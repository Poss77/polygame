import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { openModal, closeModal, triggerToast } from '../core/ui.js';
import { supabase, SUPABASE_KEY } from '../core/config.js';

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

export function getFaucetCooldownSec() {
  const baseCooldown = 86400; // 24 hours base
  if (appState.isVipActive()) {
    return Math.floor(baseCooldown * 0.90); // 10% reduction for VIPs (21.6 hours / 77,760 seconds)
  }
  return baseCooldown;
}

export function checkFaucetCooldown() {
  if (!appState.state.lastClaimTime) {
    setFaucetClaimActive(true);
    return;
  }

  const lastClaimMs = typeof appState.state.lastClaimTime === 'number'
    ? appState.state.lastClaimTime
    : new Date(appState.state.lastClaimTime).getTime();

  const now = getSecureNow();
  const diffSec = Math.floor((now - lastClaimMs) / 1000);
  const cooldownSec = getFaucetCooldownSec();

  if (isNaN(diffSec) || diffSec >= cooldownSec) {
    setFaucetClaimActive(true);
  } else {
    setFaucetClaimActive(false);
    updateFaucetCooldownTimer(cooldownSec - diffSec);
  }
}

export function setFaucetClaimActive(active) {
  if (active) {
    if (btnClaimFaucet) {
      btnClaimFaucet.disabled = false;
      const estElem = document.getElementById('faucet-estimated-claim');
      let estVal = estElem ? estElem.innerText.trim() : "50.00 PGT";
      if (estVal.startsWith("Claim ")) estVal = estVal.substring(6).trim();
      btnClaimFaucet.innerText = "Claim " + estVal;
    }
    const timerText = document.getElementById('faucet-timer-text');
    if (timerText) timerText.innerText = "READY";
    const statusSub = document.getElementById('faucet-status-subtext');
    if (statusSub) statusSub.innerText = appState.isVipActive() ? "👑 VIP Ready" : "Claim Now";
    
    const ring = document.getElementById('faucet-progress-ring');
    if (ring) ring.style.strokeDashoffset = 0;
  } else {
    if (btnClaimFaucet) btnClaimFaucet.disabled = true;
  }
}

export function updateFaucetCooldownTimer(secondsLeft) {
  const cooldownSec = getFaucetCooldownSec();
  const hrs = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  const displayStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  document.getElementById('faucet-timer-text').innerText = displayStr;
  document.getElementById('faucet-status-subtext').innerText = appState.isVipActive() ? "👑 VIP 10% Faster" : "Cooldown";
  btnClaimFaucet.innerText = `Claim Locked (${displayStr})`;
  
  const ring = document.getElementById('faucet-progress-ring');
  if (ring) {
    const totalRingLength = 565.48; // 2 * PI * r
    const fractionLeft = secondsLeft / cooldownSec;
    ring.style.strokeDashoffset = totalRingLength - (fractionLeft * totalRingLength);
  }
}

// Tick cooldown timers and weekly payouts every second
setInterval(() => {
  if (appState.state.lastClaimTime) {
    const lastClaimMs = typeof appState.state.lastClaimTime === 'number'
      ? appState.state.lastClaimTime
      : new Date(appState.state.lastClaimTime).getTime();

    const now = getSecureNow();
    const diff = Math.floor((now - lastClaimMs) / 1000);
    const cooldownSec = getFaucetCooldownSec();

    if (!isNaN(diff) && diff < cooldownSec) {
      updateFaucetCooldownTimer(cooldownSec - diff);
    } else if (btnClaimFaucet && btnClaimFaucet.disabled) {
      setFaucetClaimActive(true);
    }
  }
}, 1000);

if (btnClaimFaucet) {
  btnClaimFaucet.addEventListener('click', () => {
    if (appState.isVipActive()) {
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
  const multis = appState.getMultipliers();
  
  if (!appState.isPlayerConnected() || !supabase) {
    triggerToast("Please sign in with Google or connect a wallet first.", "error");
    setFaucetClaimActive(true);
    return;
  }
  
  isClaimInProgress = true;
  const address = (appState.state.playerId || appState.state.walletAddress || '').toLowerCase();
  
  try {
    let { data: res, error } = await supabase.rpc('claim_faucet', {
      p_wallet: address,
      p_nft_boost_percent: multis.totalFaucetBoostPercent,
      p_1flr_balance: appState.state.balance1flr || 0,
      p_staked_pgt: appState.getStakedPgtTotal(),
      p_onchain_pgt: appState.state.onchainBalancePgt || 0
    });

    if (Array.isArray(res)) res = res[0];
    if (error || !res.success) {
      triggerToast(error ? error.message : res.error, "error");
      setFaucetClaimActive(true);
      return;
    }

    const payoutAmount = parseFloat(res.payout_pgt !== undefined ? res.payout_pgt : (res.payout || 0));
    const newWeeklyFaucets = res.weekly_faucet_claims !== undefined ? parseInt(res.weekly_faucet_claims, 10) : (appState.state.weeklyFaucetClaims || 0) + 1;
    const newWeeklyTier = res.weekly_active_tier !== undefined ? parseInt(res.weekly_active_tier, 10) : (typeof appState.computeWeeklyActiveTier === 'function' ? appState.computeWeeklyActiveTier(newWeeklyFaucets, appState.state.weeklyGamesPlayed || 0) : 0);

    appState.update({
      balancePgt: appState.state.balancePgt + payoutAmount,
      totalClaims: appState.state.totalClaims + 1,
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
    appState.addActivity('You', 'claimed faucet', `+${payoutAmount.toFixed(2)} PGT`);
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

if (typeof window !== 'undefined') {
  window.checkFaucetCooldown = checkFaucetCooldown;
  window.setFaucetClaimActive = setFaucetClaimActive;
}

