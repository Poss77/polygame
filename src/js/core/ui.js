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
    title.innerText = 'Tokenomics';
    body.innerHTML = `
      <h4 style="color: var(--color-warning); margin-bottom: 0.5rem;">PolyGame Token (PGT)</h4>
      <p style="margin-bottom: 1rem;">PGT is the internal utility and reward token of the PolyGame ecosystem. It is distributed exclusively through gameplay, the faucet, and referrals.</p>
      <ul style="margin-left: 1rem; margin-bottom: 1rem; list-style-type: disc;">
        <li style="margin-bottom: 0.5rem;"><strong>Utility:</strong> Used for all Arcade Game wagers, purchasing NFTs, and staking.</li>
        <li style="margin-bottom: 0.5rem;"><strong>Deflationary:</strong> 100% of PGT used to buy NFTs is burned.</li>
        <li style="margin-bottom: 0.5rem;"><strong>House Edge:</strong> Arcade games have a mathematical house edge to ensure long-term sustainability of the rewards pool.</li>
      </ul>
      <p><em>* PGT is currently an off-chain internal ledger asset and holds no real-world monetary value.</em></p>
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
export async function connectWeb3() {
    if (typeof ethers === 'undefined') {
      triggerToast("Web3 tools not loaded!", "error");
      return;
    }
  
    const selectState = document.getElementById('wallet-select-state');
    const connectedState = document.getElementById('wallet-connected-state');
    const modalTitle = document.getElementById('wallet-modal-title');
  
    try {
      if (modalTitle) modalTitle.innerText = "Awaiting Wallet...";
      
      // Hide options and inject loader
      if (selectState) selectState.style.display = 'none';
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
  
      triggerToast("Requesting wallet connection...", "success");
      
      let providerToUse = null;

      // 1. Desktop / Extension Priority
      if (typeof window.ethereum !== 'undefined') {
        // Request accounts from MetaMask
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        providerToUse = window.ethereum;
      } 
      // 2. Mobile WalletConnect Fallback
      else {
        const wcProvider = await EthereumProvider.init({
          projectId: WALLETCONNECT_PROJECT_ID || '00950c9a536e980dd84dbc015411baa7',
          showQrModal: true,
          chains: [137] // Polygon Mainnet
        });
        
        await wcProvider.connect();
        providerToUse = wcProvider;
      }

      setWeb3Provider(new ethers.BrowserProvider(providerToUse));
      setRealSigner(await web3Provider.getSigner());
      const address = await realSigner.getAddress();

      if (modalTitle) modalTitle.innerText = "Connecting Ledger...";
      triggerToast("Reading token balances...", "success");

    // Fetch MATIC/POL balance
    const maticBalWei = await web3Provider.getBalance(address);
    const maticBalance = parseFloat(ethers.formatEther(maticBalWei));

    let pgtBalance = appState.state.balancePgt; // Fallback to current balance

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
        console.error("Failed to fetch PGT balance:", err);
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
    let ownedNfts = appState.state.ownedNfts;
    if (NFT_CONTRACT_ADDRESS && NFT_CONTRACT_ADDRESS.startsWith("0x") && NFT_CONTRACT_ADDRESS.length === 42) {
      try {
        ownedNfts = await getOwnedNftsFromChain(address);
      } catch (err) {
        console.error("Failed to fetch owned NFTs on connection:", err);
      }
    }

        await syncProfileWithDb(address, pgtBalance, flrBalance, maticBalance, ownedNfts);
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
