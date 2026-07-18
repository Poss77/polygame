import { syncProfileWithDb } from './db-sync.js';
import { TOKEN_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS, TOKEN_1FLR_CONTRACT_ADDRESS, web3Provider, realSigner } from './config.js';
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

export function closeModal(modalId) {
  const overlay = document.getElementById(`modal-${modalId}`);
  if (overlay) overlay.classList.remove('active');
}
window.closeModal = closeModal;

// Connect real wallet via MetaMask
export async function connectWeb3() {
  if (typeof window.ethereum === 'undefined' || typeof ethers === 'undefined') {
    triggerToast("Web3 or MetaMask is not available!", "error");
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
        <strong style="color: var(--color-warning);">Please open MetaMask extension manually</strong> if the popup did not appear.
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
    `;
    selectState.parentElement.appendChild(loader);

    triggerToast("Requesting MetaMask accounts...", "success");

    // Request accounts from MetaMask
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const address = accounts[0];

    if (modalTitle) modalTitle.innerText = "Connecting Ledger...";
    triggerToast("Reading token balances...", "success");

    web3Provider = new ethers.BrowserProvider(window.ethereum);
    realSigner = await web3Provider.getSigner();

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
