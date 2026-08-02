import { supabase, ADMIN_WALLET_ADDRESS } from './config.js';
import { sfx } from './audio.js';
import { appState } from './state.js';
import { closeModal, triggerToast, connectWeb3 } from './ui.js';

const getAppState = () => (typeof appState !== 'undefined' && appState) ? appState : (typeof window !== 'undefined' ? window.appState : null);

// --- Unauthenticated Guest Visit Tracker ---
export async function trackGuestVisit() {
  const activeState = getAppState();
  if (!supabase || (activeState && activeState.isPlayerConnected())) return;
  try {
    const visited = localStorage.getItem('polygame_guest_visit_logged');
    if (!visited) {
      const { data } = await supabase.rpc('record_guest_visit');
      if (data && (data.success || data.guest_visitors !== undefined)) {
        localStorage.setItem('polygame_guest_visit_logged', new Date().toISOString());
      }
    }
  } catch (e) {
    console.warn("Guest visit tracking skipped:", e);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(trackGuestVisit, 2000));
  } else {
    setTimeout(trackGuestVisit, 2000);
  }
}

// --- DB Sync: Load or Merge user profile from Supabase ---

export async function syncProfileWithDb(address, pgtBalance, flrBalance, maticBalance, chainNfts, silent = false) {
    if (!address) return;

    if (!appState || !appState.state) {
      if (window.PolyState) window.appState = new window.PolyState();
    }

    if (appState) {
      if (appState._dbSaveTimer) {
        clearTimeout(appState._dbSaveTimer);
        appState._dbSaveTimer = null;
      }
      appState.isSyncingWithDB = true;
    }
    
    const currentState = (appState && appState.state) ? appState.state : {};
    
    // Prevent cross-wallet state bleeding on account switch
    if (currentState.walletConnected && currentState.walletAddress && currentState.walletAddress.toLowerCase() !== address.toLowerCase()) {
      console.log("Wallet switch detected. Wiping local state cleanly.");
      if (appState && typeof appState.resetToDefault === 'function') {
        appState.resetToDefault(address);
      } else if (appState && appState.defaultState) {
        appState.state = JSON.parse(JSON.stringify(appState.defaultState));
        appState.state.walletAddress = address.toLowerCase();
        appState.state.linkedWalletAddress = address.toLowerCase();
      }
    }

    let dbUserRecord = null;

    if (supabase) {
      if (!silent) triggerToast("Syncing Database Profile...", "success");
      const normalizedAddress = address.toLowerCase();
      
      let query = supabase.from('users').select('*');
      if (currentState.authUserId) {
        query = query.eq('user_id', currentState.authUserId);
      } else {
        query = query.or(`player_id.ilike.${normalizedAddress},linked_wallet_address.ilike.${normalizedAddress}`);
      }
      
      let { data, error } = await query.maybeSingle();

      // Case-insensitive Fallback if user_id query returned null (e.g. standalone Web3 account)
      if (!data && normalizedAddress) {
        const { data: fbData } = await supabase.from('users').select('*')
          .or(`player_id.ilike.${normalizedAddress},linked_wallet_address.ilike.${normalizedAddress}`)
          .maybeSingle();
        if (fbData) data = fbData;
      }

      if (data && !error) {
        dbUserRecord = data;
        // Bind primary database player_id, wallet_address, and user credentials
        const canonicalId = (data.player_id || data.wallet_address || '').toLowerCase();
        if (canonicalId) {
          appState.state.playerId = canonicalId;
          appState.state.walletAddress = canonicalId;
        }
        if (data.linked_wallet_address) {
          appState.state.linkedWalletAddress = data.linked_wallet_address.toLowerCase();
        } else if (normalizedAddress && normalizedAddress !== canonicalId && !normalizedAddress.startsWith('0xpgt') && !normalizedAddress.startsWith('0xg')) {
          appState.state.linkedWalletAddress = normalizedAddress;
        }
        if (data.user_id) appState.state.authUserId = data.user_id;
        if (data.email) appState.state.authUserEmail = data.email;

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
        
        // Non-destructive merge for ownedNfts so purchased NFTs are never lost
        const dbOwned = data.owned_nfts || [];
        const localOwned = appState.state.ownedNfts || [];
        appState.state.ownedNfts = Array.from(new Set([...dbOwned, ...localOwned]));
        appState.state.crateNfts = data.crate_nfts || [];
        appState.state.stakes = stakesData;
        appState.state.totalStakingYield = data.total_staking_yield || 0;
        appState.state.activities = data.activities || [];
        appState.state.referralsList = data.referrals_list || [];

        // Maximize PolySpace building upgrade levels so upgrades NEVER revert
        if (data.space_state && typeof data.space_state === 'object' && Object.keys(data.space_state).length > 0) {
          const localSpace = appState.state.spaceState || {};
          const dbSpace = data.space_state;
          const mergedSpace = { ...localSpace, ...dbSpace };
          ['cargoLevel', 'laserLevel', 'shieldLevel', 'turretLevel', 'warpLevel'].forEach(lvlKey => {
            mergedSpace[lvlKey] = Math.max(localSpace[lvlKey] || 1, dbSpace[lvlKey] || 1);
          });
          mergedSpace.iron = Math.max(localSpace.iron || 0, dbSpace.iron || 0);
          mergedSpace.titanium = Math.max(localSpace.titanium || 0, dbSpace.titanium || 0);
          mergedSpace.quantum = Math.max(localSpace.quantum || 0, dbSpace.quantum || 0);
          mergedSpace.pgtOre = Math.max(localSpace.pgtOre || 0, dbSpace.pgtOre || 0);
          appState.state.spaceState = mergedSpace;
        } else if (appState.state.spaceState && Object.keys(appState.state.spaceState).length > 0) {
          appState.saveToDB();
        }

        // Maximize daily quest progress so quest counters NEVER revert
        if (data.daily_quests && typeof data.daily_quests === 'object' && Object.keys(data.daily_quests).length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const localQ = appState.state.dailyQuests || {};
          const dbQ = data.daily_quests;
          if (dbQ.date === today && localQ.date === today) {
            appState.state.dailyQuests = {
              date: today,
              games: Math.max(dbQ.games || 0, localQ.games || 0),
              mining: Math.max(dbQ.mining || 0, localQ.mining || 0),
              wins: Math.max(dbQ.wins || 0, localQ.wins || 0),
              games_claimed: !!(dbQ.games_claimed || localQ.games_claimed),
              mining_claimed: !!(dbQ.mining_claimed || localQ.mining_claimed),
              wins_claimed: !!(dbQ.wins_claimed || localQ.wins_claimed),
              master_claimed: !!(dbQ.master_claimed || localQ.master_claimed),
              streak_days: Math.max(dbQ.streak_days || 0, localQ.streak_days || 0),
              last_streak_date: dbQ.last_streak_date || localQ.last_streak_date || ''
            };
          } else if (dbQ.date === today) {
            appState.state.dailyQuests = dbQ;
          }
          try { localStorage.setItem('polygame_daily_quests', JSON.stringify(appState.state.dailyQuests)); } catch(e){}
        }

        if (window.renderDailyQuestsUI) {
          window.renderDailyQuestsUI();
        }

        if (window.polySpace && typeof window.polySpace.loadSpaceState === 'function') {
          window.polySpace.loadSpaceState();
          if (typeof window.polySpace.updateUI === 'function') {
            window.polySpace.updateUI();
          }
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
        const isWeb3Address = normalizedAddress && !normalizedAddress.startsWith('0xpgt') && !normalizedAddress.startsWith('0xg');
        if (!isWeb3Address && !currentState.authUserId) {
          console.log("Guest player: skipping Supabase database row creation.");
          appState.isSyncingWithDB = false;
          return;
        }

        // New registered user (Web3 or Google): Create initial user record in Supabase
        console.log("No DB profile found. Creating initial user record in Supabase for:", normalizedAddress);

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

        try {
          const isWeb3Address = normalizedAddress && !normalizedAddress.startsWith('0xpgt') && !normalizedAddress.startsWith('0xg');
          const generatedPlayerId = ('0xpgt' + Math.random().toString(16).substring(2, 10).padEnd(36, '0')).substring(0, 42).toLowerCase();
          const internalId = isWeb3Address ? generatedPlayerId : normalizedAddress;

          const initUserRecord = {
            player_id: internalId,
            wallet_address: internalId,
            username: appState.state.username || '',
            balance_pgt: appState.state.balancePgt || 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          if (isWeb3Address) {
            initUserRecord.linked_wallet_address = normalizedAddress;
          }
          if (appState.state.authUserId) {
            initUserRecord.user_id = appState.state.authUserId;
            initUserRecord.linked_wallet_address = normalizedAddress;
          }
          
          appState.state.playerId = internalId;
          appState.state.walletAddress = internalId;
          if (isWeb3Address) appState.state.linkedWalletAddress = normalizedAddress;

          const { data: existingUser } = await supabase.from('users').select('player_id').or(`player_id.eq.${internalId},linked_wallet_address.eq.${internalId}`).maybeSingle();
          if (existingUser) {
            await supabase.from('users').update(initUserRecord).eq('player_id', internalId);
          } else {
            await supabase.from('users').insert(initUserRecord);
          }
        } catch (initErr) {
          console.error("Failed to create initial user record in Supabase:", initErr);
        }

        // Check for pending referral link click & bind 4-tier downlines
        const pendingRef = localStorage.getItem('polygame_pending_referral');
        if (pendingRef) {
          try {
            const { data: bindRes } = await supabase.rpc('bind_referral_code', {
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
    let activeUserId = (appState && appState.state) ? appState.state.authUserId : null;
    if (!activeUserId && supabase && supabase.auth) {
      try {
        const { data: sData } = await supabase.auth.getSession();
        if (sData?.session?.user?.id) {
          activeUserId = sData.session.user.id;
          if (appState && appState.state) appState.state.authUserId = activeUserId;
        }
      } catch (e) {}
    }

    let primaryWallet = (appState && appState.state && appState.state.walletAddress) ? appState.state.walletAddress : address;
    let linkedWallet = (appState && appState.state && appState.state.linkedWalletAddress) ? appState.state.linkedWalletAddress : '';

    if (address && !address.toLowerCase().startsWith('0xpgt') && !address.toLowerCase().startsWith('0xg')) {
      const normAddr = address.toLowerCase();

      // Security Pre-Check: Validate if wallet address is ALREADY registered in DB under another account
      if (activeUserId) {
        try {
          const { data: existingUser } = await supabase
            .from('users')
            .select('user_id, player_id, linked_wallet_address')
            .or(`player_id.ilike.${normAddr},linked_wallet_address.ilike.${normAddr}`)
            .maybeSingle();

          if (existingUser && existingUser.user_id !== activeUserId) {
            console.warn(`[syncProfileWithDb] Connection Rejected: Address ${normAddr} is already registered to a separate account (user_id: ${existingUser.user_id || 'standalone'})`);
            if (!silent && window.triggerToast) {
              window.triggerToast(`⚠️ Linking Blocked: Wallet address ${formatShortAddress(address)} is already registered to another account in the database.`, 'error');
            }
            // Disconnect Web3 to prevent local state corruption or account bleed
            setWeb3Provider(null);
            setRealSigner(null);
            appState.isSyncingWithDB = false;
            closeModal('wallet');
            return;
          }

          // Address is clean and unassociated - safe to link to Google account
          await supabase
            .from('users')
            .update({ linked_wallet_address: normAddr, updated_at: new Date().toISOString() })
            .eq('user_id', activeUserId);
          linkedWallet = normAddr;
        } catch (e) {
          console.error("Failed to validate/update linked_wallet_address in DB:", e);
        }
      } else {
        // For direct Web3 users, primary wallet is 0x...
        primaryWallet = address;
        linkedWallet = address;
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

    // Verify on-chain Web3 NFTs strictly per wallet address without cross-account bleed
    if (Array.isArray(chainNfts)) {
      if (chainNfts.length > 0) {
        updatePayload.ownedNfts = Array.from(new Set(chainNfts));
      } else if (address && !address.toLowerCase().startsWith('0xpgt') && !address.toLowerCase().startsWith('0xg')) {
        updatePayload.ownedNfts = [];
      } else {
        updatePayload.ownedNfts = (dbUserRecord && Array.isArray(dbUserRecord.owned_nfts)) ? dbUserRecord.owned_nfts : (appState.state.ownedNfts || []);
      }
    } else {
      updatePayload.ownedNfts = (dbUserRecord && Array.isArray(dbUserRecord.owned_nfts)) ? dbUserRecord.owned_nfts : (appState.state.ownedNfts || []);
    }

    // If equipped NFT is no longer owned, unequip it
    const combinedNfts = [...updatePayload.ownedNfts, ...(appState.state.crateNfts || [])];
    if (appState.state.equippedNft && !combinedNfts.includes(appState.state.equippedNft)) {
       updatePayload.equippedNft = null;
    }

    appState.isSyncingWithDB = false;
    appState.update(updatePayload);
    appState.saveToDB(); // Overwrite & clean any corrupted DB rows with verified state

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

  if (appState.isPlayerConnected() && supabase) {
    const wallet = (appState.getPlayerId() || appState.state.walletAddress || '').toLowerCase();
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
          claim_amount: cleanAmt,
          claim_action: 'Arcade Win'
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
      }).or(`player_id.eq.${wallet},linked_wallet_address.eq.${wallet}`);
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

  setWeb3Provider(null);
  setRealSigner(null);

  try {
    localStorage.removeItem('polygame_state');
    localStorage.removeItem('polygame_state_checksum');
    localStorage.removeItem('polygame_guest_address');
  } catch (e) {}

  if (appState) {
    appState.resetToDefault();
  }

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

  if (window.renderDailyQuestsUI) window.renderDailyQuestsUI();
  if (window.syncProfileView) window.syncProfileView();

  if (window.triggerToast) window.triggerToast("Logged out successfully. Switched to Guest Mode.", "info");
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
      .or(`player_id.eq.${appState.getPlayerId().toLowerCase()},linked_wallet_address.eq.${appState.getPlayerId().toLowerCase()}`)
      .maybeSingle();

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
  if (!supabase || !appState.state.walletAddress) return null;
  
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

      if (typeof window.loadInvadersLeaderboard === 'function') {
        window.loadInvadersLeaderboard();
      }
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
    let updateQuery = supabase.from('users').update({
      balance_pgt: newBal,
      invaders_highscore: appState.state.invadersHighScore,
      alltime_invaders_highscore: Math.max(appState.state.alltimeInvadersHighScore || 0, score),
      updated_at: new Date().toISOString()
    });

    if (appState.state.authUserId) {
      updateQuery = updateQuery.eq('user_id', appState.state.authUserId);
    } else {
      updateQuery = updateQuery.or(`player_id.ilike.${address},linked_wallet_address.ilike.${address}`);
    }
    await updateQuery;
  } catch (e) {
    console.error("Invaders fallback error:", e);
  }

  if (typeof window.loadInvadersLeaderboard === 'function') {
    window.loadInvadersLeaderboard();
  }

  return { success: true, payout: finalPgt, new_balance: newBal, new_high_score: isNewHigh, score };
}
window.submitInvadersScoreToDB = submitInvadersScoreToDB;
window.syncProfileWithDb = syncProfileWithDb;

export async function submitHighScoreToDB(gameType, score) {
  if (!supabase) return;
  const primary = (appState.state.walletAddress || '').toLowerCase();
  const linked = (appState.state.linkedWalletAddress || '').toLowerCase();
  const isInternal = (addr) => addr && (addr.startsWith('0xpgt') || addr.startsWith('0xg'));
  const targetWallet = (linked && !isInternal(linked)) ? linked : (primary || linked);
  if (!targetWallet) return;

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
  appState.save();

  const payload = { p_wallet: targetWallet };
  if (gameType === 'astrododge') payload.p_game_highscore = cleanScore;
  else if (gameType === 'invaders') payload.p_invaders_highscore = cleanScore;
  else if (gameType === 'drift') payload.p_drift_highscore = cleanScore;

  try {
    const { error } = await supabase.rpc('submit_arcade_highscore', payload);
    if (error) {
      console.warn("[submitHighScoreToDB] RPC warning, using fallback update:", error.message);
      const dbUpdate = { updated_at: new Date().toISOString() };
      if (gameType === 'astrododge') dbUpdate.game_highscore = cleanScore;
      if (gameType === 'invaders') dbUpdate.invaders_highscore = cleanScore;
      if (gameType === 'drift') dbUpdate.drift_highscore = cleanScore;
      
      try {
        if (appState.state.authUserId) {
          await supabase.from('users').update(dbUpdate).eq('user_id', appState.state.authUserId);
        } else {
          await supabase.from('users').update(dbUpdate).or(`player_id.eq.${targetWallet},linked_wallet_address.eq.${targetWallet}`);
        }
      } catch (e) {
        console.error("[submitHighScoreToDB] Direct update error:", e);
      }
    }
  } catch (err) {
    console.error("[submitHighScoreToDB] RPC exception:", err);
  }

  // Refresh live leaderboards UI immediately
  if (gameType === 'astrododge' && typeof window.loadAstroDodgeLeaderboard === 'function') {
    window.loadAstroDodgeLeaderboard();
  } else if (gameType === 'invaders' && typeof window.loadInvadersLeaderboard === 'function') {
    window.loadInvadersLeaderboard();
  } else if (gameType === 'drift' && typeof window.loadDriftLeaderboard === 'function') {
    window.loadDriftLeaderboard();
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

  // Security Pre-Check: Prevent linking a wallet address that ALREADY belongs to another account in DB
  try {
    const normAddr = address.toLowerCase();
    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id, player_id, linked_wallet_address')
      .or(`player_id.ilike.${normAddr},linked_wallet_address.ilike.${normAddr}`)
      .maybeSingle();

    if (existingUser && existingUser.user_id !== userId) {
      if (window.triggerToast) {
        window.triggerToast(`⚠️ Linking Rejected: Wallet address ${formatShortAddress(address)} is already registered to a separate account in the database.`, 'error');
      }
      return false;
    }
  } catch (chkErr) {
    console.error('[linkWalletToAccount] Collision check error:', chkErr);
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
    const internalWallet = ('0xpgt' + user.id.replace(/-/g, '') + '0000000000000000000000000000000000000000').substring(0, 42).toLowerCase();

    let { data: userRow, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const rawGoogleName = user.user_metadata?.full_name || user.user_metadata?.name || '';
    const initialUsername = (rawGoogleName && !rawGoogleName.includes('@')) ? rawGoogleName : '';

    if (!userRow) {
      // Check if user exists by internal player_id
      let { data: existingWalletRow } = await supabase
        .from('users')
        .select('*')
        .or(`player_id.eq.${internalWallet},user_id.eq.${user.id}`)
        .maybeSingle();

      if (existingWalletRow) {
        userRow = existingWalletRow;
        const up = { user_id: user.id, email: user.email };
        if (!userRow.username && initialUsername) up.username = initialUsername;
        await supabase.from('users').update(up).eq('user_id', user.id);
      } else {
        const { data: inserted } = await supabase
          .from('users')
          .insert({
            user_id: user.id,
            player_id: internalWallet,
            email: user.email,
            username: initialUsername,
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
      // Only set username if real name is available and db username is blank
      if ((!userRow.username || userRow.username.trim() === '') && initialUsername) {
        userRow.username = initialUsername;
        try {
          await supabase.from('users').update({ username: initialUsername }).eq('user_id', user.id);
        } catch (e) {}
      }

      // Primary wallet for Google accounts is ALWAYS the internal address 0xpgt... to guarantee single account integrity
      let activeWallet = userRow.player_id || internalWallet;
      if (!activeWallet || activeWallet.trim() === '' || (!activeWallet.toLowerCase().startsWith('0xpgt') && !activeWallet.toLowerCase().startsWith('0xg'))) {
        activeWallet = internalWallet;
        userRow.player_id = internalWallet;
        try {
          await supabase.from('users').update({ player_id: internalWallet }).eq('user_id', user.id);
        } catch (e) {}
      }

      // Check for pending referral link click & bind 4-tier downlines for Google account
      const pendingRef = localStorage.getItem('polygame_pending_referral');
      const userPid = userRow.player_id || internalWallet;
      if (pendingRef && userRow && userPid) {
        try {
          const { data: bindRes } = await supabase.rpc('bind_referral_code', {
            p_user_wallet: userPid.toLowerCase(),
            p_ref_code: pendingRef
          });
          if (bindRes && bindRes.success) {
            if (window.triggerToast) {
              window.triggerToast("🎉 Referral applied across 4-Tier network!", "success");
            }
          }
        } catch (err) {
          console.warn("[syncAuthenticatedUser] Failed to bind referral code via RPC:", err);
        }
        localStorage.removeItem('polygame_pending_referral');
      }

      let activeWeb3Address = null;
      if (realSigner) {
        try { activeWeb3Address = (await realSigner.getAddress()).toLowerCase(); } catch (e) {}
      }
      const isWeb3 = activeWeb3Address && (!activeWeb3Address.startsWith('0xpgt') && !activeWeb3Address.startsWith('0xg')) && activeWeb3Address.length === 42;
      let linked = isWeb3 ? activeWeb3Address : (userRow.linked_wallet_address || '');

      if (isWeb3 && userRow.linked_wallet_address !== activeWeb3Address) {
        try {
          const normWeb3 = activeWeb3Address;
          // Security Pre-Check: Ensure active Web3 wallet is not registered to another account
          const { data: existingWeb3Row } = await supabase
            .from('users')
            .select('user_id, player_id, linked_wallet_address')
            .or(`player_id.ilike.${normWeb3},linked_wallet_address.ilike.${normWeb3}`)
            .maybeSingle();

          if (existingWeb3Row && existingWeb3Row.user_id !== user.id) {
            console.warn(`[syncAuthenticatedUser] Active Web3 wallet ${normWeb3} belongs to another account. Skipping link.`);
            if (window.triggerToast) {
              window.triggerToast(`⚠️ Active wallet ${formatShortAddress(currentWeb3)} is registered to a separate account. Logging into Google without linking.`, 'warning');
            }
            linked = userRow.linked_wallet_address || '';
          } else {
            const { data: rpcRes } = await supabase.rpc('link_wallet_to_account', {
              p_wallet: normWeb3,
              p_user_id: user.id
            });
            if (rpcRes && rpcRes.success && rpcRes.merged_pgt > 0) {
              triggerToast(`🎉 Merged +${rpcRes.merged_pgt} PGT & game scores into your account!`, 'success');
            }
            linked = normWeb3;
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

      const isWeb3Active = !!(appState.state.walletConnected && window.realSigner);

      appState.update({
        authUserId: user.id,
        authUserEmail: user.email,
        walletConnected: true,
        walletProvider: isWeb3Active ? 'google_linked' : 'google',
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

      const isInternalAddr = (addr) => !addr || addr.toLowerCase().startsWith('0xpgt') || addr.toLowerCase().startsWith('0xg');
      const realLinked = (linked && !isInternalAddr(linked)) 
        ? linked 
        : (!isInternalAddr(userRow.wallet_address) ? userRow.wallet_address : null);

      const fullAddrEl = document.getElementById('wallet-addr-full');
      if (fullAddrEl) {
        fullAddrEl.innerText = realLinked 
          ? 'Linked Wallet: ' + realLinked 
          : 'Google Account: ' + (user.email || 'Connected') + ' (No Web3 Wallet Linked)';
      }
      if (walletDisp) {
        walletDisp.innerText = realLinked 
          ? realLinked.substring(0, 6) + '...' + realLinked.substring(realLinked.length - 4) 
          : (user.email ? user.email.split('@')[0] : 'Google Account');
      }

      // Non-blocking background NFT check for Google users with linked Web3 wallet
      setTimeout(() => {
        try {
          const linkedW = (userRow.linked_wallet_address && !isInternalAddr(userRow.linked_wallet_address)) ? userRow.linked_wallet_address : (!isInternalAddr(userRow.wallet_address) ? userRow.wallet_address : null);
          if (linkedW && linkedW.length >= 42 && typeof window.getOwnedNftsFromChain === 'function') {
            window.getOwnedNftsFromChain(linkedW).then(chainNfts => {
              if (Array.isArray(chainNfts)) {
                appState.state.ownedNfts = Array.from(new Set(chainNfts));
                appState.saveToDB();
                if (typeof window.renderNftInventory === 'function') window.renderNftInventory();
              }
            }).catch(err => console.warn("Background chain NFT fetch error on Google login:", err));
          }
        } catch (e) {}
      }, 1500);
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
  const cleanAddr = address.trim().toLowerCase();
  return /^0x[a-fA-F0-9]{40}$/.test(cleanAddr) && !cleanAddr.startsWith('0xpgt') && !cleanAddr.startsWith('0xg');
}
window.isValidEthereumAddress = isValidEthereumAddress;

export function formatShortAddress(address) {
  if (!address) return 'None';
  const lower = address.toLowerCase();
  if (lower.startsWith('0xpgt') || lower.startsWith('0xg')) return 'Google User';
  if (address.length >= 42) {
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  return address;
}
window.formatShortAddress = formatShortAddress;
