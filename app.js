/**
 * PolyGame - Core Application Engine & State Coordinator
 * Handles Web3 Mocking, LocalStorage synchronization, UI routing,
 * sound synthesis, Captcha Verification, Staking yields, and NFT modifications.
 */

// --- Web3 Configurations (Real Polygon Deployments) ---
// REPLACE this placeholder with your deployed PGT ERC-20 contract address:
const TOKEN_CONTRACT_ADDRESS = "0x8929e5ef2f34801561001057600080fd5b506040"; // Placeholder token address
const NFT_CONTRACT_ADDRESS = "";   // Placeholder NFT address
const TOKEN_1FLR_CONTRACT_ADDRESS = "0x5f0197Ba06860DaC7e31258BdF749F92b6a636d4";
// REPLACE this with your own secure admin/treasury wallet address to receive staking deposits:
const VAULT_RECEIVER_ADDRESS = "0x14791697260E4c9A71f18484C9f997B308e59325"; // Defaults to authority signer address

let web3Provider = null;
let realSigner = null;

// --- Retro Synthesizer SFX Engine (Web Audio API) ---
class RetroSynth {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle(forceState = null) {
    this.enabled = forceState !== null ? forceState : !this.enabled;
    const label = document.getElementById('sound-status-label');
    if (label) {
      label.innerText = this.enabled ? 'ON' : 'OFF';
      label.style.color = this.enabled ? 'var(--color-accent)' : 'var(--color-danger)';
    }
    if (this.enabled) this.init();
    return this.enabled;
  }

  // Double arpeggio tone for claims & rewards
  playSuccess() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    
    // Low gain to avoid ear-blasting
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.08, t);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    masterGain.connect(this.ctx.destination);

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      osc.connect(masterGain);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.2);
    });
  }

  // Disappointing descending sweep for errors/cancels
  playError() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.12, t);
    masterGain.gain.linearRampToValueAtTime(0.001, t + 0.4);
    masterGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(80, t + 0.35);
    osc.connect(masterGain);
    
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // Classic retro coin pickup chime
  playCoin() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.06, t);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    masterGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.setValueAtTime(1318.51, t + 0.08); // E6
    
    osc.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // Quick cybernetic drum beat for Roshambo count downs
  playRoshamboDrum() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.15, t);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    masterGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(40, t + 0.12);
    osc.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Frequency slide up for equips
  playPowerUp() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.07, t);
    masterGain.gain.linearRampToValueAtTime(0.001, t + 0.5);
    masterGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.4);

    osc.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  // White noise explosion with lowpass filter sweep for crash
  playExplosion() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const duration = 0.6;

    // Buffer generation
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + duration);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.12, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    noiseNode.start(t);
    noiseNode.stop(t + duration);
  }
}

const sfx = new RetroSynth();

// --- Static NFT Cards Registry ---
const NFT_REGISTRY = [
  // --- FAUCET BOOST GROUP ---
  {
    id: 'nft_common_boost',
    name: 'Copper Core',
    rarity: 'common',
    group: 'faucet',
    price: 5.0,
    faucetBoost: 10,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'A vintage energy transducer. Enhances basic spatial vacuuming.',
    svg: `<svg viewBox="0 0 100 100"><rect x="30" y="30" width="40" height="40" rx="10" fill="none" stroke="#8899b8" stroke-width="4"/><circle cx="50" cy="50" r="10" fill="#cd7f32" /><path d="M50 15v15M50 70v15M15 50h15M70 50h15" stroke="#8899b8" stroke-width="3"/></svg>`
  },
  {
    id: 'nft_silver_charger',
    name: 'Silver Charger',
    rarity: 'rare',
    group: 'faucet',
    price: 15.0,
    faucetBoost: 25,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'Upgraded power cell boosting standard molecular extraction.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="25" fill="none" stroke="#c0c0c0" stroke-width="4"/><path d="M50 15 L50 85 M15 50 L85 50" stroke="#c0c0c0" stroke-width="2"/><circle cx="50" cy="50" r="8" fill="#e0e0e0"/></svg>`
  },
  {
    id: 'nft_gold_turbine',
    name: 'Gold Turbine',
    rarity: 'epic',
    group: 'faucet',
    price: 40.0,
    faucetBoost: 50,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'High-yield particle turbine for massive energy harvests.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="28" fill="none" stroke="#ffd700" stroke-width="4"/><path d="M35 35 L65 65 M35 65 L65 35" stroke="#ffd700" stroke-width="3"/><polygon points="50,20 60,35 40,35" fill="#ffd700"/><polygon points="50,80 60,65 40,65" fill="#ffd700"/></svg>`
  },

  // --- GAME BOOST GROUP ---
  {
    id: 'nft_rare_shield',
    name: 'Viper Shield',
    rarity: 'rare',
    group: 'game',
    price: 15.0,
    faucetBoost: 0,
    gameMultiplier: 15,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'Reinforced plating designed to deflect minor orbital dust debris.',
    svg: `<svg viewBox="0 0 100 100"><polygon points="50,15 80,35 80,65 50,85 20,65 20,35" fill="none" stroke="#00f0ff" stroke-width="4"/><polygon points="50,25 70,40 70,60 50,75 30,60 30,40" fill="#00f0ff" opacity="0.3"/><circle cx="50" cy="50" r="8" fill="#fff"/></svg>`
  },
  {
    id: 'nft_pulse_blaster',
    name: 'Pulse Blaster',
    rarity: 'epic',
    group: 'game',
    price: 40.0,
    faucetBoost: 0,
    gameMultiplier: 30,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'Holographic projectile matrix that doubles core arcade kinetics.',
    svg: `<svg viewBox="0 0 100 100"><rect x="35" y="15" width="30" height="70" rx="5" fill="none" stroke="#ff007f" stroke-width="4"/><circle cx="50" cy="30" r="10" fill="#ff007f" opacity="0.4"/><line x1="50" y1="45" x2="50" y2="75" stroke="#ff007f" stroke-width="4"/></svg>`
  },
  {
    id: 'nft_epic_yield',
    name: 'Apex Matrix',
    rarity: 'epic',
    group: 'game',
    price: 60.0,
    faucetBoost: 0,
    gameMultiplier: 50,
    stakingBoost: 5,
    referralMultiplier: 1.0,
    description: 'Neural core algorithm yielding accelerated block processing.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="#bd00ff" stroke-width="4"/><path d="M30 30 L70 70 M30 70 L70 30" stroke="#bd00ff" stroke-width="3"/><rect x="42" y="42" width="16" height="16" rx="3" fill="#bd00ff" /><circle cx="50" cy="50" r="3" fill="#fff"/></svg>`
  },

  // --- REFERRAL BOOST GROUP ---
  {
    id: 'nft_affiliate_guild',
    name: 'Affiliate Guild',
    rarity: 'rare',
    group: 'referral',
    price: 10.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.5,
    description: 'A network relay core boosting all downline commissions by 1.5x.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="25" cy="50" r="10" fill="#00ff66"/><circle cx="75" cy="30" r="10" fill="#00ff66"/><circle cx="75" cy="70" r="10" fill="#00ff66"/><line x1="25" y1="50" x2="75" y2="30" stroke="#00ff66" stroke-width="3"/><line x1="25" y1="50" x2="75" y2="70" stroke="#00ff66" stroke-width="3"/></svg>`
  },
  {
    id: 'nft_legendary_king',
    name: 'Omni Lord',
    rarity: 'legendary',
    group: 'referral',
    price: 20.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 2.0,
    description: 'Ultimate referral beacon. Multiplies all network commission earnings by 2x.',
    svg: `<svg viewBox="0 0 100 100"><polygon points="50,10 90,40 75,85 25,85 10,40" fill="none" stroke="#ffb700" stroke-width="5"/><circle cx="50" cy="50" r="22" fill="none" stroke="#ffb700" stroke-width="2" stroke-dasharray="4,4"/><polygon points="50,30 62,55 38,55" fill="#ffb700"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`
  }
];

// Secure hash utility to prevent manual local storage editing (Anti-cheat)
function cyb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334903);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
const CHECKSUM_SALT = "polygame_secret_salt_1982";

// --- Persistent Application State Management ---
class PolyState {
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

  // Modify state and immediately save/sync
  update(keyValObj) {
    Object.keys(keyValObj).forEach(key => {
      this.state[key] = keyValObj[key];
    });
    this.save();
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

  // Calculate current multipliers based on state
  getMultipliers() {
    let nftFaucetBoost = 0;
    let nftGameMultiplier = 0;
    let nftStakingBoost = 0;
    let nftReferralMultiplier = 1.0;

    if (this.state.equippedNft) {
      const activeNft = NFT_REGISTRY.find(n => n.id === this.state.equippedNft);
      if (activeNft) {
        nftFaucetBoost = activeNft.faucetBoost || 0;
        nftGameMultiplier = activeNft.gameMultiplier || 0;
        nftStakingBoost = activeNft.stakingBoost || 0;
        nftReferralMultiplier = activeNft.referralMultiplier || 1.0;
      }
    }

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
    if (this.state.walletConnected) {
      addrDisplay.style.display = 'inline-block';
      addrDisplay.innerText = this.state.walletAddress.substring(0, 6) + '...' + this.state.walletAddress.substring(38);
      connectBtn.style.display = 'none';
    } else {
      addrDisplay.style.display = 'none';
      connectBtn.style.display = 'flex';
    }

    // Dashboard quick stats
    const multis = this.getMultipliers();
    document.getElementById('stats-total-claims').innerText = this.state.totalClaims;
    document.getElementById('stats-active-boost').innerText = `+${multis.totalFaucetBoostPercent}%`;
    document.getElementById('stats-game-highscore').innerText = this.state.gameHighScore;
    document.getElementById('stats-referrals-count').innerText = this.state.referralsCount;
    
    // Weekly Pending Payout pool sync
    const pendingLabel = document.getElementById('dashboard-pending-payout');
    if (pendingLabel) {
      pendingLabel.innerText = `${this.state.pendingPayoutPgt.toFixed(2)} PGT`;
    }

    // Faucet UI stats
    document.getElementById('faucet-multiplier-nft').innerText = `+${multis.nftFaucetBoost}%`;
    document.getElementById('faucet-multiplier-referral').innerText = `+${multis.referralBoost}%`;
    document.getElementById('faucet-multiplier-streak').innerText = `+${multis.streakBoost}%`;
    
    const basePayout = 50.0;
    const totalEst = basePayout * (1 + multis.totalFaucetBoostPercent / 100);
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

    let walletMax = 0;
    if (this.state.walletConnected) {
      walletMax = isPgt ? (this.state.onchainBalancePgt || 0) : (this.state.onchainBalance1flr || 0);
    } else {
      walletMax = isPgt ? this.state.balancePgt : this.state.balance1flr;
    }
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

const appState = new PolyState();

// --- Master View Switcher (Router) ---
function switchTab(tabId) {
  // Play sound
  sfx.init();
  
  // Deactivate current tabs
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Activate new link
  const targetLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
  if (targetLink) targetLink.classList.add('active');

  // Activate new panel
  const targetPanel = document.getElementById(`view-${tabId}`);
  if (targetPanel) targetPanel.classList.add('active');

  // Update header text
  const viewTitle = document.getElementById('view-title');
  if (viewTitle) {
    viewTitle.innerText = targetLink ? targetLink.innerText.trim() : 'Dashboard';
  }

  // Custom view initializers
  if (tabId === 'nft') {
    renderNftMarketplace();
    renderNftInventory();
  }
  if (tabId === 'profile') {
    syncProfileView();
  }
}

// --- Notification Toast Manager ---
function triggerToast(message, type = 'success') {
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
function openModal(modalId) {
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

function closeModal(modalId) {
  const overlay = document.getElementById(`modal-${modalId}`);
  if (overlay) overlay.classList.remove('active');
}

// Connect real wallet via MetaMask
async function connectWeb3() {
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

    // Remove loader
    const tempLoader = document.getElementById('modal-loader-real-web3');
    if (tempLoader) tempLoader.remove();

    // Update State
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
function mockWalletSelection(providerName) {
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
const pgtInput = document.getElementById('swap-input-pgt');
const maticInput = document.getElementById('swap-input-matic');
const executeSwapBtn = document.getElementById('btn-execute-swap');

function calculateSwapRate() {
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

// --- Crypto Faucet human verification ---
const btnClaimFaucet = document.getElementById('btn-claim-faucet');
let captchaTarget = [];
let captchaInput = [];
const captchaSymbols = ['⚡', '💎', '👑', '👾', '🛸', '🎮', '🍒', '🎲'];

// Secure True Time query (anti-system clock cheats)
async function fetchTrueTime() {
  try {
    const res = await fetch("https://worldtimeapi.org/api/timezone/Etc/UTC");
    if (res.ok) {
      const data = await res.json();
      return data.unixtime * 1000; // Return in ms
    }
  } catch (err) {
    console.error("True time sync failed, falling back to local clock:", err);
  }
  return Date.now();
}

let cachedTrueTimeOffset = 0;
// We'll update the clock offset on startup
fetchTrueTime().then(trueMs => {
  cachedTrueTimeOffset = trueMs - Date.now();
});

function getSecureNow() {
  return Date.now() + cachedTrueTimeOffset;
}

function checkFaucetCooldown() {
  if (!appState.state.lastClaimTime) {
    setFaucetClaimActive(true);
    return;
  }

  const now = getSecureNow();
  const diffSec = Math.floor((now - appState.state.lastClaimTime) / 1000);
  const cooldownSec = 86400; // 24 hours

  if (diffSec >= cooldownSec) {
    setFaucetClaimActive(true);
  } else {
    setFaucetClaimActive(false);
    updateFaucetCooldownTimer(cooldownSec - diffSec);
  }
}

function setFaucetClaimActive(active) {
  if (active) {
    btnClaimFaucet.disabled = false;
    btnClaimFaucet.innerText = "Claim " + document.getElementById('faucet-estimated-claim').innerText;
    document.getElementById('faucet-timer-text').innerText = "READY";
    document.getElementById('faucet-status-subtext').innerText = "Claim Now";
    
    const ring = document.getElementById('faucet-progress-ring');
    if (ring) ring.style.strokeDashoffset = 0;
  } else {
    btnClaimFaucet.disabled = true;
  }
}

function updateFaucetCooldownTimer(secondsLeft) {
  const hrs = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  const displayStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  document.getElementById('faucet-timer-text').innerText = displayStr;
  document.getElementById('faucet-status-subtext').innerText = "Cooldown";
  btnClaimFaucet.innerText = `Claim Locked (${displayStr})`;
  
  const ring = document.getElementById('faucet-progress-ring');
  if (ring) {
    const totalRingLength = 565.48; // 2 * PI * r
    const fractionLeft = secondsLeft / 86400;
    ring.style.strokeDashoffset = totalRingLength - (fractionLeft * totalRingLength);
  }
}

// Tick cooldown timers and weekly payouts every second
setInterval(() => {
  if (appState.state.lastClaimTime) {
    const now = getSecureNow();
    const diff = Math.floor((now - appState.state.lastClaimTime) / 1000);
    if (diff < 86400) {
      updateFaucetCooldownTimer(86400 - diff);
    } else if (btnClaimFaucet.disabled) {
      setFaucetClaimActive(true);
    }
  }

  // Tick weekly payouts countdown
  const countdownLabel = document.getElementById('dashboard-payout-countdown');
  if (countdownLabel) {
    const secureNow = getSecureNow();
    const nowSecDate = new Date(secureNow);
    
    // Find next Sunday at 00:00 UTC
    // Day: 0 = Sunday, 1 = Monday ... 6 = Saturday
    const currentDay = nowSecDate.getUTCDay();
    const daysToSunday = currentDay === 0 ? 7 : 7 - currentDay;
    
    const nextSunday = new Date(Date.UTC(
      nowSecDate.getUTCFullYear(),
      nowSecDate.getUTCMonth(),
      nowSecDate.getUTCDate() + daysToSunday,
      0, 0, 0, 0
    ));
    
    const diffMs = nextSunday.getTime() - secureNow;
    if (diffMs > 0) {
      const days = Math.floor(diffMs / (86400 * 1000));
      const hrs = Math.floor((diffMs % (86400 * 1000)) / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      countdownLabel.innerText = `${days}d ${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    } else {
      countdownLabel.innerText = "Processing Payouts...";
    }
  }
}, 1000);

if (btnClaimFaucet) {
  btnClaimFaucet.addEventListener('click', () => {
    openModal('captcha');
    generateCaptchaChallenge();
  });
}

// Generate captcha sequence
function generateCaptchaChallenge() {
  captchaTarget = [];
  captchaInput = [];
  
  // Choose 3 random symbols for sequence
  const pool = [...captchaSymbols];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    captchaTarget.push(pool.splice(idx, 1)[0]);
  }

  // Draw target
  const targetCont = document.getElementById('captcha-target-display');
  targetCont.innerHTML = '';
  captchaTarget.forEach(sym => {
    const box = document.createElement('div');
    box.className = 'captcha-sym-box';
    box.innerText = sym;
    targetCont.appendChild(box);
  });

  // Draw input display
  drawCaptchaInputDisplay();

  // Draw Keyboard options
  const keyCont = document.getElementById('captcha-keyboard-pad');
  keyCont.innerHTML = '';
  
  // Shuffle all symbols to generate keys
  const shuffledKeys = [...captchaSymbols].sort(() => Math.random() - 0.5);
  shuffledKeys.forEach(sym => {
    const key = document.createElement('button');
    key.className = 'btn-captcha-key';
    key.innerText = sym;
    key.addEventListener('click', () => handleCaptchaKeyPress(sym));
    keyCont.appendChild(key);
  });
}

function handleCaptchaKeyPress(sym) {
  if (captchaInput.length >= 3) return;
  sfx.playCoin();
  captchaInput.push(sym);
  drawCaptchaInputDisplay();
}

function drawCaptchaInputDisplay() {
  const display = document.getElementById('captcha-input-display');
  display.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const box = document.createElement('div');
    box.className = `captcha-sym-box ${captchaInput[i] ? 'active-selected' : ''}`;
    box.innerText = captchaInput[i] || '';
    display.appendChild(box);
  }
}

document.getElementById('btn-captcha-reset').addEventListener('click', () => {
  captchaInput = [];
  sfx.playError();
  drawCaptchaInputDisplay();
});

document.getElementById('btn-captcha-verify').addEventListener('click', () => {
  if (captchaInput.length < 3) {
    triggerToast("Incomplete sequence", "error");
    return;
  }

  // Check sequence matches
  const match = captchaTarget.every((val, index) => val === captchaInput[index]);
  
  if (match) {
    closeModal('captcha');
    executeFaucetClaim();
  } else {
    triggerToast("Captcha verification failed. Try again.", "error");
    generateCaptchaChallenge();
  }
});

function executeFaucetClaim() {
  const multis = appState.getMultipliers();
  const basePayout = 50.0;
  const totalPayout = basePayout * (1 + multis.totalFaucetBoostPercent / 100);

  // Update claim streak
  let newStreak = appState.state.claimStreak + 1;
  if (appState.state.lastClaimTime) {
    const hoursSinceLast = (getSecureNow() - appState.state.lastClaimTime) / (3600 * 1000);
    if (hoursSinceLast > 36) {
      newStreak = 1;
    }
  }

  appState.update({
    pendingPayoutPgt: appState.state.pendingPayoutPgt + totalPayout,
    totalClaims: appState.state.totalClaims + 1,
    lastClaimTime: getSecureNow(),
    claimStreak: newStreak
  });

  sfx.playSuccess();
  triggerToast(`Claimed +${totalPayout.toFixed(2)} PGT Faucet reward (Pending)!`, 'success');
  appState.addActivity('You', 'claimed faucet', `+${totalPayout.toFixed(2)} PGT (Pending)`);
  
  setFaucetClaimActive(false);
}

// --- NFT Marketplace & Inventory rendering ---
function renderNftMarketplace() {
  const grid = document.getElementById('nft-market-grid');
  if (!grid) return;
  
  grid.innerHTML = `
    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-primary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">⚡ Faucet Boost Cores</h3>
    </div>
    <div id="nft-group-faucet" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 2rem;"></div>

    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-accent); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">🎮 Game Multiplier Cores</h3>
    </div>
    <div id="nft-group-game" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 2rem;"></div>

    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-secondary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">🔗 Referral Multiplier Cores</h3>
    </div>
    <div id="nft-group-referral" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 1rem;"></div>
  `;

  const faucetContainer = document.getElementById('nft-group-faucet');
  const gameContainer = document.getElementById('nft-group-game');
  const referralContainer = document.getElementById('nft-group-referral');

  NFT_REGISTRY.forEach(nft => {
    const isOwned = appState.state.ownedNfts.includes(nft.id);
    
    // Calculate boost textual representation
    let bonuses = [];
    if (nft.faucetBoost > 0) bonuses.push(`Faucet claim +${nft.faucetBoost}%`);
    if (nft.gameMultiplier > 0) bonuses.push(`Arcade score +${nft.gameMultiplier}%`);
    if (nft.stakingBoost > 0) bonuses.push(`Staking APY +${nft.stakingBoost}%`);
    if (nft.referralMultiplier > 1.0) bonuses.push(`Referral rewards x${nft.referralMultiplier}`);

    const card = document.createElement('div');
    card.className = `nft-card rarity-${nft.rarity}`;
    card.innerHTML = `
      <div class="nft-art-container">
        <div class="nft-art-bg"></div>
        <div class="nft-art-svg">${nft.svg}</div>
        <span class="nft-rarity-badge rarity-${nft.rarity}">${nft.rarity}</span>
      </div>
      <div class="nft-details">
        <h4 class="nft-name">${nft.name}</h4>
        <p style="font-size:0.8rem; color:var(--text-dim); line-height:1.3; min-height:35px;">${nft.description}</p>
        <div class="nft-bonus">
          ${bonuses.map(b => `<span>🚀 ${b}</span>`).join('<br>')}
        </div>
        <div class="nft-buy-footer">
          <span class="nft-price">${nft.price.toFixed(2)} POL</span>
          ${isOwned 
            ? `<button class="btn-nft-action" style="cursor:not-allowed; opacity:0.6;" disabled>Owned</button>` 
            : `<button class="btn-nft-action" onclick="purchaseNft('${nft.id}')">Buy NFT</button>`}
        </div>
      </div>
    `;

    if (nft.group === 'faucet' && faucetContainer) {
      faucetContainer.appendChild(card);
    } else if (nft.group === 'game' && gameContainer) {
      gameContainer.appendChild(card);
    } else if (nft.group === 'referral' && referralContainer) {
      referralContainer.appendChild(card);
    }
  });
}

function renderNftInventory() {
  const grid = document.getElementById('nft-inventory-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  const ownedIds = appState.state.ownedNfts;

  if (ownedIds.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 0; color: var(--text-dim);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎒</div>
        Your NFT backpack is empty. Buy utility cores in the marketplace to unlock massive boosts.
      </div>
    `;
    return;
  }

  ownedIds.forEach(nftId => {
    const nft = NFT_REGISTRY.find(n => n.id === nftId);
    if (!nft) return;

    const isEquipped = appState.state.equippedNft === nftId;
    let bonuses = [];
    if (nft.faucetBoost > 0) bonuses.push(`Faucet claim +${nft.faucetBoost}%`);
    if (nft.gameMultiplier > 0) bonuses.push(`Arcade score +${nft.gameMultiplier}%`);
    if (nft.stakingBoost > 0) bonuses.push(`Staking APY +${nft.stakingBoost}%`);

    const card = document.createElement('div');
    card.className = `nft-card rarity-${nft.rarity} ${isEquipped ? 'active-equipped' : ''}`;
    card.innerHTML = `
      <div class="nft-art-container">
        <div class="nft-art-bg" style="background-color: var(--border-color-rarity);"></div>
        <div class="nft-art-svg">${nft.svg}</div>
        <span class="nft-rarity-badge rarity-${nft.rarity}">${nft.rarity}</span>
      </div>
      <div class="nft-details">
        <h4 class="nft-name">${nft.name}</h4>
        <div class="nft-bonus">
          ${bonuses.map(b => `<span>🚀 ${b}</span>`).join('<br>')}
        </div>
        <div class="nft-buy-footer" style="border:none; padding-top:0.5rem; margin-top:0.5rem;">
          <span style="font-size: 0.8rem; font-weight: 700; color: ${isEquipped ? 'var(--color-accent)' : 'var(--text-dim)'}">
            ${isEquipped ? '● Equipped Active' : '○ Locked in Bag'}
          </span>
          <button class="btn-nft-action" onclick="toggleEquipNft('${nft.id}')">
            ${isEquipped ? 'Unequip' : 'Equip Core'}
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function purchaseNft(nftId) {
  const nft = NFT_REGISTRY.find(n => n.id === nftId);
  if (!nft) return;

  // 1. Check if connected to real MetaMask provider
  if (!appState.state.walletConnected || appState.state.walletProvider !== 'metamask') {
    triggerToast("Please connect MetaMask on Polygon to buy real NFTs!", "error");
    return;
  }

  if (!NFT_CONTRACT_ADDRESS || NFT_CONTRACT_ADDRESS.length !== 42) {
    triggerToast("Please deploy the NFT contract and paste the address in app.js!", "error");
    return;
  }

  try {
    // 2. Validate MATIC balance
    if (appState.state.balanceMatic < nft.price) {
      triggerToast(`Insufficient MATIC balance (Requires ${nft.price} MATIC)`, "error");
      return;
    }

    const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, [
      "function buyUtilityNFT(string memory nftTypeId, string memory tokenURI_) external payable returns (uint256)"
    ], realSigner);

    triggerToast(`Buying ${nft.name}... Confirm in MetaMask`, "success");

    const tokenURI = `https://polygame.xyz/metadata/${nftId}.json`;
    const priceWei = ethers.parseEther(nft.price.toString());

    const tx = await nftContract.buyUtilityNFT(nftId, tokenURI, {
      value: priceWei
    });

    triggerToast("Purchase pending on-chain. Please wait...", "success");
    await tx.wait();

    // Optimistically update local state
    const owned = [...appState.state.ownedNfts];
    if (!owned.includes(nftId)) {
      owned.push(nftId);
    }

    appState.update({
      ownedNfts: owned,
      balanceMatic: Math.max(0, appState.state.balanceMatic - nft.price)
    });

    sfx.playPowerUp();
    triggerToast(`Success! Purchased ${nft.name} NFT!`, 'success');
    appState.addActivity('You', `purchased ${nft.name} NFT on-chain`, `-${nft.price} MATIC`);
    
    renderNftMarketplace();
    renderNftInventory();

    // Refetch full list from chain in background to verify
    getOwnedNftsFromChain(appState.state.walletAddress).then(list => {
      appState.update({ ownedNfts: list });
    });

  } catch (err) {
    console.error("NFT purchase failed:", err);
    triggerToast("Purchase failed: " + (err.reason || err.message || err), "error");
  }
}

function toggleEquipNft(nftId) {
  const isEquipped = appState.state.equippedNft === nftId;
  const nextEquip = isEquipped ? null : nftId;
  
  appState.update({
    equippedNft: nextEquip
  });

  sfx.playPowerUp();
  triggerToast(nextEquip ? `Equipped core: ${NFT_REGISTRY.find(n=>n.id===nftId).name}` : "Core unequipped", 'success');
  
  renderNftInventory();
  renderNftMarketplace();
}

function switchNftView(viewName) {
  const marketBtn = document.querySelector('.nft-tab[data-nft-view="market"]');
  const inventoryBtn = document.querySelector('.nft-tab[data-nft-view="inventory"]');
  
  if (viewName === 'market') {
    marketBtn.classList.add('active');
    inventoryBtn.classList.remove('active');
    document.getElementById('nft-market-panel').style.display = 'block';
    document.getElementById('nft-inventory-panel').style.display = 'none';
  } else {
    marketBtn.classList.remove('active');
    inventoryBtn.classList.add('active');
    document.getElementById('nft-market-panel').style.display = 'none';
    document.getElementById('nft-inventory-panel').style.display = 'block';
    renderNftInventory();
  }
}

// --- Staking Yield Accumulation Cycle ---
let yieldInterval = null;
let activeStakingPool = 'pgt';
let activeStakingTier = 'day';

function initStakingCycle() {
  if (yieldInterval) clearInterval(yieldInterval);
  
  yieldInterval = setInterval(() => {
    const secondsInYear = 365 * 24 * 3600;
    let shouldUpdate = false;

    // Accrue yield across all active stakes
    const list = appState.state.stakes || [];
    if (list.length > 0) {
      list.forEach(stake => {
        const yieldPerSecond = stake.amount * (stake.apy / 100) / secondsInYear;
        stake.interest = (stake.interest || 0) + yieldPerSecond;
        shouldUpdate = true;
      });
    }

    // Sync total unclaimed interest in UI
    let activeInterest = 0;
    list.forEach(stake => {
      if (stake.pool === activeStakingPool) {
        activeInterest += stake.interest;
      }
    });
    
    const yieldLabel = document.getElementById('staking-live-yield');
    if (yieldLabel) {
      yieldLabel.innerText = activeInterest.toFixed(6);
    }

    // Sync lock status countdown & active positions list
    updateStakingLockCountdownUI();
    if (typeof renderStakingLedger === 'function') {
      renderStakingLedger();
    }

    // To prevent heavy local storage writes, we sync the state values back to storage every 10s
    if (shouldUpdate && Math.floor(Date.now() / 1000) % 10 === 0) {
      const raw = JSON.stringify(appState.state);
      const computed = cyb53(raw + CHECKSUM_SALT);
      localStorage.setItem('polygame_state', raw);
      localStorage.setItem('polygame_state_checksum', computed);
    }
  }, 1000);
}

// Pool switching tab triggers
function switchStakingPool(pool) {
  activeStakingPool = pool;
  
  const btnPgt = document.getElementById('btn-staking-pool-pgt');
  const btn1flr = document.getElementById('btn-staking-pool-1flr');
  const hubTitle = document.getElementById('staking-hub-title');
  const inputAmt = document.getElementById('staking-input-amount');
  
  if (!btnPgt || !btn1flr) return;
  
  if (pool === 'pgt') {
    btnPgt.classList.add('active');
    btn1flr.classList.remove('active');
    if (hubTitle) hubTitle.innerText = "⚡ PGT Staking Vault";
  } else {
    btnPgt.classList.add('active'); // keep tab background classes consistent
    btnPgt.classList.remove('active');
    btn1flr.classList.add('active');
    if (hubTitle) hubTitle.innerText = "🔥 1FLR Staking Vault";
  }
  
  // Re-adjust selector visual states
  document.getElementById('btn-staking-pool-pgt').className = `games-tab ${pool === 'pgt' ? 'active' : ''}`;
  document.getElementById('btn-staking-pool-1flr').className = `games-tab ${pool === '1flr' ? 'active' : ''}`;

  if (inputAmt) inputAmt.value = '';
  
  calculateStakingReward();
  appState.syncUI();
}
window.switchStakingPool = switchStakingPool;

// Tier duration triggers
function selectStakingTier(tier) {
  activeStakingTier = tier;
  
  const btnDay = document.getElementById('btn-stake-tier-day');
  const btnMonth = document.getElementById('btn-stake-tier-month');
  const btnYear = document.getElementById('btn-stake-tier-year');
  
  if (!btnDay || !btnMonth || !btnYear) return;
  
  btnDay.classList.remove('active');
  btnMonth.classList.remove('active');
  btnYear.classList.remove('active');
  
  if (tier === 'day') btnDay.classList.add('active');
  else if (tier === 'month') btnMonth.classList.add('active');
  else if (tier === 'year') btnYear.classList.add('active');
  
  calculateStakingReward();
}
window.selectStakingTier = selectStakingTier;

// Lock status timers updater
function updateStakingLockCountdownUI() {
  const lockBox = document.getElementById('staking-lock-status-box');
  const countdownLabel = document.getElementById('staking-lock-countdown');
  if (!lockBox || !countdownLabel) return;
  
  const pool = activeStakingPool;
  const lockUntil = pool === 'pgt' ? appState.state.stakingLockUntilPgt : appState.state.stakingLockUntil1flr;
  const stakedAmt = pool === 'pgt' ? appState.state.stakedBalancePgt : appState.state.stakedBalance1flr;
  
  if (stakedAmt > 0 && lockUntil) {
    const diff = lockUntil - getSecureNow();
    if (diff > 0) {
      lockBox.style.display = 'block';
      
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      countdownLabel.innerText = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      lockBox.style.display = 'block';
      countdownLabel.innerText = "UNLOCKED (Expired)";
      countdownLabel.style.color = "var(--color-accent)";
    }
  } else {
    lockBox.style.display = 'none';
  }
}

function renderStakingLedger() {
  const body = document.getElementById('staking-ledger-body');
  const countLabel = document.getElementById('staking-active-count');
  if (!body) return;

  const stakes = appState.state.stakes || [];
  if (countLabel) countLabel.innerText = stakes.length;

  if (stakes.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-dim);">No active stakes found. Select pool and deposit above!</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = '';
  const now = getSecureNow();

  stakes.forEach(stake => {
    const isPgt = stake.pool === 'pgt';
    const symbol = isPgt ? 'PGT' : '1FLR';
    const icon = isPgt ? '⚡' : '🔥';
    
    // Calculate time remaining
    const diff = stake.lockUntil - now;
    let timeStr = '';
    
    if (diff <= 0) {
      timeStr = '<span class="status-badge success" style="color:var(--color-primary); font-weight:700;">Unlocked</span>';
    } else {
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      timeStr = `🔒 ${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--border-glass)';
    row.innerHTML = `
      <td style="padding: 0.75rem 0.5rem; font-weight: 700;">${icon} ${symbol}</td>
      <td style="padding: 0.75rem 0.5rem;">${stake.amount.toFixed(2)} ${symbol}</td>
      <td style="padding: 0.75rem 0.5rem; color: var(--color-accent); font-weight: 700;">${stake.apy.toFixed(2)}%</td>
      <td style="padding: 0.75rem 0.5rem;">${timeStr}</td>
      <td style="padding: 0.75rem 0.5rem; color: var(--color-primary); font-weight: 700;">${stake.interest.toFixed(6)} ${symbol}</td>
      <td style="padding: 0.75rem 0.5rem; text-align: right;">
        <button class="btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right: 0.25rem; background: var(--color-primary); color: black; border: none; cursor: pointer;" onclick="harvestIndividualStake('${stake.id}')" ${stake.interest < 0.0001 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>Harvest</button>
        <button class="btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid var(--border-glass); cursor: pointer;" onclick="unstakeIndividualPosition('${stake.id}')">Unstake</button>
      </td>
    `;
    body.appendChild(row);
  });
}
window.renderStakingLedger = renderStakingLedger;

function harvestIndividualStake(id) {
  const stakes = appState.state.stakes || [];
  const stake = stakes.find(s => s.id === id);
  if (!stake) return;

  const interest = stake.interest || 0;
  if (interest <= 0.0001) {
    triggerToast("No substantial yield accumulated yet", "error");
    return;
  }

  const updates = { stakes: [...stakes] };
  const targetStake = updates.stakes.find(s => s.id === id);
  targetStake.interest = 0.0;

  if (stake.pool === 'pgt') {
    updates.balancePgt = appState.state.balancePgt + interest;
  } else {
    updates.balance1flr = appState.state.balance1flr + interest;
  }

  appState.update(updates);
  sfx.playSuccess();
  triggerToast(`Harvested +${interest.toFixed(4)} ${stake.pool.toUpperCase()} rewards!`, 'success');
  appState.addActivity('You', `harvested stake position yield`, `+${interest.toFixed(2)} ${stake.pool.toUpperCase()}`);
}
window.harvestIndividualStake = harvestIndividualStake;

function unstakeIndividualPosition(id) {
  const stakes = appState.state.stakes || [];
  const stake = stakes.find(s => s.id === id);
  if (!stake) return;

  const now = getSecureNow();
  if (stake.lockUntil && now < stake.lockUntil) {
    const diff = stake.lockUntil - now;
    const mins = Math.ceil(diff / 60000);
    triggerToast(`Stake is locked! Try again in ${mins} minute(s) or use Fast Forward.`, "error");
    sfx.playError();
    return;
  }

  const interest = stake.interest || 0;
  const totalPayback = stake.amount + interest;

  const updates = {
    stakes: stakes.filter(s => s.id !== id)
  };

  if (stake.pool === 'pgt') {
    updates.balancePgt = appState.state.balancePgt + totalPayback;
  } else {
    updates.balance1flr = appState.state.balance1flr + totalPayback;
  }

  appState.update(updates);
  sfx.playError();
  triggerToast(`Unstaked position & yields! (+${totalPayback.toFixed(2)} ${stake.pool.toUpperCase()})`, 'success');
  appState.addActivity('You', `withdrew staked ${stake.pool.toUpperCase()} position`, `+${totalPayback.toFixed(2)} ${stake.pool.toUpperCase()}`);
}
window.unstakeIndividualPosition = unstakeIndividualPosition;

// Fast forward simulator
function fastForwardStakingLock() {
  const pool = activeStakingPool;
  const now = getSecureNow();
  
  const stakes = appState.state.stakes || [];
  const updates = {
    stakes: stakes.map(s => {
      if (s.pool === pool) {
        return { ...s, lockUntil: now + 60000 };
      }
      return s;
    })
  };
  
  appState.update(updates);
  sfx.playSuccess();
  triggerToast(`All active ${pool.toUpperCase()} positions fast-forwarded! Expiry in 60s.`, "success");
}
window.fastForwardStakingLock = fastForwardStakingLock;

// Staking Deposit Actions
document.getElementById('btn-staking-deposit').addEventListener('click', async () => {
  const inputAmt = document.getElementById('staking-input-amount');
  if (!inputAmt) return;
  
  const amt = parseFloat(inputAmt.value) || 0;
  if (amt <= 0) {
    triggerToast("Enter a valid amount to stake", "error");
    return;
  }

  const stakes = appState.state.stakes || [];
  if (stakes.length >= 25) {
    triggerToast("Maximum limit of 25 active stakes reached!", "error");
    return;
  }

  const pool = activeStakingPool;
  const isPgt = pool === 'pgt';

  // Calculate Lock Expiry Duration
  const now = getSecureNow();
  let durationMs = 86400 * 1000; // 1 Day default
  if (activeStakingTier === 'month') durationMs = 30 * 86400 * 1000;
  else if (activeStakingTier === 'year') durationMs = 365 * 86400 * 1000;

  const lockUntil = now + durationMs;

  const multis = appState.getMultipliers();
  const baseApy = activeStakingTier === 'day' ? 1.0 : (activeStakingTier === 'month' ? 2.0 : 3.0);
  const finalApy = baseApy + multis.nftStakingBoost;

  // --- Real Web3 Staking (MetaMask) ---
  if (appState.state.walletConnected && appState.state.walletProvider === 'metamask') {
    const onchainBal = isPgt ? (appState.state.onchainBalancePgt || 0) : (appState.state.onchainBalance1flr || 0);
    if (onchainBal < amt) {
      triggerToast(`Insufficient onchain ${pool.toUpperCase()} token balance in your MetaMask wallet!`, "error");
      return;
    }

    try {
      const contractAddress = isPgt ? TOKEN_CONTRACT_ADDRESS : TOKEN_1FLR_CONTRACT_ADDRESS;
      if (!contractAddress || !contractAddress.startsWith("0x") || contractAddress.length !== 42) {
        triggerToast(`Token contract address not configured correctly for ${pool.toUpperCase()}`, "error");
        return;
      }

      triggerToast("Opening MetaMask to sign staking deposit...", "info");
      
      const signer = await web3Provider.getSigner();
      const tokenContract = new ethers.Contract(contractAddress, [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function decimals() view returns (uint8)"
      ], signer);

      const decimals = await tokenContract.decimals();
      const parsedAmt = ethers.parseUnits(amt.toString(), decimals);

      // Execute real transfer on-chain to the pool authority address
      const tx = await tokenContract.transfer(VAULT_RECEIVER_ADDRESS, parsedAmt);
      triggerToast("Transaction submitted! Confirming on-chain...", "success");
      
      await tx.wait();
      triggerToast("Staking deposit successful on-chain!", "success");
      
      // Update on-chain balance immediately
      const newOnchain = onchainBal - amt;
      const updates = {
        stakes: [...stakes, {
          id: "stake_" + Math.floor(100000 + Math.random() * 900000),
          pool: pool,
          amount: amt,
          tier: activeStakingTier,
          apy: finalApy,
          stakedAt: now,
          lockUntil: lockUntil,
          interest: 0.0
        }]
      };
      
      if (isPgt) {
        updates.onchainBalancePgt = newOnchain;
      } else {
        updates.onchainBalance1flr = newOnchain;
      }
      
      appState.update(updates);
      inputAmt.value = '';
      sfx.playPowerUp();
      appState.addActivity('You', `staked onchain ${pool.toUpperCase()} tokens`, `-${amt.toFixed(2)} ${pool.toUpperCase()}`);

    } catch (err) {
      console.error("On-chain staking failed:", err);
      triggerToast("Staking transaction failed: " + (err.reason || err.message || err), "error");
      sfx.playError();
    }
  } else {
    // --- Mock Staking (Local Sandbox) ---
    const balance = isPgt ? appState.state.balancePgt : appState.state.balance1flr;
    if (balance < amt) {
      triggerToast(`Insufficient ${pool.toUpperCase()} token balance`, "error");
      return;
    }

    const newStake = {
      id: "stake_" + Math.floor(100000 + Math.random() * 900000),
      pool: pool,
      amount: amt,
      tier: activeStakingTier,
      apy: finalApy,
      stakedAt: now,
      lockUntil: lockUntil,
      interest: 0.0
    };

    const updates = {
      stakes: [...stakes, newStake]
    };

    if (isPgt) {
      updates.balancePgt = balance - amt;
    } else {
      updates.balance1flr = balance - amt;
    }

    appState.update(updates);
    inputAmt.value = '';
    sfx.playPowerUp();
    triggerToast(`Locked & Staked +${amt.toFixed(2)} ${pool.toUpperCase()}!`, 'success');
    appState.addActivity('You', `staked ${pool.toUpperCase()} tokens`, `-${amt.toFixed(2)} ${pool.toUpperCase()}`);
  }
});

document.getElementById('btn-staking-harvest').addEventListener('click', () => {
  const pool = activeStakingPool;
  const isPgt = pool === 'pgt';
  
  const stakes = appState.state.stakes || [];
  let totalInterest = 0;
  
  stakes.forEach(stake => {
    if (stake.pool === pool) {
      totalInterest += stake.interest || 0;
    }
  });

  if (totalInterest <= 0.0001) {
    triggerToast("No substantial yield accumulated yet across your positions", "error");
    return;
  }

  const updates = {
    stakes: stakes.map(stake => {
      if (stake.pool === pool) {
        return { ...stake, interest: 0.0 };
      }
      return stake;
    })
  };

  if (isPgt) {
    updates.balancePgt = appState.state.balancePgt + totalInterest;
  } else {
    updates.balance1flr = appState.state.balance1flr + totalInterest;
  }

  appState.update(updates);
  sfx.playSuccess();
  triggerToast(`Harvested +${totalInterest.toFixed(4)} ${pool.toUpperCase()} rewards from all positions!`, 'success');
  appState.addActivity('You', `harvested all ${pool.toUpperCase()} staking yield`, `+${totalInterest.toFixed(2)} ${pool.toUpperCase()}`);
});

document.getElementById('btn-staking-unstake').addEventListener('click', () => {
  const pool = activeStakingPool;
  const isPgt = pool === 'pgt';
  const stakes = appState.state.stakes || [];
  
  const poolStakes = stakes.filter(s => s.pool === pool);
  if (poolStakes.length === 0) {
    triggerToast("Nothing is currently staked in this pool", "error");
    return;
  }

  const now = getSecureNow();
  const maturedStakes = poolStakes.filter(s => !s.lockUntil || now >= s.lockUntil);
  const lockedStakes = poolStakes.filter(s => s.lockUntil && now < s.lockUntil);

  if (maturedStakes.length === 0) {
    triggerToast("All your positions in this pool are currently locked! Use Fast Forward to test.", "error");
    sfx.playError();
    return;
  }

  let totalPayback = 0;
  maturedStakes.forEach(s => {
    totalPayback += s.amount + (s.interest || 0);
  });

  const updates = {
    stakes: stakes.filter(s => s.pool !== pool || (s.lockUntil && now < s.lockUntil))
  };

  if (isPgt) {
    updates.balancePgt = appState.state.balancePgt + totalPayback;
  } else {
    updates.balance1flr = appState.state.balance1flr + totalPayback;
  }

  appState.update(updates);
  sfx.playError();
  triggerToast(`Unstaked ${maturedStakes.length} matured positions! (+${totalPayback.toFixed(2)} ${pool.toUpperCase()})`, 'success');
  appState.addActivity('You', `unstaked matured ${pool.toUpperCase()} positions`, `+${totalPayback.toFixed(2)} ${pool.toUpperCase()}`);
});

// Staking Max clickers
document.getElementById('staking-wallet-max').addEventListener('click', () => {
  const pool = activeStakingPool;
  let maxVal = 0;
  if (appState.state.walletConnected) {
    maxVal = pool === 'pgt' ? (appState.state.onchainBalancePgt || 0) : (appState.state.onchainBalance1flr || 0);
  } else {
    maxVal = pool === 'pgt' ? appState.state.balancePgt : appState.state.balance1flr;
  }
  document.getElementById('staking-input-amount').value = Math.floor(maxVal);
  calculateStakingReward();
});
document.getElementById('staking-fill-half').addEventListener('click', () => {
  const pool = activeStakingPool;
  let maxVal = 0;
  if (appState.state.walletConnected) {
    maxVal = pool === 'pgt' ? (appState.state.onchainBalancePgt || 0) : (appState.state.onchainBalance1flr || 0);
  } else {
    maxVal = pool === 'pgt' ? appState.state.balancePgt : appState.state.balance1flr;
  }
  document.getElementById('staking-input-amount').value = Math.floor(maxVal * 0.5);
  calculateStakingReward();
});

// Staking Reward calculator
const stakeInput = document.getElementById('staking-input-amount');

function calculateStakingReward() {
  const inputAmt = document.getElementById('staking-input-amount');
  const estReward = document.getElementById('calc-est-reward');
  const estTotal = document.getElementById('calc-est-total');
  if (!inputAmt || !estReward || !estTotal) return;

  const amt = parseFloat(inputAmt.value) || 0;
  
  const multis = appState.getMultipliers();
  const baseApy = activeStakingTier === 'day' ? 1.0 : (activeStakingTier === 'month' ? 2.0 : 3.0);
  const currentApy = (baseApy + multis.nftStakingBoost) / 100;
  
  let fraction = 1 / 365;
  if (activeStakingTier === 'month') fraction = 30 / 365;
  else if (activeStakingTier === 'year') fraction = 1.0;
  
  const interest = amt * currentApy * fraction;
  const tokenSymbol = activeStakingPool === 'pgt' ? 'PGT' : '1FLR';
  
  estReward.innerText = `${interest.toFixed(4)} ${tokenSymbol}`;
  estTotal.innerText = `${(amt + interest).toFixed(4)} ${tokenSymbol}`;
}

if (stakeInput) {
  stakeInput.addEventListener('input', calculateStakingReward);
}

// --- Affiliate Referral Simulations (Multi-Level 4-Tiers) ---
document.getElementById('btn-simulate-referral-claim').addEventListener('click', () => {
  const names = ['CryptoKnight', 'ZecHunter', 'ChainSlinger', 'BitGlider', 'TokenWrangler', 'HashRider', 'PolMaster'];
  const user = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 999);
  
  // Roll a level 1 to 4
  const level = Math.floor(1 + Math.random() * 4); // 1, 2, 3, or 4
  
  let pct = 10;
  let commission = 5.0; // 10% of 50
  if (level === 2) { pct = 5; commission = 2.5; } // 5% of 50
  else if (level === 3) { pct = 2; commission = 1.0; } // 2% of 50
  else if (level === 4) { pct = 1; commission = 0.5; } // 1% of 50

  const refList = [...(appState.state.referralsList || [])];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const multis = appState.getMultipliers();
  const finalCommission = commission * multis.nftReferralMultiplier;
  
  refList.unshift({ name: user, level: level, commission: finalCommission, time: time });
  if (refList.length > 10) refList.pop();

  const updates = {
    referralsCount: appState.state.referralsCount + 1,
    totalReferralCommission: appState.state.totalReferralCommission + finalCommission,
    pendingPayoutPgt: appState.state.pendingPayoutPgt + finalCommission,
    referralsList: refList
  };

  if (level === 1) updates.referralsL1 = (appState.state.referralsL1 || 0) + 1;
  else if (level === 2) updates.referralsL2 = (appState.state.referralsL2 || 0) + 1;
  else if (level === 3) updates.referralsL3 = (appState.state.referralsL3 || 0) + 1;
  else if (level === 4) updates.referralsL4 = (appState.state.referralsL4 || 0) + 1;

  appState.update(updates);

  // Log activity with downline tier details
  appState.addActivity(user, `claimed faucet (Tier L${level} downline)`, `+${finalCommission.toFixed(2)} PGT (Pending)`);
  
  setTimeout(() => {
    appState.addActivity('System', `credited ${pct}% L${level} affiliate bonus from ${user}`, `+${finalCommission.toFixed(2)} PGT (Pending)`);
    triggerToast(`Downline L${level} referral ${user} claimed! Commission: +${finalCommission.toFixed(2)} PGT (Pending)`, 'success');
  }, 350);
});

// Copy ref link
document.getElementById('btn-copy-ref-link').addEventListener('click', () => {
  const link = document.getElementById('ref-invite-link');
  link.select();
  link.setSelectionRange(0, 99999); // mobile compatibility
  navigator.clipboard.writeText(link.value).then(() => {
    sfx.playCoin();
    triggerToast("Referral link copied to clipboard!", 'success');
  });
});

// --- Initialization / Routing binds ---
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    const tab = link.getAttribute('data-tab');
    switchTab(tab);
  });
});

// Sound toggler
document.getElementById('sound-toggle-btn').addEventListener('click', () => {
  sfx.toggle();
});

// Header Wallet buttons
document.getElementById('btn-wallet-connect').addEventListener('click', () => {
  openModal('wallet');
});
document.getElementById('wallet-address-display').addEventListener('click', () => {
  openModal('wallet');
});

// Window startup
function initializeApp() {
  appState.syncUI();
  checkFaucetCooldown();
  initStakingCycle();
  calculateStakingReward();
  
  // Set up initial leaderboard data
  if (currentLeaderboardType === 'arcade') {
    setupLeaderboardUI();
  } else if (currentLeaderboardType === 'pgt') {
    renderPgtLeaderboard();
  } else if (currentLeaderboardType === 'ref') {
    renderReferralLeaderboard();
  }

  // Auto connect real wallet on load if already logged in
  autoConnectWeb3();

  // Bind PGT Withdraw executor click
  const executeWithdrawBtn = document.getElementById('btn-execute-withdraw');
  if (executeWithdrawBtn) {
    executeWithdrawBtn.addEventListener('click', executeWithdrawPGT);
  }

  // Bind PGT Leaderboard Sync click
  const syncLeaderboardBtn = document.getElementById('btn-sync-leaderboard');
  if (syncLeaderboardBtn) {
    syncLeaderboardBtn.addEventListener('click', syncLeaderboardRank);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// --- Leaderboard Populating ---
function setupLeaderboardUI() {
  const scoreboard = document.getElementById('leaderboard-scores-container');
  if (!scoreboard) return;

  const mockLeaderboard = [
    { rank: 1, name: 'CyberSamurai', score: 9840, prize: '1000 PGT' },
    { rank: 2, name: 'VoidWalker', score: 8120, prize: '750 PGT' },
    { rank: 3, name: 'HyperDoge', score: 7650, prize: '500 PGT' },
    { rank: 4, name: 'BlockBreaker', score: 6200, prize: '300 PGT' },
    { rank: 5, name: 'Satoshi_07', score: 5540, prize: '150 PGT' }
  ];

  // Insert user row
  const userHighScore = appState.state.gameHighScore;
  const username = getActiveUsername();
  const listToRender = [...mockLeaderboard];
  
  // Insert or adjust user rank depending on high score
  let userInserted = false;
  for (let i = 0; i < listToRender.length; i++) {
    if (userHighScore > listToRender[i].score) {
      listToRender.splice(i, 0, { rank: i + 1, name: `${username} (You)`, score: userHighScore, prize: 'Bonus Multiplier', isUser: true });
      userInserted = true;
      break;
    }
  }

  if (!userInserted) {
    listToRender.push({ rank: listToRender.length + 1, name: `${username} (You)`, score: userHighScore, prize: 'N/A', isUser: true });
  }

  // Re-adjust rank numbers
  listToRender.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  scoreboard.innerHTML = '';
  listToRender.slice(0, 6).forEach(row => {
    const item = document.createElement('div');
    item.className = `leaderboard-row ${row.isUser ? 'user-row' : ''}`;
    item.innerHTML = `
      <span class="leaderboard-rank rank-${row.rank}">${row.rank}</span>
      <span class="leaderboard-name">${row.name}</span>
      <span class="leaderboard-score">${row.score.toLocaleString()}</span>
      <span class="leaderboard-prize">${row.prize}</span>
    `;
    scoreboard.appendChild(item);
  });
}

// --- USER PROFILE & PGT LEADERBOARD LOGIC ---

// Fetch Username mapped to connected address
function getActiveUsername() {
  if (!appState.state.walletConnected || !appState.state.walletAddress) {
    return "Anonymous Player";
  }
  const addr = appState.state.walletAddress.toLowerCase();
  const saved = localStorage.getItem(`polygame_username_${addr}`);
  return saved || `Player_${addr.substring(2, 8)}`;
}

// Sync values inside Profile view
function syncProfileView() {
  const profileNameInput = document.getElementById('profile-name-input');
  if (profileNameInput && document.activeElement !== profileNameInput) {
    profileNameInput.value = getActiveUsername();
  }

  const statusLabel = document.getElementById('profile-wallet-status');
  const addressLabel = document.getElementById('profile-wallet-address');
  const networkLabel = document.getElementById('profile-wallet-network');

  if (statusLabel && addressLabel && networkLabel) {
    if (appState.state.walletConnected) {
      statusLabel.innerText = "Connected";
      statusLabel.style.color = "var(--color-accent)";
      addressLabel.innerText = appState.state.walletAddress;
      
      const providerStr = appState.state.walletProvider.toUpperCase();
      networkLabel.innerText = `${providerStr} (Polygon Ledger)`;
    } else {
      statusLabel.innerText = "Disconnected";
      statusLabel.style.color = "var(--color-danger)";
      addressLabel.innerText = "None";
      networkLabel.innerText = "None";
    }
  }

  // Summary achievements
  const achieveScore = document.getElementById('profile-achieve-score');
  const achieveNft = document.getElementById('profile-achieve-nft');
  const achieveStaked = document.getElementById('profile-achieve-staked');

  if (achieveScore) achieveScore.innerText = appState.state.gameHighScore;
  
  if (achieveNft) {
    let nftName = "None";
    if (appState.state.equippedNft) {
      const nft = NFT_REGISTRY.find(n => n.id === appState.state.equippedNft);
      if (nft) nftName = nft.name;
    }
    achieveNft.innerText = nftName;
  }

  if (achieveStaked) {
    let totalStaked = 0;
    (appState.state.stakes || []).forEach(s => {
      totalStaked += s.amount;
    });
    achieveStaked.innerText = `${totalStaked.toFixed(2)} Tokens`;
  }
}

// Profile Save button listener
const btnSaveProfile = document.getElementById('btn-save-profile');
if (btnSaveProfile) {
  btnSaveProfile.addEventListener('click', () => {
    const input = document.getElementById('profile-name-input');
    if (!input) return;
    
    const nameStr = input.value.trim();
    if (!nameStr) {
      triggerToast("Username cannot be empty!", "error");
      return;
    }

    const address = appState.state.walletAddress || "anonymous";
    localStorage.setItem(`polygame_username_${address.toLowerCase()}`, nameStr);
    
    triggerToast("Username saved!", "success");
    sfx.playSuccess();

    appState.syncUI();
    
    // Refresh active leaderboard display
    if (currentLeaderboardType === 'pgt') {
      renderPgtLeaderboard();
    } else {
      setupLeaderboardUI();
    }
  });
}

// Leaderboard Selector Toggle
let currentLeaderboardType = 'arcade';

function switchLeaderboardView(type) {
  currentLeaderboardType = type;
  
  const btnArcade = document.getElementById('btn-leaderboard-arcade');
  const btnPgt = document.getElementById('btn-leaderboard-pgt');
  const btnRef = document.getElementById('btn-leaderboard-ref');
  
  const arcadeDetails = document.getElementById('leaderboard-arcade-details');
  const pgtDetails = document.getElementById('leaderboard-pgt-details');
  const refDetails = document.getElementById('leaderboard-ref-details');
  
  if (!btnArcade || !btnPgt || !btnRef || !arcadeDetails || !pgtDetails || !refDetails) return;

  btnArcade.classList.remove('active');
  btnPgt.classList.remove('active');
  btnRef.classList.remove('active');

  arcadeDetails.style.display = 'none';
  pgtDetails.style.display = 'none';
  refDetails.style.display = 'none';

  if (type === 'arcade') {
    btnArcade.classList.add('active');
    arcadeDetails.style.display = 'block';
    setupLeaderboardUI();
  } else if (type === 'pgt') {
    btnPgt.classList.add('active');
    pgtDetails.style.display = 'block';
    renderPgtLeaderboard();
  } else if (type === 'ref') {
    btnRef.classList.add('active');
    refDetails.style.display = 'block';
    renderReferralLeaderboard();
  }
}
window.switchLeaderboardView = switchLeaderboardView;

function renderReferralLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-scores-container');
  if (!scoreboard) return;

  const mockReferrers = [
    { name: 'AffiliateKing', count: 142, earned: 710.0 },
    { name: 'PolygonNode', count: 98, earned: 490.0 },
    { name: 'ZecGamer_8', count: 76, earned: 380.0 },
    { name: 'CryptoDegen', count: 54, earned: 270.0 },
    { name: 'Web3Beacon', count: 32, earned: 160.0 }
  ];

  const userCount = appState.state.referralsCount;
  const userEarned = appState.state.totalReferralCommission;
  const username = getActiveUsername();

  const listToRender = [...mockReferrers];

  // Insert user row
  let userInserted = false;
  for (let i = 0; i < listToRender.length; i++) {
    if (userCount > listToRender[i].count) {
      listToRender.splice(i, 0, { rank: i + 1, name: `${username} (You)`, count: userCount, earned: userEarned, isUser: true });
      userInserted = true;
      break;
    }
  }

  if (!userInserted) {
    listToRender.push({ rank: listToRender.length + 1, name: `${username} (You)`, count: userCount, earned: userEarned, isUser: true });
  }

  // Re-rank
  listToRender.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  scoreboard.innerHTML = '';
  listToRender.slice(0, 6).forEach(row => {
    const item = document.createElement('div');
    item.className = `leaderboard-row ${row.isUser ? 'user-row' : ''}`;
    item.innerHTML = `
      <span class="leaderboard-rank rank-${row.rank}">${row.rank}</span>
      <span class="leaderboard-name">${row.name}</span>
      <span class="leaderboard-score" style="color: var(--color-primary); font-weight:700;">${row.count} Ref(s)</span>
      <span class="leaderboard-prize" style="font-size:0.75rem; color:var(--color-accent); font-weight:700;">+${row.earned.toFixed(0)} PGT</span>
    `;
    scoreboard.appendChild(item);
  });
}
window.renderReferralLeaderboard = renderReferralLeaderboard;

// Render PGT Token holders leaderboard list with global sync & cryptographic validations
async function renderPgtLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-scores-container');
  if (!scoreboard) return;

  // Render placeholder loading indicator
  scoreboard.innerHTML = '<div style="text-align:center; padding: 1.5rem; color:var(--text-dim); font-size:0.9rem;">⚡ Verifying Global cryptographic signatures...</div>';

  const mockWhales = [
    { name: '0xTreasureVault (System)', balance: 2500000.0, prize: 'Ecosystem', address: '0x0000000000000000000000000000000000000000' },
    { name: '0xPolyGameLP (Uniswap)', balance: 1200000.0, prize: 'Liquidity', address: '0x0000000000000000000000000000000000000001' },
    { name: 'BlockWhale_88', balance: 850000.0, prize: 'Investor', address: '0x0000000000000000000000000000000000000002' },
    { name: 'SatoshiGamer', balance: 500000.0, prize: 'Player', address: '0x0000000000000000000000000000000000000003' },
    { name: 'YieldKing_42', balance: 250000.0, prize: 'Staker', address: '0x0000000000000000000000000000000000000004' }
  ];

  let verifiedList = [];
  try {
    const res = await fetch("https://kvdb.io/polygame_bucket_secret_99824/leaderboard");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const entry of data) {
          try {
            // Re-create the verification message
            const message = `PolyGame Leaderboard Sync:\nAddress: ${entry.address.toLowerCase()}\nUsername: ${entry.username}\nBalance: ${entry.balance}\nTimestamp: ${entry.timestamp}`;
            
            // Recover signer
            const recoveredSigner = ethers.verifyMessage(message, entry.signature);
            if (recoveredSigner.toLowerCase() === entry.address.toLowerCase()) {
              verifiedList.push({
                name: entry.username,
                balance: parseFloat(entry.balance) || 0,
                address: entry.address,
                prize: 'Ecosystem Player',
                isUser: appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === entry.address.toLowerCase()
              });
            }
          } catch (err) {
            console.warn("Invalid signature verification discarded for:", entry.address);
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to load public leaderboard rankings:", e);
  }

  // Combine mock players with verified players, ensuring no double counting
  let combined = [...verifiedList];
  
  // Add mock whales if they are not already overridden by matching address keys
  mockWhales.forEach(whale => {
    if (!combined.some(p => p.address.toLowerCase() === whale.address.toLowerCase())) {
      combined.push(whale);
    }
  });

  // Sort by balance descending
  combined.sort((a, b) => b.balance - a.balance);

  // If the user's active wallet balance is not in the list, insert it dynamically
  const userAddress = appState.state.walletAddress;
  if (appState.state.walletConnected && userAddress) {
    const exists = combined.some(p => p.address.toLowerCase() === userAddress.toLowerCase());
    if (!exists) {
      combined.push({
        name: `${getActiveUsername()} (Unsynced)`,
        balance: appState.state.balancePgt,
        address: userAddress,
        prize: 'Local Session',
        isUser: true
      });
      // Re-sort
      combined.sort((a, b) => b.balance - a.balance);
    }
  }

  // Render
  scoreboard.innerHTML = '';
  combined.slice(0, 8).forEach((row, idx) => {
    const rank = idx + 1;
    const item = document.createElement('div');
    item.className = `leaderboard-row ${row.isUser ? 'user-row' : ''}`;
    
    // Display visual indicators if the rank is verified or local
    let verificationBadge = "";
    if (row.address.startsWith("0x00000000000000000000")) {
      verificationBadge = `<span style="font-size:0.65rem; color:var(--text-dim); margin-left: 0.25rem;">[Whale]</span>`;
    } else if (row.prize === 'Local Session') {
      verificationBadge = `<span style="font-size:0.65rem; color:var(--color-warning); margin-left: 0.25rem;">[Local]</span>`;
    } else {
      verificationBadge = `<span style="font-size:0.65rem; color:var(--color-accent); margin-left: 0.25rem; font-weight:700;" title="Cryptographically verified on Polygon link">✓ Verified</span>`;
    }

    item.innerHTML = `
      <span class="leaderboard-rank rank-${rank}">${rank}</span>
      <span class="leaderboard-name">${row.name} ${verificationBadge}</span>
      <span class="leaderboard-score" style="color: var(--color-accent); font-weight:700;">${row.balance.toLocaleString([], {minimumFractionDigits:0, maximumFractionDigits:0})} PGT</span>
      <span class="leaderboard-prize" style="font-size:0.75rem; color:var(--text-dim);">${row.prize}</span>
    `;
    scoreboard.appendChild(item);
  });
}

// Expose switch function globally for inline click event
window.switchLeaderboardView = switchLeaderboardView;

async function autoConnectWeb3() {
  if (typeof window.ethereum !== 'undefined' && appState.state.walletConnected) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        await connectWeb3();
      }
    } catch (e) {
      console.error("Auto connection check failed:", e);
    }
  }
}

// --- Roshambo Betting Logic ---

function switchGameModeView(mode) {
  const tabArcade = document.getElementById('tab-game-arcade');
  const tabInvaders = document.getElementById('tab-game-invaders');
  const tabRoshambo = document.getElementById('tab-game-roshambo');
  const tabSpinner = document.getElementById('tab-game-spinner');
  
  const panelArcade = document.getElementById('panel-game-arcade');
  const panelInvaders = document.getElementById('panel-game-invaders');
  const panelRoshambo = document.getElementById('panel-game-roshambo');
  const panelSpinner = document.getElementById('panel-game-spinner');

  if (!tabArcade || !tabInvaders || !tabRoshambo || !tabSpinner || !panelArcade || !panelInvaders || !panelRoshambo || !panelSpinner) return;

  // Remove active classes
  tabArcade.classList.remove('active');
  tabInvaders.classList.remove('active');
  tabRoshambo.classList.remove('active');
  tabSpinner.classList.remove('active');

  // Hide panels
  panelArcade.style.display = 'none';
  panelInvaders.style.display = 'none';
  panelRoshambo.style.display = 'none';
  panelSpinner.style.display = 'none';

  if (mode === 'arcade') {
    tabArcade.classList.add('active');
    panelArcade.style.display = 'flex';
  } else if (mode === 'invaders') {
    tabInvaders.classList.add('active');
    panelInvaders.style.display = 'flex';
  } else if (mode === 'roshambo') {
    tabRoshambo.classList.add('active');
    panelRoshambo.style.display = 'flex';
    updateRoshamboWagerLabels();
  } else if (mode === 'spinner') {
    tabSpinner.classList.add('active');
    panelSpinner.style.display = 'flex';
    updateSpinnerWagerLabels();
  }
}
window.switchGameModeView = switchGameModeView;

function setRoshamboWager(type) {
  const input = document.getElementById('roshambo-bet-input');
  if (!input) return;
  
  const maxBal = appState.state.balancePgt;
  if (type === 'min') {
    input.value = 10;
  } else if (type === 'half') {
    input.value = Math.max(10, Math.floor(maxBal / 2));
  } else if (type === 'double') {
    const val = parseFloat(input.value) || 0;
    input.value = Math.max(10, Math.floor(val * 2));
  } else if (type === 'max') {
    input.value = Math.max(10, Math.floor(maxBal));
  }
}
window.setRoshamboWager = setRoshamboWager;

function updateRoshamboWagerLabels() {
  const label = document.getElementById('roshambo-wallet-balance-label');
  if (label) {
    label.innerText = `${appState.state.balancePgt.toFixed(2)} PGT`;
  }
}

// Lucky Neon Spinner Controls
function setSpinnerWager(type) {
  const input = document.getElementById('spinner-bet-input');
  if (!input) return;
  
  const maxBal = appState.state.balancePgt;
  if (type === 'min') {
    input.value = 10;
  } else if (type === 'half') {
    input.value = Math.max(10, Math.floor(maxBal / 2));
  } else if (type === 'double') {
    const val = parseFloat(input.value) || 0;
    input.value = Math.max(10, Math.floor(val * 2));
  } else if (type === 'max') {
    input.value = Math.max(10, Math.floor(maxBal));
  }
}
window.setSpinnerWager = setSpinnerWager;

function updateSpinnerWagerLabels() {
  const label = document.getElementById('spinner-wallet-balance-label');
  if (label) {
    label.innerText = `${appState.state.balancePgt.toFixed(2)} PGT`;
  }
}

let spinnerIsSpinning = false;
let currentSpinnerRotation = 0;

function spinLuckyWheel() {
  if (spinnerIsSpinning) return;

  const input = document.getElementById('spinner-bet-input');
  const wheel = document.getElementById('wheel-svg');
  const ann = document.getElementById('spinner-announcement');
  if (!input || !wheel || !ann) return;

  const bet = Math.floor(parseFloat(input.value)) || 0;
  const balance = appState.state.balancePgt;

  if (bet < 10) {
    triggerToast("Minimum wager is 10 PGT!", "error");
    return;
  }
  if (bet > balance) {
    triggerToast("Insufficient PGT token balance!", "error");
    return;
  }

  spinnerIsSpinning = true;
  sfx.init();

  // Deduct bet from balance immediately
  appState.update({
    balancePgt: balance - bet
  });
  updateSpinnerWagerLabels();

  ann.innerText = "🌀 Spinning... Best of luck!";
  ann.style.color = "var(--color-primary)";

  // segment targets (Exactly 95% RTP in average)
  const rand = Math.random() * 100;
  let winIdx = 0;
  let multiplier = 0.0;
  
  if (rand < 43) {
    winIdx = 0; // 0x (43% probability)
    multiplier = 0.0;
  } else if (rand < 73) {
    winIdx = 2; // 0.5x (30% probability)
    multiplier = 0.5;
  } else if (rand < 83) {
    winIdx = 1; // 1.5x (10% probability)
    multiplier = 1.5;
  } else if (rand < 93) {
    winIdx = 3; // 2x (10% probability)
    multiplier = 2.0;
  } else if (rand < 98) {
    winIdx = 4; // 5x (5% probability)
    multiplier = 5.0;
  } else {
    winIdx = 5; // 10x (2% probability)
    multiplier = 10.0;
  }

  const spins = 6;
  const targetAngle = 360 - (winIdx * 60 + 30);
  const currentOffset = currentSpinnerRotation % 360;
  currentSpinnerRotation = currentSpinnerRotation + (spins * 360) - currentOffset + targetAngle;

  wheel.style.transform = `rotate(${currentSpinnerRotation}deg)`;

  let tickCount = 0;
  const tickInterval = setInterval(() => {
    if (tickCount < 18) {
      sfx.playRoshamboDrum();
      tickCount++;
    } else {
      clearInterval(tickInterval);
    }
  }, 200);

  setTimeout(() => {
    spinnerIsSpinning = false;
    const payout = Math.floor(bet * multiplier);
    
    appState.update({
      balancePgt: appState.state.balancePgt + payout
    });
    
    updateSpinnerWagerLabels();

    if (multiplier > 1.0) {
      sfx.playSuccess();
      ann.innerText = `🎉 WON! Segments aligned at ${multiplier}x multiplier. Payout +${payout} PGT!`;
      ann.style.color = "var(--color-accent)";
      appState.addActivity('You', `won spinner bet (${multiplier}x)`, `+${payout} PGT`);
    } else if (multiplier === 0.5) {
      sfx.playCoin();
      ann.innerText = `⚠️ Partial return! Returned 0.5x wager (+${payout} PGT).`;
      ann.style.color = "var(--color-warning)";
      appState.addActivity('You', `partially hit spinner bet (0.5x)`, `-${bet - payout} PGT`);
    } else {
      sfx.playError();
      ann.innerText = `❌ Segment missed! Landed on 0x. Better luck next time!`;
      ann.style.color = "var(--color-danger)";
      appState.addActivity('You', `lost spinner bet (0x)`, `-${bet} PGT`);
    }
  }, 4100);
}
window.spinLuckyWheel = spinLuckyWheel;
window.setSpinnerWager = setSpinnerWager;

const btnSpinWheel = document.getElementById('btn-spin-wheel');
if (btnSpinWheel) {
  btnSpinWheel.addEventListener('click', spinLuckyWheel);
}

let roshamboIsPlaying = false;

async function playRoshamboRound(playerChoice) {
  if (roshamboIsPlaying) return;

  const input = document.getElementById('roshambo-bet-input');
  if (!input) return;
  
  const betAmount = Math.floor(parseFloat(input.value)) || 0;
  const userBalance = appState.state.balancePgt;

  if (betAmount < 10) {
    triggerToast("Minimum wager is 10 PGT!", "error");
    return;
  }
  if (betAmount > userBalance) {
    triggerToast("Insufficient PGT token balance!", "error");
    return;
  }

  roshamboIsPlaying = true;
  
  // Deduct wager immediately
  appState.update({
    balancePgt: userBalance - betAmount
  });
  updateRoshamboWagerLabels();

  // Disable buttons visually
  document.getElementById('btn-roshambo-rock').disabled = true;
  document.getElementById('btn-roshambo-paper').disabled = true;
  document.getElementById('btn-roshambo-scissors').disabled = true;

  const handPlayer = document.getElementById('roshambo-hand-player');
  const handCpu = document.getElementById('roshambo-hand-cpu');
  const announcement = document.getElementById('roshambo-announcement');

  if (handPlayer && handCpu && announcement) {
    handPlayer.innerText = '✊';
    handCpu.innerText = '✊';
    handPlayer.classList.add('roshambo-shaking');
    handCpu.classList.add('roshambo-shaking');
    announcement.innerText = "ROCK...";
    announcement.style.color = "var(--text-white)";
    sfx.playRoshamboDrum();

    setTimeout(() => {
      announcement.innerText = "PAPER...";
      sfx.playRoshamboDrum();
    }, 400);

    setTimeout(() => {
      announcement.innerText = "SCISSORS...";
      sfx.playRoshamboDrum();
    }, 800);

    setTimeout(() => {
      handPlayer.classList.remove('roshambo-shaking');
      handCpu.classList.remove('roshambo-shaking');

      const choices = ['rock', 'paper', 'scissors'];
      const cpuChoice = choices[Math.floor(Math.random() * 3)];

      const emojis = {
        rock: '✊',
        paper: '🖐️',
        scissors: '✌️'
      };

      handPlayer.innerText = emojis[playerChoice];
      handCpu.innerText = emojis[cpuChoice];

      let result = 'draw';
      if (playerChoice === cpuChoice) {
        result = 'draw';
      } else if (
        (playerChoice === 'rock' && cpuChoice === 'scissors') ||
        (playerChoice === 'scissors' && cpuChoice === 'paper') ||
        (playerChoice === 'paper' && cpuChoice === 'rock')
      ) {
        result = 'win';
      } else {
        result = 'lose';
      }

      let pgtPayout = 0;
      if (result === 'win') {
        pgtPayout = betAmount * 2;
        announcement.innerText = `YOU WON! +${pgtPayout} PGT 🤖🎉`;
        announcement.style.color = 'var(--color-accent)';
        sfx.playSuccess();
        
        appState.update({
          balancePgt: appState.state.balancePgt + pgtPayout
        });
        triggerToast(`Winner! Gained +${pgtPayout} PGT!`, "success");
        addRoshamboLog(result, playerChoice, cpuChoice, betAmount, pgtPayout);
      } else if (result === 'draw') {
        pgtPayout = betAmount;
        announcement.innerText = `DRAW! Refunded ${pgtPayout} PGT 🤝`;
        announcement.style.color = 'var(--color-warning)';
        sfx.playCoin();

        appState.update({
          balancePgt: appState.state.balancePgt + pgtPayout
        });
        addRoshamboLog(result, playerChoice, cpuChoice, betAmount, pgtPayout);
      } else {
        announcement.innerText = `YOU LOST! Lost -${betAmount} PGT 💀`;
        announcement.style.color = 'var(--color-danger)';
        sfx.playError();

        addRoshamboLog(result, playerChoice, cpuChoice, betAmount, 0);
      }

      roshamboIsPlaying = false;
      document.getElementById('btn-roshambo-rock').disabled = false;
      document.getElementById('btn-roshambo-paper').disabled = false;
      document.getElementById('btn-roshambo-scissors').disabled = false;

      updateRoshamboWagerLabels();
      appState.syncUI();
      
    }, 1200);
  } else {
    roshamboIsPlaying = false;
  }
}
window.playRoshamboRound = playRoshamboRound;

function addRoshamboLog(result, player, cpu, bet, payout) {
  const feed = document.getElementById('roshambo-history-feed');
  if (!feed) return;

  if (feed.innerHTML.includes("No rounds played yet")) {
    feed.innerHTML = '';
  }

  const row = document.createElement('div');
  row.className = `roshambo-log-row ${result}`;
  
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const emojis = { rock: '✊', paper: '🖐️', scissors: '✌️' };
  const outcomeTexts = {
    win: `WON +${payout} PGT`,
    lose: `LOST -${bet} PGT`,
    draw: `DRAW (Refund)`
  };

  row.innerHTML = `
    <span style="font-weight: 700; text-transform: uppercase;">${outcomeTexts[result]}</span>
    <span>You ${emojis[player]} vs ${emojis[cpu]} CPU</span>
    <span style="font-size: 0.75rem; color: var(--text-dim);">${timeStr}</span>
  `;

  feed.insertBefore(row, feed.firstChild);

  if (feed.children.length > 10) {
    feed.lastChild.remove();
  }
}

// Fetch owned NFT IDs directly from the blockchain
async function getOwnedNftsFromChain(address) {
  if (!web3Provider || !NFT_CONTRACT_ADDRESS || NFT_CONTRACT_ADDRESS.length !== 42) {
    return [];
  }
  try {
    const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, [
      "function balanceOf(address owner) view returns (uint256)",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function getNFTType(uint256 tokenId) view returns (string)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
    ], web3Provider);

    const filter = nftContract.filters.Transfer(null, address);
    const events = await nftContract.queryFilter(filter, 0, 'latest');
    const ownedIds = new Set();
    
    for (const event of events) {
      const tokenId = event.args.tokenId;
      try {
        const owner = await nftContract.ownerOf(tokenId);
        if (owner.toLowerCase() === address.toLowerCase()) {
          const nftTypeId = await nftContract.getNFTType(tokenId);
          ownedIds.add(nftTypeId);
        }
      } catch (e) {
        // Token might not exist or owned by burn
      }
    }
    return Array.from(ownedIds);
  } catch (err) {
    console.error("Error reading NFTs from chain:", err);
    return [];
  }
}

// Quick set withdrawal amount input helper
function setWithdrawAmount(type) {
  const input = document.getElementById('withdraw-input-amount');
  if (!input) return;

  const maxBal = appState.state.balancePgt;
  if (type === 'half') {
    input.value = Math.max(10, Math.floor(maxBal / 2));
  } else if (type === 'max') {
    input.value = Math.max(10, Math.floor(maxBal));
  }
}
window.setWithdrawAmount = setWithdrawAmount;

// Authority Signer Key (for local testing/demonstration)
// This authority key is pre-configured and owns the PGT token contract deploy.
const AUTHORITY_PRIVATE_KEY = "0x0123456789012345678901234567890123456789012345678901234567890123";
// Corresponding public authority signer: 0x14791697260E4c9A71f18484C9f997B308e59325

async function generateClaimVoucher(recipient, amount, nonce) {
  const authorityWallet = new ethers.Wallet(AUTHORITY_PRIVATE_KEY);
  
  const network = await web3Provider.getNetwork();
  const chainId = network.chainId;
  
  // Package message parameters (contract address, chainId, recipient, amount, nonce)
  const messageHash = ethers.solidityPackedKeccak256(
    ["address", "uint256", "address", "uint256", "uint256"],
    [TOKEN_CONTRACT_ADDRESS, chainId, recipient, amount, nonce]
  );
  
  // Sign message
  const messageHashBytes = ethers.getBytes(messageHash);
  const signature = await authorityWallet.signMessage(messageHashBytes);
  return signature;
}

async function executeWithdrawPGT() {
  const amountInput = document.getElementById('withdraw-input-amount');
  if (!amountInput) return;

  const amount = Math.floor(parseFloat(amountInput.value)) || 0;
  const offChainBalance = appState.state.balancePgt;

  if (amount < 10) {
    triggerToast("Minimum withdrawal is 10 PGT!", "error");
    return;
  }
  if (amount > offChainBalance) {
    triggerToast("Insufficient off-chain balance!", "error");
    return;
  }

  if (!appState.state.walletConnected || appState.state.walletProvider !== 'metamask') {
    triggerToast("Please connect your MetaMask wallet first!", "error");
    return;
  }

  if (!TOKEN_CONTRACT_ADDRESS || TOKEN_CONTRACT_ADDRESS.length !== 42) {
    triggerToast("Please enter your PGT contract address at the top of app.js", "error");
    return;
  }

  try {
    triggerToast("Generating authorization voucher...", "success");

    const recipient = appState.state.walletAddress;
    const nonce = Math.floor(Math.random() * 100000000); // Random nonce
    const amountWei = ethers.parseEther(amount.toString());

    // Generate local cryptosigned voucher from authority key
    const signature = await generateClaimVoucher(recipient, amountWei, nonce);

    // Call claimTokens on deployed ERC-20 PGT Contract
    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, [
      "function claimTokens(uint256 amount, uint256 nonce, bytes memory signature) payable",
      "function withdrawalFee() view returns (uint256)"
    ], realSigner);

    let feeWei = ethers.parseEther("0.5"); // Default fallback
    try {
      feeWei = await tokenContract.withdrawalFee();
    } catch (e) {
      console.warn("Could not query withdrawalFee from contract, using default 0.5 POL:", e);
    }

    triggerToast("Confirm transaction in MetaMask...", "success");

    const tx = await tokenContract.claimTokens(amountWei, nonce, signature, {
      value: feeWei
    });
    triggerToast("Withdrawal pending on-chain...", "success");

    await tx.wait();

    // Deduct off-chain balance and save
    appState.update({
      balancePgt: offChainBalance - amount
    });

    sfx.playSuccess();
    triggerToast(`Withdrawal Success! Claimed ${amount} real PGT in your wallet!`, "success");
    appState.addActivity('You', `withdrew PGT on-chain`, `-${amount} PGT`);

    closeModal('withdraw');
    appState.syncUI();

  } catch (err) {
    console.error("Withdrawal claim failed:", err);
    triggerToast("Claim failed: " + (err.reason || err.message || err), "error");
  }
}

// Sync player off-chain rank globally using cryptographic signatures
async function syncLeaderboardRank() {
  if (!appState.state.walletConnected || appState.state.walletProvider !== 'metamask') {
    triggerToast("Please connect MetaMask on Polygon to sync your rank!", "error");
    return;
  }

  try {
    triggerToast("Requesting MetaMask signature...", "success");

    const address = appState.state.walletAddress.toLowerCase();
    const username = getActiveUsername();
    const balance = Math.floor(appState.state.balancePgt);
    const timestamp = getSecureNow();
    
    // Package message payload
    const message = `PolyGame Leaderboard Sync:\nAddress: ${address}\nUsername: ${username}\nBalance: ${balance}\nTimestamp: ${timestamp}`;
    
    // Request MetaMask signature
    const signature = await realSigner.signMessage(message);

    triggerToast("Syncing with global ledger...", "success");

    // Fetch current public leaderboard
    let list = [];
    try {
      const res = await fetch("https://kvdb.io/polygame_bucket_secret_99824/leaderboard");
      if (res.ok) {
        list = await res.json();
      }
    } catch (e) {
      console.warn("No existing leaderboard found, creating new bucket.");
    }

    if (!Array.isArray(list)) list = [];

    // Filter out previous entry for this user
    list = list.filter(entry => entry.address.toLowerCase() !== address);

    // Add new entry
    list.push({
      address: address,
      username: username,
      balance: balance,
      timestamp: timestamp,
      signature: signature
    });

    // Save back to DB
    const postRes = await fetch("https://kvdb.io/polygame_bucket_secret_99824/leaderboard", {
      method: "POST",
      body: JSON.stringify(list)
    });

    if (postRes.ok) {
      triggerToast("Rank synced globally! Refreshing rankings...", "success");
      sfx.playSuccess();
      
      // Force refresh leaderboard
      if (currentLeaderboardType === 'pgt') {
        renderPgtLeaderboard();
      }
    } else {
      triggerToast("Database sync failed.", "error");
    }

  } catch (err) {
    console.error("Leaderboard sync failed:", err);
    triggerToast("Sync failed: " + (err.reason || err.message || err), "error");
  }
}
window.syncLeaderboardRank = syncLeaderboardRank;
