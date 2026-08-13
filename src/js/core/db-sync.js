import { supabase, ADMIN_WALLET_ADDRESS, web3Provider, realSigner, setWeb3Provider, setRealSigner } from './config.js';
import { sfx } from './audio.js';
import { appState, PolyState } from './state.js';
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

    let activeAppState = getAppState();
    if (!activeAppState || !activeAppState.state) {
      const StateClass = (typeof PolyState !== 'undefined') ? PolyState : (typeof window !== 'undefined' ? window.PolyState : null);
      if (StateClass) {
        window.appState = new StateClass();
        activeAppState = window.appState;
      }
    }
    if (!activeAppState || !activeAppState.state) {
      console.error("[syncProfileWithDb] Unable to resolve valid PolyState instance.");
      return;
    }

    if (activeAppState._dbSaveTimer) {
      clearTimeout(activeAppState._dbSaveTimer);
      activeAppState._dbSaveTimer = null;
    }
    activeAppState.isSyncingWithDB = true;
    
    const currentState = activeAppState.state || {};
    const activeAddress = (currentState.linkedWalletAddress || currentState.walletAddress || currentState.playerId || '').toLowerCase();
    const incomingAddress = (address || '').toLowerCase();

    // Prevent cross-wallet state bleeding on account switch
    if (activeAddress && incomingAddress && activeAddress !== incomingAddress && !activeAddress.startsWith('0xguest')) {
      console.log(`[syncProfileWithDb] Account switch detected (${activeAddress} -> ${incomingAddress}). Resetting local state.`);
      if (typeof activeAppState.resetToDefault === 'function') {
        activeAppState.resetToDefault(incomingAddress);
      } else if (activeAppState.defaultState) {
        activeAppState.state = JSON.parse(JSON.stringify(activeAppState.defaultState));
        activeAppState.state.walletAddress = incomingAddress;
        activeAppState.state.linkedWalletAddress = incomingAddress;
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

      if (error && error.code !== 'PGRST116') {
        console.warn("Primary user profile query failed, attempting fallback by player_id:", error);
        const { data: fbData } = await supabase.from('users').select('*')
          .or(`player_id.eq.${normalizedAddress},linked_wallet_address.eq.${normalizedAddress}`)
          .maybeSingle();
        if (fbData) data = fbData;
      }

      if (data && !error) {
        dbUserRecord = data;
        // Bind primary database player_id, wallet_address, and user credentials
        const canonicalId = (data.player_id || data.wallet_address || '').toLowerCase();
        if (canonicalId) {
          activeAppState.state.playerId = canonicalId;
          activeAppState.state.walletAddress = canonicalId;
        }
        if (data.linked_wallet_address) {
          activeAppState.state.linkedWalletAddress = data.linked_wallet_address.toLowerCase();
        } else if (normalizedAddress && normalizedAddress !== canonicalId && !normalizedAddress.startsWith('0xpgt') && !normalizedAddress.startsWith('0xg')) {
          activeAppState.state.linkedWalletAddress = normalizedAddress;
        }
        if (data.user_id) activeAppState.state.authUserId = data.user_id;
        if (data.email) activeAppState.state.authUserEmail = data.email;

        // User exists in DB, merge DB state into local guest state (DB wins)
        console.log("Found existing profile in DB:", data);
        activeAppState.state.vipUntil = data.vip_until || null;
        if (data.username) {
          activeAppState.state.username = data.username;
          localStorage.setItem(`polygame_username_${normalizedAddress}`, data.username);
        } else {
          const localSaved = localStorage.getItem(`polygame_username_${normalizedAddress}`);
          if (localSaved) activeAppState.state.username = localSaved;
        }
        activeAppState.state.isAmbassador = !!data.is_ambassador;
        activeAppState.state.balancePgt = data.balance_pgt || 0;
        activeAppState.state.balance1flr = data.balance_1flr || 0;
        activeAppState.state.totalClaims = data.total_claims || 0;
        const rawLastClaim = data.last_faucet_claim || data.last_claim_time;
        activeAppState.state.lastClaimTime = rawLastClaim ? new Date(rawLastClaim).getTime() : null;
        activeAppState.state.claimStreak = data.claim_streak || 0;
        activeAppState.state.gameHighScore = parseInt(data.game_highscore || 0, 10);
        activeAppState.state.invadersHighScore = parseInt(data.invaders_highscore || 0, 10);
        activeAppState.state.driftHighScore = parseInt(data.drift_highscore || 0, 10);
        
        // Fetch stakes from the new user_stakes table
        let stakesData = [];
        const { data: sData, error: sErr } = await supabase.rpc('get_user_stakes', { p_wallet: normalizedAddress });
        if (sData && sData.success) {
          stakesData = sData.stakes;
        } else if (data.stakes) {
          // fallback to legacy column if migration hasn't been happened
          stakesData = data.stakes;
        }
        
        // Sourced strictly from DB record for existing users (prevents cross-account local state bleeding)
        const dbOwned = Array.isArray(data.owned_nfts) ? data.owned_nfts : [];
        activeAppState.state.ownedNfts = Array.from(new Set([...dbOwned]));
        activeAppState.state.crateNfts = data.crate_nfts || [];
        activeAppState.state.stakes = stakesData;
        activeAppState.state.totalStakingYield = data.total_staking_yield || 0;
        activeAppState.state.activities = data.activities || [];
        activeAppState.state.referralsList = data.referrals_list || [];

        // PolySpace state sourced strictly from DB record for existing users (prevents cross-account state bleeding)
        const defaultSpace = {
          warpLevel: 1,
          laserLevel: 1,
          cargoLevel: 1,
          shieldLevel: 1,
          turretLevel: 1,
          fleetPower: 100,
          iron: 50,
          titanium: 10,
          quantum: 0,
          pgtOre: 0,
          expeditions: [],
          missionLogs: [],
          pokesToday: 0,
          lastPokeDate: null,
          lastOpDate: null,
          raidsWon: 0,
          mineralsMinedTotal: 0
        };

        if (data.space_state && typeof data.space_state === 'object' && Object.keys(data.space_state).length > 0) {
          activeAppState.state.spaceState = { ...defaultSpace, ...data.space_state };
        } else {
          activeAppState.state.spaceState = { ...defaultSpace };
        }

        // Maximize daily quest progress so quest counters NEVER revert
        if (data.daily_quests && typeof data.daily_quests === 'object' && Object.keys(data.daily_quests).length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const localQ = activeAppState.state.dailyQuests || {};
          const dbQ = data.daily_quests;
          if (dbQ.date === today && localQ.date === today) {
            activeAppState.state.dailyQuests = {
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
            activeAppState.state.dailyQuests = dbQ;
          }
          try { localStorage.setItem('polygame_daily_quests', JSON.stringify(activeAppState.state.dailyQuests)); } catch(e){}
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

        activeAppState.state.equippedNft = data.equipped_nft;
        activeAppState.state.stakedBalancePgt = data.staked_balance_pgt || 0;
        activeAppState.state.stakedBalance1flr = data.staked_balance_1flr || 0;
        activeAppState.state.referralsCount = data.referrals_count || 0;
        activeAppState.state.referralsL1 = data.referrals_l1 || 0;
        activeAppState.state.referralsL2 = data.referrals_l2 || 0;
        activeAppState.state.referralsL3 = data.referrals_l3 || 0;
        activeAppState.state.referralsL4 = data.referrals_l4 || 0;
        activeAppState.state.totalReferralCommission = data.total_referral_commission || 0;
        activeAppState.state.unclaimedReferralPgt = data.unclaimed_referral_pgt || 0;
        
        let validRefCode = data.referral_code;
        if (!validRefCode || validRefCode.trim() === '' || validRefCode === 'EMPTY') {
          validRefCode = 'ref_' + Math.random().toString(16).substring(2, 10);
          data.referral_code = validRefCode;
          try {
            supabase.from('users').update({ referral_code: validRefCode }).eq('player_id', data.player_id).then(() => {});
          } catch (e) {}
        }
        activeAppState.state.referralCode = validRefCode;
      } else {
        const isWeb3Address = normalizedAddress && !normalizedAddress.startsWith('0xpgt') && !normalizedAddress.startsWith('0xg');
        if (!isWeb3Address && !currentState.authUserId) {
          console.log("Guest player: skipping Supabase database row creation.");
          activeAppState.isSyncingWithDB = false;
          return;
        }

        // New registered user (Web3 or Google): Create initial user record in Supabase
        console.log("No DB profile found. Creating initial user record in Supabase for:", normalizedAddress);

        // Security Cap: Prevent fake guest state injection (>1,000 PGT) on first wallet registration
        if (activeAppState.state.balancePgt > 1000) {
          console.warn("Guest balance exceeds security threshold. Capping to 1,000 PGT for new account registration.");
          if (typeof window.sendAdminAlert === 'function') {
            window.sendAdminAlert({
              category: 'SECURITY ANOMALY',
              title: '⚠️ High Guest Balance Sanitized on Wallet Connect',
              description: `Player \`${address}\` attempted to register a new account with \`${activeAppState.state.balancePgt.toFixed(2)} PGT\` guest balance. Sanitized to 1,000 PGT max.`,
              color: 0xFF0000
            });
          }
          activeAppState.state.balancePgt = 1000;
        }

        try {
          const isWeb3Address = normalizedAddress && !normalizedAddress.startsWith('0xpgt') && !normalizedAddress.startsWith('0xg');
          const generatedPlayerId = ('0xpgt' + Math.random().toString(16).substring(2, 10)).toLowerCase();
          const internalId = isWeb3Address ? generatedPlayerId : normalizedAddress;
          const genCode = 'ref_' + Math.random().toString(16).substring(2, 10);

          const initUserRecord = {
            player_id: internalId,
            username: activeAppState.state.username || '',
            referral_code: genCode,
            balance_pgt: activeAppState.state.balancePgt || 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          activeAppState.state.referralCode = genCode;
          if (isWeb3Address) {
            initUserRecord.linked_wallet_address = normalizedAddress;
          }
          if (activeAppState.state.authUserId) {
            initUserRecord.user_id = activeAppState.state.authUserId;
            initUserRecord.linked_wallet_address = normalizedAddress;
          }
          
          activeAppState.state.playerId = internalId;
          activeAppState.state.walletAddress = internalId;
          if (isWeb3Address) activeAppState.state.linkedWalletAddress = normalizedAddress;

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
        const pendingRef = localStorage.getItem('polygame_pending_referral') || sessionStorage.getItem('polygame_pending_referral');
        if (pendingRef) {
          try {
            const targetWallet = activeAppState.state.playerId || normalizedAddress;
            let bindRes = null;
            const res1 = await supabase.rpc('bind_referral_code', {
              p_user_wallet: targetWallet,
              p_ref_code: pendingRef
            });
            bindRes = res1 ? res1.data : null;

            if ((!bindRes || !bindRes.success) && normalizedAddress && normalizedAddress.toLowerCase() !== targetWallet.toLowerCase()) {
              const res2 = await supabase.rpc('bind_referral_code', {
                p_user_wallet: normalizedAddress,
                p_ref_code: pendingRef
              });
              if (res2 && res2.data && res2.data.success) bindRes = res2.data;
            }

            if (bindRes && bindRes.success) {
              triggerToast("🎉 Referral applied across 4-Tier network!", "success");
              localStorage.removeItem('polygame_pending_referral');
              sessionStorage.removeItem('polygame_pending_referral');
            } else if (bindRes && bindRes.message) {
              console.log("[bind_referral_code] Result:", bindRes.message);
              if (bindRes.message.includes('already') || bindRes.message.includes('yourself')) {
                localStorage.removeItem('polygame_pending_referral');
                sessionStorage.removeItem('polygame_pending_referral');
              }
            }
          } catch (err) {
            console.warn("Failed to bind referral code via RPC:", err);
          }
        }
      }
    }

    // Remove loader
    const tempLoader = document.getElementById('modal-loader-real-web3');
    if (tempLoader) tempLoader.remove();

    // Handle Web3 wallet connection vs Google social user primary address
    let activeUserId = (activeAppState && activeAppState.state) ? activeAppState.state.authUserId : null;
    if (!activeUserId && supabase && supabase.auth) {
      try {
        const { data: sData } = await supabase.auth.getSession();
        if (sData?.session?.user?.id) {
          activeUserId = sData.session.user.id;
          if (activeAppState && activeAppState.state) activeAppState.state.authUserId = activeUserId;
        }
      } catch (e) {}
    }

    let primaryWallet = (activeAppState && activeAppState.state && activeAppState.state.walletAddress) ? activeAppState.state.walletAddress : address;
    let linkedWallet = (activeAppState && activeAppState.state && activeAppState.state.linkedWalletAddress) ? activeAppState.state.linkedWalletAddress : '';

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

          // Permanent Wallet Lock: Check if account already has a locked linked_wallet_address
          if (dbUserRecord && dbUserRecord.linked_wallet_address && dbUserRecord.linked_wallet_address.trim() !== '') {
            if (dbUserRecord.linked_wallet_address.toLowerCase() !== normAddr) {
              console.warn(`[syncProfileWithDb] Permanent Wallet Lock: account is permanently linked to ${dbUserRecord.linked_wallet_address}`);
              if (!silent && window.triggerToast) {
                window.triggerToast(`⚠️ Permanent Wallet Lock: This account is permanently linked to ${formatShortAddress(dbUserRecord.linked_wallet_address)} and cannot be changed to another wallet.`, 'error');
              }
              setWeb3Provider(null);
              setRealSigner(null);
              appState.isSyncingWithDB = false;
              closeModal('wallet');
              return;
            }
          } else {
            // Address is clean and unassociated - safe to link to Google account
            await supabase
              .from('users')
              .update({ linked_wallet_address: normAddr, updated_at: new Date().toISOString() })
              .eq('user_id', activeUserId);
            linkedWallet = normAddr;
          }
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
      balanceMatic: maticBalance,
      isAmbassador: !!(dbUserRecord && dbUserRecord.is_ambassador)
    };

    // Safely update ownedNfts by merging DB records, on-chain scanned NFTs, and local state
    let verifiedChainNfts = chainNfts;
    if (verifiedChainNfts === null && address && address.startsWith('0x') && !address.startsWith('0xpgt') && !address.startsWith('0xg')) {
      if (typeof window !== 'undefined' && typeof window.getOwnedNftsFromChain === 'function') {
        try {
          verifiedChainNfts = await window.getOwnedNftsFromChain(address);
        } catch (e) {
          console.warn("[syncProfileWithDb] On-chain NFT scan fallback warning:", e);
        }
      }
    }

    const onchainNfts = Array.isArray(verifiedChainNfts) ? verifiedChainNfts : [];
    const dbOwnedNfts = (dbUserRecord && Array.isArray(dbUserRecord.owned_nfts)) ? dbUserRecord.owned_nfts : [];
    const localOwnedNfts = Array.isArray(appState.state.ownedNfts) ? appState.state.ownedNfts : [];

    // Combine & deduplicate in-game DB NFTs + on-chain scanned Polygon NFTs + local NFTs
    updatePayload.ownedNfts = Array.from(new Set([...dbOwnedNfts, ...onchainNfts, ...localOwnedNfts]));

    // If equipped NFT is no longer owned, unequip it automatically
    const combinedNfts = [...updatePayload.ownedNfts, ...(appState.state.crateNfts || [])];
    if (appState.state.equippedNft && !combinedNfts.includes(appState.state.equippedNft)) {
       updatePayload.equippedNft = null;
    }

    appState.isSyncingWithDB = false;
    appState.update(updatePayload);
    if (typeof window.checkFaucetCooldown === 'function') {
      window.checkFaucetCooldown();
    }
    appState.saveToDB(); // Overwrite & clean any corrupted DB rows with verified state

    if (typeof window.renderNftInventory === 'function') {
      window.renderNftInventory();
    }

    const connectedState = document.getElementById('wallet-connected-state');
    if (connectedState) {
      connectedState.style.display = 'block';
      document.getElementById('wallet-addr-full').innerText = address;
    }
    
    // Check Admin Privileges
    const adminNav = document.getElementById('nav-item-admin');
    const adminCard = document.getElementById('profile-admin-card');
    if (address.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase()) {
      console.log("Admin privileges verified for:", address);
      if (adminNav) adminNav.style.display = 'block';
      if (adminCard) adminCard.style.display = 'block';
      triggerToast("Master Admin Privileges Unlocked!", "success");
    } else {
      if (adminNav) adminNav.style.display = 'none';
      if (adminCard) adminCard.style.display = 'none';
    }

    // Check for Multi-Account IP sharing (> 2 accounts on same IP)
    if (typeof window.checkMultiAccountIP === 'function') {
      window.checkMultiAccountIP(address);
    }

    closeModal('wallet');
    if (!silent) triggerToast("MetaMask connected successfully!", "success");

    // Hook auto-reload events safely if window.ethereum exists
    if (window.ethereum && typeof window.ethereum.on === 'function') {
      window.ethereum.on('accountsChanged', (accs) => {
        if (localStorage.getItem('polygame_user_logged_out') === 'true') return;
        if (!appState || !appState.state || !appState.state.walletConnected) return; // Prevent unauthenticated reloads
        if (!accs || accs.length === 0) {
          logoutUser();
        } else {
          window.location.reload();
        }
      });
      window.ethereum.on('chainChanged', () => {
        if (localStorage.getItem('polygame_user_logged_out') === 'true') return;
        if (!appState || !appState.state || !appState.state.walletConnected) return; // Prevent unauthenticated reloads
        window.location.reload();
      });
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
      let { data, error } = await supabase.rpc('credit_arcade_payout', {
        p_player_id: wallet,
        p_amount: cleanAmt
      });

      if (error || !data) {
        const retryRes = await supabase.rpc('credit_arcade_payout', {
          p_wallet: wallet,
          p_amount: cleanAmt
        });
        if (retryRes.data) {
          data = retryRes.data;
          error = null;
        }
      }

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

  } else {
    // Guest mode balance update
    appState.state.balancePgt = parseFloat((appState.state.balancePgt + cleanAmt).toFixed(2));
    appState.save();
  }
}
window.creditArcadePayout = creditArcadePayout;

// Disconnect wallet / Log out Google Account
export async function logoutUser() {
  console.log("[logoutUser] Logout triggered.");
  localStorage.setItem('polygame_user_logged_out', 'true');

  if (supabase && supabase.auth) {
    try { await supabase.auth.signOut(); } catch (e) {}
  }

  // Revoke dApp permissions in MetaMask so extension requires user approval on reconnect
  if (typeof window.ethereum !== 'undefined' && window.ethereum.request) {
    try {
      await window.ethereum.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }]
      });
    } catch (e) {
      console.log("[logoutUser] wallet_revokePermissions not supported or rejected:", e);
    }
  }

  // Disconnect WalletConnect session if active
  if (window.globalWCProvider && typeof window.globalWCProvider.disconnect === 'function') {
    try {
      await window.globalWCProvider.disconnect();
    } catch (e) {}
    window.globalWCProvider = null;
  }

  setWeb3Provider(null);
  setRealSigner(null);

  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-') || k.includes('auth-token') || k === 'polygame_state' || k === 'polygame_state_checksum' || k === 'polygame_guest_address' || k === 'polygame_username') {
        localStorage.removeItem(k);
      }
    });
  } catch (e) {}

  localStorage.setItem('polygame_user_logged_out', 'true');

  if (appState) {
    if (appState._dbSaveTimer) {
      clearTimeout(appState._dbSaveTimer);
      appState._dbSaveTimer = null;
    }
    appState.isSyncingWithDB = true; // Prevent outgoing DB saves during logout reset
    appState.state = JSON.parse(JSON.stringify(appState.defaultState));
    appState.state.walletConnected = false;
    appState.state.walletProvider = null;
    appState.state.authUserId = null;
    appState.state.authUserEmail = null;
    appState.state.linkedWalletAddress = null;
    if (typeof getOrCreateGuestAddress === 'function') {
      appState.state.walletAddress = getOrCreateGuestAddress(true);
    }
    appState.save();
    appState.isSyncingWithDB = false;
  }

  if (typeof window.resetWalletModalUI === 'function') {
    window.resetWalletModalUI();
  }

  const selectState = document.getElementById('wallet-select-state');
  const connectedState = document.getElementById('wallet-connected-state');
  const modalTitle = document.getElementById('wallet-modal-title');
  const adminNav = document.getElementById('nav-item-admin');
  const headerLogout = document.getElementById('btn-header-logout');
  const addrDisplay = document.getElementById('wallet-address-display');
  const connectBtn = document.getElementById('btn-wallet-connect');

  if (modalTitle) modalTitle.innerText = "Connect Crypto Wallet";
  if (connectedState) connectedState.style.display = 'none';
  if (selectState) selectState.style.display = 'block';
  if (adminNav) adminNav.style.display = 'none';
  if (headerLogout) headerLogout.style.display = 'none';
  if (addrDisplay) addrDisplay.style.display = 'none';
  if (connectBtn) connectBtn.style.display = 'flex';

  const adminPanel = document.getElementById('view-admin');
  if (adminPanel && adminPanel.classList.contains('active')) {
    if (window.switchTab) window.switchTab('dashboard');
  }

  // Purge & reload PolySpace Mining Engine state
  if (window.polySpace) {
    if (typeof window.polySpace.loadSpaceState === 'function') window.polySpace.loadSpaceState();
    if (typeof window.polySpace.updateUI === 'function') window.polySpace.updateUI();
  }

  // Refresh all feature module UIs for fresh Guest session
  if (appState && typeof appState.syncUI === 'function') appState.syncUI();
  if (window.renderDailyQuestsUI) window.renderDailyQuestsUI();
  if (window.syncProfileView) window.syncProfileView();
  if (window.renderNftInventory) window.renderNftInventory();
  if (window.renderStakingLedger) window.renderStakingLedger();
  if (window.syncReferralData) window.syncReferralData();
  if (window.updateRoshamboWagerLabels) window.updateRoshamboWagerLabels();
  if (window.checkFaucetCooldown) window.checkFaucetCooldown();

  if (window.triggerToast) window.triggerToast("Logged out successfully. Switched to Guest Mode.", "info");
  if (window.closeModal) window.closeModal('wallet');

  // Hard Page Reload protocol for 100% clean memory & state wipe
  setTimeout(() => {
    window.location.reload();
  }, 150);
}
window.logoutUser = logoutUser;

// Global Delegated Click Listener for Log Out buttons
document.addEventListener('click', (e) => {
  const logoutBtn = e.target.closest('#btn-wallet-disconnect, .btn-account-logout, #btn-header-logout');
  if (logoutBtn) {
    e.preventDefault();
    e.stopPropagation();
    logoutUser();
  }
});



// Global Jackpot Sync Logic with Silent Retry Guard
export async function syncJackpotData() {
  if (!supabase) return;

  const fetchWithRetry = async (queryFn, retries = 2, delayMs = 300) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await queryFn();
        if (res && !res.error) return res;
        if (i < retries) await new Promise(r => setTimeout(r, delayMs));
      } catch (e) {
        if (i < retries) await new Promise(r => setTimeout(r, delayMs));
        else throw e;
      }
    }
    return { data: null, error: 'Max retries exceeded' };
  };

  try {
    // Fetch jackpot counter with silent retry guard
    const jackpotRes = await fetchWithRetry(() =>
      supabase.from('global_jackpot').select('amount, current_amount').eq('id', 1).single()
    );

    if (jackpotRes && jackpotRes.data) {
      const val = parseFloat(jackpotRes.data.current_amount || jackpotRes.data.amount || 2000.0);
      const counterEl = document.getElementById('progressive-jackpot-counter');
      if (counterEl) {
        counterEl.innerText = `${Math.max(2000.0, val).toFixed(2)} PGT`;
      }
    }

    // Fetch winners list with silent retry guard
    const winnersRes = await fetchWithRetry(() =>
      supabase.from('jackpot_winners').select('wallet_address, amount, won_at').order('won_at', { ascending: false }).limit(10)
    );

    if (winnersRes && winnersRes.data) {
      const winnersData = winnersRes.data;
      const listEl = document.getElementById('jackpot-winners-list');
      if (listEl) {
        listEl.innerHTML = '';
        if (winnersData.length === 0) {
          listEl.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 1rem;">No winners yet. Spin to be the first!</div>';
        } else {
          // Fetch user profiles map to resolve display names (usernames)
          const { data: userProfiles } = await supabase.from('users').select('player_id, linked_wallet_address, username');
          const userMap = {};
          if (userProfiles) {
            userProfiles.forEach(u => {
              if (u.username && u.username.trim() !== '') {
                if (u.player_id) userMap[u.player_id.toLowerCase()] = u.username.trim();
                if (u.linked_wallet_address) userMap[u.linked_wallet_address.toLowerCase()] = u.username.trim();
              }
            });
          }

          const activeSt = (typeof getAppState === 'function' ? getAppState() : (window.appState || null));
          const myPrimary = (activeSt?.state?.walletAddress || activeSt?.state?.playerId || '').toLowerCase();
          const myLinked = (activeSt?.state?.linkedWalletAddress || '').toLowerCase();

          winnersData.forEach(winner => {
            const rawAddr = (winner.wallet_address || '').toLowerCase();
            const isUser = myPrimary && (rawAddr === myPrimary || rawAddr === myLinked);
            
            let displayName = userMap[rawAddr];
            let isCustomName = !!displayName;

            if (!displayName) {
              if (isUser && activeSt?.state?.username) {
                displayName = activeSt.state.username;
                isCustomName = true;
              } else {
                displayName = winner.wallet_address.length >= 10 
                  ? `${winner.wallet_address.substring(0, 6)}...${winner.wallet_address.substring(winner.wallet_address.length - 4)}` 
                  : winner.wallet_address;
              }
            }

            const date = new Date(winner.won_at).toLocaleDateString();
            const div = document.createElement('div');
            div.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: ${isUser ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255,255,255,0.02)'}; border: 1px solid var(--border-glass); border-radius: var(--border-radius-sm);`;
            div.innerHTML = `
              <span style="color: var(--color-primary); font-weight: ${isCustomName ? '700' : '400'}; ${!isCustomName ? 'font-family: monospace;' : ''}">
                ${displayName} ${isUser ? '<span style="font-size: 0.75rem; color: var(--color-accent); margin-left: 0.25rem;">(You)</span>' : ''}
              </span>
              <span style="color: var(--text-muted); font-size: 0.8rem;">${date}</span>
              <strong style="color: var(--color-accent);">+${parseFloat(winner.amount).toFixed(2)} PGT</strong>
            `;
            listEl.appendChild(div);
          });
        }
      }
    }
  } catch (err) {
    console.warn("[syncJackpotData] Silent retry caught:", err);
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

  // Cap jackpot increment per bet to a maximum of 500 PGT to prevent pool inflation
  const incVal = Math.min(500.00, numBet * 0.01);

  // 1. Optimistic live UI update on screen IMMEDIATELY
  const counterEl = document.getElementById('progressive-jackpot-counter');
  if (counterEl) {
    const rawVal = counterEl.innerText.replace(/[^0-9.]/g, '');
    const currentVal = parseFloat(rawVal) || 2000.0;
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

  // Trigger Discord Webhook Notification for Big Bet Wins (Payout > 100 PGT threshold)
  if (typeof window.sendDiscordBetWinAnnouncement === 'function') {
    window.sendDiscordBetWinAnnouncement(game, betAmount, payout, multiplier);
  } else if (typeof window.sendDiscordBigWin === 'function') {
    window.sendDiscordBigWin(game, betAmount, payout, multiplier);
  }

  if (!supabase || !appState.isPlayerConnected()) return;
  const targetId = appState.getPlayerId() || appState.state.walletAddress || '';
  if (!targetId) return;

  try {
    await supabase.from('bet_wins').insert({
      wallet_address: targetId.toLowerCase(),
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
    const { data, error } = await supabase.from('global_settings').select('earn_multiplier, site_message, min_withdraw_pgt, max_withdraw_pgt').eq('id', 1).single();
    if (data && !error) {
      if (data.earn_multiplier !== undefined) {
        appState.update({ globalEarnMultiplier: parseFloat(data.earn_multiplier) });
      }
      if (data.min_withdraw_pgt !== undefined && data.min_withdraw_pgt !== null) {
        appState.update({ minWithdrawPgt: parseFloat(data.min_withdraw_pgt) });
      }
      if (data.max_withdraw_pgt !== undefined && data.max_withdraw_pgt !== null) {
        appState.update({ maxWithdrawPgt: parseFloat(data.max_withdraw_pgt) });
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

      const isNewHigh = Boolean(res.new_high_score || score > (appState.state.invadersHighScore || 0));
      if (isNewHigh) {
        appState.state.invadersHighScore = score;
        appState.state.alltimeInvadersHighScore = Math.max(appState.state.alltimeInvadersHighScore || 0, score);
        res.new_high_score = true;
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

  // Safe High Score update (without touching balance_pgt) if RPC failed
  const isNewHigh = score > (appState.state.invadersHighScore || 0);
  if (isNewHigh) {
    appState.state.invadersHighScore = score;
    appState.save();
    try {
      let updateQuery = supabase.from('users').update({
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
      console.error("Invaders highscore update error:", e);
    }
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
  localStorage.removeItem('polygame_user_logged_out');
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
    const walletAddr = appState.state.playerId || appState.state.walletAddress || appState.state.linkedWalletAddress || null;

    const { data, error } = await supabase.rpc('delete_user_account', {
      p_user_id: userId,
      p_wallet: walletAddr
    });

    if (error) throw error;

    if (window.triggerToast) window.triggerToast('Account deleted successfully. Logging out...', 'info');

    // Trigger full logout & session purge to unbind Web3 wallet and reset to fresh Guest mode
    await logoutUser();
  } catch (err) {
    console.error('[deleteUserAccount] Error:', err);
    if (window.triggerToast) window.triggerToast('Failed to delete account: ' + (err.message || err), 'error');
  }
}
window.deleteUserAccount = deleteUserAccount;

export async function initAuthListeners() {
  if (!supabase) return;

  try {
    const isLoggedOut = localStorage.getItem('polygame_user_logged_out') === 'true';
    const { data: { session } } = await supabase.auth.getSession();
    if (!isLoggedOut && session?.user) {
      await syncAuthenticatedUser(session.user);
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        localStorage.removeItem('polygame_user_logged_out');
      }
      if (localStorage.getItem('polygame_user_logged_out') === 'true') {
        return;
      }
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
  localStorage.removeItem('polygame_user_logged_out');

  let activeAppState = getAppState();
  if (!activeAppState || !activeAppState.state) {
    const StateClass = (typeof PolyState !== 'undefined') ? PolyState : (typeof window !== 'undefined' ? window.PolyState : null);
    if (StateClass) {
      window.appState = new StateClass();
      activeAppState = window.appState;
    }
  }
  if (!activeAppState || !activeAppState.state) {
    console.error("[syncAuthenticatedUser] Critical error: PolyState instance is uninitialized");
    return;
  }

  try {
    // Generate deterministic short internal player_id for Google accounts before real Web3 wallet is linked
    const internalWallet = ('0xpgt' + user.id.replace(/-/g, '').substring(0, 8)).toLowerCase();

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

      // Check for pending referral link click & bind 4-tier downlines for Google / Email accounts
      const pendingRef = localStorage.getItem('polygame_pending_referral') || sessionStorage.getItem('polygame_pending_referral');
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
          } else if (bindRes && bindRes.message) {
            console.log("[syncAuthenticatedUser] Referral bind result:", bindRes.message);
          }
        } catch (err) {
          console.warn("[syncAuthenticatedUser] Failed to bind referral code via RPC:", err);
        }
        localStorage.removeItem('polygame_pending_referral');
        sessionStorage.removeItem('polygame_pending_referral');
      }

      let activeWeb3Address = null;
      const signerObj = (typeof realSigner !== 'undefined' && realSigner) ? realSigner : (typeof window !== 'undefined' ? window.realSigner : null);
      if (signerObj) {
        try { activeWeb3Address = (await signerObj.getAddress()).toLowerCase(); } catch (e) {}
      }
      const isWeb3 = activeWeb3Address && (!activeWeb3Address.startsWith('0xpgt') && !activeWeb3Address.startsWith('0xg')) && activeWeb3Address.length === 42;
      let linked = isWeb3 ? activeWeb3Address : (userRow.linked_wallet_address || '');

      if (isWeb3 && userRow.linked_wallet_address && userRow.linked_wallet_address.trim() !== '') {
        if (userRow.linked_wallet_address.toLowerCase() !== activeWeb3Address) {
          console.warn(`[syncAuthenticatedUser] Account is permanently linked to ${userRow.linked_wallet_address}. Ignoring active Web3 connection.`);
          if (window.triggerToast) {
            window.triggerToast(`⚠️ Account is permanently linked to ${formatShortAddress(userRow.linked_wallet_address)} and cannot be changed.`, 'warning');
          }
          linked = userRow.linked_wallet_address;
        }
      } else if (isWeb3) {
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
              window.triggerToast(`⚠️ Active wallet ${formatShortAddress(activeWeb3Address)} is registered to a separate account. Logging into Google without linking.`, 'warning');
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
      if (userRow.username && userRow.username.trim() !== '') {
        activeAppState.state.username = userRow.username;
      }
      activeAppState.state.balancePgt = parseFloat(userRow.balance_pgt || 0);
      activeAppState.state.balance1flr = parseFloat(userRow.balance_1flr || 0);
      activeAppState.state.gameHighScore = parseInt(userRow.game_highscore || 0, 10);
      activeAppState.state.invadersHighScore = parseInt(userRow.invaders_highscore || 0, 10);
      activeAppState.state.alltimeGameHighScore = parseInt(userRow.alltime_game_highscore || userRow.game_highscore || 0, 10);
      activeAppState.state.alltimeInvadersHighScore = parseInt(userRow.alltime_invaders_highscore || userRow.invaders_highscore || 0, 10);
      activeAppState.state.alltimeDriftHighScore = parseInt(userRow.alltime_drift_highscore || userRow.drift_highscore || 0, 10);
      activeAppState.state.driftHighScore = parseInt(userRow.drift_highscore || 0, 10);
      activeAppState.state.lastClaimTime = lastClaimTs;
      activeAppState.state.claimStreak = parseInt(userRow.claim_streak || 0, 10);
      activeAppState.state.totalClaims = parseInt(userRow.total_claims || 0, 10);
      activeAppState.state.ownedNfts = userRow.owned_nfts || [];
      activeAppState.state.equippedNft = userRow.equipped_nft || null;
      activeAppState.state.stakes = userRow.stakes || [];
      activeAppState.state.stakedBalancePgt = parseFloat(userRow.staked_balance_pgt || 0);
      activeAppState.state.stakedBalance1flr = parseFloat(userRow.staked_balance_1flr || 0);
      activeAppState.state.totalStakingYield = parseFloat(userRow.total_staking_yield || 0);
      activeAppState.state.totalEarned = parseFloat(userRow.total_earned || 0);
      let validGoogleRefCode = userRow.referral_code;
      if (!validGoogleRefCode || validGoogleRefCode.trim() === '' || validGoogleRefCode === 'EMPTY') {
        validGoogleRefCode = 'ref_' + Math.random().toString(16).substring(2, 10);
        userRow.referral_code = validGoogleRefCode;
        try {
          supabase.from('users').update({ referral_code: validGoogleRefCode }).eq('user_id', user.id).then(() => {});
        } catch (e) {}
      }
      activeAppState.state.referralCode = validGoogleRefCode;
      activeAppState.state.referralsCount = parseInt(userRow.referrals_count || 0, 10);
      activeAppState.state.referralsL1 = parseInt(userRow.referrals_l1 || 0, 10);
      activeAppState.state.referralsL2 = parseInt(userRow.referrals_l2 || 0, 10);
      activeAppState.state.referralsL3 = parseInt(userRow.referrals_l3 || 0, 10);
      activeAppState.state.referralsL4 = parseInt(userRow.referrals_l4 || 0, 10);
      activeAppState.state.unclaimedReferralPgt = parseFloat(userRow.unclaimed_referral_pgt || 0);
      activeAppState.state.unclaimedReferralPol = parseFloat(userRow.unclaimed_referral_pol || 0);
      activeAppState.state.totalReferralPol = parseFloat(userRow.total_referral_pol || 0);
      activeAppState.state.isAmbassador = !!userRow.is_ambassador;
      activeAppState.state.totalReferralCommission = parseFloat(userRow.total_referral_commission || 0);
      activeAppState.state.activities = userRow.activities || [];

      // Restore PolySpace Mining Data
      if (userRow.space_state && typeof userRow.space_state === 'object' && Object.keys(userRow.space_state).length > 0) {
        activeAppState.state.spaceState = { ...userRow.space_state };
      }

      if (window.polySpace && typeof window.polySpace.loadSpaceState === 'function') {
        window.polySpace.loadSpaceState();
      }

      const isWeb3Active = !!(window.realSigner && window.web3Provider);

      activeAppState.update({
        authUserId: user.id,
        authUserEmail: user.email,
        walletConnected: isWeb3Active,
        walletProvider: isWeb3Active ? 'google_linked' : 'google',
        walletAddress: activeWallet,
        linkedWalletAddress: linked,
        isAmbassador: !!userRow.is_ambassador
      });

      if (typeof window.checkFaucetCooldown === 'function') {
        window.checkFaucetCooldown();
      }

      const selectState = document.getElementById('wallet-select-state');
      const connectedState = document.getElementById('wallet-connected-state');
      const modalTitle = document.getElementById('wallet-modal-title');
      const walletDisp = document.getElementById('wallet-address-display');

      if (selectState) selectState.style.display = 'none';
      if (connectedState) connectedState.style.display = 'block';
      if (modalTitle) modalTitle.innerText = isWeb3Active ? 'Wallet Integrated' : 'Account Manager';

      const btnLinkGoogleModal = document.getElementById('btn-link-google-action');
      if (btnLinkGoogleModal) {
        if (!activeAppState.state.authUserEmail && !activeAppState.state.authUserId) {
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
        fullAddrEl.innerHTML = `
          <div style="color: var(--color-success); font-weight: 700; font-size: 1.05rem;">Connected with Google</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${user.email || 'Google Account'}</div>
          ${realLinked ? `<div style="font-size: 0.75rem; color: var(--color-accent); margin-top: 0.4rem; font-family: monospace;">Linked Wallet: ${realLinked.substring(0, 6)}...${realLinked.substring(realLinked.length - 4)}</div>` : '<div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.4rem;">No Web3 Wallet Connected</div>'}
        `;
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
              if (Array.isArray(chainNfts) && chainNfts.length > 0) {
                const current = Array.isArray(activeAppState.state.ownedNfts) ? activeAppState.state.ownedNfts : [];
                activeAppState.state.ownedNfts = Array.from(new Set([...current, ...chainNfts]));
                activeAppState.saveToDB();
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
