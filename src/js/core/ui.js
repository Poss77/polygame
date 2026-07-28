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
  const host = window.location.host;
  const path = window.location.pathname;
  const targetUrl = `https://metamask.app.link/dapp/${host}${path}?auto_connect=true`;
  triggerToast("Opening MetaMask App...", "success");
  window.location.href = targetUrl;
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
  if (overlay) overlay.classList.add('active');

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
  const overlay = document.getElementById(`modal-${modalId}`);
  if (overlay) overlay.classList.remove('active');
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
  
    try {
      if (modalTitle) modalTitle.innerText = forceWalletConnect ? "Loading WalletConnect..." : "Awaiting Wallet...";
      
      // Hide options and inject loader
      if (selectState && !isAutoConnect) selectState.style.display = 'none';
      if (!isAutoConnect && selectState && selectState.parentElement) {
        const loader = document.createElement('div');
        loader.id = 'modal-loader-real-web3';
        loader.style.textAlign = 'center';
        loader.style.padding = '1.5rem 0';
        loader.innerHTML = `
          <div style="width:40px; height:40px; border:3px solid var(--border-cyan); border-top-color:var(--color-primary); border-radius:50%; animation:spin 1s linear infinite; margin: 0 auto 1rem auto;"></div>
          <div style="font-size:0.88rem; color:var(--text-muted); line-height: 1.4; margin-bottom: 1.25rem;">
            Awaiting connection signature.<br>
            <strong style="color: var(--color-warning);">Please check your Wallet app</strong> if the prompt did not appear.
          </div>
          <button class="btn-secondary" onclick="resetWalletModalUI()" style="padding: 0.4rem 1rem; font-size: 0.8rem; border-color: var(--border-glass);">← Choose Another Option</button>
          <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
        `;
        selectState.parentElement.appendChild(loader);
      }
  
      if (!isAutoConnect) triggerToast("Requesting wallet connection...", "success");
      
      let providerToUse = null;

      // 1. Desktop / Extension / MetaMask Mobile In-App Browser (unless WalletConnect forced)
      if (typeof window.ethereum !== 'undefined' && !forceWalletConnect) {
        // Direct eth_requestAccounts call so MetaMask Mobile bottom sheet resolves to [Connect] prompt immediately
        try {
          const accountsPromise = window.ethereum.request({ method: 'eth_requestAccounts' });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 15000)
          );
          await Promise.race([accountsPromise, timeoutPromise]);
          providerToUse = window.ethereum;
        } catch (reqErr) {
          const errMsg = (reqErr && reqErr.message) ? reqErr.message.toLowerCase() : '';
          const errCode = reqErr ? reqErr.code : null;

          if (errCode === -32002 || errMsg.includes('already pending')) {
            console.warn("eth_requestAccounts pending request (-32002).");
            triggerToast("MetaMask request already pending! Please check your MetaMask window to approve the connection.", "error");
            throw new Error("Connection request already pending in MetaMask. Please check MetaMask to approve.");
          } else if (errMsg === 'timeout') {
            console.warn("eth_requestAccounts timed out (15s). MetaMask may be unresponsive.");
            triggerToast("MetaMask is not responding. Please open MetaMask and approve the connection request, or try refreshing.", "error");
            throw new Error("Wallet request timed out. Please open MetaMask manually and approve the connection.");
          }
          throw reqErr;
        }
      } 
      // 2. Mobile WalletConnect Fallback (no injected provider)
      else {
        if (modalTitle) modalTitle.innerText = "Loading WalletConnect...";

        // Dynamic import — only fetched when actually needed, prevents CDN failures from crashing the app
        let EthereumProvider;
        try {
          const wcModule = await import('https://esm.sh/@walletconnect/ethereum-provider@2.17.0');
          EthereumProvider = wcModule.EthereumProvider || wcModule.default || wcModule;
        } catch (importErr) {
          console.error("Failed to load WalletConnect module:", importErr);
          throw new Error("Could not load WalletConnect. Please open this site inside MetaMask Mobile's browser instead.");
        }

        const ProviderClass = (EthereumProvider && EthereumProvider.EthereumProvider) || (EthereumProvider && EthereumProvider.default) || EthereumProvider;
        
        if (!ProviderClass || typeof ProviderClass.init !== 'function') {
          throw new Error("WalletConnect module not ready. Please open this site in MetaMask Mobile's browser.");
        }

        if (modalTitle) modalTitle.innerText = "Awaiting Wallet...";

        const wcProvider = await ProviderClass.init({
          projectId: WALLETCONNECT_PROJECT_ID || '00950c9a536e980dd84dbc015411baa7',
          showQrModal: true,
          chains: [137], // Polygon Mainnet
          optionalChains: [137],
          rpcMap: {
            137: 'https://polygon-rpc.com'
          },
          metadata: {
            name: 'PolyGame',
            description: 'Play-to-Earn Crypto Gaming Portal',
            url: window.location.origin || 'https://polygongaming.io',
            icons: ['https://polygongaming.io/favicon.ico']
          }
        });
        
        if (!wcProvider || typeof wcProvider.connect !== 'function') {
          throw new Error("Failed to initialize WalletConnect. Please open in MetaMask Mobile app.");
        }

        await wcProvider.connect();
        providerToUse = wcProvider;
      }

      setWeb3Provider(new ethers.BrowserProvider(providerToUse));
      setRealSigner(await web3Provider.getSigner());
      const address = await realSigner.getAddress();

      if (modalTitle) modalTitle.innerText = "Connecting Ledger...";
      if (!isAutoConnect) triggerToast("Reading token balances...", "success");

    // Auto-switch mobile wallet to Polygon Mainnet (Chain 137 / 0x89)
    if (window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== '0x89' && chainId !== '137') {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x89' }]
            });
          } catch (switchError) {
            if (switchError && switchError.code === 4902) {
              await window.ethereum.request({
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

    const POLYGON_RPC_FALLBACKS = [
      "https://polygon-bor-rpc.publicnode.com",
      "https://1rpc.io/matic",
      "https://rpc.ankr.com/polygon",
      "https://polygon-rpc.com"
    ];



    // Fetch POL (native MATIC) balance with direct JSON-RPC fallback
    let maticBalance = 0;
    try {
      if (web3Provider) {
        const maticBalWei = await web3Provider.getBalance(address);
        maticBalance = parseFloat(ethers.formatEther(maticBalWei));
      }
    } catch (err) {
      console.warn("web3Provider POL fetch failed on mobile, trying direct JSON-RPC...", err);
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
      console.warn("web3Provider PGT fetch failed on mobile, trying direct JSON-RPC...", err);
    }

    if (pgtBalance === 0) {
      pgtBalance = await getDirectPolygonPGTBalance(address);
    }

    // Fetch real 1FLR balance if address is populated
    let flrBalance = appState.state.balance1flr || 0;
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
    console.error("MetaMask connection failed:", err);
    triggerToast("Connection failed: " + (err.message || err), "error");
    
    // Remove loader
    const tempLoader = document.getElementById('modal-loader-real-web3');
    if (tempLoader) tempLoader.remove();

    // Reset state
    if (selectState) selectState.style.display = 'block';
    if (modalTitle) modalTitle.innerText = "Connect Crypto Wallet";
  }
}
window.connectWeb3 = connectWeb3;
