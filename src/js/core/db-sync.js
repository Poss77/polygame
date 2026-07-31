import { supabase, ADMIN_WALLET_ADDRESS } from './config.js';
import { sfx } from './audio.js';
import { appState } from './state.js';
import { closeModal, triggerToast, connectWeb3 } from './ui.js';

// --- DB Sync: Load or Merge user profile from Supabase ---

export async function syncProfileWithDb(address, pgtBalance, flrBalance, maticBalance, chainNfts, silent = false) {
    appState.isSyncingWithDB = true;
    
    // Prevent cross-wallet state bleeding on account switch
    if (appState.state.walletConnected && appState.state.walletAddress && appState.state.walletAddress.toLowerCase() !== address.toLowerCase()) {
      console.log("Wallet switch detected. Wiping local state to prevent bleed.");
      appState.state = Object.assign({}, appState.defaultState);
    }

    if (supabase) {
      if (!silent) triggerToast("Syncing Database Profile...", "success");
      const normalizedAddress = address.toLowerCase();
      
      let query = supabase.from('users').select('*');
      if (appState.state.authUserId) {
        query = query.eq('user_id', appState.state.authUserId);
      } else {
        query = query.or(`wallet_address.eq.${normalizedAddress},linked_wallet_address.eq.${normalizedAddress}`);
      }
      
      const { data, error } = await query.maybeSingle();

      if (data && !error) {
        // User exists in DB, merge DB state into local guest state (DB wins)
        console.log("Found existing profile in DB:", data);
        appState.state.vipUntil = data.vip_until || null;
        if (data.username) {
          appState.state.username = data.username;
          localStorage.setItem(`polygame_username_${normalizedAddress}`, data.username);
        } else {
          const localSaved = localStorage.getItem(`polygame_username_${normalizedAddress}`);
          if (localSaved) appState.state.username = localSaved;
        }
        appState.state.balancePgt = data.balance_pgt || 0;
        appState.state.balance1flr = data.balance_1flr || 0;
        appState.state.totalClaims = data.total_claims || 0;
        const rawLastClaim = data.last_faucet_claim || data.last_claim_time;
        appState.state.lastClaimTime = rawLastClaim ? new Date(rawLastClaim).getTime() : null;
        appState.state.claimStreak = data.claim_streak || 0;
        appState.state.gameHighScore = Math.max(data.game_highscore || 0, appState.state.gameHighScore || 0);
        appState.state.invadersHighScore = Math.max(data.invaders_highscore || 0, appState.state.invadersHighScore || 0);
        appState.state.driftHighScore = Math.max(data.drift_highscore || 0, appState.state.driftHighScore || 0);
        
        // Fetch stakes from the new user_stakes table
        let stakesData = [];
        const { data: sData, error: sErr } = await supabase.rpc('get_user_stakes', { p_wallet: normalizedAddress });
        if (sData && sData.success) {
          stakesData = sData.stakes;
        } else if (data.stakes) {
          // fallback to legacy column if migration hasn't happened
          stakesData = data.stakes;
        }
        
        // Overwrite arrays with DB data to prevent state bleed from previous wallets
        appState.state.ownedNfts = data.owned_nfts || [];
        appState.state.crateNfts = data.crate_nfts || [];
        appState.state.stakes = stakesData;
        appState.state.totalStakingYield = data.total_staking_yield || 0;
        appState.state.activities = data.activities || [];
        appState.state.referralsList = data.referrals_list || [];
        if (data.space_state && typeof data.space_state === 'object' && Object.keys(data.space_state).length > 0) {
          appState.state.spaceState = { ...appState.state.spaceState, ...data.space_state };
        } else if (appState.state.spaceState && Object.keys(appState.state.spaceState).length > 0) {
          appState.saveToDB();
        }

        if (data.daily_quests && typeof data.daily_quests === 'object' && Object.keys(data.daily_quests).length > 0) {
          appState.state.dailyQuests = data.daily_quests;
          try { localStorage.setItem('polygame_daily_quests', JSON.stringify(data.daily_quests)); } catch(e){}
        }

        if (window.renderDailyQuestsUI) {
          window.renderDailyQuestsUI();
        }

        if (window.polySpace && typeof window.polySpace.loadSpaceState === 'function') {
          window.polySpace.loadSpaceState();
        }

        appState.state.equippedNft = data.equipped_nft;
        appState.state.stakedBalancePgt = data.staked_balance_pgt || 0;
        appState.state.stakedBalance1flr = data.staked_balance_1flr || 0;
        appState.state.referralsCount = data.referrals_count || 0;
        appState.state.referralsL1 = data.referrals_l1 || 0;
        appState.state.referralsL2 = data.referrals_l2 || 0;
        appState.state.referralsL3 = data.referrals_l3 || 0;
        appState.state.referralsL4 = data.referrals_l4 || 0;
        appState.state.totalReferralCommission = data.total_referral_commission || 0;
        appState.state.unclaimedReferralPgt = data.unclaimed_referral_pgt || 0;
        appState.state.referralCode = data.referral_code || appState.state.referralCode;
      } else {
        // New user to DB, will be pushed on the first saveToDB() call below
        console.log("No DB profile found. Will insert guest data.");

        // Security Cap: Prevent fake guest state injection (>1,000 PGT) on first wallet registration
        if (appState.state.balancePgt > 1000) {
          console.warn("Guest balance exceeds security threshold. Capping to 1,000 PGT for new account registration.");
          if (typeof window.sendAdminAlert === 'function') {
            window.sendAdminAlert({
              category: 'SECURITY ANOMALY',
              title: '⚠️ High Guest Balance Sanitized on Wallet Connect',
              description: `Player \`${address}\` attempted to register a new account with \`${appState.state.balancePgt.toFixed(2)} PGT\` guest balance. Sanitized to 1,000 PGT max.`,
              color: 0xFF0000
            });
          }
          appState.state.balancePgt = 1000;
        }

        // Check for pending referral link click & bind 4-tier downlines
        const pendingRef = localStorage.getItem('polygame_pending_referral');
        if (pendingRef) {
          try {
            const { data: bindRes, error: bindErr } = await supabase.rpc('bind_referral_code', {
              p_user_wallet: normalizedAddress,
              p_ref_code: pendingRef
            });
            if (bindRes && bindRes.success) {
              triggerToast("🎉 Referral applied across 4-Tier network!", "success");
            }
          } catch (err) {
            console.warn("Failed to bind referral code via RPC:", err);
          }
          localStorage.removeItem('polygame_pending_referral');
        }
      }
    }

    // Remove loader
    const tempLoader = document.getElementById('modal-loader-real-web3');
    if (tempLoader) tempLoader.remove();

    // Handle Web3 wallet connection vs Google social user primary address
    let activeUserId = appState.state.authUserId;
    if (!activeUserId && supabase && supabase.auth) {
      try {
        const { data: sData } = await supabase.auth.getSession();
        if (sData?.session?.user?.id) {
          activeUserId = sData.session.user.id;
          appState.state.authUserId = activeUserId;
        }
      } catch (e) {}
    }

    let primaryWallet = appState.state.walletAddress || address;
    let linkedWallet = appState.state.linkedWalletAddress || '';

    if (address && !address.startsWith('0xg')) {
      linkedWallet = address;
      if (activeUserId) {
        // For Google accounts, update linked_wallet_address in DB using user_id
        try {
          await supabase
            .from('users')
            .update({ linked_wallet_address: address.toLowerCase(), updated_at: new Date().toISOString() })
            .eq('user_id', activeUserId);
        } catch (e) {
          console.error("Failed to update linked_wallet_address in DB:", e);
        }
      } else {
        // For direct Web3 users, primary wallet is 0x...
        primaryWallet = address;
      }
    }

    // Update State (this triggers saveToDB automatically via update())
    const updatePayload = {
      walletConnected: true,
      walletProvider: activeUserId ? "google_linked" : "metamask",
      walletAddress: primaryWallet,
      linkedWalletAddress: linkedWallet,
      onchainBalancePgt: pgtBalance,
      onchainBalance1flr: flrBalance,
      balanceMatic: maticBalance
    };

    // Merge on-chain NFTs with DB/off-chain owned NFTs
    if (Array.isArray(chainNfts) && chainNfts.length > 0) {
      const mergedNfts = Array.from(new Set([...(appState.state.ownedNfts || []), ...chainNfts]));
      updatePayload.ownedNfts = mergedNfts;
    } else {
      updatePayload.ownedNfts = appState.state.ownedNfts || [];
    }

    // If equipped NFT is no longer owned, unequip it
    const combinedNfts = [...updatePayload.ownedNfts, ...(appState.state.crateNfts || [])];
    if (appState.state.equippedNft && !combinedNfts.includes(appState.state.equippedNft)) {
       updatePayload.equippedNft = null;
    }

    appState.isSyncingWithDB = false;
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

    // Check for Multi-Account IP sharing (> 2 accounts on same IP)
    if (typeof window.checkMultiAccountIP === 'function') {
      window.checkMultiAccountIP(address);
    }

    closeModal('wallet');
    if (!silent) triggerToast("MetaMask connected successfully!", "success");

    // Hook auto-reload events safely if window.ethereum exists
    if (window.ethereum && typeof window.ethereum.on === 'function') {
      window.ethereum.on('accountsChanged', () => window.location.reload());
      window.ethereum.on('chainChanged', () => window.location.reload());
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

    triggerToast(`Wallet connected using ${providerName.toUpperCase()}`, 'success');
  }, 1800);
}
window.mockWalletSelection = mockWalletSelection;

export async function creditArcadePayout(amount) {
  const cleanAmt = parseFloat(parseFloat(amount || 0).toFixed(2));
  if (isNaN(cleanAmt) || cleanAmt <= 0) return;

  // Feed 1% of arcade payout earnings into the Global Progressive Jackpot
  processBetJackpot(cleanAmt, 'Arcade Payout');

  if (appState.state.walletConnected && appState.state.walletAddress && supabase) {
    const wallet = appState.state.walletAddress.toLowerCase();
    try {
      const { data, error } = await supabase.rpc('credit_arcade_payout', {
        p_wallet: wallet,
        p_amount: cleanAmt
      });
      if (data && data.success && data.new_balance !== undefined && data.new_balance !== null) {
        const newBal = parseFloat(parseFloat(data.new_balance).toFixed(2));
        appState.state.balancePgt = newBal;
        appState.save();

        // Process 4-tier referral commissions on game earn
        supabase.rpc('process_referral_commissions', {
          claiming_wallet: wallet,
          claim_amount: cleanAmt
        }).then(() => {
          if (typeof syncReferralData === 'function') syncReferralData();
        }).catch(() => {});
        return;
      }
      if (error) console.warn("[creditArcadePayout] RPC error:", error);
    } catch (err) {
      console.error("[creditArcadePayout] RPC exception:", err);
    }

    // Direct DB update fallback if RPC fails or is missing permissions
    const fallbackBal = parseFloat((appState.state.balancePgt + cleanAmt).toFixed(2));
    appState.state.balancePgt = fallbackBal;
    appState.save();

    try {
      await supabase.from('users').update({
        balance_pgt: fallbackBal,
        updated_at: new Date().toISOString()
      }).eq('wallet_address', wallet);
    } catch (e) {
      console.error("Direct balance fallback error:", e);
    }

  } else {
    // Guest mode balance update
    appState.state.balancePgt = parseFloat((appState.state.balancePgt + cleanAmt).toFixed(2));
    appState.save();
  }
}
window.creditArcadePayout = creditArcadePayout;

// Disconnect wallet / Log out Google Account
export async function logoutUser() {
  if (supabase && supabase.auth) {
    await supabase.auth.signOut().catch(e => console.error("SignOut error:", e));
  }

  try {
    localStorage.removeItem('polygame_state');
    localStorage.removeItem('polygame_state_checksum');
  } catch (e) {}

  appState.state = Object.assign({}, appState.defaultState);
  appState.save();

  const selectState = document.getElementById('wallet-select-state');
  const connectedState = document.getElementById('wallet-connected-state');
  const modalTitle = document.getElementById('wallet-modal-title');
  const adminNav = document.getElementById('nav-item-admin');

  if (modalTitle) modalTitle.innerText = "Log In / Connect Wallet";
  if (connectedState) connectedState.style.display = 'none';
  if (selectState) selectState.style.display = 'block';
  if (adminNav) adminNav.style.display = 'none';

  const adminPanel = document.getElementById('view-admin');
  if (adminPanel && adminPanel.classList.contains('active')) {
    if (window.switchTab) window.switchTab('dashboard');
  }

  if (window.syncProfileView) window.syncProfileView();

  if (window.triggerToast) window.triggerToast("Logged out successfully", "info");
  if (window.closeModal) window.closeModal('wallet');
}
window.logoutUser = logoutUser;

document.querySelectorAll('#btn-wallet-disconnect, .btn-account-logout').forEach(btn => {
  btn.addEventListener('click', logoutUser);
});



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
window.syncJackpotData = syncJackpotData;

// Start auto-sync interval for jackpot (every 5 seconds)
// Optimized jackpot polling interval (30s) to minimize DB load
setInterval(syncJackpotData, 30000);

// Live Referral Data Sync Logic
export async function syncReferralData() {
  if (!supabase || !appState.state.walletConnected || !appState.state.walletAddress) return;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('unclaimed_referral_pgt, total_referral_commission, unclaimed_referral_pol, total_referral_pol, is_ambassador, referrals_count, referrals_l1, referrals_l2, referrals_l3, referrals_l4, referrals_list')
      .eq('wallet_address', appState.state.walletAddress.toLowerCase())
      .single();

    if (data && !error) {
      appState.update({
        unclaimedReferralPgt: parseFloat(data.unclaimed_referral_pgt || 0),
        unclaimedReferralPol: parseFloat(data.unclaimed_referral_pol || 0),
        totalReferralPol: parseFloat(data.total_referral_pol || 0),
        isAmbassador: !!data.is_ambassador,
        totalReferralCommission: parseFloat(data.total_referral_commission || 0),
        referralsCount: data.referrals_count || 0,
        referralsL1: data.referrals_l1 || 0,
        referralsL2: data.referrals_l2 || 0,
        referralsL3: data.referrals_l3 || 0,
        referralsL4: data.referrals_l4 || 0,
        referralsList: data.referrals_list || []
      });
    }
  } catch (err) {
    console.warn("Referral sync error:", err);
  }
}
window.syncReferralData = syncReferralData;

export async function processBetJackpot(betAmount, gameName = 'Casino Game') {
  const numBet = parseFloat(betAmount) || 0;
  if (numBet <= 0) return 0;

  const incVal = numBet * 0.01;

  // 1. Optimistic live UI update on screen IMMEDIATELY
  const counterEl = document.getElementById('progressive-jackpot-counter');
  if (counterEl) {
    const rawVal = counterEl.innerText.replace(/[^0-9.]/g, '');
    const currentVal = parseFloat(rawVal) || 1200.0;
    counterEl.innerText = `${(currentVal + incVal).toFixed(2)} PGT`;
  }

  // 2. Increment progressive jackpot pool in database (1% of bet)
  if (supabase) {
    try {
      supabase.rpc('increment_jackpot', { p_amount: incVal }).then(() => {
        syncJackpotData();
      }).catch(e => console.warn("Jackpot increment RPC error:", e));
    } catch (e) {}
  }

  // 3. 1 in 10,000 chance to hit the progressive jackpot!
  if (Math.random() < 0.0001 && appState.state.walletConnected && appState.state.walletAddress && supabase) {
    try {
      const { data: jackpotAmount, error } = await supabase.rpc('claim_jackpot', {
        p_wallet: appState.state.walletAddress.toLowerCase()
      });

      if (!error && jackpotAmount && jackpotAmount > 0) {
        appState.update({
          balancePgt: appState.state.balancePgt + jackpotAmount
        });
        
        const formatAmt = parseFloat(jackpotAmount).toFixed(2);
        if (window.triggerToast) {
          window.triggerToast(`🏆 MEGA JACKPOT HIT! You won ${formatAmt} PGT on ${gameName}!`, 'success');
        }
        appState.addActivity('You', `won the Global Progressive Jackpot on ${gameName}`, `+${formatAmt} PGT`);
        syncJackpotData();
        return jackpotAmount;
      }
    } catch (err) {
      console.error("Jackpot claim error:", err);
    }
  }
  return 0;
}
window.processBetJackpot = processBetJackpot;

export async function recordGameMetrics(game, wager, payout, playtimeSeconds = 0) {
  if (typeof window.trackQuestProgress === 'function') {
    const gName = (game || '').trim().toLowerCase();
    const isEarnGame = ['astro', 'dodge', 'invader', 'drift'].some(k => gName.includes(k));
    const isBetGame = ['roshambo', 'spinner', 'plinko', 'crash'].some(k => gName.includes(k));

    if (isEarnGame) {
      window.trackQuestProgress('games', 1);
    } else if (isBetGame) {
      if (payout > (wager || 0)) {
        window.trackQuestProgress('wins', 1);
      }
    } else {
      if (!wager || wager === 0) {
        window.trackQuestProgress('games', 1);
      } else if (payout > wager) {
        window.trackQuestProgress('wins', 1);
      }
    }
  }
  if (!supabase) return;
  
  try {
    // Call the RPC function to atomically increment global game metrics
    await supabase.rpc('log_game_metric', { 
      p_game: game, 
      p_wager: wager, 
      p_payout: payout,
      p_playtime_seconds: playtimeSeconds
    });
  } catch (e) {
    console.error("Failed to log game metrics:", e);
  }
}

export async function logBetWin(game, betAmount, payout, multiplier) {
  if (payout <= 0) return;

  // Trigger Discord Webhook Notification for Big Wins (Payout >= 20 PGT or Multiplier >= 3x)
  if ((payout >= 20 || multiplier >= 3) && typeof window.sendDiscordBigWin === 'function') {
    window.sendDiscordBigWin(game, betAmount, payout, multiplier);
  }

  if (!supabase || !appState.state.walletConnected || !appState.state.walletAddress) return;

  try {
    await supabase.from('bet_wins').insert({
      wallet_address: appState.state.walletAddress.toLowerCase(),
      game: game,
      bet_amount: betAmount,
      payout: payout,
      multiplier: multiplier
    });

    // Process 4-tier referral commissions on bet wins
    supabase.rpc('process_referral_commissions', {
      claiming_wallet: appState.state.walletAddress.toLowerCase(),
      claim_amount: payout
    }).catch(() => {});
  } catch (e) {
    console.error("Failed to log bet win:", e);
  }
}

export async function syncGlobalSettings() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('global_settings').select('earn_multiplier, site_message').eq('id', 1).single();
    if (data && !error) {
      if (data.earn_multiplier !== undefined) {
        appState.update({ globalEarnMultiplier: parseFloat(data.earn_multiplier) });
      }
      if (data.site_message !== undefined) {
        appState.update({ siteMessage: data.site_message });
        
        const banner = document.getElementById('site-announcement-banner');
        const bannerText = document.getElementById('site-announcement-text');
        if (banner && bannerText) {
          if (data.site_message && data.site_message.trim().length > 0) {
            bannerText.innerText = data.site_message;
            banner.style.display = 'flex';
          } else {
            banner.style.display = 'none';
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to sync global settings:', e);
  }
}

export async function submitInvadersScoreToDB(score) {
  if (!supabase || !appState.state.walletConnected) return null;
  
  const address = appState.state.walletAddress.toLowerCase();
  const multis = appState.getMultipliers();
  
  try {
    let { data: res, error } = await supabase.rpc('submit_invaders_score', {
      p_wallet: address,
      p_score: score,
      p_nft_game_multiplier: multis.nftGameMultiplier,
      p_global_earn_multiplier: appState.state.globalEarnMultiplier || 1.0
    });
    
    if (res && res.success) {
      const rawNewBal = (res.new_balance !== undefined && res.new_balance !== null) ? parseFloat(res.new_balance) : null;
      if (rawNewBal !== null && !isNaN(rawNewBal)) {
        appState.state.balancePgt = parseFloat(rawNewBal.toFixed(2));
      } else {
        const payoutVal = parseFloat(parseFloat(res.payout || 0).toFixed(2));
        appState.state.balancePgt = parseFloat((appState.state.balancePgt + payoutVal).toFixed(2));
      }
      if (res.new_high_score) {
        appState.state.invadersHighScore = res.score;
      }
      appState.save();
      return res;
    }
    if (error) console.warn("[submitInvadersScoreToDB] RPC error:", error);
  } catch (err) {
    console.error("Invaders score submit failed:", err);
  }

  // Fallback for Cyber Invaders if RPC fails or is missing permissions
  const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
  const vipMult = appState.isVipActive() ? 2.0 : 1.0;
  const ambMult = appState.state.isAmbassador ? 2.0 : 1.0;
  const globalMult = appState.state.globalEarnMultiplier || 1.0;
  const rawPgt = score * 0.015 * globalMult;
  const finalPgt = parseFloat((rawPgt * nftMult * vipMult * ambMult).toFixed(2));
  
  const newBal = parseFloat((appState.state.balancePgt + finalPgt).toFixed(2));
  appState.state.balancePgt = newBal;
  const isNewHigh = score > (appState.state.invadersHighScore || 0);
  if (isNewHigh) {
    appState.state.invadersHighScore = score;
  }
  appState.save();

  try {
    await supabase.from('users').update({
      balance_pgt: newBal,
      invaders_highscore: appState.state.invadersHighScore,
      alltime_game_highscore: appState.state.alltimeGameHighScore,
      alltime_invaders_highscore: appState.state.alltimeInvadersHighScore,
      alltime_drift_highscore: appState.state.alltimeDriftHighScore,
      updated_at: new Date().toISOString()
    }).eq('wallet_address', address);
  } catch (e) {
    console.error("Invaders fallback error:", e);
  }

  return { success: true, payout: finalPgt, new_balance: newBal, new_high_score: isNewHigh, score };
}
window.submitInvadersScoreToDB = submitInvadersScoreToDB;
window.syncProfileWithDb = syncProfileWithDb;

export async function submitHighScoreToDB(gameType, score) {
  if (!supabase || !appState.state.walletConnected || !appState.state.walletAddress) return;
  const address = appState.state.walletAddress.toLowerCase();
  const cleanScore = Math.floor(score || 0);
  if (cleanScore <= 0) return;

  // Update local state if score is a new high
  if (gameType === 'astrododge' && cleanScore > (appState.state.gameHighScore || 0)) {
    appState.state.gameHighScore = cleanScore;
  } else if (gameType === 'invaders' && cleanScore > (appState.state.invadersHighScore || 0)) {
    appState.state.invadersHighScore = cleanScore;
  } else if (gameType === 'drift' && cleanScore > (appState.state.driftHighScore || 0)) {
    appState.state.driftHighScore = cleanScore;
  }

  const payload = { p_wallet: address };
  if (gameType === 'astrododge') payload.p_game_highscore = cleanScore;
  else if (gameType === 'invaders') payload.p_invaders_highscore = cleanScore;
  else if (gameType === 'drift') payload.p_drift_highscore = cleanScore;

  try {
    const { error } = await supabase.rpc('submit_arcade_highscore', payload);
    if (error) {
      console.warn("[submitHighScoreToDB] RPC warning, using fallback update:", error.message);
      const dbUpdate = { updated_at: new Date().toISOString() };
      if (gameType === 'astrododge' && cleanScore >= (appState.state.gameHighScore || 0)) dbUpdate.game_highscore = cleanScore;
      if (gameType === 'invaders' && cleanScore >= (appState.state.invadersHighScore || 0)) dbUpdate.invaders_highscore = cleanScore;
      if (gameType === 'drift' && cleanScore >= (appState.state.driftHighScore || 0)) dbUpdate.drift_highscore = cleanScore;
      
      if (Object.keys(dbUpdate).length > 1) {
        try { 
          await supabase.from('users').update(dbUpdate).eq('wallet_address', address); 
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error("[submitHighScoreToDB] RPC exception:", err);
  }
}
window.submitHighScoreToDB = submitHighScoreToDB;


// --- Social Auth (Google Passwordless) & Wallet Account Linking ---

export async function loginWithGoogle() {
  if (!supabase) {
    if (window.triggerToast) window.triggerToast('Database connection not ready', 'error');
    return;
  }
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error('[loginWithGoogle] Error:', err);
    if (window.triggerToast) window.triggerToast('Google Sign-In failed: ' + err.message, 'error');
  }
}
window.loginWithGoogle = loginWithGoogle;

export async function linkWalletToAccount(address) {
  if (!supabase) return false;
  
  if (!isValidEthereumAddress(address)) {
    if (window.triggerToast) window.triggerToast("Invalid Polygon wallet address. Addresses must start with 0x and be 42 characters long.", "error");
    return false;
  }
  
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    if (window.triggerToast) window.triggerToast('Please log in with Google first before linking a wallet.', 'warning');
    return false;
  }

  try {
    const { data, error } = await supabase.rpc('link_wallet_to_account', {
      p_wallet: address.toLowerCase(),
      p_user_id: userId
    });

    if (error) throw error;

    if (!data.success) {
      if (window.triggerToast) window.triggerToast(data.message, 'error');
      return false;
    }

    appState.update({ linkedWalletAddress: address, walletProvider: 'google_linked' });
    if (window.triggerToast) window.triggerToast('Wallet linked to your Google account!', 'success');
    return true;
  } catch (err) {
    console.error('[linkWalletToAccount] Error:', err);
    if (window.triggerToast) window.triggerToast('Failed to link wallet: ' + err.message, 'error');
    return false;
  }
}
window.linkWalletToAccount = linkWalletToAccount;

export async function deleteUserAccount() {
  if (!supabase) return;
  const userInput = prompt("⚠️ WARNING: Account deletion will unbind your wallet/Google login and reset all stored database progress.\n\nTo confirm account deletion, please type 'DELETE' below:");
  if (!userInput || userInput.trim().toUpperCase() !== 'DELETE') {
    if (window.triggerToast) window.triggerToast("Account deletion cancelled. You must type 'DELETE' to confirm.", "info");
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || appState.state.authUserId || null;
    const walletAddr = appState.state.walletAddress || null;

    const { data, error } = await supabase.rpc('delete_user_account', {
      p_user_id: userId,
      p_wallet: walletAddr
    });

    if (error) throw error;

    if (session) {
      await supabase.auth.signOut().catch(() => {});
    }

    const defaultState = appState.defaultState;
    appState.update({
      ...defaultState,
      walletConnected: false,
      walletProvider: null,
      walletAddress: '',
      authUserEmail: null,
      authUserId: null
    });

    if (window.triggerToast) window.triggerToast('Account deleted successfully.', 'info');
    if (window.closeModal) window.closeModal('wallet');
  } catch (err) {
    console.error('[deleteUserAccount] Error:', err);
    if (window.triggerToast) window.triggerToast('Failed to delete account: ' + err.message, 'error');
  }
}
window.deleteUserAccount = deleteUserAccount;

export async function initAuthListeners() {
  if (!supabase) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await syncAuthenticatedUser(session.user);
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        await syncAuthenticatedUser(session.user);
      }
    });
  } catch (err) {
    console.error('[initAuthListeners] Error initializing Supabase auth listener:', err);
  }
}

async function syncAuthenticatedUser(user) {
  if (!user || !supabase) return;
  try {
    // Generate deterministic internal wallet address for Google accounts before real Web3 wallet is linked
    const internalWallet = ('0xg' + user.id.replace(/-/g, '') + '0000000000000000000000000000000000000000').substring(0, 42).toLowerCase();

    let { data: userRow, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!userRow) {
      // Check if user exists by internal wallet address
      let { data: existingWalletRow } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', internalWallet)
        .maybeSingle();

      if (existingWalletRow) {
        userRow = existingWalletRow;
        await supabase.from('users').update({ user_id: user.id, email: user.email }).eq('wallet_address', internalWallet);
      } else {
        const { data: inserted } = await supabase
          .from('users')
          .insert({
            user_id: user.id,
            wallet_address: internalWallet,
            email: user.email,
            auth_provider: 'google',
            balance_pgt: 100,
            created_at: new Date().toISOString()
          })
          .select('*')
          .maybeSingle();
        
        if (inserted) userRow = inserted;
      }
    }

    if (userRow) {
      // Primary wallet for Google accounts is ALWAYS the internal address 0xg... to guarantee single account integrity
      let activeWallet = userRow.wallet_address;
      if (!activeWallet || activeWallet.trim() === '' || !activeWallet.startsWith('0xg')) {
        activeWallet = internalWallet;
        userRow.wallet_address = internalWallet;
        try {
          await supabase.from('users').update({ wallet_address: internalWallet }).eq('user_id', user.id);
        } catch (e) {}
      }

      const currentWeb3 = appState.state.linkedWalletAddress || appState.state.walletAddress;
      const isWeb3 = currentWeb3 && !currentWeb3.startsWith('0xg') && currentWeb3.length >= 42;
      let linked = isWeb3 ? currentWeb3 : (userRow.linked_wallet_address || '');

      if (isWeb3 && userRow.linked_wallet_address !== currentWeb3.toLowerCase()) {
        try {
          const { data: rpcRes } = await supabase.rpc('link_wallet_to_account', {
            p_wallet: currentWeb3.toLowerCase(),
            p_user_id: user.id
          });
          if (rpcRes && rpcRes.success && rpcRes.merged_pgt > 0) {
            triggerToast(`🎉 Merged +${rpcRes.merged_pgt} PGT & game scores into your account!`, 'success');
          }
        } catch (e) {
          try {
            await supabase.from('users').update({ linked_wallet_address: currentWeb3.toLowerCase() }).eq('user_id', user.id);
          } catch (err) {}
        }
      }

      const rawLastClaim = userRow.last_faucet_claim || userRow.last_claim_time;
      const lastClaimTs = rawLastClaim ? new Date(rawLastClaim).getTime() : null;

      // Restore 100% of Database User Data
      appState.state.balancePgt = parseFloat(userRow.balance_pgt || 0);
      appState.state.balance1flr = parseFloat(userRow.balance_1flr || 0);
      appState.state.gameHighScore = Math.max(parseInt(userRow.game_highscore || 0, 10), appState.state.gameHighScore || 0);
      appState.state.invadersHighScore = Math.max(parseInt(userRow.invaders_highscore || 0, 10), appState.state.invadersHighScore || 0);
      appState.state.alltimeGameHighScore = Math.max(parseInt(userRow.alltime_game_highscore || userRow.game_highscore || 0, 10), appState.state.alltimeGameHighScore || 0);
      appState.state.alltimeInvadersHighScore = Math.max(parseInt(userRow.alltime_invaders_highscore || userRow.invaders_highscore || 0, 10), appState.state.alltimeInvadersHighScore || 0);
      appState.state.alltimeDriftHighScore = Math.max(parseInt(userRow.alltime_drift_highscore || userRow.drift_highscore || 0, 10), appState.state.alltimeDriftHighScore || 0);
      appState.state.driftHighScore = Math.max(parseInt(userRow.drift_highscore || 0, 10), appState.state.driftHighScore || 0);
      appState.state.lastClaimTime = lastClaimTs;
      appState.state.claimStreak = parseInt(userRow.claim_streak || 0, 10);
      appState.state.totalClaims = parseInt(userRow.total_claims || 0, 10);
      appState.state.ownedNfts = userRow.owned_nfts || [];
      appState.state.crateNfts = userRow.crate_nfts || [];
      appState.state.equippedNft = userRow.equipped_nft || null;
      appState.state.stakes = userRow.stakes || [];
      appState.state.stakedBalancePgt = parseFloat(userRow.staked_balance_pgt || 0);
      appState.state.stakedBalance1flr = parseFloat(userRow.staked_balance_1flr || 0);
      appState.state.totalStakingYield = parseFloat(userRow.total_staking_yield || 0);
      appState.state.totalEarned = parseFloat(userRow.total_earned || 0);
      appState.state.referralCode = userRow.referral_code || appState.state.referralCode;
      appState.state.referralsCount = parseInt(userRow.referrals_count || 0, 10);
      appState.state.referralsL1 = parseInt(userRow.referrals_l1 || 0, 10);
      appState.state.referralsL2 = parseInt(userRow.referrals_l2 || 0, 10);
      appState.state.referralsL3 = parseInt(userRow.referrals_l3 || 0, 10);
      appState.state.referralsL4 = parseInt(userRow.referrals_l4 || 0, 10);
      appState.state.unclaimedReferralPgt = parseFloat(userRow.unclaimed_referral_pgt || 0);
      appState.state.unclaimedReferralPol = parseFloat(userRow.unclaimed_referral_pol || 0);
      appState.state.totalReferralPol = parseFloat(userRow.total_referral_pol || 0);
      appState.state.isAmbassador = !!userRow.is_ambassador;
      appState.state.totalReferralCommission = parseFloat(userRow.total_referral_commission || 0);
      appState.state.activities = userRow.activities || [];

      // Restore PolySpace Mining Data
      if (userRow.space_state && typeof userRow.space_state === 'object' && Object.keys(userRow.space_state).length > 0) {
        appState.state.spaceState = { ...appState.state.spaceState, ...userRow.space_state };
      }

      if (window.polySpace && typeof window.polySpace.loadSpaceState === 'function') {
        window.polySpace.loadSpaceState();
      }

      appState.update({
        authUserId: user.id,
        authUserEmail: user.email,
        walletConnected: true,
        walletProvider: linked ? 'google_linked' : 'google',
        walletAddress: activeWallet,
        linkedWalletAddress: linked
      });

      const selectState = document.getElementById('wallet-select-state');
      const connectedState = document.getElementById('wallet-connected-state');
      const modalTitle = document.getElementById('wallet-modal-title');
      const walletDisp = document.getElementById('wallet-address-display');

      if (selectState) selectState.style.display = 'none';
      if (connectedState) connectedState.style.display = 'block';
      if (modalTitle) modalTitle.innerText = 'Account & Wallet Manager';

      const btnLinkGoogleModal = document.getElementById('btn-link-google-action');
      if (btnLinkGoogleModal) {
        if (!appState.state.authUserEmail && !appState.state.authUserId) {
          btnLinkGoogleModal.style.display = 'block';
        } else {
          btnLinkGoogleModal.style.display = 'none';
        }
      }

      const fullAddrEl = document.getElementById('wallet-addr-full');
      if (fullAddrEl) {
        fullAddrEl.innerText = userRow.wallet_address 
          ? 'Linked Wallet: ' + userRow.wallet_address 
          : 'Google Account: ' + user.email + ' (No Wallet Linked)';
      }
      if (walletDisp) {
        walletDisp.innerText = userRow.wallet_address 
          ? userRow.wallet_address.substring(0, 6) + '...' + userRow.wallet_address.substring(38) 
          : (user.email ? user.email.split('@')[0] : 'Google User');
      }
    }
  } catch (e) {
    console.error('Error syncing authenticated social user:', e);
  }
}

// Auto-initialize auth listeners when db-sync is imported
initAuthListeners();

// --- Strict Web3 Address Validation & Shortening Helpers ---

export function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') return false;
  const cleanAddr = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(cleanAddr) && !cleanAddr.toLowerCase().startsWith('0xg');
}
window.isValidEthereumAddress = isValidEthereumAddress;

export function formatShortAddress(address) {
  if (!address) return 'None';
  if (address.startsWith('0xg')) return 'Google User';
  if (address.length >= 42) {
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  return address;
}
window.formatShortAddress = formatShortAddress;
