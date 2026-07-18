import { supabase, ADMIN_WALLET_ADDRESS } from './config.js';
import { sfx } from './audio.js';
import { appState } from './state.js';
import { closeModal, triggerToast, connectWeb3 } from './ui.js';

// --- DB Sync: Load or Merge user profile from Supabase ---

    if (supabase) {
      triggerToast("Syncing Database Profile...", "success");
      const normalizedAddress = address.toLowerCase();
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', normalizedAddress)
        .single();

      if (data && !error) {
        // User exists in DB, merge DB state into local guest state (DB wins)
        console.log("Found existing profile in DB:", data);
        appState.state.balancePgt = data.balance_pgt || 0;
        appState.state.balance1flr = data.balance_1flr || 0;
        appState.state.pendingPayoutPgt = data.pending_payout_pgt || 0;
        appState.state.totalClaims = data.total_claims || 0;
        appState.state.lastClaimTime = data.last_claim_time;
        appState.state.claimStreak = data.claim_streak || 0;
        if ((data.game_highscore || 0) > appState.state.gameHighScore) {
          appState.state.gameHighScore = data.game_highscore;
        }
        
        // Merge arrays (if empty in DB, keep guest data, otherwise take DB)
        if (data.owned_nfts && data.owned_nfts.length > 0) appState.state.ownedNfts = data.owned_nfts;
        if (data.stakes && data.stakes.length > 0) appState.state.stakes = data.stakes;
        if (data.activities && data.activities.length > 0) appState.state.activities = data.activities;
        if (data.referrals_list && data.referrals_list.length > 0) appState.state.referralsList = data.referrals_list;

        appState.state.equippedNft = data.equipped_nft;
        appState.state.stakedBalancePgt = data.staked_balance_pgt || 0;
        appState.state.stakedBalance1flr = data.staked_balance_1flr || 0;
        appState.state.referralsCount = data.referrals_count || 0;
        appState.state.referralsL1 = data.referrals_l1 || 0;
        appState.state.referralsL2 = data.referrals_l2 || 0;
        appState.state.referralsL3 = data.referrals_l3 || 0;
        appState.state.referralsL4 = data.referrals_l4 || 0;
        appState.state.totalReferralCommission = data.total_referral_commission || 0;
        appState.state.referralCode = data.referral_code || appState.state.referralCode;
      } else {
        // New user to DB, will be pushed on the first saveToDB() call below
        console.log("No DB profile found. Will insert guest data.");
      }
    }

    // Remove loader
    const tempLoader = document.getElementById('modal-loader-real-web3');
    if (tempLoader) tempLoader.remove();

    // Update State (this triggers saveToDB automatically via update())
    appState.update({
      walletConnected: true,
      walletProvider: "metamask",
      walletAddress: address,
      onchainBalancePgt: pgtBalance,
      onchainBalance1flr: flrBalance,
      balanceMatic: maticBalance,
      ownedNfts: ownedNfts
    });

    if (connectedState) {
      connectedState.style.display = 'block';
      document.getElementById('wallet-addr-full').innerText = address;
    }
    
    // Check Admin Privileges
    if (address.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase()) {
      const adminNav = document.getElementById('nav-item-admin');
      if (adminNav) adminNav.style.display = 'block';
    } else {
      const adminNav = document.getElementById('nav-item-admin');
      if (adminNav) adminNav.style.display = 'none';
    }

    closeModal('wallet');
    triggerToast("MetaMask connected successfully!", "success");

    // Hook auto-reload events
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());

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

// Mock Connect Process wrapper (intercepts MetaMask)
export function mockWalletSelection(providerName) {
  if (providerName === 'metamask') {
    connectWeb3();
    return;
  }

  // Otherwise, use mock connector for other options:
  const selectState = document.getElementById('wallet-select-state');
  const connectedState = document.getElementById('wallet-connected-state');
  const modalTitle = document.getElementById('wallet-modal-title');
  
  modalTitle.innerText = "Connecting...";
  selectState.style.display = 'none';

  const loader = document.createElement('div');
  loader.id = 'modal-loader-temp';
  loader.style.textAlign = 'center';
  loader.style.padding = '2rem 0';
  loader.innerHTML = `
    <div style="width:40px; height:40px; border:3px solid var(--border-cyan); border-top-color:var(--color-primary); border-radius:50%; animation:spin 1s linear infinite; margin: 0 auto 1rem auto;"></div>
    <div style="font-size:0.9rem; color:var(--text-muted);">Please sign transaction inside your client popup...</div>
    <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
  `;
  selectState.parentElement.appendChild(loader);

  setTimeout(() => {
    const tempLoader = document.getElementById('modal-loader-temp');
    if (tempLoader) tempLoader.remove();

    const hex = '0123456789abcdef';
    let mockAddr = '0x';
    for (let i = 0; i < 40; i++) mockAddr += hex[Math.floor(Math.random() * 16)];

    appState.update({
      walletConnected: true,
      walletProvider: providerName,
      walletAddress: mockAddr,
      balanceMatic: 12.45
    });

    modalTitle.innerText = "Wallet Integrated";
    connectedState.style.display = 'block';
    document.getElementById('wallet-addr-full').innerText = mockAddr;
    
    document.getElementById('swap-max-pgt').innerText = appState.state.balancePgt.toFixed(2);
    calculateSwapRate();

    triggerToast(`Wallet connected using ${providerName.toUpperCase()}`, 'success');
  }, 1800);
}
window.mockWalletSelection = mockWalletSelection;

// Disconnect wallet
document.querySelectorAll('#btn-wallet-disconnect').forEach(btn => {
  btn.addEventListener('click', () => {
    appState.update({
      walletConnected: false,
      walletProvider: null,
      walletAddress: '',
      balanceMatic: 0.0
    });
    
    const selectState = document.getElementById('wallet-select-state');
    const connectedState = document.getElementById('wallet-connected-state');
    const modalTitle = document.getElementById('wallet-modal-title');
    
    modalTitle.innerText = "Connect Crypto Wallet";
    if (connectedState) connectedState.style.display = 'none';
    if (selectState) selectState.style.display = 'block';
    
    triggerToast("Wallet disconnected", "error");
    closeModal('wallet');
  });
});

// Swap Calculations
export const pgtInput = document.getElementById('swap-input-pgt');
export const maticInput = document.getElementById('swap-input-matic');
export const executeSwapBtn = document.getElementById('btn-execute-swap');

export function calculateSwapRate() {
  const pgt = parseFloat(pgtInput.value) || 0;
  // Rate: 100 PGT = 0.5 MATIC (0.005 multiplier)
  const matic = pgt * 0.005;
  maticInput.value = matic.toFixed(4);
}

if (pgtInput) {
  pgtInput.addEventListener('input', calculateSwapRate);
  document.getElementById('swap-max-pgt').addEventListener('click', () => {
    pgtInput.value = Math.floor(appState.state.balancePgt);
    calculateSwapRate();
  });
}

if (executeSwapBtn) {
  executeSwapBtn.addEventListener('click', () => {
    const pgtAmount = parseFloat(pgtInput.value) || 0;
    if (pgtAmount <= 0) {
      triggerToast("Input a valid swap amount", "error");
      return;
    }
    if (appState.state.balancePgt < pgtAmount) {
      triggerToast("Insufficient PGT token balance", "error");
      return;
    }

    const maticPayout = pgtAmount * 0.005;
    
    // Adjust balances
    appState.update({
      balancePgt: appState.state.balancePgt - pgtAmount,
      balanceMatic: appState.state.balanceMatic + maticPayout
    });

    sfx.playCoin();
    triggerToast(`Swapped ${pgtAmount} PGT for +${maticPayout.toFixed(4)} MATIC!`, 'success');
    appState.addActivity('You', `swapped ${pgtAmount} PGT`, `+${maticPayout.toFixed(2)} MATIC`);
    
    // Reset inputs
    document.getElementById('swap-max-pgt').innerText = appState.state.balancePgt.toFixed(2);
    pgtInput.value = '100';
    calculateSwapRate();
    closeModal('wallet');
  });
}

