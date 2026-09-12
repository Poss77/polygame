import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { openModal, closeModal, triggerToast } from '../core/ui.js';
import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../core/config.js';
import { fetchUserTotalPgtLiquidity } from './dex.js';

  // --- Crypto Faucet human verification ---

export const btnClaimFaucet = document.getElementById('btn-claim-faucet');
export let captchaTarget = [];
export let captchaInput = [];
export const captchaSymbols = ['⚡', '💎', '👑', '👾', '🛸', '🎮', '🍒', '🎲'];

// Secure True Time query (uses Supabase server Date header, silent fallback)
export async function fetchTrueTime() {
  try {
    if (supabase) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=player_id&limit=1`, { 
        method: 'HEAD', 
        headers: { 
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        cache: 'no-store' 
      });
      const serverDateStr = res.headers.get('date');
      if (serverDateStr) {
        const serverMs = new Date(serverDateStr).getTime();
        if (!isNaN(serverMs) && serverMs > 0) return serverMs;
      }
    }
  } catch (err) {
    // Silent fallback to system clock
  }
  return Date.now();
}

export let cachedTrueTimeOffset = 0;
// Update the clock offset on startup
fetchTrueTime().then(trueMs => {
  cachedTrueTimeOffset = trueMs - Date.now();
}).catch(() => {});

export function getSecureNow() {
  return Date.now() + cachedTrueTimeOffset;
}

export const getFaucetAppState = () => {
  if (typeof appState !== 'undefined' && appState && appState.state) return appState;
  if (typeof window !== 'undefined' && window.appState && window.appState.state) return window.appState;
  return null;
};

// Background Liquidity Scanner Sync
export async function syncUserLiquidity(force = false) {
  const stateObj = getFaucetAppState();
  if (!stateObj || !stateObj.state) return;
  const wallet = stateObj.state.linkedWalletAddress || stateObj.state.walletAddress || (stateObj.state.playerId && stateObj.state.playerId.startsWith('0x') && stateObj.state.playerId.length === 42 ? stateObj.state.playerId : null);
  if (!wallet) return;

  try {
    const res = await fetchUserTotalPgtLiquidity(wallet, force);
    if (res && typeof res.totalPgt === 'number') {
      stateObj.update({
        liquidityPgtAmount: res.totalPgt,
        liquidityUsdAmount: res.totalUsd || 0,
        liquidityMultiplier: res.multiplier || 1.0,
        isLiquidityProvider: res.isQualified
      });
      if (typeof stateObj.syncUI === 'function') stateObj.syncUI();
    }
  } catch (e) {
    console.warn('[syncUserLiquidity Exception]', e);
  }
}
if (typeof window !== 'undefined') window.syncUserLiquidity = syncUserLiquidity;

export function getFaucetCooldownSec() {
  const baseCooldown = 86400; // 24 hours base
  const stateObj = getFaucetAppState();
  if (stateObj && typeof stateObj.isVipActive === 'function' && stateObj.isVipActive()) {
    return Math.floor(baseCooldown * 0.90); // 10% reduction for VIPs (21.6 hours / 77,760 seconds)
  }
  return baseCooldown;
}

export function updateFaucetNavBadge(overridePgtReady = null, overrideVipReady = null) {
  const navBadge = document.getElementById('faucet-nav-badge');
  if (!navBadge) return;
  const stateObj = getFaucetAppState();
  const isConnected = stateObj && typeof stateObj.isPlayerConnected === 'function' && stateObj.isPlayerConnected();
  if (!isConnected || !stateObj || !stateObj.state) {
    navBadge.style.display = 'none';
    return;
  }

  const now = getSecureNow();

  // 1. Evaluate PGT Faucet
  let pgtReady = false;
  if (typeof overridePgtReady === 'boolean') {
    pgtReady = overridePgtReady;
  } else if (!stateObj.state.lastClaimTime) {
    pgtReady = true;
  } else {
    const lastClaimMs = typeof stateObj.state.lastClaimTime === 'number'
      ? stateObj.state.lastClaimTime
      : new Date(stateObj.state.lastClaimTime).getTime();
    const diffSec = Math.floor((now - lastClaimMs) / 1000);
    const cooldownSec = getFaucetCooldownSec();
    pgtReady = isNaN(diffSec) || diffSec >= cooldownSec;
  }

  // 2. Evaluate VIP POL Faucet (only if user has active VIP status)
  let vipReady = false;
  const isVip = typeof stateObj.isVipActive === 'function' && stateObj.isVipActive();
  if (isVip) {
    if (typeof overrideVipReady === 'boolean') {
      vipReady = overrideVipReady;
    } else if (!stateObj.state.lastVipFaucetClaim) {
      vipReady = true;
    } else {
      const lastVipMs = typeof stateObj.state.lastVipFaucetClaim === 'number'
        ? stateObj.state.lastVipFaucetClaim
        : new Date(stateObj.state.lastVipFaucetClaim).getTime();
      const diffVipSec = Math.floor((now - lastVipMs) / 1000);
      const vipCooldownSec = getVipFaucetCooldownSec();
      vipReady = isNaN(diffVipSec) || diffVipSec >= vipCooldownSec;
    }
  }

  // 3. Dynamic Dual Count: "1" if 1 ready, "2" if both ready, hidden if 0 ready
  const readyCount = (pgtReady ? 1 : 0) + (vipReady ? 1 : 0);

  if (readyCount > 0) {
    navBadge.innerText = readyCount.toString();
    navBadge.style.display = 'inline-flex';
    if (readyCount === 2) {
      navBadge.setAttribute('title', '2 Daily Faucets ready to claim: PGT + VIP POL!');
    } else if (pgtReady) {
      navBadge.setAttribute('title', 'Daily PGT Faucet ready to claim!');
    } else {
      navBadge.setAttribute('title', 'VIP POL Faucet ready to claim!');
    }
  } else {
    navBadge.style.display = 'none';
  }
}

export function checkFaucetCooldown() {
  const stateObj = getFaucetAppState();
  if (!stateObj || !stateObj.state) return;

  if (!stateObj.state.lastClaimTime) {
    setFaucetClaimActive(true);
    updateFaucetNavBadge();
    return;
  }

  const lastClaimMs = typeof stateObj.state.lastClaimTime === 'number'
    ? stateObj.state.lastClaimTime
    : new Date(stateObj.state.lastClaimTime).getTime();

  const now = getSecureNow();
  const diffSec = Math.floor((now - lastClaimMs) / 1000);
  const cooldownSec = getFaucetCooldownSec();

  if (isNaN(diffSec) || diffSec >= cooldownSec) {
    setFaucetClaimActive(true);
  } else {
    setFaucetClaimActive(false);
    updateFaucetCooldownTimer(cooldownSec - diffSec);
  }
  updateFaucetNavBadge();
}

export function setFaucetClaimActive(active) {
  updateFaucetNavBadge(active);
  const stateObj = getFaucetAppState();
  const isVip = stateObj && typeof stateObj.isVipActive === 'function' && stateObj.isVipActive();
  const btnClaim = btnClaimFaucet || document.getElementById('btn-claim-faucet');

  if (active) {
    if (btnClaim) {
      btnClaim.disabled = false;
      const defaultEst = (stateObj && stateObj.state && typeof stateObj.state.faucetBasePgt === 'number' ? stateObj.state.faucetBasePgt.toFixed(2) : "50.00") + " PGT";
      const estElem = document.getElementById('faucet-estimated-claim');
      let estVal = (estElem && estElem.innerText) ? estElem.innerText.trim() : defaultEst;
      if (estVal.startsWith("Claim ")) estVal = estVal.substring(6).trim();
      btnClaim.innerText = "Claim " + estVal;
    }
    const timerText = document.getElementById('faucet-timer-text');
    if (timerText) timerText.innerText = "READY";
    const statusSub = document.getElementById('faucet-status-subtext');
    if (statusSub) statusSub.innerText = isVip ? "👑 VIP Ready" : "Claim Now";
    
    const ring = document.getElementById('faucet-progress-ring');
    if (ring) ring.style.strokeDashoffset = 0;
  } else {
    if (btnClaim) btnClaim.disabled = true;
  }
}

export function updateFaucetCooldownTimer(secondsLeft) {
  updateFaucetNavBadge(false);
  const stateObj = getFaucetAppState();
  const isVip = stateObj && typeof stateObj.isVipActive === 'function' && stateObj.isVipActive();

  const cooldownSec = getFaucetCooldownSec();
  const hrs = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  const displayStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  const timerText = document.getElementById('faucet-timer-text');
  if (timerText) timerText.innerText = displayStr;
  const statusSub = document.getElementById('faucet-status-subtext');
  if (statusSub) statusSub.innerText = isVip ? "👑 VIP 10% Faster" : "Cooldown";
  const btnClaim = btnClaimFaucet || document.getElementById('btn-claim-faucet');
  if (btnClaim) {
    btnClaim.disabled = true;
    btnClaim.innerText = `Claim Locked (${displayStr})`;
  }
  
  const ring = document.getElementById('faucet-progress-ring');
  if (ring) {
    const totalRingLength = 565.48; // 2 * PI * r
    const fractionLeft = secondsLeft / cooldownSec;
    ring.style.strokeDashoffset = totalRingLength - (fractionLeft * totalRingLength);
  }
}

// Tick cooldown timers and weekly payouts every second
setInterval(() => {
  const stateObj = getFaucetAppState();
  if (!stateObj || !stateObj.state) return;

  const isConnected = typeof stateObj.isPlayerConnected === 'function' && stateObj.isPlayerConnected();

  if (!isConnected) {
    updateFaucetNavBadge(false, false);
    return;
  }

  let pgtReady = false;
  if (stateObj.state.lastClaimTime) {
    const lastClaimMs = typeof stateObj.state.lastClaimTime === 'number'
      ? stateObj.state.lastClaimTime
      : new Date(stateObj.state.lastClaimTime).getTime();

    const now = getSecureNow();
    const diff = Math.floor((now - lastClaimMs) / 1000);
    const cooldownSec = getFaucetCooldownSec();

    if (!isNaN(diff) && diff < cooldownSec) {
      updateFaucetCooldownTimer(cooldownSec - diff);
      pgtReady = false;
    } else {
      pgtReady = true;
      if (btnClaimFaucet && btnClaimFaucet.disabled) {
        setFaucetClaimActive(true);
      }
    }
  } else {
    // User is connected and has never claimed yet
    pgtReady = true;
    if (btnClaimFaucet && btnClaimFaucet.disabled) {
      setFaucetClaimActive(true);
    }
  }

  // Tick VIP POL Faucet Cooldown if VIP
  let vipReady = false;
  if (typeof stateObj.isVipActive === 'function' && stateObj.isVipActive()) {
    if (stateObj.state.lastVipFaucetClaim) {
      const lastVipMs = typeof stateObj.state.lastVipFaucetClaim === 'number'
        ? stateObj.state.lastVipFaucetClaim
        : new Date(stateObj.state.lastVipFaucetClaim).getTime();
      const now = getSecureNow();
      const diffVip = Math.floor((now - lastVipMs) / 1000);
      const vipCooldownSec = getVipFaucetCooldownSec();

      if (!isNaN(diffVip) && diffVip < vipCooldownSec) {
        updateVipFaucetCooldownTimer(vipCooldownSec - diffVip);
        vipReady = false;
      } else {
        vipReady = true;
        const btnVipClaim = document.getElementById('btn-claim-vip-faucet');
        if (btnVipClaim && btnVipClaim.disabled) {
          setVipFaucetClaimActive(true);
        }
      }
    } else {
      vipReady = true;
      const btnVipClaim = document.getElementById('btn-claim-vip-faucet');
      if (btnVipClaim && btnVipClaim.disabled) {
        setVipFaucetClaimActive(true);
      }
    }
  }

  updateFaucetNavBadge(pgtReady, vipReady);
}, 1000);

if (btnClaimFaucet) {
  btnClaimFaucet.addEventListener('click', () => {
    const stateObj = getFaucetAppState();
    if (stateObj && typeof stateObj.isVipActive === 'function' && stateObj.isVipActive()) {
      triggerToast("👑 VIP Perk: Instant Faucet Claim! Captcha Bypassed.", "success");
      executeFaucetClaim();
    } else {
      openModal('captcha');
      generateCaptchaChallenge();
    }
  });
}

// Generate captcha sequence
export function generateCaptchaChallenge() {
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

export function handleCaptchaKeyPress(sym) {
  if (captchaInput.length >= 3 || isClaimInProgress) return;
  sfx.playCoin();
  captchaInput.push(sym);
  drawCaptchaInputDisplay();

  // Auto-verify sequence as soon as 3rd symbol is entered
  if (captchaInput.length === 3) {
    setTimeout(() => {
      verifyCaptchaSequence();
    }, 220);
  }
}

export function drawCaptchaInputDisplay() {
  const display = document.getElementById('captcha-input-display');
  display.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const box = document.createElement('div');
    box.className = `captcha-sym-box ${captchaInput[i] ? 'active-selected' : ''}`;
    box.innerText = captchaInput[i] || '';
    display.appendChild(box);
  }
}

export function verifyCaptchaSequence() {
  if (isClaimInProgress) return;
  if (captchaInput.length < 3) {
    triggerToast("Incomplete sequence", "error");
    return;
  }

  // Check sequence matches
  const match = captchaTarget.every((val, index) => val === captchaInput[index]);
  
  if (match) {
    sfx.playSuccess();
    closeModal('captcha');
    executeFaucetClaim();
  } else {
    sfx.playError();
    triggerToast("❌ Incorrect sequence! Challenge reset.", "error");
    captchaInput = [];
    generateCaptchaChallenge();
  }
}

const btnCaptchaReset = document.getElementById('btn-captcha-reset');
if (btnCaptchaReset) {
  btnCaptchaReset.addEventListener('click', () => {
    captchaInput = [];
    sfx.playError();
    drawCaptchaInputDisplay();
  });
}

let isClaimInProgress = false;

const btnCaptchaVerify = document.getElementById('btn-captcha-verify');
if (btnCaptchaVerify) {
  btnCaptchaVerify.addEventListener('click', () => {
    verifyCaptchaSequence();
  });
}

export async function executeFaucetClaim() {
  if (isClaimInProgress) return;
  const stateObj = getFaucetAppState();
  if (!stateObj || !stateObj.state) return;

  const multis = typeof stateObj.getMultipliers === 'function' ? stateObj.getMultipliers() : { totalFaucetBoostPercent: 0 };
  
  if (!stateObj.isPlayerConnected() || !supabase) {
    triggerToast("Please sign in with Google or connect a wallet first.", "error");
    setFaucetClaimActive(true);
    return;
  }

  if (stateObj.state.isBanned) {
    triggerToast("Security Alert: Account has been permanently suspended.", "error");
    setFaucetClaimActive(false);
    return;
  }
  
  isClaimInProgress = true;
  const playerId = (stateObj.state.playerId || stateObj.state.walletAddress || '').toLowerCase();
  
  try {
    let { data: res, error } = await supabase.rpc('claim_faucet', {
      p_player_id: playerId,
      p_nft_boost_percent: multis.totalFaucetBoostPercent || 0,
      p_1flr_balance: 0,
      p_staked_pgt: typeof stateObj.getStakedPgtTotal === 'function' ? stateObj.getStakedPgtTotal() : 0,
      p_onchain_pgt: stateObj.state.onchainBalancePgt || 0,
      p_lp_pgt: stateObj.state.liquidityPgtAmount || 0,
      p_lp_usd: stateObj.state.liquidityUsdAmount || 0
    });

    if (Array.isArray(res)) res = res[0];
    if (error || !res.success) {
      triggerToast(error ? error.message : res.error, "error");
      if (res && res.next_claim) {
        const nextClaimMs = new Date(res.next_claim).getTime();
        const cooldownSec = getFaucetCooldownSec();
        const now = getSecureNow();
        const diffSec = Math.floor((nextClaimMs - now) / 1000);
        if (diffSec > 0) {
          stateObj.update({ lastClaimTime: nextClaimMs - (cooldownSec * 1000) });
          updateFaucetCooldownTimer(diffSec);
          return;
        }
      }
      checkFaucetCooldown();
      return;
    }

    const payoutAmount = parseFloat(res.payout_pgt !== undefined ? res.payout_pgt : (res.payout || 0));
    const newWeeklyFaucets = res.weekly_faucet_claims !== undefined ? parseInt(res.weekly_faucet_claims, 10) : (stateObj.state.weeklyFaucetClaims || 0) + 1;
    const newWeeklyTier = res.weekly_active_tier !== undefined ? parseInt(res.weekly_active_tier, 10) : (typeof stateObj.computeWeeklyActiveTier === 'function' ? stateObj.computeWeeklyActiveTier(newWeeklyFaucets, stateObj.state.weeklyGamesPlayed || 0) : 0);

    stateObj.update({
      balancePgt: stateObj.state.balancePgt + payoutAmount,
      totalClaims: stateObj.state.totalClaims + 1,
      weeklyFaucetClaims: newWeeklyFaucets,
      weeklyActiveTier: newWeeklyTier,
      lastClaimTime: new Date(res.claimed_at || res.last_claim || Date.now()).getTime(),
      claimStreak: res.streak
    });

    // Sync referral data view & profile view
    if (typeof window.syncReferralData === 'function') {
      window.syncReferralData();
    }
    if (typeof window.syncProfileView === 'function') {
      window.syncProfileView();
    }

    sfx.playSuccess();
    triggerToast(`Claimed +${payoutAmount.toFixed(2)} PGT Faucet reward!`, 'success');
    if (typeof stateObj.addActivity === 'function') {
      stateObj.addActivity('You', 'claimed faucet', `+${payoutAmount.toFixed(2)} PGT`);
    }
    if (typeof window.recordGameMetrics === 'function') {
      window.recordGameMetrics('Faucet', 1, payoutAmount, 0);
    }
    
    setFaucetClaimActive(false);
  } catch (err) {
    console.error("Faucet claim failed:", err);
    triggerToast("Claim failed. Please try again.", "error");
    setFaucetClaimActive(true);
  } finally {
    isClaimInProgress = false;
  }
}

// ==============================================================================
// VIP-EXCLUSIVE POL FAUCET SYSTEM
// Base: 0.005 POL (in global_settings), same multipliers as PGT, on-site accumulation
// ==============================================================================

let isVipClaimInProgress = false;
let isVipPayoutInProgress = false;

export function switchFaucetViewTab(tab) {
  // Merged unified 2-column view: faucets are displayed side-by-side / stacked
  checkFaucetCooldown();
  checkVipFaucetCooldown();
  renderVipFaucetUI();
}

export function getVipFaucetCooldownSec() {
  return Math.floor(86400 * 0.90); // 21.6 hours (VIP 10% faster cooldown / 77,760s)
}

export function getVipEstimatedClaimPol() {
  const stateObj = getFaucetAppState();
  if (!stateObj || !stateObj.state) return 0.0100;
  const basePol = (typeof stateObj.state.vipFaucetBasePol === 'number' && stateObj.state.vipFaucetBasePol > 0)
    ? stateObj.state.vipFaucetBasePol
    : 0.005;
  const multis = typeof stateObj.getMultipliers === 'function' ? stateObj.getMultipliers() : { totalFaucetBoostPercent: 0 };

  // Shared consecutive day streak from PGT
  const streak = parseInt(stateObj.state.claimStreak || 0, 10);
  const streakBoost = Math.min(streak * 2, 10);
  const combinedBoostPercent = (multis.nftFaucetBoost || 0) + (multis.referralBoost || 0) + streakBoost;

  let totalEst = basePol * (1 + combinedBoostPercent / 100);

  const lpUsd = parseFloat(stateObj.state.liquidityUsdAmount || 0);
  const lpPgt = parseFloat(stateObj.state.liquidityPgtAmount || 0);
  const isLpForce = !!stateObj.state.isLiquidityProvider;
  let lpMult = 1.0;
  if (lpUsd >= 150 || lpPgt >= 500000 || isLpForce) {
    lpMult = 1.30;
  } else if (lpUsd >= 100) {
    lpMult = 1.20;
  } else if (lpUsd >= 50) {
    lpMult = 1.10;
  }

  if (lpMult > 1.0) totalEst *= lpMult;
  if (isPgtWhale) totalEst *= 1.25;
  if (isPgtOnchainWhale) totalEst *= 1.10;
  if (multis.isApexUnlocked) totalEst *= 1.5;
  totalEst *= 2.0; // VIP 2x
  if (!!stateObj.state.isAmbassador) totalEst *= 2.0;

  return Math.round(totalEst * 1000000) / 1000000;
}

export function checkVipFaucetCooldown() {
  const stateObj = getFaucetAppState();
  if (!stateObj || !stateObj.state) return;
  if (typeof stateObj.isVipActive === 'function' && !stateObj.isVipActive()) {
    updateFaucetNavBadge();
    return;
  }

  if (!stateObj.state.lastVipFaucetClaim) {
    setVipFaucetClaimActive(true);
    updateFaucetNavBadge();
    return;
  }

  const lastClaimMs = typeof stateObj.state.lastVipFaucetClaim === 'number'
    ? stateObj.state.lastVipFaucetClaim
    : new Date(stateObj.state.lastVipFaucetClaim).getTime();

  const now = getSecureNow();
  const diffSec = Math.floor((now - lastClaimMs) / 1000);
  const cooldownSec = getVipFaucetCooldownSec();

  if (isNaN(diffSec) || diffSec >= cooldownSec) {
    setVipFaucetClaimActive(true);
  } else {
    setVipFaucetClaimActive(false);
    updateVipFaucetCooldownTimer(cooldownSec - diffSec);
  }
  updateFaucetNavBadge();
}

export function setVipFaucetClaimActive(active) {
  const btnClaim = document.getElementById('btn-claim-vip-faucet');
  const timerText = document.getElementById('vip-faucet-timer-text');
  const statusSub = document.getElementById('vip-faucet-status-subtext');
  const ring = document.getElementById('vip-faucet-progress-ring');

  if (active) {
    if (btnClaim) {
      btnClaim.disabled = false;
      const estPol = getVipEstimatedClaimPol();
      btnClaim.innerText = `👑 Claim ${estPol.toFixed(4)} POL`;
      btnClaim.style.opacity = '1';
      btnClaim.style.cursor = 'pointer';
    }
    if (timerText) timerText.innerText = "READY";
    if (statusSub) statusSub.innerText = "👑 VIP Ready";
    if (ring) ring.style.strokeDashoffset = 0;
  } else {
    if (btnClaim) {
      btnClaim.disabled = true;
      btnClaim.style.opacity = '0.6';
      btnClaim.style.cursor = 'not-allowed';
    }
  }
  updateFaucetNavBadge(null, active);
}

export function updateVipFaucetCooldownTimer(secondsLeft) {
  const cooldownSec = getVipFaucetCooldownSec();
  const hrs = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  const displayStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const timerText = document.getElementById('vip-faucet-timer-text');
  if (timerText) timerText.innerText = displayStr;
  const statusSub = document.getElementById('vip-faucet-status-subtext');
  if (statusSub) statusSub.innerText = "👑 Cooldown (21.6h)";

  const btnClaim = document.getElementById('btn-claim-vip-faucet');
  if (btnClaim) btnClaim.innerText = `Claim Locked (${displayStr})`;

  const ring = document.getElementById('vip-faucet-progress-ring');
  if (ring) {
    const totalRingLength = 565.48; // 2 * PI * 90
    const fractionLeft = secondsLeft / cooldownSec;
    ring.style.strokeDashoffset = totalRingLength - (fractionLeft * totalRingLength);
  }
}

export function renderVipFaucetUI() {
  const stateObj = getFaucetAppState();
  if (!stateObj || !stateObj.state) return;

  const isVip = typeof stateObj.isVipActive === 'function' && stateObj.isVipActive();
  const lockedStation = document.getElementById('vip-faucet-locked-station') || document.getElementById('vip-faucet-locked-view');
  const activeStation = document.getElementById('vip-faucet-active-station') || document.getElementById('vip-faucet-active-view');

  if (!isVip) {
    if (lockedStation) lockedStation.style.display = 'block';
    if (activeStation) activeStation.style.display = 'none';
    return;
  }

  if (lockedStation) lockedStation.style.display = 'none';
  if (activeStation) activeStation.style.display = 'block';

  const basePol = (typeof stateObj.state.vipFaucetBasePol === 'number' && stateObj.state.vipFaucetBasePol > 0)
    ? stateObj.state.vipFaucetBasePol
    : 0.005;
  const minPayout = (typeof stateObj.state.vipFaucetMinPayoutPol === 'number' && stateObj.state.vipFaucetMinPayoutPol > 0)
    ? stateObj.state.vipFaucetMinPayoutPol
    : 5.0;
  const unclaimedPol = parseFloat(stateObj.state.unclaimedVipFaucetPol || 0);
  const streak = parseInt(stateObj.state.claimStreak || 0, 10);
  const streakBoost = Math.min(streak * 2, 10);

  // Update base payout label
  const baseEl = document.getElementById('vip-faucet-base-payout-display');
  if (baseEl) baseEl.innerText = `${basePol.toFixed(4)} POL`;

  // Update multipliers breakdown
  const multis = typeof stateObj.getMultipliers === 'function' ? stateObj.getMultipliers() : { totalFaucetBoostPercent: 0 };
  const nftBoostEl = document.getElementById('vip-faucet-multiplier-nft');
  if (nftBoostEl) nftBoostEl.innerText = `+${multis.nftFaucetBoost}%`;

  const refBoostEl = document.getElementById('vip-faucet-multiplier-referral');
  if (refBoostEl) refBoostEl.innerText = `+${multis.referralBoost}%`;

  const streakBoostEl = document.getElementById('vip-faucet-multiplier-streak');
  if (streakBoostEl) streakBoostEl.innerText = `+${streakBoost}% (Day ${streak})`;

  const relicsEl = document.getElementById('vip-faucet-multiplier-relics');
  if (relicsEl) {
    const isApex = !!multis.isApexUnlocked;
    relicsEl.innerText = isApex ? 'x1.5 (+50%) (Unlocked)' : '+0% (0/17)';
    relicsEl.style.color = isApex ? '#ffd700' : 'var(--text-muted)';
  }

  const isVipUser = typeof stateObj.isVipActive === 'function' && stateObj.isVipActive();
  const vipValEl = document.getElementById('faucet-multiplier-vip');
  if (vipValEl) {
    if (isVipUser) {
      vipValEl.innerHTML = `<span style="color: #ffd700; font-weight: 800;">x2 (+100%)</span>`;
    } else {
      vipValEl.innerHTML = `<span style="color: var(--text-muted); font-weight: 600;">+0% <span style="font-size: 0.8em; opacity: 0.75;">(x2 possible)</span></span>`;
    }
  }

  const isAmbUser = !!stateObj.state.isAmbassador;
  const ambValEl = document.getElementById('faucet-multiplier-ambassador');
  if (ambValEl) {
    if (isAmbUser) {
      ambValEl.innerHTML = `<span style="color: var(--color-warning); font-weight: 800;">x2 (+100%)</span>`;
    } else {
      ambValEl.innerHTML = `<span style="color: var(--text-muted); font-weight: 600;">+0% <span style="font-size: 0.8em; opacity: 0.75;">(x2 possible)</span></span>`;
    }
  }

  // Whale & Liquidity Provider boosts
  const lpUsd = parseFloat(stateObj.state.liquidityUsdAmount || 0);
  const lpPgt = parseFloat(stateObj.state.liquidityPgtAmount || 0);
  const isLpForce = !!stateObj.state.isLiquidityProvider;
  let lpMult = 1.0;
  if (lpUsd >= 150 || lpPgt >= 500000 || isLpForce) {
    lpMult = 1.30;
  } else if (lpUsd >= 100) {
    lpMult = 1.20;
  } else if (lpUsd >= 50) {
    lpMult = 1.10;
  }

  const elLp = document.getElementById('vip-faucet-multiplier-lp') || document.getElementById('faucet-multiplier-lp');
  if (elLp) {
    if (lpMult > 1.0) {
      elLp.innerText = `+${Math.round((lpMult - 1.0) * 100)}% (${lpMult.toFixed(1)}x)`;
      elLp.style.color = (lpMult >= 1.3) ? '#ffd700' : (lpMult >= 1.2 ? '#38bdf8' : 'var(--color-primary)');
    } else {
      elLp.innerText = '+0% (1.1x–1.3x)';
      elLp.style.color = 'var(--text-muted)';
    }
  }
  const elPgt = document.getElementById('vip-faucet-multiplier-pgt');
  if (elPgt) {
    elPgt.innerText = isPgtWhale ? '+25%' : '+0%';
    elPgt.style.color = isPgtWhale ? 'var(--color-success)' : 'var(--text-muted)';
  }
  const elPgtOnchain = document.getElementById('vip-faucet-multiplier-pgt-onchain');
  if (elPgtOnchain) {
    elPgtOnchain.innerText = isPgtOnchainWhale ? '+10%' : '+0%';
    elPgtOnchain.style.color = isPgtOnchainWhale ? 'var(--color-success)' : 'var(--text-muted)';
  }

  // Estimated next claim
  const estPol = getVipEstimatedClaimPol();
  const estClaimEl = document.getElementById('vip-faucet-estimated-claim');
  if (estClaimEl) estClaimEl.innerText = `${estPol.toFixed(4)} POL`;

  const estPolSharedEl = document.getElementById('faucet-estimated-claim-pol');
  if (estPolSharedEl) estPolSharedEl.innerText = `👑 ${estPol.toFixed(4)} POL`;

  const btnClaim = document.getElementById('btn-claim-vip-faucet');
  if (btnClaim && !btnClaim.disabled) {
    btnClaim.innerText = `👑 Claim ${estPol.toFixed(4)} POL`;
  }

  // Accumulated balance & payout box
  const accumBalEl = document.getElementById('vip-faucet-accumulated-balance');
  if (accumBalEl) accumBalEl.innerText = `${unclaimedPol.toFixed(4)} POL`;

  const minPayoutDisplayEl = document.getElementById('vip-faucet-min-payout-display');
  if (minPayoutDisplayEl) minPayoutDisplayEl.innerText = `${minPayout.toFixed(2)} POL`;

  const pct = Math.min(100, Math.max(0, (unclaimedPol / minPayout) * 100));
  const progFill = document.getElementById('vip-faucet-payout-progress-fill');
  if (progFill) progFill.style.width = `${pct}%`;

  const progLabel = document.getElementById('vip-faucet-payout-progress-label');
  if (progLabel) progLabel.innerText = `${unclaimedPol.toFixed(4)} / ${minPayout.toFixed(4)} POL (${pct.toFixed(1)}%)`;

  // Destination wallet label
  const destWallet = (stateObj.state.linkedWalletAddress || stateObj.state.walletAddress || '').toLowerCase();
  const destWalletEl = document.getElementById('vip-faucet-payout-destination');
  const isValidEvm = destWallet && !destWallet.startsWith('0xpgt') && !destWallet.startsWith('0xguest') && destWallet.length >= 42;
  if (destWalletEl) {
    if (isValidEvm) {
      destWalletEl.innerHTML = `Destination Wallet: <span style="color:var(--color-primary); font-family:monospace; font-weight:700;">${destWallet.substring(0, 8)}...${destWallet.substring(destWallet.length - 6)}</span> <span style="color:var(--color-success);">✔</span>`;
    } else {
      destWalletEl.innerHTML = `<span style="color:var(--color-warning);">⚠️ No Web3 EVM wallet linked. Payouts require a linked wallet in Profile.</span>`;
    }
  }

  // Payout button state
  const btnPayout = document.getElementById('btn-request-vip-payout');
  if (btnPayout) {
    const canPayout = unclaimedPol >= minPayout && isValidEvm;
    btnPayout.disabled = !canPayout;
    if (unclaimedPol >= minPayout) {
      btnPayout.innerText = `💎 Request ${minPayout.toFixed(2)} POL Payout`;
      btnPayout.style.background = 'linear-gradient(135deg, #ffd700, #ff8800)';
      btnPayout.style.color = '#000';
      btnPayout.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.4)';
      btnPayout.style.cursor = isValidEvm ? 'pointer' : 'not-allowed';
    } else {
      btnPayout.innerText = `Request Payout (Need ${minPayout.toFixed(2)} POL)`;
      btnPayout.style.background = 'rgba(255, 255, 255, 0.08)';
      btnPayout.style.color = 'var(--text-muted)';
      btnPayout.style.boxShadow = 'none';
      btnPayout.style.cursor = 'not-allowed';
    }
  }

  // Check cooldown status for claim button
  checkVipFaucetCooldown();
}

export async function executeVipFaucetClaim() {
  if (isVipClaimInProgress) return;
  const stateObj = getFaucetAppState();
  if (!stateObj || !stateObj.state) return;

  if (!stateObj.isPlayerConnected() || !supabase) {
    triggerToast("Please sign in or connect a wallet first.", "error");
    return;
  }

  if (typeof stateObj.isVipActive === 'function' && !stateObj.isVipActive()) {
    triggerToast("👑 VIP Membership required to claim the VIP POL Faucet.", "error");
    return;
  }

  isVipClaimInProgress = true;
  if (stateObj.state.isBanned) {
    triggerToast("Security Alert: Account has been permanently suspended.", "error");
    if (btn) {
      btn.disabled = true;
      btn.innerText = "🚫 Suspended";
    }
    return;
  }

  const multis = typeof stateObj.getMultipliers === 'function' ? stateObj.getMultipliers() : { totalFaucetBoostPercent: 0 };
  const streak = parseInt(stateObj.state.claimStreak || 0, 10);
  const streakBoost = Math.min(streak * 2, 10);
  const combinedBoostPercent = (multis.nftFaucetBoost || 0) + (multis.referralBoost || 0) + streakBoost;
  const playerId = (stateObj.state.playerId || stateObj.state.walletAddress || '').toLowerCase();

  try {
    let { data: res, error } = await supabase.rpc('claim_vip_faucet', {
      p_player_id: playerId,
      p_nft_boost_percent: combinedBoostPercent,
      p_1flr_balance: 0,
      p_staked_pgt: typeof stateObj.getStakedPgtTotal === 'function' ? stateObj.getStakedPgtTotal() : 0,
      p_onchain_pgt: stateObj.state.onchainBalancePgt || 0,
      p_lp_pgt: stateObj.state.liquidityPgtAmount || 0,
      p_lp_usd: stateObj.state.liquidityUsdAmount || 0
    });

    if (Array.isArray(res)) res = res[0];
    if (error || !res.success) {
      triggerToast(error ? error.message : res.error, "error");
      if (res && res.next_claim) {
        const nextClaimMs = new Date(res.next_claim).getTime();
        const cooldownSec = getVipFaucetCooldownSec();
        const now = getSecureNow();
        const diffSec = Math.floor((nextClaimMs - now) / 1000);
        if (diffSec > 0) {
          stateObj.update({ lastVipFaucetClaim: nextClaimMs - (cooldownSec * 1000) });
          updateVipFaucetCooldownTimer(diffSec);
          return;
        }
      }
      checkVipFaucetCooldown();
      return;
    }

    const payoutPol = parseFloat(res.payout_pol || 0);
    const newUnclaimed = parseFloat(res.unclaimed_vip_faucet_pol || 0);
    const newTotal = parseFloat(res.total_vip_faucet_pol || 0);

    stateObj.update({
      unclaimedVipFaucetPol: newUnclaimed,
      totalVipFaucetPol: newTotal,
      lastVipFaucetClaim: new Date(res.last_vip_faucet_claim || Date.now()).getTime(),
      vipFaucetStreak: res.streak || (streak + 1)
    });

    sfx.playSuccess();
    triggerToast(`🎉 Claimed +${payoutPol.toFixed(4)} POL! Accumulated: ${newUnclaimed.toFixed(4)} POL`, "success");

    if (typeof stateObj.addActivity === 'function') {
      stateObj.addActivity('You', 'claimed VIP POL faucet', `+${payoutPol.toFixed(4)} POL`);
    }

    renderVipFaucetUI();
    setVipFaucetClaimActive(false);
  } catch (err) {
    console.error("VIP Faucet claim error:", err);
    triggerToast("VIP Claim failed. Please try again.", "error");
    setVipFaucetClaimActive(true);
  } finally {
    isVipClaimInProgress = false;
  }
}

export async function requestVipFaucetPayout() {
  if (isVipPayoutInProgress) return;
  const stateObj = getFaucetAppState();
  if (!stateObj || !stateObj.state) return;

  const minPayout = (typeof stateObj.state.vipFaucetMinPayoutPol === 'number' && stateObj.state.vipFaucetMinPayoutPol > 0)
    ? stateObj.state.vipFaucetMinPayoutPol
    : 5.0;
  const unclaimed = parseFloat(stateObj.state.unclaimedVipFaucetPol || 0);

  if (unclaimed < minPayout) {
    triggerToast(`Minimum accumulated balance for payout is ${minPayout.toFixed(2)} POL. You have ${unclaimed.toFixed(4)} POL.`, "warning");
    return;
  }

  const destWallet = (stateObj.state.linkedWalletAddress || stateObj.state.walletAddress || '').toLowerCase();
  if (!destWallet || destWallet.startsWith('0xpgt') || destWallet.startsWith('0xguest') || destWallet.length < 42) {
    triggerToast("No valid Web3 EVM wallet linked to your account! Please link a wallet in Profile.", "error");
    return;
  }

  const confirmed = window.confirm(`Request ${minPayout.toFixed(2)} POL on-chain payout to wallet ${destWallet}?\n\nMaster Admin will review and execute the transfer directly to your wallet on Polygon (Admin pays gas fee).`);
  if (!confirmed) return;

  isVipPayoutInProgress = true;
  const btn = document.getElementById('btn-request-vip-payout');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳ Submitting Payout Request...";
  }

  const playerId = (stateObj.state.playerId || stateObj.state.walletAddress || '').toLowerCase();

  try {
    let { data: res, error } = await supabase.rpc('request_vip_faucet_pol_payout', {
      p_player_id: playerId,
      p_amount: minPayout
    });

    if (Array.isArray(res)) res = res[0];
    if (error || !res.success) {
      triggerToast(error ? error.message : res.error, "error");
      return;
    }

    const newUnclaimed = parseFloat(res.new_unclaimed_balance || 0);
    stateObj.update({
      unclaimedVipFaucetPol: newUnclaimed
    });

    sfx.playSuccess();
    triggerToast(`✅ Payout request for ${minPayout.toFixed(2)} POL submitted! Master Admin will process on Polygon.`, "success");

    if (typeof stateObj.addActivity === 'function') {
      stateObj.addActivity('You', 'requested VIP POL payout', `${minPayout.toFixed(2)} POL`);
    }

    // Dispatch urgent alert to Master Admin private Discord channel
    import('../utils/discord.js').then(({ sendAdminAlert }) => {
      sendAdminAlert({
        title: "New VIP Faucet POL Payout Request",
        description: `VIP Member **${stateObj.state.username || playerId.substring(0, 8)}** requested a VIP Faucet payout of **${minPayout.toFixed(2)} POL**!`,
        category: "PAYOUT",
        color: 0xFFD700,
        fields: [
          { name: "Player Account", value: playerId, inline: true },
          { name: "Amount", value: `${minPayout.toFixed(2)} POL`, inline: true }
        ]
      }).catch(() => {});
    }).catch(() => {});

    renderVipFaucetUI();
  } catch (err) {
    console.error("VIP Faucet payout request failed:", err);
    triggerToast("Failed to submit payout request: " + (err.message || err), "error");
  } finally {
    isVipPayoutInProgress = false;
    if (btn) {
      const currentUnclaimed = parseFloat(stateObj.state.unclaimedVipFaucetPol || 0);
      btn.disabled = currentUnclaimed < minPayout;
      btn.innerText = currentUnclaimed >= minPayout
        ? `💎 Request ${minPayout.toFixed(2)} POL Payout`
        : `Request Payout (Need ${minPayout.toFixed(2)} POL)`;
    }
  }
}

// Attach event listeners
const btnClaimVip = document.getElementById('btn-claim-vip-faucet');
if (btnClaimVip) {
  btnClaimVip.addEventListener('click', () => {
    executeVipFaucetClaim();
  });
}

const btnPayoutVip = document.getElementById('btn-request-vip-payout');
if (btnPayoutVip) {
  btnPayoutVip.addEventListener('click', () => {
    requestVipFaucetPayout();
  });
}

export function unlockVipPass() {
  if (typeof window.unlockVipPass === 'function' && window.unlockVipPass !== unlockVipPass) {
    window.unlockVipPass();
    return;
  }
  if (typeof window.closeModal === 'function') {
    window.closeModal('vip-lock');
  }
  if (typeof window.switchTab === 'function') {
    window.switchTab('nft');
    if (typeof window.switchNftView === 'function') {
      window.switchNftView('market');
    }
    setTimeout(() => {
      const target = document.getElementById('nft-group-special') || document.getElementById('nft-market-grid');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.style.transition = 'box-shadow 0.4s ease';
        target.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.4)';
        setTimeout(() => {
          if (target) target.style.boxShadow = 'none';
        }, 1500);
      }
    }, 150);
  }
}

const btnUnlockVipFaucet = document.getElementById('btn-unlock-vip-faucet');
if (btnUnlockVipFaucet) {
  btnUnlockVipFaucet.addEventListener('click', () => {
    unlockVipPass();
  });
}

if (typeof window !== 'undefined') {
  window.checkFaucetCooldown = checkFaucetCooldown;
  window.setFaucetClaimActive = setFaucetClaimActive;
  window.updateFaucetNavBadge = updateFaucetNavBadge;
  window.switchFaucetViewTab = switchFaucetViewTab;
  window.checkVipFaucetCooldown = checkVipFaucetCooldown;
  window.setVipFaucetClaimActive = setVipFaucetClaimActive;
  window.renderVipFaucetUI = renderVipFaucetUI;
  window.executeVipFaucetClaim = executeVipFaucetClaim;
  window.requestVipFaucetPayout = requestVipFaucetPayout;
  window.getVipEstimatedClaimPol = getVipEstimatedClaimPol;
  window.unlockVipPass = window.unlockVipPass || unlockVipPass;
}

