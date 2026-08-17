import { syncProfileWithDb } from './db-sync.js';
import { TOKEN_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS, TOKEN_1FLR_CONTRACT_ADDRESS, WALLETCONNECT_PROJECT_ID, web3Provider, realSigner, setWeb3Provider, setRealSigner } from './config.js';
// WalletConnect is loaded dynamically inside connectWeb3() to prevent
// the esm.sh CDN fetch from crashing the entire module chain on mobile.
import { sfx } from './audio.js';
import { appState } from './state.js';
import { getOwnedNftsFromChain } from '../features/nft.js';

const getAppState = () => (typeof appState !== 'undefined' && appState && appState.state) ? appState : (typeof window !== 'undefined' && window.appState && window.appState.state ? window.appState : null);

// --- Notification Toast Manager ---

export function triggerToast(message, type = 'success') {
  const container = document.getElementById('notification-stack');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `notification ${type}`;
  toast.innerHTML = `
    <span class="notification-content">${message}</span>
    <button class="btn-notification-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);
  
  // Audio feedback
  if (type === 'success') {
    sfx.playSuccess();
  } else {
    sfx.playError();
  }

  // Self destroy
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 4000);
}

export function openMetaMaskMobileDeepLink() {
  const rawUrl = window.location.href.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const isAndroid = /Android/i.test(navigator.userAgent);
  const universalUrl = `https://metamask.app.link/dapp/${rawUrl}`;
  const androidIntentUrl = `intent://dapp/${rawUrl}#Intent;scheme=metamask;package=io.metamask;end;`;
  
  triggerToast("Opening MetaMask App...", "success");

  try {
    if (isAndroid) {
      // Android Native Intent directly targets io.metamask package, bypassing Chrome activity picker loop
      window.location.href = androidIntentUrl;
    } else {
      // iOS / Universal Link
      window.location.href = universalUrl;
    }
  } catch (e) {
    console.warn("Direct deep link navigation failed:", e);
    window.location.href = universalUrl;
  }

  // Floating fallback button on mobile if auto-redirect is delayed or blocked by browser
  setTimeout(() => {
    if (document.visibilityState === 'visible') {
      const old = document.getElementById('mm-deeplink-fallback-btn');
      if (old) old.remove();

      const fallbackBtn = document.createElement('a');
      fallbackBtn.href = isAndroid ? androidIntentUrl : universalUrl;
      fallbackBtn.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:999999; background:linear-gradient(135deg, #ff8800, #ff5500); color:#ffffff; font-weight:900; padding:14px 28px; border-radius:30px; box-shadow:0 0 20px rgba(255,136,0,0.7); text-decoration:none; font-size:15px; text-align:center; border: 2px solid #ffffff; cursor:pointer; animation: pulse 2s infinite;';
      fallbackBtn.innerText = '🦊 Tap Here to Open MetaMask App';
      fallbackBtn.id = 'mm-deeplink-fallback-btn';
      
      document.body.appendChild(fallbackBtn);

      setTimeout(() => {
        if (fallbackBtn.parentElement) fallbackBtn.remove();
      }, 12000);
    }
  }, 800);
}
window.openMetaMaskMobileDeepLink = openMetaMaskMobileDeepLink;

export function resetWalletModalUI() {
  const tempLoader = document.getElementById('modal-loader-real-web3');
  if (tempLoader) tempLoader.remove();

  const selectState = document.getElementById('wallet-select-state');
  const connectedState = document.getElementById('wallet-connected-state');
  const modalTitle = document.getElementById('wallet-modal-title');

  const activeSt = getAppState();
  const isGoogle = activeSt && activeSt.state && (activeSt.state.authUserEmail || activeSt.state.authUserId);
  const isWeb3 = activeSt && activeSt.state && activeSt.state.walletConnected && window.realSigner;

  if (isGoogle || isWeb3) {
    if (modalTitle) modalTitle.innerText = isWeb3 ? "Wallet Integrated" : "Account Manager";
    if (selectState) selectState.style.display = 'none';
    if (connectedState) {
      connectedState.style.display = 'block';
      const addrEl = document.getElementById('wallet-addr-full');
      if (addrEl) {
        if (isGoogle) {
          const email = activeSt.state.authUserEmail || 'Connected';
          const linkedW = activeSt.state.linkedWalletAddress;
          const isInternal = (a) => !a || a.startsWith('0xpgt') || a.startsWith('0xg');
          const hasLinked = linkedW && !isInternal(linkedW) && linkedW.length >= 42;

          addrEl.innerHTML = `
            <div style="color: var(--color-success); font-weight: 700; font-size: 1.05rem;">Connected with Google</div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${email}</div>
            ${hasLinked ? `<div style="font-size: 0.75rem; color: var(--color-accent); margin-top: 0.4rem; font-family: monospace;">Linked Wallet: ${linkedW.substring(0, 6)}...${linkedW.substring(linkedW.length - 4)}</div>` : '<div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.4rem;">No Web3 Wallet Connected</div>'}
          `;
        } else {
          addrEl.innerText = activeSt.state.walletAddress;
        }
      }

      const btnLinkGoogleModal = document.getElementById('btn-link-google-action');
      if (btnLinkGoogleModal) {
        if (!activeSt.state.authUserEmail && !activeSt.state.authUserId) {
          btnLinkGoogleModal.style.display = 'block';
        } else {
          btnLinkGoogleModal.style.display = 'none';
        }
      }
    }
  } else {
    if (modalTitle) modalTitle.innerText = "Connect Crypto Wallet";
    if (connectedState) connectedState.style.display = 'none';
    if (selectState) selectState.style.display = 'block';

    // Highlight or adapt option cards based on whether window.ethereum is present
    const injectedOpt = document.getElementById('wallet-opt-injected');
    const appOpt = document.getElementById('wallet-opt-metamask-app');
    const hasInjected = typeof window.ethereum !== 'undefined';

    if (injectedOpt) {
      injectedOpt.style.display = hasInjected ? 'flex' : 'flex';
    }
    if (appOpt) {
      appOpt.style.display = hasInjected ? 'none' : 'flex';
    }
  }
}
window.resetWalletModalUI = resetWalletModalUI;

export function preloadWalletConnect() {
  if (window._wcPreloaded || window.globalWCProvider) return;
  window._wcPreloaded = true;
  import('https://esm.sh/@walletconnect/ethereum-provider@2.17.0')
    .then((m) => {
      console.log("[WalletConnect] Module pre-cached successfully.");
      const exp = (m && (m.EthereumProvider || m.default)) || m;
      if (exp) window.WalletConnectEthereumProvider = exp;
    })
    .catch(() => {});
}
if (typeof window !== 'undefined') {
  window.preloadWalletConnect = preloadWalletConnect;
}

export function openModal(modalId) {
  sfx.init();
  const overlay = document.getElementById(`modal-${modalId}`);
  if (overlay) {
    overlay.classList.add('active');
    overlay.style.pointerEvents = 'all';
  }

  if (modalId === 'wallet') {
    localStorage.removeItem('polygame_user_logged_out');
    resetWalletModalUI();
    preloadWalletConnect();
    const noticeEl = document.getElementById('mobile-browser-web3-notice');
    if (noticeEl) {
      const isMobileExternal = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.ethereum;
      noticeEl.style.display = isMobileExternal ? 'block' : 'none';
    }
  }

  if (modalId === 'withdraw') {
    if (typeof window.syncWithdrawModalUI === 'function') {
      window.syncWithdrawModalUI();
    } else {
      const label = document.getElementById('withdraw-available-label');
      if (label) label.innerText = `${appState.state.balancePgt.toFixed(2)} PGT`;
      const input = document.getElementById('withdraw-input-amount');
      if (input) input.value = Math.min(100, Math.floor(appState.state.balancePgt));
    }
  }
}
window.openModal = openModal;

export function openInfoModal(type) {
  const title = document.getElementById('info-modal-title');
  const body = document.getElementById('info-modal-body');
  
  if (!title || !body) return;
  
  if (type === 'privacy') {
    title.innerText = 'Privacy Policy';
    body.innerHTML = `
      <h4 style="color: var(--color-primary); margin-bottom: 0.5rem;">Data Collection</h4>
      <p style="margin-bottom: 1rem;">We only store your wallet address and minimal on-site progression data (highscores, referrals, balances) required for PolyGame mechanics to function.</p>
      <h4 style="color: var(--color-primary); margin-bottom: 0.5rem;">Web3 Privacy</h4>
      <p style="margin-bottom: 1rem;">Because we use Web3 authentication, no passwords, emails, or personal identification data are collected or required to play.</p>
    `;
  } else if (type === 'terms') {
    title.innerText = 'Terms & Conditions';
    body.innerHTML = `
      <h4 style="color: var(--color-accent); margin-bottom: 0.5rem;">Fair Play Policy</h4>
      <p style="margin-bottom: 1rem; color: white; font-weight: 700;">Strictly 1 Account Per Person.</p>
      <p style="margin-bottom: 1rem;">We monitor all faucet claims, referral trees, and game metrics. If we detect IP farming, sybil attacks, or multiple accounts attempting to farm PGT or exploit referrals, your IP and associated wallet addresses will be permanently banned.</p>
      
      <h4 style="color: var(--color-accent); margin-bottom: 0.5rem;">Account & Game Rules</h4>
      <ul style="margin-left: 1.25rem; margin-bottom: 1rem; list-style-type: disc;">
        <li style="margin-bottom: 0.5rem;">Accounts can be deleted after 12 months of inactivity.</li>
        <li style="margin-bottom: 0.5rem;">Mini-game payouts can be changed at any time without notice.</li>
      </ul>

      <h4 style="color: var(--color-accent); margin-bottom: 0.5rem;">Risk Acknowledgment</h4>
      <p>PolyGame is a Web3 Arcade. By interacting with the smart contracts and PolyGame tokens, you acknowledge the experimental nature of Web3 technology.</p>
    `;
  } else if (type === 'tokenomics') {
    title.innerText = 'Tokenomics & Distribution';
    body.innerHTML = `
      <h4 style="color: var(--color-warning); margin-bottom: 0.5rem;">PolyGame Token (PGT)</h4>
      <p style="margin-bottom: 1rem;">PGT is the utility, reward, and governance token of the Polygon Gaming ecosystem. Total Max Supply: <strong>1,000,000,000 PGT (1 Billion Tokens)</strong>.</p>
      
      <h5 style="color: var(--color-accent); margin-top: 1rem; margin-bottom: 0.75rem;">📊 Official Token Distribution</h5>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; background: rgba(0, 240, 255, 0.05); border: 1px solid var(--border-cyan); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 0.4rem;">
          <span>🎮 <strong>Player Rewards & Gameplay</strong></span>
          <strong style="color: var(--color-success); font-size: 1.05rem;">70% (700M PGT)</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 0.4rem;">
          <span>📣 <strong>Publicity & Marketing</strong></span>
          <strong style="color: var(--color-accent); font-size: 1.05rem;">10% (100M PGT)</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 0.4rem;">
          <span>💻 <strong>Developer & Ecosystem</strong></span>
          <strong style="color: var(--color-warning); font-size: 1.05rem;">10% (100M PGT)</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>💧 <strong>Liquidity Pool</strong></span>
          <strong style="color: #ff00ff; font-size: 1.05rem;">10% (100M PGT)</strong>
        </div>
      </div>

      <ul style="margin-left: 1rem; margin-bottom: 1rem; list-style-type: disc;">
        <li style="margin-bottom: 0.5rem;"><strong>Utility:</strong> Used for all Arcade Game wagers, PolySpace mining expeditions, purchasing NFTs, and high-yield APY staking.</li>
        <li style="margin-bottom: 0.5rem;"><strong>Deflationary:</strong> 100% of PGT spent on Utility NFTs is permanently burned from supply.</li>
        <li style="margin-bottom: 0.5rem;"><strong>Fair Distribution:</strong> 70% of total token supply is distributed directly to players via hourly faucets, arcade wins, and space mining!</li>
      </ul>

      <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-cyan); border-radius: 6px; padding: 0.75rem; font-size: 0.85rem; word-break: break-all;">
        <div style="color: var(--text-dim); margin-bottom: 0.25rem;">⚡ Polygon Smart Contract Address:</div>
        <a href="https://polygonscan.com/token/0x701100D19b1a93672cfe7291EA455b4220631209" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); font-family: monospace; font-weight: 700; text-decoration: underline;">
          0x701100D19b1a93672cfe7291EA455b4220631209
        </a>
      </div>
    `;
  }
  
  openModal('info');
}
window.openInfoModal = openInfoModal;

export function closeModal(modalId) {
  if (modalId) {
    const overlay = document.getElementById(`modal-${modalId}`);
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.pointerEvents = 'none';
    }
  } else {
    // Only sweep unactive modal overlays if no specific modal ID passed
    document.querySelectorAll('.modal-overlay:not(.active)').forEach(el => {
      el.style.pointerEvents = 'none';
    });
  }
}
window.closeModal = closeModal;

const isRealEvmAddress = (addr) => addr && typeof addr === 'string' && !addr.startsWith('0xpgt') && !addr.startsWith('0xg') && /^0x[a-fA-F0-9]{40}$/.test(addr);

// Global Direct JSON-RPC Helpers for Mobile & Desktop
export async function getDirectPolygonPOLBalance(address) {
  if (!isRealEvmAddress(address)) return 0.0;
  const rpcs = [
    "https://polygon-bor-rpc.publicnode.com",
    "https://rpc.ankr.com/polygon",
    "https://polygon.drpc.org",
    "https://polygon-mainnet.public.blastapi.io"
  ];
  for (const rpcUrl of rpcs) {
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address.toLowerCase(), 'latest'],
          id: 1
        })
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data && data.result) {
        const wei = BigInt(data.result);
        return parseFloat(ethers.formatEther(wei));
      }
    } catch (rpcErr) {
      console.warn(`Direct JSON-RPC ${rpcUrl} POL fetch failed:`, rpcErr);
    }
  }
  return 0.0;
}
window.getDirectPolygonPOLBalance = getDirectPolygonPOLBalance;

export async function getDirectPolygonPGTBalance(address) {
  if (!isRealEvmAddress(address)) return 0.0;
  const pgtAddress = TOKEN_CONTRACT_ADDRESS || "0x701100D19b1a93672cfe7291EA455b4220631209";
  const cleanAddr = address.toLowerCase().replace('0x', '').padStart(64, '0');
  const dataHex = '0x70a08231' + cleanAddr; // balanceOf(address)
  
  const rpcs = [
    "https://polygon-bor-rpc.publicnode.com",
    "https://rpc.ankr.com/polygon",
    "https://polygon.drpc.org",
    "https://polygon-mainnet.public.blastapi.io"
  ];
  for (const rpcUrl of rpcs) {
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: pgtAddress, data: dataHex }, 'latest'],
          id: 1
        })
      });
      if (!resp.ok) continue;
      const resData = await resp.json();
      if (resData && resData.result && resData.result !== '0x') {
        const wei = BigInt(resData.result);
        return parseFloat(ethers.formatUnits(wei, 18));
      }
    } catch (rpcErr) {
      console.warn(`Direct JSON-RPC ${rpcUrl} PGT fetch failed:`, rpcErr);
    }
  }
  return 0.0;
}
window.getDirectPolygonPGTBalance = getDirectPolygonPGTBalance;

export async function getDirectPolygon1FLRBalance(address) {
  if (!isRealEvmAddress(address)) return 0.0;
  const flrAddress = TOKEN_1FLR_CONTRACT_ADDRESS || "0x5f0197Ba06860DaC7e31258BdF749F92b6a636d4";
  if (!flrAddress || flrAddress.length !== 42) return 0.0;
  const cleanAddr = address.toLowerCase().replace('0x', '').padStart(64, '0');
  const dataHex = '0x70a08231' + cleanAddr; // balanceOf(address)
  
  const rpcs = [
    "https://polygon-bor-rpc.publicnode.com",
    "https://rpc.ankr.com/polygon",
    "https://polygon.drpc.org",
    "https://polygon-mainnet.public.blastapi.io"
  ];
  for (const rpcUrl of rpcs) {
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: flrAddress, data: dataHex }, 'latest'],
          id: 1
        })
      });
      if (!resp.ok) continue;
      const resData = await resp.json();
      if (resData && resData.result && resData.result !== '0x') {
        const wei = BigInt(resData.result);
        return parseFloat(ethers.formatUnits(wei, 18));
      }
    } catch (rpcErr) {
      console.warn(`Direct JSON-RPC ${rpcUrl} 1FLR fetch failed:`, rpcErr);
    }
  }
  return 0.0;
}
window.getDirectPolygon1FLRBalance = getDirectPolygon1FLRBalance;

// Connect real wallet via MetaMask or WalletConnect
export async function connectWeb3(isAutoConnect = false, forceWalletConnect = false) {
    if (typeof ethers === 'undefined') {
      if (!isAutoConnect) triggerToast("Web3 tools not loaded!", "error");
      return;
    }

    if (window._isConnectingWeb3) {
      console.log("[connectWeb3] Connection request already in progress. Ignoring duplicate call.");
      return;
    }
    window._isConnectingWeb3 = true;

    try {
      if (isAutoConnect && localStorage.getItem('polygame_user_logged_out') === 'true') {
        console.log("[connectWeb3] Auto-connect skipped because user explicitly logged out.");
        return;
      }
      if (!isAutoConnect) {
        localStorage.removeItem('polygame_user_logged_out');
      }
    
      const selectState = document.getElementById('wallet-select-state');
      const connectedState = document.getElementById('wallet-connected-state');
      const modalTitle = document.getElementById('wallet-modal-title');

      // Clean any existing loader first
      const existingLoader = document.getElementById('modal-loader-real-web3');
      if (existingLoader) existingLoader.remove();

      // Close wallet modal overlay immediately so native popup stream opens cleanly without backdrop conflicts
      if (!isAutoConnect) {
        closeModal('wallet');
      }
    
      let providerToUse = null;
      let primaryAddress = null;

      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isMetaMaskAppBrowser = typeof window.ethereum !== 'undefined' && (window.ethereum.isMetaMask || navigator.userAgent.includes('MetaMask'));

      // 1. Injected Provider Path (Desktop Extensions & MetaMask Mobile App Browser ONLY)
      if (typeof window.ethereum !== 'undefined' && !forceWalletConnect && (!isMobileDevice || isMetaMaskAppBrowser)) {
        let injected = window.ethereum;
        if (window.ethereum.providers && window.ethereum.providers.length > 0) {
          injected = window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum.providers[0];
        }

        try {
          const methodToUse = isAutoConnect ? 'eth_accounts' : 'eth_requestAccounts';
          let accounts = [];
          
          // Wrap request in a timeout Promise.race to prevent mobile browser hang when extension/app doesn't respond
          const requestPromise = (injected.request)
            ? injected.request({ method: methodToUse })
            : (typeof injected.enable === 'function' ? injected.enable() : Promise.reject("Provider enable missing"));

          const timeoutMs = isAutoConnect ? 4000 : 10000;
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error("Wallet connection timed out after 10 seconds."));
            }, timeoutMs);
          });

          try {
            accounts = await Promise.race([requestPromise, timeoutPromise]);
          } catch (rErr) {
            if (!isAutoConnect && typeof injected.enable === 'function' && !rErr.message?.includes('timed out')) {
              accounts = await injected.enable();
            } else {
              throw rErr;
            }
          }

          if (isAutoConnect && (!accounts || accounts.length === 0)) {
            resetWalletModalUI();
            return;
          }
          providerToUse = injected;
          if (accounts && accounts.length > 0) primaryAddress = accounts[0];
        } catch (reqErr) {
          if (isAutoConnect) {
            resetWalletModalUI();
            return;
          }
          const errMsg = (reqErr && reqErr.message) ? reqErr.message.toLowerCase() : '';
          const errCode = reqErr ? reqErr.code : null;
          if (errCode === -32002 || errMsg.includes('already pending')) {
            triggerToast("Wallet request pending! Please check your wallet window/app to approve.", "error");
            throw new Error("Connection request pending.");
          }
          
          // Mobile browser / Brave Shields fallback to WalletConnect modal
          console.warn("Injected wallet request failed or timed out. Falling back to WalletConnect modal...", reqErr);
          triggerToast("Opening WalletConnect modal...", "info");
          window._isConnectingWeb3 = false;
          return connectWeb3(false, true);
        }
      } 
      // 2. WalletConnect Path (For Chrome Mobile / External Wallets / Explicit WalletConnect)
      else {
        // If user tapped "MetaMask (In-Browser / Extension)" on Chrome Mobile where window.ethereum is undefined
        if (!forceWalletConnect && typeof window.ethereum === 'undefined') {
          triggerToast("Opening WalletConnect modal...", "info");
          window._isConnectingWeb3 = false;
          return connectWeb3(false, true);
        }

        closeModal('wallet');
        triggerToast("Initializing WalletConnect...", "info");

        let ProviderClass = window.WalletConnectEthereumProvider || window.EthereumProvider;
        if (ProviderClass && ProviderClass.EthereumProvider) ProviderClass = ProviderClass.EthereumProvider;
        if (ProviderClass && ProviderClass.default) ProviderClass = ProviderClass.default;

        if (!ProviderClass || typeof ProviderClass.init !== 'function') {
          const cdnUrls = [
            'https://esm.sh/@walletconnect/ethereum-provider@2.17.0',
            'https://esm.sh/@walletconnect/ethereum-provider@2.23.10?bundle'
          ];

          for (const url of cdnUrls) {
            try {
              const wcModule = await import(url);
              const exp = (wcModule && (wcModule.EthereumProvider || wcModule.default)) || wcModule;
              if (exp && typeof exp.init === 'function') {
                ProviderClass = exp;
                window.WalletConnectEthereumProvider = exp;
                break;
              }
            } catch (importErr) {
              console.warn(`[WalletConnect] Failed loading from ${url}:`, importErr);
            }
          }
        }
        
        if (!ProviderClass || typeof ProviderClass.init !== 'function') {
          console.error("WalletConnect module could not be initialized.");
          triggerToast("Unable to load WalletConnect. Please check your connection and try again.", "error");
          resetWalletModalUI();
          return;
        }

        // Use existing active provider session if already connected
        if (window.globalWCProvider && window.globalWCProvider.session) {
          providerToUse = window.globalWCProvider;
        } else {
          if (window.globalWCProvider) {
            try {
              await window.globalWCProvider.disconnect();
            } catch (e) {}
            window.globalWCProvider = null;
          }

          const activeProjectId = (typeof WALLETCONNECT_PROJECT_ID !== 'undefined' && WALLETCONNECT_PROJECT_ID) 
            ? WALLETCONNECT_PROJECT_ID 
            : '00950c9a536e980dd84dbc015411baa7';

          const wcInitConfig = {
            projectId: activeProjectId,
            showQrModal: true,
            chains: [137], // Polygon Mainnet
            optionalChains: [137, 1],
            rpcMap: {
              137: 'https://polygon-bor-rpc.publicnode.com',
              1: 'https://ethereum-rpc.publicnode.com'
            },
            metadata: {
              name: 'PolyGame',
              description: 'Play-to-Earn Web3 Arcade Gaming Portal',
              url: typeof window !== 'undefined' ? window.location.origin : 'https://polygongaming.io',
              icons: [(typeof window !== 'undefined' ? window.location.origin : 'https://polygongaming.io') + '/src/assets/logo.svg']
            },
            qrModalOptions: {
              themeMode: 'dark'
            }
          };

          const wcProvider = await ProviderClass.init(wcInitConfig);
          window.globalWCProvider = wcProvider;

          if (!wcProvider || typeof wcProvider.connect !== 'function') {
            window.globalWCProvider = null;
            triggerToast("Failed to initialize WalletConnect.", "error");
            resetWalletModalUI();
            return;
          }

          try {
            await wcProvider.connect();
            providerToUse = wcProvider;
          } catch (connErr) {
            window.globalWCProvider = null;
            resetWalletModalUI();
            const msg = (connErr && connErr.message) ? connErr.message : String(connErr);
            console.log("[WalletConnect] Connection request ended:", msg);
            triggerToast("WalletConnect connection cancelled.", "info");
            return;
          }
        }
      }

      setWeb3Provider(new ethers.BrowserProvider(providerToUse));

      let address = primaryAddress;
      if (!address && providerToUse.accounts && providerToUse.accounts.length > 0) {
        address = providerToUse.accounts[0];
      }

      if (!address && providerToUse.request) {
        try {
          const accs = await providerToUse.request({ method: 'eth_accounts' });
          if (accs && accs.length > 0) address = accs[0];
        } catch (e) {}
      }

      try {
        const signer = await web3Provider.getSigner();
        if (signer) {
          setRealSigner(signer);
          if (!address) address = await signer.getAddress();
        }
      } catch (signerErr) {
        console.warn("web3Provider.getSigner() warning, falling back to direct address:", signerErr);
      }

      if (!address || !isRealEvmAddress(address)) {
        throw new Error("Unable to retrieve a valid Web3 wallet address from provider.");
      }

      address = address.toLowerCase();

      // Persist state immediately before network switch or RPC network calls
      const activeSt = getAppState();
      if (activeSt && activeSt.state) {
        activeSt.state.walletConnected = true;
        activeSt.state.walletProvider = 'metamask';
        activeSt.state.walletAddress = address;
        activeSt.state.linkedWalletAddress = address;
        if (typeof activeSt.save === 'function') activeSt.save();
      }

      // Auto-switch wallet to Polygon Mainnet (Chain 137 / 0x89) for injected window.ethereum
      if (providerToUse === window.ethereum && providerToUse.request) {
        try {
          const chainId = await providerToUse.request({ method: 'eth_chainId' }).catch(() => null);
          if (chainId && chainId !== '0x89' && chainId !== '137') {
            try {
              await providerToUse.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x89' }]
              });
            } catch (switchError) {
              const code = switchError ? switchError.code : null;
              if (code === 4902 || code === -32603 || code === 4001) {
                try {
                  await providerToUse.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0x89',
                      chainName: 'Polygon Mainnet',
                      nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                      rpcUrls: ['https://polygon-rpc.com', 'https://1rpc.io/matic'],
                      blockExplorerUrls: ['https://polygonscan.com/']
                    }]
                  });
                } catch (addErr) {
                  console.warn("Polygon network add warning:", addErr);
                }
              }
            }
          }
        } catch (err) {
          console.warn("Polygon network switch error:", err);
        }
      }

      if (modalTitle) modalTitle.innerText = "Connecting Ledger...";
      if (!isAutoConnect) triggerToast("Reading token balances...", "success");

      // Fetch POL, PGT, 1FLR balances in parallel via fast direct JSON-RPC (<100ms)
      const [maticBalance, pgtBalance, flrBalance] = await Promise.all([
        getDirectPolygonPOLBalance(address).catch(() => 0),
        getDirectPolygonPGTBalance(address).catch(() => 0),
        getDirectPolygon1FLRBalance(address).catch(() => 0)
      ]);

      // Sync profile with DB (verifies authorization, ownership, balances, and NFTs safely)
      await syncProfileWithDb(address, pgtBalance, flrBalance, maticBalance, null, isAutoConnect);

    } catch (err) {
      console.error("Wallet connection failed:", err);
      triggerToast("Connection failed: " + (err.message || err), "error");
      
      // Dispatch real-time diagnostic telemetry to Discord Webhook
      if (typeof window.sendAdminAlert === 'function') {
        window.sendAdminAlert({
          category: 'MOBILE WALLET DIAGNOSTIC',
          title: '⚠️ Wallet Connection Failure Captured',
          description: `**Error**: \`${(err.message || String(err)).substring(0, 300)}\`\n**UserAgent**: \`${navigator.userAgent.substring(0, 150)}\`\n**ForceWC**: \`${forceWalletConnect}\`\n**Injected**: \`${typeof window.ethereum !== 'undefined'}\``,
          color: 0xFF0033
        });
      }

      resetWalletModalUI();
    } finally {
      window._isConnectingWeb3 = false;
    }
  }
window.connectWeb3 = connectWeb3;

export async function addPgtToMetaMask() {
  const tokenAddress = "0x701100D19b1a93672cfe7291EA455b4220631209";
  const tokenSymbol = 'PGT';
  const tokenDecimals = 18;
  const tokenImage = 'https://polygongaming.io/assets/logo.png';

  if (typeof window.ethereum !== 'undefined') {
    try {
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenAddress,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            image: tokenImage,
          },
        },
      });

      if (wasAdded) {
        triggerToast("🦊 PGT Token added to MetaMask wallet!", "success");
      } else {
        triggerToast("PGT token watch request cancelled.", "info");
      }
    } catch (error) {
      console.error(error);
      triggerToast("Could not add PGT to MetaMask", "error");
    }
  } else {
    triggerToast("MetaMask extension not detected in browser.", "error");
  }
}
window.addPgtToMetaMask = addPgtToMetaMask;

export async function refreshOnChainBalances() {
  const address = appState && appState.state ? appState.state.walletAddress : null;
  if (!address || !address.startsWith('0x')) return;

  try {
    const pgtBal = await getDirectPolygonPGTBalance(address);
    const polBal = await getDirectPolygonPOLBalance(address);

    appState.update({
      onchainPgtBalance: pgtBal,
      balancePol: polBal
    });

    const onchainPgtEl = document.getElementById('balance-pgt-onchain');
    if (onchainPgtEl) onchainPgtEl.innerText = pgtBal.toFixed(2);

    const polBalEl = document.getElementById('balance-pol');
    if (polBalEl) polBalEl.innerText = polBal.toFixed(4);

    const depositMaxEl = document.getElementById('deposit-available-max');
    if (depositMaxEl) depositMaxEl.innerText = `${pgtBal.toFixed(2)} PGT`;

    console.log(`On-chain balances refreshed for ${address}: ${pgtBal.toFixed(2)} PGT, ${polBal.toFixed(4)} POL`);
  } catch (err) {
    console.warn("Failed to refresh on-chain balances:", err);
  }
}
window.refreshOnChainBalances = refreshOnChainBalances;

export function showVipLockModal(gameName = 'VIP Exclusive Game') {
  const modal = document.getElementById('modal-vip-lock');
  const gameNameEl = document.getElementById('vip-lock-game-name');
  if (gameNameEl) gameNameEl.innerText = gameName;

  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  } else if (window.triggerToast) {
    window.triggerToast(`👑 VIP Pass required to access ${gameName}!`, "warning");
  }
}
window.showVipLockModal = showVipLockModal;
