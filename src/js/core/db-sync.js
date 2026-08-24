import { supabase, ADMIN_WALLET_ADDRESS, web3Provider, realSigner, setWeb3Provider, setRealSigner, APP_VERSION } from './config.js';
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
    const normalizedAddress = (address || '').toLowerCase();
    const isEVMAddress = normalizedAddress && !normalizedAddress.startsWith('0xpgt') && !normalizedAddress.startsWith('0xg');

    // 1. Resolve active Supabase auth user (Google / Email)
    let activeUserId = currentState.authUserId || null;
    if (!activeUserId && supabase && supabase.auth) {
      try {
        const { data: sData } = await supabase.auth.getSession();
        if (sData?.session?.user?.id) {
          activeUserId = sData.session.user.id;
          activeAppState.state.authUserId = activeUserId;
          if (sData.session.user.email) activeAppState.state.authUserEmail = sData.session.user.email;
        }
      } catch (e) {}
    }

    // 2. Early Security Pre-Check & Validation (Prevents ANY local state corruption or cross-wallet bleeding)
    if (activeUserId && isEVMAddress) {
      try {
        const { data: userProfile } = await supabase
          .from('users')
          .select('*')
          .eq('user_id', activeUserId)
          .maybeSingle();

        if (userProfile) {
          // Check A: Permanent Wallet Lock
          if (userProfile.linked_wallet_address && userProfile.linked_wallet_address.trim() !== '') {
            const currentLinked = userProfile.linked_wallet_address.toLowerCase();
            if (currentLinked !== normalizedAddress) {
              console.warn(`[syncProfileWithDb] Permanent Wallet Lock: account is permanently linked to ${currentLinked}`);
              if (!silent && window.triggerToast) {
                window.triggerToast(`⚠️ Permanent Wallet Lock: This account is permanently linked to ${formatShortAddress(currentLinked)} and cannot be changed to another wallet.`, 'error');
              }
              setWeb3Provider(null);
              setRealSigner(null);
              activeAppState.isSyncingWithDB = false;
              if (typeof closeModal === 'function') closeModal('wallet');
              if (typeof resetWalletModalUI === 'function') resetWalletModalUI();
              return;
            }
          }

          // Check B: Is incoming wallet already registered in DB under another account?
          const { data: conflictUser } = await supabase
            .from('users')
            .select('user_id, player_id, linked_wallet_address')
            .or(`player_id.ilike.${normalizedAddress},linked_wallet_address.ilike.${normalizedAddress}`)
            .maybeSingle();

          if (conflictUser && conflictUser.user_id !== activeUserId) {
            console.warn(`[syncProfileWithDb] Connection Rejected: Address ${normalizedAddress} is already registered to a separate account (user_id: ${conflictUser.user_id || 'standalone'})`);
            if (!silent && window.triggerToast) {
              window.triggerToast(`⚠️ Linking Blocked: Wallet address ${formatShortAddress(address)} is already registered to another account in the database.`, 'error');
            }
            setWeb3Provider(null);
            setRealSigner(null);
            activeAppState.isSyncingWithDB = false;
            if (typeof closeModal === 'function') closeModal('wallet');
            if (typeof resetWalletModalUI === 'function') resetWalletModalUI();
            return;
          }

          // Check C: If user did not have a linked wallet yet and incoming wallet is clean, link it
          if (!userProfile.linked_wallet_address || userProfile.linked_wallet_address.trim() === '') {
            await supabase
              .from('users')
              .update({ linked_wallet_address: normalizedAddress, updated_at: new Date().toISOString() })
              .eq('user_id', activeUserId);
            userProfile.linked_wallet_address = normalizedAddress;
          }
        }
      } catch (preCheckErr) {
        console.error("[syncProfileWithDb] Pre-validation check error:", preCheckErr);
      }
    } else if (!activeUserId) {
      // Direct Web3 account switch check
      const activeAddress = (currentState.linkedWalletAddress || currentState.walletAddress || currentState.playerId || '').toLowerCase();
      if (activeAddress && normalizedAddress && activeAddress !== normalizedAddress && !activeAddress.startsWith('0xguest')) {
        console.log(`[syncProfileWithDb] Web3 Account switch detected (${activeAddress} -> ${normalizedAddress}). Resetting local state.`);
        if (typeof activeAppState.resetToDefault === 'function') {
          activeAppState.resetToDefault(normalizedAddress);
        } else if (activeAppState.defaultState) {
          activeAppState.state = JSON.parse(JSON.stringify(activeAppState.defaultState));
          activeAppState.state.walletAddress = normalizedAddress;
          activeAppState.state.linkedWalletAddress = normalizedAddress;
        }
      }
    }

    let dbUserRecord = null;

    if (supabase) {
      if (!silent) triggerToast("Syncing Database Profile...", "success");
      
      let query = supabase.from('users').select('*');
      if (activeUserId) {
        query = query.eq('user_id', activeUserId);
      } else {
        query = query.or(`player_id.ilike.${normalizedAddress},linked_wallet_address.ilike.${normalizedAddress}`);
      }
      
      let { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116' && !activeUserId) {
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
        } else if (normalizedAddress && normalizedAddress !== canonicalId && isEVMAddress) {
          activeAppState.state.linkedWalletAddress = normalizedAddress;
        }
        if (data.user_id) activeAppState.state.authUserId = data.user_id;
        if (data.email) activeAppState.state.authUserEmail = data.email;

        // User exists in DB, merge DB state into local guest state (DB wins)
        console.log("Found existing profile in DB:", data);
        activeAppState.state.vipUntil = data.vip_until || null;
        activeAppState.state.createdAt = data.created_at || null;
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
        // Load persistent local cache for career all-time high scores
        const savedAlltimeKey = `polygame_alltime_scores_${(canonicalId || normalizedAddress || '').toLowerCase()}`;
        let cachedAlltime = {};
        try { cachedAlltime = JSON.parse(localStorage.getItem(savedAlltimeKey) || '{}'); } catch (e) {}

        const prevAlltimeGame = activeAppState.state.alltimeGameHighScore || cachedAlltime.game || 0;
        const prevAlltimeInv = activeAppState.state.alltimeInvadersHighScore || cachedAlltime.invaders || 0;
        const prevAlltimeDrift = activeAppState.state.alltimeDriftHighScore || cachedAlltime.drift || 0;
        const prevAlltimeStack = Math.max(activeAppState.state.alltimeStackerHighScore || 0, activeAppState.state.alltimeCatcherHighScore || 0, cachedAlltime.stacker || 0, cachedAlltime.catcher || 0);

        activeAppState.state.gameHighScore = parseInt(data.game_highscore || 0, 10);
        activeAppState.state.invadersHighScore = parseInt(data.invaders_highscore || 0, 10);
        activeAppState.state.driftHighScore = parseInt(data.drift_highscore || 0, 10);
        const stackHigh = parseInt(data.stacker_highscore || 0, 10);
        activeAppState.state.stackerHighScore = stackHigh;
        activeAppState.state.catcherHighScore = stackHigh;

        // Strictly preserve MAX between DB all-time, current weekly, and existing memory/local cache
        const dbAllGame = parseInt(data.alltime_game_highscore || 0, 10);
        const dbAllInv = parseInt(data.alltime_invaders_highscore || 0, 10);
        const dbAllDrift = parseInt(data.alltime_drift_highscore || 0, 10);
        const dbAllStack = parseInt(data.alltime_stacker_highscore || 0, 10);

        activeAppState.state.alltimeGameHighScore = Math.max(prevAlltimeGame, dbAllGame, activeAppState.state.gameHighScore);
        activeAppState.state.alltimeInvadersHighScore = Math.max(prevAlltimeInv, dbAllInv, activeAppState.state.invadersHighScore);
        activeAppState.state.alltimeDriftHighScore = Math.max(prevAlltimeDrift, dbAllDrift, activeAppState.state.driftHighScore);
        activeAppState.state.alltimeStackerHighScore = Math.max(prevAlltimeStack, dbAllStack, stackHigh);
        activeAppState.state.alltimeCatcherHighScore = Math.max(prevAlltimeStack, dbAllStack, stackHigh);

        // Auto-recover career best from tournament archive history if all-time is currently 0
        if (activeAppState.state.alltimeStackerHighScore === 0 && canonicalId) {
          try {
            const { data: hist } = await supabase.from('weekly_leaderboard_history')
              .select('best_score')
              .or(`player_id.ilike.${canonicalId},wallet_address.ilike.${normalizedAddress}`)
              .in('game_type', ['stacker', 'catcher'])
              .order('best_score', { ascending: false })
              .limit(1);
            if (hist && hist.length > 0 && hist[0].best_score > 0) {
              const recovered = Number(hist[0].best_score);
              activeAppState.state.alltimeStackerHighScore = recovered;
              activeAppState.state.alltimeCatcherHighScore = recovered;
            }
          } catch (e) {}
        }

        // Persist updated career bests to local storage
        try {
          localStorage.setItem(savedAlltimeKey, JSON.stringify({
            game: activeAppState.state.alltimeGameHighScore,
            invaders: activeAppState.state.alltimeInvadersHighScore,
            drift: activeAppState.state.alltimeDriftHighScore,
            stacker: activeAppState.state.alltimeStackerHighScore,
            catcher: activeAppState.state.alltimeCatcherHighScore
          }));
        } catch (e) {}
        
        // Keep app_version fresh in database for Web3 login
        if (canonicalId) {
          try {
            supabase.from('users').update({ app_version: APP_VERSION ? `v${APP_VERSION}` : 'v1.5.033' }).eq('player_id', canonicalId).then(() => {});
          } catch (e) {}
        }

        // Fetch stakes strictly for the verified player_id / canonical identity
        const targetStakeId = canonicalId || data.linked_wallet_address || (activeUserId ? (data.player_id || '') : normalizedAddress);
        let stakesData = [];
        if (targetStakeId) {
          const { data: sData, error: sErr } = await supabase.rpc('get_user_stakes', { p_wallet: targetStakeId });
          if (sData && sData.success) {
            stakesData = sData.stakes;
          } else if (data.stakes) {
            stakesData = data.stakes;
          }
        }
        
        // Sourced strictly from DB record for existing users (prevents cross-account local state bleeding)
        const dbOwned = Array.isArray(data.owned_nfts) ? data.owned_nfts : [];
        activeAppState.state.ownedNfts = Array.from(new Set([...dbOwned]));
        activeAppState.state.crateNfts = data.crate_nfts || [];
        activeAppState.state.stakes = stakesData;
        activeAppState.state.totalStakingYield = data.total_staking_yield || 0;
        activeAppState.state.activities = data.activities || [];
        activeAppState.state.referralsList = data.referrals_list || [];
        activeAppState.state.relics = (data.relics && typeof data.relics === 'object') ? data.relics : {};

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
        console.log("No DB profile found. Initializing fresh 0.0 balance user record in Supabase for:", normalizedAddress);

        // Security: Never inherit browser / guest balance or stats for account creation. Everything starts strictly at 0.
        activeAppState.state.balancePgt = 0.0;
        activeAppState.state.balance1flr = 0.0;
        activeAppState.state.stakedBalancePgt = 0.0;
        activeAppState.state.stakedBalance1flr = 0.0;
        activeAppState.state.totalClaims = 0;
        activeAppState.state.claimStreak = 0;
        activeAppState.state.lastClaimTime = null;
        activeAppState.state.gameHighScore = 0;
        activeAppState.state.invadersHighScore = 0;
        activeAppState.state.driftHighScore = 0;
        activeAppState.state.ownedNfts = [];
        activeAppState.state.crateNfts = [];
        activeAppState.state.stakes = [];
        activeAppState.state.totalStakingYield = 0.0;
        activeAppState.state.activities = [];
        activeAppState.state.referralsCount = 0;
        activeAppState.state.referralsL1 = 0;
        activeAppState.state.referralsL2 = 0;
        activeAppState.state.referralsL3 = 0;
        activeAppState.state.referralsL4 = 0;
        activeAppState.state.totalReferralCommission = 0.0;
        activeAppState.state.unclaimedReferralPgt = 0.0;

        try {
          const isWeb3Address = normalizedAddress && !normalizedAddress.startsWith('0xpgt') && !normalizedAddress.startsWith('0xg');
          const generatedPlayerId = ('0xpgt' + Math.random().toString(16).substring(2, 10)).toLowerCase();
          const internalId = isWeb3Address ? generatedPlayerId : normalizedAddress;
          const genCode = 'ref_' + Math.random().toString(16).substring(2, 10);

          const initUserRecord = {
            player_id: internalId,
            username: activeAppState.state.username || '',
            referral_code: genCode,
            balance_pgt: 0.0,
            balance_1flr: 0.0,
            staked_balance_pgt: 0.0,
            staked_balance_1flr: 0.0,
            total_claims: 0,
            claim_streak: 0,
            game_highscore: 0,
            invaders_highscore: 0,
            drift_highscore: 0,
            owned_nfts: [],
            crate_nfts: [],
            stakes: [],
            total_staking_yield: 0.0,
            activities: [],
            referrals_count: 0,
            referrals_l1: 0,
            referrals_l2: 0,
            referrals_l3: 0,
            referrals_l4: 0,
            total_referral_commission: 0.0,
            unclaimed_referral_pgt: 0.0,
            app_version: APP_VERSION ? `v${APP_VERSION}` : 'v1.5.016',
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

    const canonicalId = (dbUserRecord?.player_id || dbUserRecord?.wallet_address || activeAppState.state.playerId || '').toLowerCase();
    const primaryWallet = canonicalId || (activeUserId ? (dbUserRecord?.player_id || '') : normalizedAddress);
    let linkedWallet = activeAppState.state.linkedWalletAddress || dbUserRecord?.linked_wallet_address || '';
    if (!activeUserId && isEVMAddress) {
      linkedWallet = normalizedAddress;
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

    // Safely update ownedNfts: When a real wallet is connected or linked to synthetic player, merge on-chain verified tokens with in-game NFTs
    const isValidEvmAddr = (a) => a && typeof a === 'string' && a.startsWith('0x') && a.length === 42 && !a.toLowerCase().startsWith('0xpgt') && !a.toLowerCase().startsWith('0xg');
    const onchainTargetAddress = isValidEvmAddr(address) 
      ? address 
      : (dbUserRecord && isValidEvmAddr(dbUserRecord.linked_wallet_address))
        ? dbUserRecord.linked_wallet_address
        : (appState.state && isValidEvmAddr(appState.state.linkedWalletAddress))
          ? appState.state.linkedWalletAddress
          : null;

    let verifiedChainNfts = chainNfts;

    // Fast-path: Initialize immediately from cached database profile, merging with verified chain tokens (<200ms)
    const baseDbNfts = (dbUserRecord && Array.isArray(dbUserRecord.owned_nfts)) ? dbUserRecord.owned_nfts : (appState.state.ownedNfts || []);
    if (Array.isArray(verifiedChainNfts) && verifiedChainNfts.length > 0) {
      updatePayload.ownedNfts = Array.from(new Set([...baseDbNfts, ...verifiedChainNfts]));
    } else {
      updatePayload.ownedNfts = baseDbNfts;
    }
    updatePayload.relics = (dbUserRecord && dbUserRecord.relics && typeof dbUserRecord.relics === 'object') ? dbUserRecord.relics : (appState.state.relics || {});

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
    if (typeof window.renderRelicsVault === 'function') {
      window.renderRelicsVault();
    }

    // Asynchronous Non-Blocking On-Chain Scan (Runs in background so MetaMask connects in <300ms)
    if (onchainTargetAddress) {
      setTimeout(async () => {
        try {
          const [chainNftsList, chainRelicsObj] = await Promise.all([
            (typeof window.getOwnedNftsFromChain === 'function')
              ? window.getOwnedNftsFromChain(onchainTargetAddress).catch(() => null)
              : Promise.resolve(null),
            (typeof window.getOwnedRelicsFromChain === 'function')
              ? window.getOwnedRelicsFromChain(onchainTargetAddress).catch(() => null)
              : Promise.resolve(null)
          ]);

          const bgUpdate = {};
          let shouldUpdate = false;

          if (Array.isArray(chainNftsList)) {
            const currentOwned = (appState.state.ownedNfts && Array.isArray(appState.state.ownedNfts)) 
              ? appState.state.ownedNfts 
              : ((dbUserRecord && Array.isArray(dbUserRecord.owned_nfts)) ? dbUserRecord.owned_nfts : []);
            
            const isDifferent = chainNftsList.length !== currentOwned.length || 
              JSON.stringify([...chainNftsList].sort()) !== JSON.stringify([...currentOwned].sort());

            if (isDifferent) {
              bgUpdate.ownedNfts = chainNftsList;
              shouldUpdate = true;

              // If equipped NFT was sold/transferred away, unequip it
              if (appState.state.equippedNft && !chainNftsList.includes(appState.state.equippedNft) && !(appState.state.crateNfts || []).includes(appState.state.equippedNft)) {
                bgUpdate.equippedNft = null;
                appState.update({ equippedNft: null });
              }

              if (supabase && onchainTargetAddress) {
                const targetPId = (appState.state.playerId || (dbUserRecord && dbUserRecord.player_id) || onchainTargetAddress).toLowerCase();
                supabase.from('users').update({ 
                  owned_nfts: chainNftsList, 
                  equipped_nft: appState.state.equippedNft, 
                  updated_at: new Date().toISOString() 
                })
                .or(`player_id.ilike.${targetPId},linked_wallet_address.ilike.${onchainTargetAddress}`)
                .then(() => console.log("[syncProfileWithDb] On-chain NFTs synchronized to Supabase users.owned_nfts."));
              }
            }
          }

          if (chainRelicsObj && typeof chainRelicsObj === 'object') {
            const currentRelics = { ...(appState.state.relics || {}) };
            Object.keys(chainRelicsObj).forEach(rId => {
              const prev = currentRelics[rId] || { unminted: 0, onchain: 0, token_ids: [] };
              currentRelics[rId] = {
                unminted: prev.unminted || 0,
                onchain: chainRelicsObj[rId].onchain || 0,
                total: (prev.unminted || 0) + (chainRelicsObj[rId].onchain || 0),
                token_ids: chainRelicsObj[rId].token_ids || []
              };
            });
            bgUpdate.relics = currentRelics;
            shouldUpdate = true;

            if (supabase && onchainTargetAddress) {
              const targetPId = (appState.state.playerId || (dbUserRecord && dbUserRecord.player_id) || onchainTargetAddress).toLowerCase();
              supabase.from('users').update({ relics: currentRelics, updated_at: new Date().toISOString() })
                .or(`player_id.ilike.${targetPId},linked_wallet_address.ilike.${onchainTargetAddress}`)
                .then(() => console.log("[syncProfileWithDb] Background onchain relics synced to Supabase users.relics."));
            }
          }

          if (shouldUpdate) {
            appState.update(bgUpdate);
            appState.saveToDB();
            if (typeof window.renderNftInventory === 'function') window.renderNftInventory();
            if (typeof window.renderRelicsVault === 'function') window.renderRelicsVault();
          }
        } catch (bgErr) {
          console.warn("[syncProfileWithDb] Background on-chain scan warning:", bgErr);
        }
      }, 50);
    }

    const connectedState = document.getElementById('wallet-connected-state');
    if (connectedState) {
      connectedState.style.display = 'block';
      document.getElementById('wallet-addr-full').innerText = address;
    }
    
    // Check Admin Privileges
    const adminNav = document.getElementById('nav-item-admin');
    const adminCard = document.getElementById('profile-admin-card');
    const adminPanel = document.getElementById('view-admin');
    if (address.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase()) {
      console.log("Admin privileges verified for:", address);
      if (adminNav) { adminNav.classList.add('admin-unlocked'); adminNav.style.display = ''; }
      if (adminCard) adminCard.style.display = 'block';
      if (adminPanel) adminPanel.classList.add('admin-authorized');
      triggerToast("Master Admin Privileges Unlocked!", "success");
    } else {
      if (adminNav) { adminNav.classList.remove('admin-unlocked'); adminNav.style.display = 'none'; }
      if (adminCard) adminCard.style.display = 'none';
      if (adminPanel) adminPanel.classList.remove('admin-authorized');
    }

    // Check for Multi-Account IP sharing (> 2 accounts on same IP)
    if (typeof window.checkMultiAccountIP === 'function') {
      window.checkMultiAccountIP(primaryWallet || address, linkedWallet);
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

const _activeSessionStarting = {};

export async function startArcadeSession(gameName) {
  if (!appState.isPlayerConnected() || !supabase) return null;
  const cleanGame = (gameName || 'arcade').toLowerCase();
  if (_activeSessionStarting[cleanGame]) {
    return null;
  }
  _activeSessionStarting[cleanGame] = true;
  setTimeout(() => { delete _activeSessionStarting[cleanGame]; }, 800);

  const wallet = (appState.getPlayerId() || appState.state.walletAddress || '').toLowerCase();
  try {
    const { data, error } = await supabase.rpc('start_arcade_session', {
      p_player_id: wallet,
      p_game_name: gameName
    });
    if (data && !data.success && data.error) {
      if (typeof window.triggerToast === 'function') {
        window.triggerToast(`⚠️ ${data.error} PGT rewards are paused, but you can still play to climb the leaderboards!`, 'warning');
      }
      return null;
    }
    if (!error && data && data.success) {
      return data.session_id;
    }
  } catch (err) {
    console.warn("[startArcadeSession] RPC error:", err);
  }
  return null;
}
window.startArcadeSession = startArcadeSession;

export async function endArcadeSession(sessionId, score = 0, bonusItems = 0, bonusTokens = 0, nftMult = 1.0) {
  if (!appState.isPlayerConnected() || !supabase || !sessionId) return null;
  const wallet = (appState.getPlayerId() || appState.state.walletAddress || '').toLowerCase();
  const multis = (appState && typeof appState.getMultipliers === 'function') ? appState.getMultipliers() : {};
  const rawNft = nftMult || (1 + ((multis.nftGameMultiplier || 0) / 100));
  const apexMult = multis.isApexUnlocked ? 1.5 : 1.0;
  const verifiedNftMult = Math.max(1.0, Math.min(10.0, rawNft * apexMult));
  try {
    const { data, error } = await supabase.rpc('end_arcade_session', {
      p_player_id: wallet,
      p_session_id: sessionId,
      p_score: Math.floor(score),
      p_bonus_items: Math.floor(bonusItems),
      p_bonus_tokens: Math.floor(bonusTokens),
      p_nft_multiplier: verifiedNftMult
    });
    if (!error && data && data.success) {
      if (data.new_balance !== undefined && data.new_balance !== null) {
        const newBal = parseFloat(parseFloat(data.new_balance).toFixed(2));
        appState.update({ balancePgt: newBal });
      }
      data.payout = data.payout_pgt !== undefined ? parseFloat(data.payout_pgt) : parseFloat(data.payout || 0);
      return data;
    } else if (error) {
      console.warn("[endArcadeSession] RPC error:", error);
    }
  } catch (err) {
    console.error("[endArcadeSession] RPC exception:", err);
  }
  return null;
}
window.endArcadeSession = endArcadeSession;

export async function creditArcadePayout(amount, gameName = 'PolySpace Mining') {
  if (!appState.isPlayerConnected() || !supabase || !amount || amount <= 0) return null;
  const wallet = (appState.getPlayerId() || appState.state.walletAddress || '').toLowerCase();
  const amt = parseFloat(parseFloat(amount).toFixed(2));
  try {
    const { data, error } = await supabase.rpc('credit_arcade_payout', {
      p_player_id: wallet,
      p_amount: amt,
      p_game_name: gameName
    });
    if (!error && data && data.success) {
      if (data.new_balance !== undefined && data.new_balance !== null) {
        const newBal = parseFloat(parseFloat(data.new_balance).toFixed(2));
        appState.update({ balancePgt: newBal });
      }
      return data;
    } else if (error) {
      console.warn("[creditArcadePayout] RPC error:", error);
    }
  } catch (err) {
    console.error("[creditArcadePayout] RPC exception:", err);
  }
  return null;
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



// Global Jackpot Sync Logic with Silent Retry Guard & Visibility Sentinel
export async function syncJackpotData() {
  if (!supabase) return;
  // If tab is in background or device was sleeping, skip polling to prevent stale socket errors
  if (typeof document !== 'undefined' && document.hidden) return;

  const fetchWithRetry = async (queryFn, retries = 2, delayMs = 300) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await queryFn();
        if (res && !res.error) return res;
        if (i < retries) await new Promise(r => setTimeout(r, delayMs));
      } catch (e) {
        if (i < retries) await new Promise(r => setTimeout(r, delayMs));
        else return { data: null, error: e };
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
          // Fetch user profiles map only for winner addresses to minimize payload
          const winnerAddrs = winnersData.map(w => (w.wallet_address || '').toLowerCase()).filter(Boolean);
          const userMap = {};
          if (winnerAddrs.length > 0) {
            try {
              const profilesRes = await fetchWithRetry(() =>
                supabase.from('users').select('player_id, linked_wallet_address, username')
              );
              if (profilesRes && profilesRes.data) {
                profilesRes.data.forEach(u => {
                  if (u.username && u.username.trim() !== '') {
                    if (u.player_id) userMap[u.player_id.toLowerCase()] = u.username.trim();
                    if (u.linked_wallet_address) userMap[u.linked_wallet_address.toLowerCase()] = u.username.trim();
                  }
                });
              }
            } catch (e) {}
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

// Start auto-sync interval for jackpot (every 30 seconds when tab is visible)
setInterval(() => {
  if (typeof document !== 'undefined' && document.hidden) return;
  syncJackpotData();
}, 30000);

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncJackpotData();
  });
}

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

export function handleServerJackpotWin(serverResult, gameName = 'Casino Game') {
  if (serverResult && serverResult.jackpot_won && serverResult.jackpot_payout > 0) {
    const formatAmt = parseFloat(serverResult.jackpot_payout).toFixed(2);
    if (window.triggerToast) {
      window.triggerToast(`🏆 MEGA JACKPOT HIT! You won ${formatAmt} PGT on ${gameName}!`, 'success');
    }
    if (appState && appState.addActivity) {
      appState.addActivity('You', `won the Global Progressive Jackpot on ${gameName}`, `+${formatAmt} PGT`);
    }
    syncJackpotData();
  }
}
window.handleServerJackpotWin = handleServerJackpotWin;

export async function processBetJackpot(betAmount, gameName = 'Casino Game') {
  const numBet = parseFloat(betAmount) || 0;
  if (numBet <= 0) return 0;

  const incVal = numBet * 0.01;

  // Optimistic live UI counter update
  const counterEl = document.getElementById('progressive-jackpot-counter');
  if (counterEl) {
    const rawVal = counterEl.innerText.replace(/[^0-9.]/g, '');
    const currentVal = parseFloat(rawVal) || 2000.0;
    counterEl.innerText = `${(currentVal + incVal).toFixed(2)} PGT`;
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
    const payload = {
      wallet_address: targetId.toLowerCase(),
      player_id: (appState.getPlayerId() || targetId).toLowerCase(),
      game: game,
      bet_amount: parseFloat(betAmount || 0),
      payout: parseFloat(payout || 0),
      multiplier: parseFloat(multiplier || 1.0)
    };
    const { error } = await supabase.from('bet_wins').insert(payload);
    if (error) {
      // Fallback in case player_id column doesn't exist yet in the database table
      await supabase.from('bet_wins').insert({
        wallet_address: targetId.toLowerCase(),
        game: game,
        bet_amount: parseFloat(betAmount || 0),
        payout: parseFloat(payout || 0),
        multiplier: parseFloat(multiplier || 1.0)
      });
    }
  } catch (e) {
    // Non-blocking log catch
  }
}

export async function syncGlobalSettings() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('global_settings').select('earn_multiplier, site_message, min_withdraw_pgt, max_withdraw_pgt, max_weekly_withdrawals, max_daily_plays_per_game, game_payout_settings, discord_webhook_url, discord_admin_webhook_url, discord_announcements_webhook_url').eq('id', 1).single();
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
      if (data.max_weekly_withdrawals !== undefined && data.max_weekly_withdrawals !== null) {
        appState.update({ maxWeeklyWithdrawals: parseInt(data.max_weekly_withdrawals) });
      }
      if (data.max_daily_plays_per_game !== undefined && data.max_daily_plays_per_game !== null) {
        appState.update({ maxDailyPlaysPerGame: parseInt(data.max_daily_plays_per_game) });
      }
      if (data.game_payout_settings) {
        appState.update({ gamePayoutSettings: data.game_payout_settings });
        updateLeaderboardPoolHeaders(data.game_payout_settings);
      }
      // Cache dynamic Discord Webhooks safely
      const hooks = {
        main: data.discord_webhook_url || '',
        admin: data.discord_admin_webhook_url || '',
        announcements: data.discord_announcements_webhook_url || ''
      };
      appState.state.discordWebhooks = hooks;
      try { localStorage.setItem('polygame_discord_webhooks', JSON.stringify(hooks)); } catch (e) {}

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

export function updateLeaderboardPoolHeaders(settings) {
  if (!settings) return;
  const s = settings;
  const poolArcade = (s.astrododge && s.astrododge.weekly_pool_pgt !== undefined) ? Number(s.astrododge.weekly_pool_pgt) : 50000;
  const poolInvaders = (s.invaders && s.invaders.weekly_pool_pgt !== undefined) ? Number(s.invaders.weekly_pool_pgt) : 50000;
  const poolDrift = (s.drift && s.drift.weekly_pool_pgt !== undefined) ? Number(s.drift.weekly_pool_pgt) : 50000;
  const stackerConf = s.stacker || s.catcher || {};
  const poolStacker = (stackerConf.weekly_pool_pgt !== undefined) ? Number(stackerConf.weekly_pool_pgt) : 50000;

  const elArcade = document.getElementById('lb-pool-arcade');
  if (elArcade) elArcade.innerText = `Weekly Pool: ${poolArcade.toLocaleString()} PGT`;

  const elInvaders = document.getElementById('lb-pool-invaders');
  if (elInvaders) elInvaders.innerText = `Weekly Pool: ${poolInvaders.toLocaleString()} PGT`;

  const elDrift = document.getElementById('lb-pool-drift');
  if (elDrift) elDrift.innerText = `Weekly Pool: ${poolDrift.toLocaleString()} PGT`;

  const elStacker = document.getElementById('lb-pool-stacker') || document.getElementById('lb-pool-catcher');
  if (elStacker) elStacker.innerText = `Weekly Pool: ${poolStacker.toLocaleString()} PGT`;
}

export async function submitInvadersScoreToDB(score) {
  if (!supabase || !appState.state.walletAddress) return null;
  
  const address = appState.state.walletAddress.toLowerCase();
  const multis = appState.getMultipliers();
  
  try {
    let { data: res, error } = await supabase.rpc('submit_invaders_score', {
      p_wallet: address,
      p_score: score,
      p_nft_game_multiplier: Math.round(((1 + (multis.nftGameMultiplier || 0) / 100) * (multis.isApexUnlocked ? 1.5 : 1.0) - 1) * 100),
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
  const pid = (appState.state.playerId || '').toLowerCase();
  const isInternal = (addr) => addr && (addr.startsWith('0xpgt') || addr.startsWith('0xg'));
  const targetWallet = (linked && !isInternal(linked)) ? linked : (pid || primary || linked);
  if (!targetWallet) return;

  const cleanScore = Math.floor(score || 0);
  if (cleanScore <= 0) return;

  // 1. Maintain local state high scores
  if (gameType === 'astrododge') {
    appState.state.gameHighScore = Math.max(appState.state.gameHighScore || 0, cleanScore);
    appState.state.alltimeGameHighScore = Math.max(appState.state.alltimeGameHighScore || 0, cleanScore);
  } else if (gameType === 'invaders') {
    appState.state.invadersHighScore = Math.max(appState.state.invadersHighScore || 0, cleanScore);
    appState.state.alltimeInvadersHighScore = Math.max(appState.state.alltimeInvadersHighScore || 0, cleanScore);
  } else if (gameType === 'drift') {
    appState.state.driftHighScore = Math.max(appState.state.driftHighScore || 0, cleanScore);
    appState.state.alltimeDriftHighScore = Math.max(appState.state.alltimeDriftHighScore || 0, cleanScore);
  } else if (gameType === 'stacker' || gameType === 'catcher') {
    appState.state.stackerHighScore = Math.max(appState.state.stackerHighScore || 0, cleanScore);
    appState.state.catcherHighScore = Math.max(appState.state.catcherHighScore || 0, cleanScore);
    appState.state.alltimeStackerHighScore = Math.max(appState.state.alltimeStackerHighScore || 0, cleanScore);
    appState.state.alltimeCatcherHighScore = Math.max(appState.state.alltimeCatcherHighScore || 0, cleanScore);
  }
  appState.save();

  // 2. Prepare payload for atomic monotonic RPC update
  const payload = { p_player_id: pid || targetWallet };
  if (gameType === 'astrododge') payload.p_game_highscore = cleanScore;
  else if (gameType === 'invaders') payload.p_invaders_highscore = cleanScore;
  else if (gameType === 'drift') payload.p_drift_highscore = cleanScore;
  else if (gameType === 'stacker' || gameType === 'catcher') {
    payload.p_stacker_highscore = cleanScore;
  }

  try {
    let rpcSuccess = false;
    let { data: rpcRes, error } = await supabase.rpc('submit_arcade_highscore', payload);
    if (error) {
      // Fallback for legacy signature
      const legacyPayload = {
        p_wallet: targetWallet,
        p_game_highscore: payload.p_game_highscore || null,
        p_invaders_highscore: payload.p_invaders_highscore || null,
        p_drift_highscore: payload.p_drift_highscore || null,
        p_catcher_highscore: payload.p_stacker_highscore || null
      };
      const fb = await supabase.rpc('submit_arcade_highscore', legacyPayload);
      if (!fb.error && fb.data && fb.data.success) {
        rpcSuccess = true;
      }
    } else if (rpcRes && rpcRes.success) {
      rpcSuccess = true;
    }

    if (!rpcSuccess) {
      // Direct monotonic fallback: fetch DB user row to strictly preserve GREATEST score
      let query = supabase.from('users').select('player_id, user_id, game_highscore, invaders_highscore, drift_highscore, stacker_highscore, alltime_game_highscore, alltime_invaders_highscore, alltime_drift_highscore, alltime_stacker_highscore');
      if (appState.state.authUserId) {
        query = query.eq('user_id', appState.state.authUserId);
      } else if (pid) {
        query = query.or(`player_id.ilike.${pid},linked_wallet_address.ilike.${targetWallet}`);
      } else {
        query = query.eq('linked_wallet_address', targetWallet);
      }

      const { data: userRow } = await query.maybeSingle();

      if (userRow && (userRow.player_id || userRow.user_id)) {
        const dbUpdate = { updated_at: new Date().toISOString() };
        let hasUpdate = false;

        if (gameType === 'astrododge' && cleanScore > (userRow.game_highscore || 0)) {
          dbUpdate.game_highscore = cleanScore;
          dbUpdate.alltime_game_highscore = Math.max(userRow.alltime_game_highscore || 0, cleanScore);
          hasUpdate = true;
        }
        if (gameType === 'invaders' && cleanScore > (userRow.invaders_highscore || 0)) {
          dbUpdate.invaders_highscore = cleanScore;
          dbUpdate.alltime_invaders_highscore = Math.max(userRow.alltime_invaders_highscore || 0, cleanScore);
          hasUpdate = true;
        }
        if (gameType === 'drift' && cleanScore > (userRow.drift_highscore || 0)) {
          dbUpdate.drift_highscore = cleanScore;
          dbUpdate.alltime_drift_highscore = Math.max(userRow.alltime_drift_highscore || 0, cleanScore);
          hasUpdate = true;
        }
        if ((gameType === 'stacker' || gameType === 'catcher') && cleanScore > (userRow.stacker_highscore || 0)) {
          dbUpdate.stacker_highscore = cleanScore;
          dbUpdate.alltime_stacker_highscore = Math.max(userRow.alltime_stacker_highscore || 0, cleanScore);
          hasUpdate = true;
        }

        if (hasUpdate) {
          if (userRow.player_id) {
            await supabase.from('users').update(dbUpdate).eq('player_id', userRow.player_id);
          } else {
            await supabase.from('users').update(dbUpdate).eq('user_id', userRow.user_id);
          }
        }
      }
    }
  } catch (err) {
    console.error("[submitHighScoreToDB] Exception:", err);
  }

  // 3. Trigger live UI leaderboard refresh immediately
  try {
    if (gameType === 'astrododge' && typeof window.loadAstroDodgeLeaderboard === 'function') {
      window.loadAstroDodgeLeaderboard();
    } else if (gameType === 'invaders' && typeof window.loadInvadersLeaderboard === 'function') {
      window.loadInvadersLeaderboard();
    } else if (gameType === 'drift' && typeof window.loadDriftLeaderboard === 'function') {
      window.loadDriftLeaderboard();
    } else if (gameType === 'stacker' || gameType === 'catcher') {
      if (typeof window.loadStackerLeaderboard === 'function') window.loadStackerLeaderboard();
      if (typeof window.loadCatcherLeaderboard === 'function') window.loadCatcherLeaderboard();
    }
  } catch (uiErr) {
    console.warn("[submitHighScoreToDB] UI leaderboard refresh warning:", uiErr);
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
        const up = { 
          user_id: user.id, 
          email: user.email,
          app_version: APP_VERSION ? `v${APP_VERSION}` : 'v1.5.033'
        };
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
            balance_pgt: 0.0,
            staked_balance_pgt: 0.0,
            app_version: APP_VERSION ? `v${APP_VERSION}` : 'v1.5.033',
            created_at: new Date().toISOString()
          })
          .select('*')
          .maybeSingle();
        
        if (inserted) userRow = inserted;
      }
    }

    if (userRow) {
      // Keep app_version fresh in database
      try {
        supabase.from('users').update({ app_version: APP_VERSION ? `v${APP_VERSION}` : 'v1.5.033' }).eq('user_id', user.id).then(() => {});
      } catch (e) {}
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
      let linked = userRow.linked_wallet_address || '';

      if (isWeb3) {
        // Security Pre-Check A: Permanent Wallet Lock
        if (userRow.linked_wallet_address && userRow.linked_wallet_address.trim() !== '') {
          if (userRow.linked_wallet_address.toLowerCase() !== activeWeb3Address) {
            console.warn(`[syncAuthenticatedUser] Google account is permanently linked to ${userRow.linked_wallet_address}. Disconnecting mismatched wallet ${activeWeb3Address}.`);
            if (window.triggerToast) {
              window.triggerToast(`⚠️ Account permanently linked to ${formatShortAddress(userRow.linked_wallet_address)}. Disconnected external wallet ${formatShortAddress(activeWeb3Address)}.`, 'warning');
            }
            setWeb3Provider(null);
            setRealSigner(null);
            linked = userRow.linked_wallet_address;
          }
        } else {
          // Security Pre-Check B: Check if active Web3 wallet belongs to another account in DB
          try {
            const { data: existingWeb3Row } = await supabase
              .from('users')
              .select('user_id, player_id, linked_wallet_address')
              .or(`player_id.ilike.${activeWeb3Address},linked_wallet_address.ilike.${activeWeb3Address}`)
              .maybeSingle();

            if (existingWeb3Row && existingWeb3Row.user_id !== user.id) {
              console.warn(`[syncAuthenticatedUser] Active Web3 wallet ${activeWeb3Address} belongs to another account. Disconnecting wallet.`);
              if (window.triggerToast) {
                window.triggerToast(`⚠️ Active wallet ${formatShortAddress(activeWeb3Address)} is registered to another account. Disconnected wallet.`, 'warning');
              }
              setWeb3Provider(null);
              setRealSigner(null);
              linked = '';
            } else {
              const { data: rpcRes } = await supabase.rpc('link_wallet_to_account', {
                p_wallet: activeWeb3Address,
                p_user_id: user.id
              });
              if (rpcRes && rpcRes.success && rpcRes.merged_pgt > 0) {
                triggerToast(`🎉 Merged +${rpcRes.merged_pgt} PGT & game scores into your account!`, 'success');
              }
              linked = activeWeb3Address;
            }
          } catch (e) {
            console.error("[syncAuthenticatedUser] Link error:", e);
          }
        }
      }

      const rawLastClaim = userRow.last_faucet_claim || userRow.last_claim_time;
      const lastClaimTs = rawLastClaim ? new Date(rawLastClaim).getTime() : null;

      // Fetch active stakes strictly for this Google account's canonical player_id
      let stakesData = [];
      try {
        const { data: sData, error: sErr } = await supabase.rpc('get_user_stakes', { p_wallet: activeWallet });
        if (sData && sData.success) {
          stakesData = sData.stakes;
        } else if (userRow.stakes) {
          stakesData = userRow.stakes;
        }
      } catch (stkErr) {
        stakesData = userRow.stakes || [];
      }

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
      activeAppState.state.stakes = stakesData;
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

      const stackHigh = parseInt(userRow.stacker_highscore || 0, 10);
      const alltimeStackHigh = Math.max(parseInt(userRow.alltime_stacker_highscore || 0, 10), stackHigh);

      activeAppState.state.playerId = userPid;
      activeAppState.state.vipUntil = userRow.vip_until || null;
      activeAppState.state.isAdmin = !!userRow.is_admin;
      activeAppState.state.stackerHighScore = stackHigh;
      activeAppState.state.catcherHighScore = stackHigh;
      activeAppState.state.alltimeStackerHighScore = alltimeStackHigh;
      activeAppState.state.alltimeCatcherHighScore = alltimeStackHigh;

      // Restore PolySpace Mining Data
      if (userRow.space_state && typeof userRow.space_state === 'object' && Object.keys(userRow.space_state).length > 0) {
        activeAppState.state.spaceState = { ...userRow.space_state };
      }

      if (window.polySpace && typeof window.polySpace.loadSpaceState === 'function') {
        window.polySpace.loadSpaceState();
      }

      const isWeb3Active = !!(window.realSigner && window.web3Provider && linked && activeWeb3Address && linked.toLowerCase() === activeWeb3Address.toLowerCase());

      activeAppState.update({
        playerId: userPid,
        authUserId: user.id,
        authUserEmail: user.email,
        walletConnected: isWeb3Active,
        walletProvider: isWeb3Active ? 'google_linked' : 'google',
        walletAddress: activeWallet,
        linkedWalletAddress: linked,
        vipUntil: userRow.vip_until || null,
        isAdmin: !!userRow.is_admin,
        isAmbassador: !!userRow.is_ambassador,
        catcherHighScore: stackHigh,
        stackerHighScore: stackHigh,
        alltimeStackerHighScore: alltimeStackHigh,
        alltimeCatcherHighScore: alltimeStackHigh
      });

      if (typeof window.checkFaucetCooldown === 'function') {
        window.checkFaucetCooldown();
      }
      if (typeof window.syncAmbassadorProfileBadge === 'function') {
        window.syncAmbassadorProfileBadge();
      }
      if (typeof window.syncProfileView === 'function') {
        window.syncProfileView();
      }
      if (typeof window.renderNftInventory === 'function') {
        window.renderNftInventory();
      }
      if (typeof window.updateStakingUI === 'function') {
        window.updateStakingUI();
      }
      if (typeof window.renderQuests === 'function') {
        window.renderQuests();
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

      // Check Master Admin Privileges for Google authenticated user
      const adminNav = document.getElementById('nav-item-admin');
      const adminCard = document.getElementById('profile-admin-card');
      const expectedAdmin = (ADMIN_WALLET_ADDRESS || "0x10b9993990c9ef8a212c9557cb02ad94da9a654d").toLowerCase();
      const isAdminGoogle = (
        (realLinked && realLinked.toLowerCase() === expectedAdmin) ||
        (linked && linked.toLowerCase() === expectedAdmin)
      );
      if (isAdminGoogle) {
        if (adminNav) adminNav.style.display = 'block';
        if (adminCard) adminCard.style.display = 'block';
      }

      // Non-blocking background NFT check for Google users with linked Web3 wallet
      setTimeout(() => {
        try {
          const linkedW = (userRow.linked_wallet_address && !isInternalAddr(userRow.linked_wallet_address)) ? userRow.linked_wallet_address : (!isInternalAddr(userRow.wallet_address) ? userRow.wallet_address : null);
          if (linkedW && linkedW.length >= 42 && typeof window.getOwnedNftsFromChain === 'function') {
            window.getOwnedNftsFromChain(linkedW).then(chainNfts => {
              if (Array.isArray(chainNfts) && chainNfts.length > 0) {
                const merged = Array.from(new Set([...(activeAppState.state.ownedNfts || []), ...chainNfts]));
                if (merged.length !== (activeAppState.state.ownedNfts || []).length) {
                  activeAppState.state.ownedNfts = merged;
                  activeAppState.saveToDB();
                  if (typeof window.renderNftInventory === 'function') window.renderNftInventory();
                }
              }
            }).catch(err => console.warn("Background chain NFT fetch error on Google login:", err));
          }
        } catch (e) {}
      }, 1000);
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
