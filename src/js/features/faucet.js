import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { openModal, closeModal, triggerToast } from '../core/ui.js';

  // --- Crypto Faucet human verification ---

export const btnClaimFaucet = document.getElementById('btn-claim-faucet');
export let captchaTarget = [];
export let captchaInput = [];
export const captchaSymbols = ['⚡', '💎', '👑', '👾', '🛸', '🎮', '🍒', '🎲'];

// Secure True Time query (anti-system clock cheats)
export async function fetchTrueTime() {
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

export let cachedTrueTimeOffset = 0;
// We'll update the clock offset on startup
fetchTrueTime().then(trueMs => {
  cachedTrueTimeOffset = trueMs - Date.now();
});

export function getSecureNow() {
  return Date.now() + cachedTrueTimeOffset;
}

export function checkFaucetCooldown() {
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

export function setFaucetClaimActive(active) {
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

export function updateFaucetCooldownTimer(secondsLeft) {
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
  if (captchaInput.length >= 3) return;
  sfx.playCoin();
  captchaInput.push(sym);
  drawCaptchaInputDisplay();
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

export function executeFaucetClaim() {
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

