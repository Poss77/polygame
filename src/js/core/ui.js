import { syncProfileWithDb } from './db-sync.js';
import { TOKEN_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS, TOKEN_1FLR_CONTRACT_ADDRESS, WALLETCONNECT_PROJECT_ID, web3Provider, realSigner, setWeb3Provider, setRealSigner } from './config.js';
import { EthereumProvider } from 'https://esm.sh/@walletconnect/ethereum-provider@2.11.1';
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

// --- Web3 Modal Dialog Managers ---

export function openModal(modalId) {
  sfx.init();
  const overlay = document.getElementById(`modal-${modalId}`);
  if (overlay) overlay.classList.add('active');

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

// Connect real wallet via MetaMask
export async function connectWeb3(isAutoConnect = false) {
    if (typeof ethers === 'undefined') {
      if (!isAutoConnect) triggerToast("Web3 tools not loaded!", "error");
      return;
    }
  
    const selectState = document.getElementById('wallet-select-state');
    const connectedState = document.getElementById('wallet-connected-state');
    const modalTitle = document.getElementById('wallet-modal-title');
  
    try {
      if (modalTitle) modalTitle.innerText = "Awaiting Wallet...";
      
      // Hide options and inject loader
      if (selectState && !isAutoConnect) selectState.style.display = 'none';
      if (!isAutoConnect && selectState && selectState.parentElement) {
        const loader = document.createElement('div');
        loader.id = 'modal-loader-real-web3';
        loader.style.textAlign = 'center';
        loader.style.padding = '2rem 0';
        loader.innerHTML = `
          <div style="width:40px; height:40px; border:3px solid var(--border-cyan); border-top-color:var(--color-primary); border-radius:50%; animation:spin 1s linear infinite; margin: 0 auto 1rem auto;"></div>
          <div style="font-size:0.9rem; color:var(--text-muted); line-height: 1.4;">
            Awaiting connection signature.<br>
            <strong style="color: var(--color-warning);">Please open your Wallet app manually</strong> if the popup did not appear.
          </div>
          <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
        `;
        selectState.parentElement.appendChild(loader);
      }
  
      if (!isAutoConnect) triggerToast("Requesting wallet connection...", "success");
      
      let providerToUse = null;

      // 1. Desktop / Extension Priority
      if (typeof window.ethereum !== 'undefined') {
        // Request accounts from MetaMask
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        providerToUse = window.ethereum;
      } 
      // 2. Mobile WalletConnect Fallback
      else {
        const ProviderClass = (EthereumProvider && EthereumProvider.EthereumProvider) || (EthereumProvider && EthereumProvider.default) || EthereumProvider;
        
        if (!ProviderClass || typeof ProviderClass.init !== 'function') {
          throw new Error("WalletConnect module not ready. Please use MetaMask Browser or retry.");
        }

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

    // Fetch MATIC/POL balance with fallback
    let maticBalance = 0;
    try {
      const maticBalWei = await web3Provider.getBalance(address);
      maticBalance = parseFloat(ethers.formatEther(maticBalWei));
    } catch (err) {
      console.warn("web3Provider.getBalance failed, trying public Polygon RPC fallback...", err);
      try {
        const publicProvider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
        const maticBalWei = await publicProvider.getBalance(address);
        maticBalance = parseFloat(ethers.formatEther(maticBalWei));
      } catch (rpcErr) {
        console.error("Public Polygon RPC balance fetch failed:", rpcErr);
      }
    }

    let pgtBalance = appState.state.onchainBalancePgt || 0; // Fallback to current balance

    // Fetch real PGT balance if address is populated
    if (TOKEN_CONTRACT_ADDRESS && TOKEN_CONTRACT_ADDRESS.startsWith("0x") && TOKEN_CONTRACT_ADDRESS.length === 42) {
      try {
        const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, [
          "function balanceOf(address owner) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ], web3Provider);
        const decimals = await tokenContract.decimals();
        const balance = await tokenContract.balanceOf(address);
        pgtBalance = parseFloat(ethers.formatUnits(balance, decimals));
      } catch (err) {
        console.warn("Primary PGT fetch failed, trying public RPC fallback...", err);
        try {
          const publicProvider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
          const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
          ], publicProvider);
          const decimals = await tokenContract.decimals();
          const balance = await tokenContract.balanceOf(address);
          pgtBalance = parseFloat(ethers.formatUnits(balance, decimals));
        } catch (rpcErr) {
          console.error("Failed to fetch PGT balance via RPC:", rpcErr);
        }
      }
    }

    // Fetch real 1FLR balance if address is populated
    let flrBalance = appState.state.balance1flr;
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
