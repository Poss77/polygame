import { supabase } from './config.js';
import { NFT_REGISTRY } from '../features/nft.js';
import { cyb53, CHECKSUM_SALT } from '../features/referrals.js';
import { triggerToast } from './ui.js';
import { renderStakingLedger, activeStakingTier, activeStakingPool, updateStakingLockCountdownUI } from '../features/staking.js';
import { syncProfileView } from '../features/profile.js';
import { updateRoshamboWagerLabels } from '../features/roshambo.js';

// --- Persistent Application State Management ---

export class PolyState {
  constructor() {
    this.defaultState = {
      balancePgt: 0.0,  // Initial balance is 0.0 (no fake sandbox credit)
      onchainBalancePgt: 0.0, // Real wallet balance
      balance1flr: 0.0, // Initial balance is 0.0 (no fake sandbox credit)
      onchainBalance1flr: 0.0, // Real wallet balance
      pendingPayoutPgt: 0.0, // Weekly pending rewards pool
      unclaimedReferralPgt: 0.0, // Unclaimed 4-tier referral pool
      balanceMatic: 0.0,
      walletConnected: false,
      walletProvider: null,
      walletAddress: '',
      username: '',
      
      totalClaims: 0,
      lastClaimTime: null,
      claimStreak: 0,
      
      gameHighScore: 0,
      invadersHighScore: 0,
      driftHighScore: 0,
      spaceState: {
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
        pokesToday: 0,
        lastPokeDate: null,
        raidsWon: 0,
        mineralsMinedTotal: 0
      },
      
      globalEarnMultiplier: 1.0, // Pulled from global_settings on load
      
      ownedNfts: [],
      crateNfts: [],
      equippedNft: null,
      
      // Dual Token Staking pools
      stakedBalancePgt: 0.0,
      accumulatedInterestPgt: 0.0,
      stakingLockUntilPgt: null,
      stakingTierPgt: null,
      
      stakedBalance1flr: 0.0,
      accumulatedInterest1flr: 0.0,
      stakingLockUntil1flr: null,
      stakingTier1flr: null,
      
      referralsCount: 0,
      referralsL1: 0,
      referralsL2: 0,
      referralsL3: 0,
      referralsL4: 0,
      totalReferralCommission: 0.0,
      referralCode: Math.floor(10000 + Math.random() * 90000).toString(),
      referralsList: [],
      stakes: [],
      totalStakingYield: 0.0,
      stakedNfts: [],
      
      vipUntil: null, // TIMESTAMPTZ of when VIP expires
      
      activities: []
    };

    this.state = {};
    this.isSyncingWithDB = false;
    this.loadState();
  }

  loadState() {
    const raw = localStorage.getItem('polygame_state');
    const checksum = localStorage.getItem('polygame_state_checksum');
    
    if (raw) {
      try {
        // Anti-hacking validation check
        const computed = cyb53(raw + CHECKSUM_SALT);
        if (checksum !== computed) {
          console.warn("State checksum verification failed! Resetting modified state.");
          
          if (typeof window.sendAdminAlert === 'function') {
            window.sendAdminAlert({
              category: 'SECURITY CHECKSUM',
              title: '⚠️ Local State Modification Detected',
              description: 'A player modified local storage state. Anti-cheat triggered and default state restored.',
              color: 0xFF0033
            });
          }

          // Trigger secure warning toast on next frame
          setTimeout(() => {
            triggerToast("⚠️ Local state modification detected! Restoring verified ledger.", "error");
          }, 500);

          this.state = Object.assign({}, this.defaultState);
          this.save();
          return;
        }

        const parsed = JSON.parse(raw);
        this.state = Object.assign({}, this.defaultState, parsed);
        if (this.state.walletConnected) {
          this.isSyncingWithDB = true; // Lock DB saves until autoConnectWeb3 fetches fresh DB data
        }
      } catch (e) {
        console.error("Failed to load local storage state", e);
        this.state = Object.assign({}, this.defaultState);
      }
    } else {
      this.state = Object.assign({}, this.defaultState);
    }
  }

  save() {
    const raw = JSON.stringify(this.state);
    const computed = cyb53(raw + CHECKSUM_SALT);
    localStorage.setItem('polygame_state', raw);
    localStorage.setItem('polygame_state_checksum', computed);
    this.syncUI();
  }

  // Persist state to Supabase if wallet is connected
  async saveToDB() {
    if (!this.state.walletConnected || !this.state.walletAddress || !supabase || this.isSyncingWithDB) return;

    try {
      const currentStakedPgt = (this.state.stakes || []).reduce((sum, s) => {
        if (!s.pool || s.pool.toLowerCase() === 'pgt') {
          const amt = parseFloat(s.amount || 0);
          return sum + (isNaN(amt) ? 0 : amt);
        }
        return sum;
      }, 0);

      const dbPayload = {
        wallet_address: this.state.walletAddress.toLowerCase(),
        username: this.state.username || '',
        // balance_pgt is intentionally omitted to prevent client DevTools tampering.
        // Balance is strictly managed server-side via Supabase RPCs.
        staked_balance_pgt: currentStakedPgt,
        total_claims: this.state.totalClaims,
        last_claim_time: this.state.lastClaimTime,
        last_faucet_claim: this.state.lastClaimTime ? new Date(this.state.lastClaimTime).toISOString() : null,
        claim_streak: this.state.claimStreak,
        game_highscore: this.state.gameHighScore,
        invaders_highscore: this.state.invadersHighScore,
        drift_highscore: this.state.driftHighScore,
        owned_nfts: this.state.ownedNfts || [],
        crate_nfts: this.state.crateNfts || [],
        equipped_nft: this.state.equippedNft,
        referrals_count: this.state.referralsCount,
        referrals_l1: this.state.referralsL1,
        referrals_l2: this.state.referralsL2,
        referrals_l3: this.state.referralsL3,
        referrals_l4: this.state.referralsL4,
        referral_code: this.state.referralCode,
        stakes: this.state.stakes || [],
        total_staking_yield: this.state.totalStakingYield || 0.0,
        activities: this.state.activities || [],
        space_state: this.state.spaceState || {},
        updated_at: new Date().toISOString()
      };

      if (this.state.referredBy) {
        dbPayload.referred_by = this.state.referredBy.toLowerCase();
        dbPayload.referred_by_l1 = this.state.referredBy.toLowerCase();
      }


      let { error } = await supabase.from('users').upsert(dbPayload, { onConflict: 'wallet_address' });
      if (error && error.message && (error.message.includes('drift_highscore') || error.code === 'PGRST204')) {
        delete dbPayload.drift_highscore;
        const res2 = await supabase.from('users').upsert(dbPayload, { onConflict: 'wallet_address' });
        error = res2.error;
      }
      if (error) {
        console.error("Supabase Save Error:", error);
        if (typeof window.triggerToast === 'function') {
          window.triggerToast("DB Save Error: " + (error.message || JSON.stringify(error)), "error");
        }
      }
    } catch (err) {
      console.error("Failed to save to DB:", err);
      if (typeof window.triggerToast === 'function') {
        window.triggerToast("DB Exception: " + (err.message || err), "error");
      }
    }
  }

  // Modify state and immediately save/sync
  update(keyValObj) {
    Object.keys(keyValObj).forEach(key => {
      if (typeof keyValObj[key] === 'number' && isNaN(keyValObj[key])) {
        console.error(`[PolyState Anti-Corruption] Attempted to set ${key} to NaN! Ignoring update.`);
        return; // Skip corrupted value
      }
      this.state[key] = keyValObj[key];
    });
    this.save();
    
    // Asynchronously push to database if connected
    this.saveToDB();
  }

  addActivity(user, action, reward) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const log = { user, action, reward, time };
    this.state.activities.unshift(log);
    if (this.state.activities.length > 20) {
      this.state.activities.pop();
    }
    this.save();
  }

  // --- VIP Checks ---
  isVipActive() {
    if (!this.state.vipUntil) return false;
    const expiry = new Date(this.state.vipUntil).getTime();
    return Date.now() < expiry;
  }

  // Calculate current multipliers based on state
  getMultipliers() {
    let nftFaucetBoost = 0;
    let nftGameMultiplier = 0;
    let nftStakingBoost = 1.0;
    let nftReferralMultiplier = 1.0;

    // Combine all owned NFT bonuses automatically (percentage is additive, referral multiplier is multiplicative)
    const combinedIds = [...(this.state.ownedNfts || []), ...(this.state.crateNfts || [])];
    combinedIds.forEach(nftId => {
      const activeNft = NFT_REGISTRY.find(n => n.id === nftId);
      if (activeNft) {
        nftFaucetBoost += activeNft.faucetBoost || 0;
        nftGameMultiplier += activeNft.gameMultiplier || 0;
        if (activeNft.stakingBoost) {
          nftStakingBoost *= (1 + (activeNft.stakingBoost / 100));
        }
        nftReferralMultiplier *= activeNft.referralMultiplier || 1.0;
      }
    });

    // Streak bonus: +2% per day up to 10%
    const streakBoost = Math.min(this.state.claimStreak * 2, 10);
    
    // Referral bonus: +1% per referred account up to 15%
    const referralBoost = Math.min(this.state.referralsCount * 1, 15);

    const totalFaucetBoostPercent = nftFaucetBoost + streakBoost + referralBoost;

    return {
      nftFaucetBoost,
      nftGameMultiplier,
      nftStakingBoost,
      nftReferralMultiplier,
      streakBoost,
      referralBoost,
      totalFaucetBoostPercent
    };
  }

  syncUI() {
    // Balances
    document.getElementById('balance-pgt').innerText = parseFloat(this.state.balancePgt || 0).toFixed(2);
    document.getElementById('balance-matic').innerText = parseFloat(this.state.balanceMatic || 0).toFixed(2);
    
    const onchainPill = document.getElementById('token-pill-pgt-onchain');
    const onchainLabel = document.getElementById('balance-pgt-onchain');
    if (onchainPill && onchainLabel) {
      if (this.state.walletConnected) {
        onchainPill.style.display = 'flex';
        onchainLabel.innerText = (this.state.onchainBalancePgt || 0).toFixed(2);
      } else {
        onchainPill.style.display = 'none';
      }
    }
    
    const onchainFlrPill = document.getElementById('token-pill-1flr-onchain');
    const onchainFlrLabel = document.getElementById('balance-1flr-onchain');
    if (onchainFlrPill && onchainFlrLabel) {
      if (this.state.walletConnected) {
        onchainFlrPill.style.display = 'flex';
        onchainFlrLabel.innerText = (this.state.onchainBalance1flr || 0).toFixed(2);
      } else {
        onchainFlrPill.style.display = 'none';
      }
    }
    
    // Header address & wallet toggle
    const addrDisplay = document.getElementById('wallet-address-display');
    const connectBtn = document.getElementById('btn-wallet-connect');
    const headerVip = document.getElementById('header-vip-badge');
    const joinVipBtn = document.getElementById('btn-header-join-vip');
    
    if (this.state.walletConnected) {
      addrDisplay.style.display = 'inline-block';
      if (headerVip) headerVip.style.display = 'none';
      if (joinVipBtn) {
        joinVipBtn.style.display = 'inline-block';
        joinVipBtn.innerText = this.isVipActive() ? '👑 VIP ACTIVE' : '💎 Join VIP';
      }
      addrDisplay.innerText = this.state.walletAddress.substring(0, 6) + '...' + this.state.walletAddress.substring(38);
      connectBtn.style.display = 'none';
    } else {
      addrDisplay.style.display = 'none';
      if (headerVip) headerVip.style.display = 'none';
      if (joinVipBtn) {
        joinVipBtn.style.display = 'inline-block';
        joinVipBtn.innerText = '💎 Join VIP';
      }
      connectBtn.style.display = 'flex';
    }

    // VIP Profile Card UI
    const vipStatusBadge = document.getElementById('vip-status-badge');
    const vipExpiryText = document.getElementById('vip-expiry-text');
    const vipExpiryDate = document.getElementById('vip-expiry-date');
    const btnBuyVip = document.getElementById('btn-buy-vip');
    
    if (vipStatusBadge && btnBuyVip) {
      if (this.isVipActive()) {
        vipStatusBadge.innerText = 'ACTIVE';
        vipStatusBadge.style.color = '#000';
        vipStatusBadge.style.background = 'var(--color-warning)';
        
        btnBuyVip.innerText = 'VIP ACTIVE';
        
        if (vipExpiryText && vipExpiryDate) {
          vipExpiryText.style.display = 'block';
          vipExpiryDate.innerText = new Date(this.state.vipUntil).toLocaleDateString() + ' ' + new Date(this.state.vipUntil).toLocaleTimeString();
        }
      } else {
        vipStatusBadge.innerText = 'INACTIVE';
        vipStatusBadge.style.color = 'var(--text-muted)';
        vipStatusBadge.style.background = 'rgba(255,255,255,0.1)';
        
        btnBuyVip.innerText = 'BUY 30-DAY VIP PASS NFT';
        
        if (vipExpiryText) {
          vipExpiryText.style.display = 'none';
        }
      }
    }

    // Feature-specific VIP badges
    const faucetBadge = document.getElementById('faucet-vip-badge');
    if (faucetBadge) faucetBadge.style.display = this.isVipActive() ? 'block' : 'none';
    
    const stakingBadge = document.getElementById('staking-vip-badge');
    if (stakingBadge) stakingBadge.style.display = this.isVipActive() ? 'block' : 'none';
    
    const refBadge = document.getElementById('referral-vip-badge');
    if (refBadge) refBadge.style.display = this.isVipActive() ? 'block' : 'none';

    // Dashboard quick stats
    const multis = this.getMultipliers();
    document.getElementById('stats-total-claims').innerText = this.state.totalClaims;
    document.getElementById('stats-active-boost').innerText = `+${multis.totalFaucetBoostPercent}%`;
    document.getElementById('stats-game-highscore').innerText = this.state.gameHighScore;
    document.getElementById('stats-referrals-count').innerText = this.state.referralsCount;
    


    // Faucet UI stats
    document.getElementById('faucet-multiplier-nft').innerText = `+${multis.nftFaucetBoost}%`;
    document.getElementById('faucet-multiplier-referral').innerText = `+${multis.referralBoost}%`;
    document.getElementById('faucet-multiplier-streak').innerText = `+${multis.streakBoost}%`;
    
    const faucetVipRow = document.getElementById('faucet-multiplier-vip-row');
    if (faucetVipRow) {
      faucetVipRow.style.display = this.isVipActive() ? 'flex' : 'none';
    }
    
    const basePayout = 50.0;
    let totalEst = basePayout * (1 + multis.totalFaucetBoostPercent / 100);
    
    // Whale Bonuses
    const is1FlrWhale = this.state.balance1flr >= 5000000;
    const isPgtWhale = this.state.stakedPgt >= 1000000;
    
    document.getElementById('faucet-multiplier-1flr').innerText = is1FlrWhale ? '+15%' : '+0%';
    document.getElementById('faucet-multiplier-pgt').innerText = isPgtWhale ? '+25%' : '+0%';
    
    document.getElementById('faucet-multiplier-1flr').style.color = is1FlrWhale ? 'var(--color-success)' : 'var(--text-muted)';
    document.getElementById('faucet-multiplier-pgt').style.color = isPgtWhale ? 'var(--color-success)' : 'var(--text-muted)';

    if (is1FlrWhale) totalEst *= 1.15;
    if (isPgtWhale) totalEst *= 1.25;
    if (this.isVipActive()) totalEst *= 2;
    
    document.getElementById('faucet-estimated-claim').innerText = `${totalEst.toFixed(2)} PGT`;

    // Activity Feed render
    const feed = document.getElementById('activity-feed');
    feed.innerHTML = '';
    
    // Fill up activity stream (if empty, populate some default logs)
    const logsToDraw = this.state.activities.length > 0 ? this.state.activities : this.getMockActivities();
    logsToDraw.forEach(log => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div>
          <span class="activity-user">${log.user}</span>
          <span class="activity-action">${log.action}</span>
          <span class="activity-reward">${log.reward}</span>
        </div>
        <span class="activity-time">${log.time}</span>
      `;
      feed.appendChild(item);
    });

    // Staking UI Stats (Dual Pool)
    const pool = activeStakingPool; // 'pgt' or '1flr'
    const isPgt = pool === 'pgt';
    
    let stakedVal = 0;
    (this.state.stakes || []).forEach(stake => {
      if (stake.pool === pool) {
        stakedVal += stake.amount;
      }
    });

    let walletMax = isPgt ? this.state.balancePgt : this.state.balance1flr;
    const tokenName = isPgt ? 'PGT' : '1FLR';

    // Determine APY based on active lock tier
    const baseApy = activeStakingTier === 'day' ? 1.0 : (activeStakingTier === 'month' ? 2.0 : 3.0);
    let finalApy = baseApy * multis.nftStakingBoost;
    if (this.isVipActive()) finalApy *= 2.0;

    document.getElementById('staking-balance-staked').innerText = `${parseFloat(stakedVal || 0).toFixed(2)} ${tokenName}`;
    
    const activeApyLabel = document.getElementById('staking-active-apy');
    if (activeApyLabel) activeApyLabel.innerText = `${parseFloat(finalApy || 0).toFixed(2)}%`;
    
    // Update APY breakdown UI
    const baseEl = document.getElementById('staking-breakdown-base');
    const nftEl = document.getElementById('staking-breakdown-nft');
    const stakingVipRow = document.getElementById('staking-breakdown-vip-row');
    const finalEl = document.getElementById('staking-breakdown-final');
    
    if (baseEl) baseEl.innerText = `${parseFloat(baseApy || 0).toFixed(1)}%`;
    if (nftEl) {
      const nftBonusAbsolute = baseApy * (multis.nftStakingBoost - 1.0);
      nftEl.innerText = `+${parseFloat(nftBonusAbsolute || 0).toFixed(2)}%`;
      nftEl.style.color = multis.nftStakingBoost > 1.0 ? 'var(--color-success)' : 'var(--text-muted)';
    }
    if (stakingVipRow) stakingVipRow.style.display = this.isVipActive() ? 'flex' : 'none';
    if (finalEl) finalEl.innerText = `${parseFloat(finalApy || 0).toFixed(2)}%`;
    document.getElementById('staking-wallet-max').innerText = `${parseFloat(walletMax || 0).toFixed(2)} ${tokenName}`;
    document.getElementById('staking-input-token-label').innerText = tokenName;
    
    const yieldHarvestedEl = document.getElementById('staking-total-harvested');
    if (yieldHarvestedEl) {
      yieldHarvestedEl.innerText = `${parseFloat(this.state.totalStakingYield || 0).toFixed(6)} PGT`;
    }
    
    // Update live lock box display and the list ledger
    updateStakingLockCountdownUI();
    if (typeof renderStakingLedger === 'function') {
      renderStakingLedger();
    }

    // Referral stats (Multi-Level Tiers)
    const baseUrl = window.location.origin + window.location.pathname;
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    document.getElementById('ref-invite-link').value = `${cleanBaseUrl}?ref=${this.state.referralCode}`;
    
    const l1 = document.getElementById('ref-level-1-count');
    const l2 = document.getElementById('ref-level-2-count');
    const l3 = document.getElementById('ref-level-3-count');
    const l4 = document.getElementById('ref-level-4-count');
    if (l1 && l2 && l3 && l4) {
      l1.innerText = this.state.referralsL1 || 0;
      l2.innerText = this.state.referralsL2 || 0;
      l3.innerText = this.state.referralsL3 || 0;
      l4.innerText = this.state.referralsL4 || 0;
    }

    const refUnclaimedEl = document.getElementById('ref-stat-unclaimed');
    if (refUnclaimedEl) {
      refUnclaimedEl.innerText = `${parseFloat(this.state.unclaimedReferralPgt || 0).toFixed(2)} PGT`;
    }
    const refCommissionEl = document.getElementById('ref-stat-commission');
    if (refCommissionEl) {
      refCommissionEl.innerText = `${parseFloat(this.state.totalReferralCommission || 0).toFixed(2)} PGT`;
    }

    // Render Referred Downline Ledger list
    const ledger = document.getElementById('ref-downline-ledger');
    if (ledger) {
      ledger.innerHTML = '';
      const list = this.state.referralsList || [];
      if (list.length === 0) {
        ledger.innerHTML = '<div style="text-align: center; padding: 1rem 0; color: var(--text-dim); font-size: 0.85rem;">No downline activity logged yet.</div>';
      } else {
        list.forEach(entry => {
          const row = document.createElement('div');
          row.className = 'activity-item';
          row.style.fontSize = '0.8rem';
          const isClaim = (entry.commission || 0) > 0;
          row.innerHTML = `
            <div>
              <span class="activity-user" style="font-weight:600;">${entry.name}</span>
              <span class="activity-action" style="margin: 0 0.4rem; color:var(--text-muted);">
                Tier L${entry.level || 1} ${isClaim ? 'Faucet Claim' : 'Account Linked'}
              </span>
              <span class="activity-reward" style="font-weight:700; color:${isClaim ? 'var(--color-success)' : 'var(--text-dim)'};">
                +${(entry.commission || 0).toFixed(2)} PGT
              </span>
            </div>
            <span class="activity-time">${entry.time || ''}</span>
          `;
          ledger.appendChild(row);
        });
      }
    }
    
    // Inventory Badge
    document.getElementById('inventory-count-badge').innerText = this.state.ownedNfts.length;

    // Profile updates sync
    syncProfileView();

    // Roshambo sync
    updateRoshamboWagerLabels();

    // Live Arcade HUD boost labels sync
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const vipMult = this.isVipActive() ? 2.0 : 1.0;
    const totalBoostStr = `${(nftMult * vipMult).toFixed(1)}x`;

    ['game-nft-boost-label', 'invaders-nft-boost-label', 'drift-nft-boost-label'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = totalBoostStr;
    });
  }

  getMockActivities() {
    return [
      { user: 'RocketRacer', action: 'claimed faucet', reward: '+55.00 PGT', time: '12:04:12 PM' },
      { user: 'OxQuantum', action: 'harvested yield', reward: '+142.12 PGT', time: '12:02:45 PM' },
      { user: 'SolGamer', action: 'scored 4,820 on Astro-Dodge', reward: '+96.40 PGT', time: '12:00:19 PM' },
      { user: 'SatoshiKid', action: 'bought Apex Matrix NFT', reward: '-800 PGT', time: '11:58:33 AM' }
    ];
  }
}

export const appState = new PolyState();

