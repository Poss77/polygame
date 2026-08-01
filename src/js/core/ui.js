import { syncProfileWithDb } from './db-sync.js';
import { TOKEN_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS, TOKEN_1FLR_CONTRACT_ADDRESS, WALLETCONNECT_PROJECT_ID, web3Provider, realSigner, setWeb3Provider, setRealSigner } from './config.js';
// WalletConnect is loaded dynamically inside connectWeb3() to prevent
// the esm.sh CDN fetch from crashing the entire module chain on mobile.
import { sfx } from './audio.js';
import { appState } from './state.js';
import { getOwnedNftsFromChain } from '../features/roshambo.js';

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
  const currentUrl = window.location.href.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const targetUrl = `https://metamask.app.link/dapp/${currentUrl}`;
  triggerToast("Opening MetaMask App...", "success");

  try {
    window.location.href = targetUrl;
  } catch (e) {
    console.warn("Direct deep link navigation blocked:", e);
  }

  // Floating fallback button on mobile if auto-redirect is delayed or blocked by browser
  setTimeout(() => {
    if (document.visibilityState === 'visible') {
      const old = document.getElementById('mm-deeplink-fallback-btn');
      if (old) old.remove();

      const fallbackBtn = document.createElement('a');
      fallbackBtn.href = targetUrl;
      fallbackBtn.target = '_blank';
      fallbackBtn.rel = 'noopener noreferrer';
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

  if (appState && appState.state && appState.state.walletConnected && appState.state.walletAddress) {
    if (modalTitle) modalTitle.innerText = "Wallet Integrated";
    if (selectState) selectState.style.display = 'none';
    if (connectedState) {
      connectedState.style.display = 'block';
      const addrEl = document.getElementById('wallet-addr-full');
      if (addrEl) addrEl.innerText = appState.state.walletAddress;

      const btnLinkGoogleModal = document.getElementById('btn-link-google-action');
      if (btnLinkGoogleModal) {
        if (!appState.state.authUserEmail && !appState.state.authUserId) {
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

export function openModal(modalId) {
  sfx.init();
  const overlay = document.getElementById(`modal-${modalId}`);
  if (overlay) {
    overlay.classList.add('active');
    overlay.style.pointerEvents = 'all';
  }

  if (modalId === 'wallet') {
    resetWalletModalUI();
  }

  if (modalId === 'withdraw') {
    const label = document.getElementById('withdraw-available-label');
    if (label) label.innerText = `${appState.state.balancePgt.toFixed(2)} PGT`;
    const input = document.getElementById('withdraw-input-amount');
    if (input) input.value = Math.min(100, Math.floor(appState.state.balancePgt));
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

// Global Direct JSON-RPC Helpers for Mobile & Desktop
export async function getDirectPolygonPOLBalance(address) {
  if (!address || !address.startsWith('0x')) return 0.0;
  const rpcs = [
    "https://polygon-bor-rpc.publicnode.com",
    "https://1rpc.io/matic",
    "https://rpc.ankr.com/polygon",
    "https://polygon-rpc.com"
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
  if (!address || !address.startsWith('0x')) return 0.0;
  const pgtAddress = TOKEN_CONTRACT_ADDRESS || "0x701100D19b1a93672cfe7291EA455b4220631209";
  const cleanAddr = address.toLowerCase().replace('0x', '').padStart(64, '0');
  const dataHex = '0x70a08231' + cleanAddr; // balanceOf(address)
  
  const rpcs = [
    "https://polygon-bor-rpc.publicnode.com",
    "https://1rpc.io/matic",
    "https://rpc.ankr.com/polygon",
    "https://polygon-rpc.com"
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

// Connect real wallet via MetaMask or WalletConnect
export async function connectWeb3(isAutoConnect = false, forceWalletConnect = false) {
    if (typeof ethers === 'undefined') {
      if (!isAutoConnect) triggerToast("Web3 tools not loaded!", "error");
      return;
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
  
    try {
      let providerToUse = null;

      // 1. Injected Provider Path (MetaMask Extension or MetaMask Mobile Browser)
      if (typeof window.ethereum !== 'undefined' && !forceWalletConnect) {
        let injected = window.ethereum;
        if (window.ethereum.providers && window.ethereum.providers.length > 0) {
          injected = window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum.providers[0];
        }

        try {
          const methodToUse = isAutoConnect ? 'eth_accounts' : 'eth_requestAccounts';
          let accounts = [];
          try {
            if (injected.request) {
              accounts = await injected.request({ method: methodToUse });
            } else if (typeof injected.enable === 'function') {
              accounts = await injected.enable();
            }
          } catch (rErr) {
            if (!isAutoConnect && typeof injected.enable === 'function') {
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
          console.warn("Injected wallet request failed. Falling back to WalletConnect modal...", reqErr);
          triggerToast("Injected wallet request blocked or cancelled. Opening WalletConnect...", "info");
          return connectWeb3(false, true);
        }
      } 
      // 2. WalletConnect Path (For Chrome Mobile / External Wallets / Explicit WalletConnect)
      else {
        // If user tapped "MetaMask (In-Browser / Extension)" on Chrome Mobile where window.ethereum is undefined
        if (!forceWalletConnect && typeof window.ethereum === 'undefined') {
          triggerToast("MetaMask extension not found in Chrome. Opening WalletConnect...", "info");
          return connectWeb3(false, true);
        }

        // Close our modal overlay immediately so it doesn't obstruct WalletConnect's UI
        closeModal('wallet');
        triggerToast("Initializing WalletConnect...", "info");

        let EthereumProvider;
        try {
          const wcModule = await import('https://esm.sh/@walletconnect/ethereum-provider@2.17.0');
          EthereumProvider = wcModule.EthereumProvider || wcModule.default || wcModule;
        } catch (importErr) {
          console.error("Failed to load WalletConnect module:", importErr);
          triggerToast("Failed to load WalletConnect module. Opening MetaMask App instead...", "error");
          openMetaMaskMobileDeepLink();
          return;
        }

        const ProviderClass = (EthereumProvider && EthereumProvider.EthereumProvider) || (EthereumProvider && EthereumProvider.default) || EthereumProvider;
        
        if (!ProviderClass || typeof ProviderClass.init !== 'function') {
          throw new Error("WalletConnect module not ready.");
        }

        // Clean disconnect previous provider if stale session exists
        if (window.globalWCProvider) {
          try {
            if (window.globalWCProvider.session) {
              await window.globalWCProvider.disconnect();
            }
          } catch (e) {}
          window.globalWCProvider = null;
        }

        // Clean stale pairing keys BEFORE initializing provider
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith('wc@2:') || k.startsWith('WALLET_CONNECT')) {
              localStorage.removeItem(k);
            }
          });
        } catch (e) {}

        const wcProvider = await ProviderClass.init({
          projectId: WALLETCONNECT_PROJECT_ID || '00950c9a536e980dd84dbc015411baa7',
          showQrModal: true,
          chains: [137], // Polygon Mainnet
          optionalChains: [137],
          rpcMap: {
            137: 'https://polygon-bor-rpc.publicnode.com'
          },
          metadata: {
            name: 'PolyGame',
            description: 'Play-to-Earn Crypto Gaming Portal',
            url: window.location.origin || 'https://polygongaming.io',
            icons: ['https://polygongaming.io/favicon.ico']
          }
        });
        window.globalWCProvider = wcProvider;
        
        if (!wcProvider || typeof wcProvider.connect !== 'function') {
          window.globalWCProvider = null;
          throw new Error("Failed to initialize WalletConnect.");
        }

        try {
          await wcProvider.connect();
          providerToUse = wcProvider;
        } catch (connErr) {
          window.globalWCProvider = null;
          const msg = (connErr && connErr.message) ? connErr.message : String(connErr);

          if (msg.includes('Connection request reset') || msg.includes('reset')) {
            console.warn("WalletConnect modal reset caught on mobile. Purging pairing keys and auto-retrying...");
            try {
              Object.keys(localStorage).forEach(k => {
                if (k.startsWith('wc@2:') || k.startsWith('WALLET_CONNECT')) {
                  localStorage.removeItem(k);
                }
              });
            } catch (e) {}

            const freshProvider = await ProviderClass.init({
              projectId: WALLETCONNECT_PROJECT_ID || '00950c9a536e980dd84dbc015411baa7',
              showQrModal: true,
              chains: [137],
              optionalChains: [137],
              rpcMap: { 137: 'https://polygon-bor-rpc.publicnode.com' },
              metadata: {
                name: 'PolyGame',
                description: 'Play-to-Earn Crypto Gaming Portal',
                url: window.location.origin || 'https://polygongaming.io',
                icons: ['https://polygongaming.io/favicon.ico']
              }
            });
            window.globalWCProvider = freshProvider;
            await freshProvider.connect();
            providerToUse = freshProvider;
          } else if (msg.includes('User rejected') || msg.includes('closed') || msg.includes('Modal closed')) {
            triggerToast("WalletConnect modal closed.", "info");
            return;
          } else {
            throw connErr;
          }
        }
      }

      // Auto-switch wallet to Polygon Mainnet (Chain 137 / 0x89) for injected window.ethereum
      if (providerToUse === window.ethereum && providerToUse.request) {
        try {
          const chainId = await providerToUse.request({ method: 'eth_chainId' });
          if (chainId !== '0x89' && chainId !== '137') {
            try {
              await providerToUse.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x89' }]
              });
            } catch (switchError) {
              if (switchError && (switchError.code === 4902 || switchError.code === -32603)) {
                await providerToUse.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: '0x89',
                    chainName: 'Polygon Mainnet',
                    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                    rpcUrls: ['https://polygon-bor-rpc.publicnode.com'],
                    blockExplorerUrls: ['https://polygonscan.com/']
                  }]
                });
              }
            }
          }
        } catch (err) {
          console.warn("Polygon network switch error on mobile:", err);
        }
      }

      setWeb3Provider(new ethers.BrowserProvider(providerToUse));

      let address = null;
      if (providerToUse.accounts && providerToUse.accounts.length > 0) {
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

      if (!address) {
        throw new Error("Unable to retrieve account address from connected wallet.");
      }

      address = address.toLowerCase();

      if (modalTitle) modalTitle.innerText = "Connecting Ledger...";
      if (!isAutoConnect) triggerToast("Reading token balances...", "success");

      // Fetch POL (native MATIC) balance with direct JSON-RPC fallback
      let maticBalance = 0;
      try {
        if (web3Provider) {
          const maticBalWei = await web3Provider.getBalance(address);
          maticBalance = parseFloat(ethers.formatEther(maticBalWei));
        }
      } catch (err) {
        console.warn("web3Provider POL fetch failed, trying direct JSON-RPC...", err);
      }

      if (maticBalance === 0) {
        maticBalance = await getDirectPolygonPOLBalance(address);
      }

      // Fetch PGT token balance with direct JSON-RPC fallback
      let pgtBalance = 0;
      const pgtAddress = TOKEN_CONTRACT_ADDRESS || "0x701100D19b1a93672cfe7291EA455b4220631209";

      try {
        if (web3Provider && pgtAddress.length === 42) {
          const tokenContract = new ethers.Contract(pgtAddress, [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
          ], web3Provider);
          const decimals = await tokenContract.decimals();
          const balance = await tokenContract.balanceOf(address);
          pgtBalance = parseFloat(ethers.formatUnits(balance, decimals));
        }
      } catch (err) {
        console.warn("web3Provider PGT fetch failed, trying direct JSON-RPC...", err);
      }

      if (pgtBalance === 0) {
        pgtBalance = await getDirectPolygonPGTBalance(address);
      }

      // Fetch real 1FLR balance if address is populated
      let flrBalance = (appState && appState.state) ? (appState.state.balance1flr || 0) : 0;
      if (TOKEN_1FLR_CONTRACT_ADDRESS && TOKEN_1FLR_CONTRACT_ADDRESS.startsWith("0x") && TOKEN_1FLR_CONTRACT_ADDRESS.length === 42) {
        try {
          const flrContract = new ethers.Contract(TOKEN_1FLR_CONTRACT_ADDRESS, [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
          ], web3Provider);
          const decimals = await flrContract.decimals();
          const balance = await flrContract.balanceOf(address);
          flrBalance = parseFloat(ethers.formatUnits(balance, decimals));
        } catch (err) {
          console.error("Failed to fetch 1FLR balance:", err);
        }
      }

      // Fetch real NFTs if address is populated
      let chainNfts = null;
      if (NFT_CONTRACT_ADDRESS && NFT_CONTRACT_ADDRESS.startsWith("0x") && NFT_CONTRACT_ADDRESS.length === 42) {
        try {
          chainNfts = await getOwnedNftsFromChain(address);
        } catch (err) {
          console.error("Failed to fetch owned NFTs on connection:", err);
        }
      }

      await syncProfileWithDb(address, pgtBalance, flrBalance, maticBalance, chainNfts, isAutoConnect);

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
