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
      balanceMatic: 0.0,
      walletConnected: false,
      walletProvider: null,
      walletAddress: '',
      
      totalClaims: 0,
      lastClaimTime: null,
      claimStreak: 0,
      
      gameHighScore: 0,
      invadersHighScore: 0,
      
      ownedNfts: [],
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
      stakedNfts: [],
      
      vipUntil: null, // TIMESTAMPTZ of when VIP expires
      
      activities: []
    };

    this.state = {};
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
    if (!this.state.walletConnected || !this.state.walletAddress || !supabase) return;

    try {
      const dbPayload = {
        wallet_address: this.state.walletAddress.toLowerCase(),
        balance_pgt: this.state.balancePgt,
        balance_1flr: this.state.balance1flr,
        pending_payout_pgt: this.state.pendingPayoutPgt,
        total_claims: this.state.totalClaims,
        last_claim_time: this.state.lastClaimTime,
        claim_streak: this.state.claimStreak,
        game_highscore: this.state.gameHighScore,
        invaders_highscore: this.state.invadersHighScore,
        owned_nfts: this.state.ownedNfts || [],
        equipped_nft: this.state.equippedNft,
        staked_balance_pgt: this.state.stakedBalancePgt,
        staked_balance_1flr: this.state.stakedBalance1flr,
        referrals_count: this.state.referralsCount,
        referrals_l1: this.state.referralsL1,
        referrals_l2: this.state.referralsL2,
        referrals_l3: this.state.referralsL3,
        referrals_l4: this.state.referralsL4,
        total_referral_commission: this.state.totalReferralCommission,
        referral_code: this.state.referralCode,
        referrals_list: this.state.referralsList || [],
        stakes: this.state.stakes || [],
        activities: this.state.activities || [],
        updated_at: new Date().toISOString()
      };

      if (this.state.referredBy) {
        dbPayload.referred_by = this.state.referredBy;
      }


      const { error } = await supabase.from('users').upsert(dbPayload, { onConflict: 'wallet_address' });
      if (error) {
        console.error("Supabase Save Error:", error);
      }
    } catch (err) {
      console.error("Failed to save to DB:", err);
    }
  }

  // Modify state and immediately save/sync
  update(keyValObj) {
    Object.keys(keyValObj).forEach(key => {
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
    let nftStakingBoost = 0;
    let nftReferralMultiplier = 1.0;

    // Combine all owned NFT bonuses automatically (percentage is additive, referral multiplier is multiplicative)
    (this.state.ownedNfts || []).forEach(nftId => {
      const activeNft = NFT_REGISTRY.find(n => n.id === nftId);
      if (activeNft) {
        nftFaucetBoost += activeNft.faucetBoost || 0;
        nftGameMultiplier += activeNft.gameMultiplier || 0;
        nftStakingBoost += activeNft.stakingBoost || 0;
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
    document.getElementById('balance-pgt').innerText = this.state.balancePgt.toFixed(2);
    document.getElementById('balance-matic').innerText = this.state.balanceMatic.toFixed(2);
    
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
      if (headerVip) headerVip.style.display = this.isVipActive() ? 'inline-block' : 'none';
      if (joinVipBtn) joinVipBtn.style.display = this.isVipActive() ? 'none' : 'inline-block';
      addrDisplay.innerText = this.state.walletAddress.substring(0, 6) + '...' + this.state.walletAddress.substring(38);
      connectBtn.style.display = 'none';
    } else {
      addrDisplay.style.display = 'none';
      if (headerVip) headerVip.style.display = 'none';
      if (joinVipBtn) joinVipBtn.style.display = 'inline-block';
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
        
        btnBuyVip.innerText = 'BUY VIP PASS EXTENSION';
        
        if (vipExpiryText && vipExpiryDate) {
          vipExpiryText.style.display = 'block';
          vipExpiryDate.innerText = new Date(this.state.vipUntil).toLocaleDateString() + ' ' + new Date(this.state.vipUntil).toLocaleTimeString();
        }
      } else {
        vipStatusBadge.innerText = 'INACTIVE';
        vipStatusBadge.style.color = 'var(--text-muted)';
        vipStatusBadge.style.background = 'rgba(255,255,255,0.1)';
        
        btnBuyVip.innerText = 'BUY 30-DAY VIP PASS NFT';
        if (vipExpiryText) vipExpiryText.style.display = 'none';
      }
    }

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
    
    const basePayout = 50.0;
    let totalEst = basePayout * (1 + multis.totalFaucetBoostPercent / 100);
    
    // Apply multiplicative bonuses
    if (this.state.balancePgt >= 1000000) totalEst *= 2;
    if (this.state.balance1flr >= 5000000) totalEst *= 1.1;
    if (this.state.stakedPgt >= 1000000) totalEst *= 1.25;
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
    const finalApy = baseApy + multis.nftStakingBoost;

    document.getElementById('staking-balance-staked').innerText = `${stakedVal.toFixed(2)} ${tokenName}`;
    document.getElementById('staking-apy-rate').innerText = `${finalApy.toFixed(2)}%`;
    document.getElementById('staking-wallet-max').innerText = `${walletMax.toFixed(2)} ${tokenName}`;
    document.getElementById('staking-input-token-label').innerText = tokenName;
    
    // Update live lock box display and the list ledger
    updateStakingLockCountdownUI();
    if (typeof renderStakingLedger === 'function') {
      renderStakingLedger();
    }

    // Referral stats (Multi-Level Tiers)
    document.getElementById('ref-stat-count').innerText = this.state.referralsCount;
    document.getElementById('ref-stat-commission').innerText = `${this.state.totalReferralCommission.toFixed(2)} PGT`;
    document.getElementById('ref-invite-link').value = `https://polygame.xyz/?ref=${this.state.referralCode}`;
    
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
          row.innerHTML = `
            <div>
              <span class="activity-user">${entry.name}</span>
              <span class="activity-action">Tier L${entry.level} Claim</span>
              <span class="activity-reward" style="color:var(--color-primary);">+${entry.commission.toFixed(2)} PGT</span>
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

