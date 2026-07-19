import { supabase, ADMIN_WALLET_ADDRESS } from './config.js';
import { sfx } from './audio.js';
import { appState } from './state.js';
import { closeModal, triggerToast, connectWeb3 } from './ui.js';

// --- DB Sync: Load or Merge user profile from Supabase ---

export async function syncProfileWithDb(address, pgtBalance, flrBalance, maticBalance, ownedNfts) {
    // Prevent cross-wallet state bleeding on account switch
    if (appState.state.walletConnected && appState.state.walletAddress && appState.state.walletAddress.toLowerCase() !== address.toLowerCase()) {
      console.log("Wallet switch detected. Wiping local state to prevent bleed.");
      appState.state = Object.assign({}, appState.defaultState);
    }

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
        appState.state.vipUntil = data.vip_until || null;
        appState.state.balancePgt = data.balance_pgt || 0;
        appState.state.balance1flr = data.balance_1flr || 0;
        appState.state.pendingPayoutPgt = data.pending_payout_pgt || 0;
        appState.state.totalClaims = data.total_claims || 0;
        appState.state.lastClaimTime = data.last_claim_time;
        appState.state.claimStreak = data.claim_streak || 0;
        if ((data.game_highscore || 0) > appState.state.gameHighScore) {
          appState.state.gameHighScore = data.game_highscore;
        }
        if ((data.invaders_highscore || 0) > appState.state.invadersHighScore) {
          appState.state.invadersHighScore = data.invaders_highscore;
        }
        
        // Overwrite arrays with DB data to prevent state bleed from previous wallets
        appState.state.ownedNfts = data.owned_nfts || [];
        appState.state.stakes = data.stakes || [];
        appState.state.totalStakingYield = data.total_staking_yield || 0;
        appState.state.activities = data.activities || [];
        appState.state.referralsList = data.referrals_list || [];

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

        // Check for pending referral link click
        const pendingRef = localStorage.getItem('polygame_pending_referral');
        if (pendingRef) {
          const { data: refData } = await supabase
            .from('users')
            .select('wallet_address, referrals_count, referrals_l1, referrals_list')
            .eq('referral_code', pendingRef)
            .single();

          if (refData) {
            console.log("Linking new user to referrer:", refData.wallet_address);
            // Save to state so it's inserted into the DB upon saveToDB()
            appState.state.referredBy = refData.wallet_address;
            
            // Also securely log the new downline for the referrer
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const newRefEntry = { name: "Player_" + normalizedAddress.substring(2, 8), level: 1, commission: 0, time: timeStr };
            
            let updatedList = refData.referrals_list || [];
            updatedList.unshift(newRefEntry);
            if (updatedList.length > 10) updatedList.pop();

            await supabase.from('users').update({
              referrals_count: (refData.referrals_count || 0) + 1,
              referrals_l1: (refData.referrals_l1 || 0) + 1,
              referrals_list: updatedList
            }).eq('wallet_address', refData.wallet_address);
            
            triggerToast("Referral applied successfully!", "success");
          }
          // Clear it so we don't try again
          localStorage.removeItem('polygame_pending_referral');
        }
      }
    }

    // Remove loader
    const tempLoader = document.getElementById('modal-loader-real-web3');
    if (tempLoader) tempLoader.remove();

    // Update State (this triggers saveToDB automatically via update())
    const updatePayload = {
      walletConnected: true,
      walletProvider: "metamask",
      walletAddress: address,
      onchainBalancePgt: pgtBalance,
      onchainBalance1flr: flrBalance,
      balanceMatic: maticBalance
    };

    // Replace DB NFTs with on-chain truth
    if (Array.isArray(ownedNfts)) {
      updatePayload.ownedNfts = ownedNfts;
      
      // If the currently equipped NFT is no longer owned, unequip it
      if (appState.state.equippedNft && !ownedNfts.includes(appState.state.equippedNft)) {
         updatePayload.equippedNft = null;
      }
    }

    appState.update(updatePayload);

    const connectedState = document.getElementById('wallet-connected-state');
    if (connectedState) {
      connectedState.style.display = 'block';
      document.getElementById('wallet-addr-full').innerText = address;
    }
    
    // Check Admin Privileges
    if (address.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase()) {
      console.log("Admin privileges verified for:", address);
      const adminNav = document.getElementById('nav-item-admin');
      if (adminNav) adminNav.style.display = 'block';
      triggerToast("Master Admin Privileges Unlocked!", "success");
    } else {
      const adminNav = document.getElementById('nav-item-admin');
      if (adminNav) adminNav.style.display = 'none';
    }

    closeModal('wallet');
    triggerToast("MetaMask connected successfully!", "success");

    // Hook auto-reload events
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());

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
    // Completely reset state to default properties so the UI properly clears balances
    const defaultState = appState.defaultState;
    appState.update({
      ...defaultState,
      walletConnected: false,
      walletProvider: null,
      walletAddress: '',
      balanceMatic: 0.0
    });
    
    const selectState = document.getElementById('wallet-select-state');
    const connectedState = document.getElementById('wallet-connected-state');
    const modalTitle = document.getElementById('wallet-modal-title');
    const adminNav = document.getElementById('nav-item-admin');
    
    modalTitle.innerText = "Connect Crypto Wallet";
    if (connectedState) connectedState.style.display = 'none';
    if (selectState) selectState.style.display = 'block';
    if (adminNav) adminNav.style.display = 'none';
    
    // If currently on admin panel, boot them to dashboard
    const adminPanel = document.getElementById('view-admin');
    if (adminPanel && adminPanel.classList.contains('active')) {
      if (window.switchTab) window.switchTab('dashboard');
    }

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

// Global Jackpot Sync Logic
export async function syncJackpotData() {
  if (!supabase) return;
  try {
    // Fetch jackpot counter
    const { data: jackpotData, error: jackpotError } = await supabase
      .from('global_jackpot')
      .select('amount')
      .eq('id', 1)
      .single();

    if (jackpotData && !jackpotError) {
      const counterEl = document.getElementById('progressive-jackpot-counter');
      if (counterEl) {
        counterEl.innerText = `${parseFloat(jackpotData.amount).toFixed(2)} PGT`;
      }
    }

    // Fetch winners list
    const { data: winnersData, error: winnersError } = await supabase
      .from('jackpot_winners')
      .select('wallet_address, amount, won_at')
      .order('won_at', { ascending: false })
      .limit(10);

    if (winnersData && !winnersError) {
      const listEl = document.getElementById('jackpot-winners-list');
      if (listEl) {
        listEl.innerHTML = '';
        if (winnersData.length === 0) {
          listEl.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 1rem;">No winners yet. Spin to be the first!</div>';
        } else {
          winnersData.forEach(winner => {
            const shortAddr = winner.wallet_address.substring(0, 6) + '...' + winner.wallet_address.substring(winner.wallet_address.length - 4);
            const date = new Date(winner.won_at).toLocaleDateString();
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.padding = '0.5rem';
            div.style.background = 'rgba(255,255,255,0.02)';
            div.style.border = '1px solid var(--border-glass)';
            div.style.borderRadius = 'var(--border-radius-sm)';
            div.innerHTML = `
              <span style="color: var(--color-primary);">${shortAddr}</span>
              <span style="color: var(--text-muted);">${date}</span>
              <strong style="color: var(--color-accent);">+${parseFloat(winner.amount).toFixed(2)} PGT</strong>
            `;
            listEl.appendChild(div);
          });
        }
      }
    }
  } catch (err) {
    console.error("Jackpot sync failed:", err);
  }
}

// Start auto-sync interval for jackpot
setInterval(syncJackpotData, 15000);

export async function recordGameMetrics(game, wager, payout) {
  if (!supabase) return;
  
  try {
    // Call the RPC function to atomically increment global game metrics
    await supabase.rpc('log_game_metric', { 
      p_game: game, 
      p_wager: wager, 
      p_payout: payout 
    });
  } catch (e) {
    console.error("Failed to log game metrics:", e);
  }
}

export async function syncGlobalSettings() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('global_settings').select('earn_multiplier').eq('id', 1).single();
    if (data && !error && data.earn_multiplier !== undefined) {
      appState.update({ globalEarnMultiplier: parseFloat(data.earn_multiplier) });
    }
  } catch (e) {
    console.error('Failed to sync global settings:', e);
  }
}
