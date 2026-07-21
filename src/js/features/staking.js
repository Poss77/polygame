import { TOKEN_CONTRACT_ADDRESS, TOKEN_1FLR_CONTRACT_ADDRESS, web3Provider, VAULT_RECEIVER_ADDRESS, supabase } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { getSecureNow } from './faucet.js';
import { cyb53, CHECKSUM_SALT } from './referrals.js';
import { appState } from '../core/state.js';
import { triggerToast } from '../core/ui.js';

// --- Staking Yield Accumulation Cycle ---

export let yieldInterval = null;
export let activeStakingPool = 'pgt';
export let activeStakingTier = 'day';

export function initStakingCycle() {
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
      yieldLabel.innerText = parseFloat(activeInterest || 0).toFixed(6);
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
export function switchStakingPool(pool) {
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
export function selectStakingTier(tier) {
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
export function updateStakingLockCountdownUI() {
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

export function renderStakingLedger() {
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
      <td style="padding: 0.75rem 0.5rem;">${parseFloat(stake.amount || 0).toFixed(2)} ${symbol}</td>
      <td style="padding: 0.75rem 0.5rem; color: var(--color-accent); font-weight: 700;">${parseFloat(stake.apy || 0).toFixed(2)}%</td>
      <td style="padding: 0.75rem 0.5rem;">${timeStr}</td>
      <td style="padding: 0.75rem 0.5rem; color: var(--color-primary); font-weight: 700;">${parseFloat(stake.interest || 0).toFixed(6)} ${symbol}</td>
      <td style="padding: 0.75rem 0.5rem; text-align: right;">
        <button class="btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right: 0.25rem; background: var(--color-primary); color: black; border: none; cursor: pointer;" onclick="harvestIndividualStake('${stake.id}')" ${stake.interest < 0.0001 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>Harvest</button>
        <button class="btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid var(--border-glass); cursor: pointer;" onclick="unstakeIndividualPosition('${stake.id}')">Unstake</button>
      </td>
    `;
    body.appendChild(row);
  });
}
window.renderStakingLedger = renderStakingLedger;

export async function harvestIndividualStake(id) {
  if (!appState.state.walletConnected || !supabase) return;
  const stakes = appState.state.stakes || [];
  const stake = stakes.find(s => s.id === id);
  if (!stake) return;

  const interest = stake.interest || 0;
  if (interest <= 0.0001) {
    triggerToast("No substantial yield accumulated yet", "error");
    return;
  }

  try {
    let { data: res, error } = await supabase.rpc('harvest_yield', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_stake_id: id
    });
    
    if (Array.isArray(res)) res = res[0];
    if (res && res.success) {
      const updates = { stakes: [...stakes] };
      const targetStake = updates.stakes.find(s => s.id === id);
      targetStake.interest = 0.0;
      targetStake.lastHarvest = Date.now();

      if (stake.pool === 'pgt') {
        updates.balancePgt = appState.state.balancePgt + res.yield;
      } else {
        updates.balance1flr = appState.state.balance1flr + res.yield;
      }
      updates.totalStakingYield = (appState.state.totalStakingYield || 0) + res.yield;
      appState.update(updates);
      sfx.playSuccess();
      triggerToast(`Harvested +${res.yield.toFixed(4)} ${stake.pool.toUpperCase()} rewards!`, 'success');
      appState.addActivity('You', `harvested stake position yield`, `+${res.yield.toFixed(2)} ${stake.pool.toUpperCase()}`);
    } else {
      triggerToast(error ? error.message : res.error, "error");
    }
  } catch(err) {
    console.error(err);
  }
}
window.harvestIndividualStake = harvestIndividualStake;

export async function unstakeIndividualPosition(id) {
  if (!appState.state.walletConnected || !supabase) return;
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

  try {
    let { data: res, error } = await supabase.rpc('unstake_position', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_stake_id: id
    });
    
    if (Array.isArray(res)) res = res[0];
    if (res && res.success) {
      const updates = { stakes: stakes.filter(s => s.id !== id) };
      if (stake.pool === 'pgt') {
        updates.balancePgt = appState.state.balancePgt + res.payback;
      } else {
        updates.balance1flr = appState.state.balance1flr + res.payback;
      }
      updates.totalStakingYield = (appState.state.totalStakingYield || 0) + res.yield;
      appState.update(updates);
      sfx.playError();
      triggerToast(`Unstaked position & yields! (+${res.payback.toFixed(2)} ${stake.pool.toUpperCase()})`, 'success');
      appState.addActivity('You', `withdrew staked ${stake.pool.toUpperCase()} position`, `+${res.payback.toFixed(2)} ${stake.pool.toUpperCase()}`);
    } else {
      triggerToast(error ? error.message : res.error, "error");
    }
  } catch (err) {
    console.error(err);
  }
}
window.unstakeIndividualPosition = unstakeIndividualPosition;

// Fast forward simulator
export async function fastForwardStakingLock() {
  if (!appState.state.walletConnected || !supabase) return;
  const pool = activeStakingPool;
  
  try {
    let { data: res } = await supabase.rpc('fast_forward_staking_locks', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_pool: pool
    });
    
    if (Array.isArray(res)) res = res[0];
    if (res && res.success) {
      const now = getSecureNow();
      const stakes = appState.state.stakes || [];
      const updates = {
        stakes: stakes.map(s => {
          if (s.pool === pool) return { ...s, lockUntil: now + 60000 };
          return s;
        })
      };
      appState.update(updates);
      sfx.playSuccess();
      triggerToast(`All active ${pool.toUpperCase()} positions fast-forwarded! Expiry in 60s.`, "success");
    }
  } catch(err) {
    console.error(err);
  }
}
window.fastForwardStakingLock = fastForwardStakingLock;

// Staking Deposit Actions
document.getElementById('btn-staking-deposit').addEventListener('click', async () => {
  const inputAmt = document.getElementById('staking-input-amount');
  if (!inputAmt || !appState.state.walletConnected || !supabase) {
    triggerToast("Wallet not connected", "error");
    return;
  }
  
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
  const balance = isPgt ? appState.state.balancePgt : appState.state.balance1flr;
  
  if (balance < amt) {
    triggerToast(`Insufficient ${pool.toUpperCase()} token balance`, "error");
    return;
  }

  const multis = appState.getMultipliers();
  const baseApy = activeStakingTier === 'day' ? 1.0 : (activeStakingTier === 'month' ? 2.0 : 3.0);
  let finalApy = baseApy * multis.nftStakingBoost;
  if (appState.isVipActive()) finalApy *= 2.0;

  let durationMs = 86400 * 1000;
  if (activeStakingTier === 'month') durationMs = 30 * 86400 * 1000;
  else if (activeStakingTier === 'year') durationMs = 365 * 86400 * 1000;

  try {
    let { data: res, error } = await supabase.rpc('deposit_stake', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_pool: pool,
      p_amount: amt,
      p_tier: activeStakingTier,
      p_apy: finalApy,
      p_duration_ms: durationMs
    });

    if (Array.isArray(res)) res = res[0];
    if (res && res.success) {
      const now = getSecureNow();
      const newStake = {
        id: res.stake_id,
        pool: pool,
        amount: amt,
        tier: activeStakingTier,
        apy: finalApy,
        stakedAt: now,
        lockUntil: now + durationMs,
        lastHarvest: now,
        interest: 0.0
      };
      
      const updates = { stakes: [...stakes, newStake] };
      if (isPgt) updates.balancePgt = balance - amt;
      else updates.balance1flr = balance - amt;
      
      appState.update(updates);
      inputAmt.value = '';
      sfx.playPowerUp();
      triggerToast(`Locked & Staked +${amt.toFixed(2)} ${pool.toUpperCase()}!`, 'success');
      appState.addActivity('You', `staked ${pool.toUpperCase()} tokens`, `-${amt.toFixed(2)} ${pool.toUpperCase()}`);
    } else {
      triggerToast(error ? error.message : res.error, "error");
    }
  } catch (err) {
    console.error(err);
  }
});

document.getElementById('btn-staking-harvest').addEventListener('click', async () => {
  const pool = activeStakingPool;
  const isPgt = pool === 'pgt';
  if (!appState.state.walletConnected || !supabase) return;
  
  try {
    let { data: res, error } = await supabase.rpc('harvest_all_yield', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_pool: pool
    });
    
    if (Array.isArray(res)) res = res[0];
    if (res && res.success && res.total_yield > 0) {
      const stakes = appState.state.stakes || [];
      const updates = {
        stakes: stakes.map(s => {
          if (s.pool === pool) return { ...s, interest: 0.0, lastHarvest: Date.now() };
          return s;
        })
      };
      
      if (isPgt) updates.balancePgt = appState.state.balancePgt + res.total_yield;
      else updates.balance1flr = appState.state.balance1flr + res.total_yield;
      
      updates.totalStakingYield = (appState.state.totalStakingYield || 0) + res.total_yield;
      appState.update(updates);
      sfx.playSuccess();
      triggerToast(`Harvested +${res.total_yield.toFixed(4)} ${pool.toUpperCase()} rewards from all positions!`, 'success');
      appState.addActivity('You', `harvested all ${pool.toUpperCase()} staking yield`, `+${res.total_yield.toFixed(2)} ${pool.toUpperCase()}`);
    } else {
      triggerToast(error ? error.message : "No substantial yield to harvest", "error");
    }
  } catch (err) {
    console.error(err);
  }
});

document.getElementById('btn-staking-unstake').addEventListener('click', async () => {
  const pool = activeStakingPool;
  const isPgt = pool === 'pgt';
  if (!appState.state.walletConnected || !supabase) return;
  
  try {
    let { data: res, error } = await supabase.rpc('unstake_all_matured', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_pool: pool
    });
    
    if (Array.isArray(res)) res = res[0];
    if (res && res.success && res.count > 0) {
      const now = getSecureNow();
      const stakes = appState.state.stakes || [];
      const updates = {
        stakes: stakes.filter(s => s.pool !== pool || (s.lockUntil && now < s.lockUntil))
      };
      
      if (isPgt) updates.balancePgt = appState.state.balancePgt + res.payback;
      else updates.balance1flr = appState.state.balance1flr + res.payback;
      
      appState.update(updates);
      sfx.playError();
      triggerToast(`Unstaked ${res.count} matured positions! (+${res.payback.toFixed(2)} ${pool.toUpperCase()})`, 'success');
      appState.addActivity('You', `unstaked matured ${pool.toUpperCase()} positions`, `+${res.payback.toFixed(2)} ${pool.toUpperCase()}`);
    } else {
      triggerToast(error ? error.message : "No matured stakes found.", "error");
    }
  } catch (err) {
    console.error(err);
  }
});

// Staking Max clickers
document.getElementById('staking-wallet-max').addEventListener('click', () => {
  const pool = activeStakingPool;
  let maxVal = pool === 'pgt' ? appState.state.balancePgt : appState.state.balance1flr;
  document.getElementById('staking-input-amount').value = Math.floor(maxVal);
  calculateStakingReward();
});
document.getElementById('staking-fill-half').addEventListener('click', () => {
  const pool = activeStakingPool;
  let maxVal = pool === 'pgt' ? appState.state.balancePgt : appState.state.balance1flr;
  document.getElementById('staking-input-amount').value = Math.floor(maxVal * 0.5);
  calculateStakingReward();
});

// Staking Reward calculator
export const stakeInput = document.getElementById('staking-input-amount');

export function calculateStakingReward() {
  const inputAmt = document.getElementById('staking-input-amount');
  const estReward = document.getElementById('calc-est-reward');
  const estTotal = document.getElementById('calc-est-total');
  if (!inputAmt || !estReward || !estTotal) return;

  const amt = parseFloat(inputAmt.value) || 0;
  
  const multis = appState.getMultipliers();
  const baseApy = activeStakingTier === 'day' ? 1.0 : (activeStakingTier === 'month' ? 2.0 : 3.0);
  let finalApy = baseApy * multis.nftStakingBoost;
  if (appState.isVipActive()) finalApy *= 2.0;
  
  const currentApy = finalApy / 100;
  
  let fraction = 1 / 365;
  if (activeStakingTier === 'month') fraction = 30 / 365;
  else if (activeStakingTier === 'year') fraction = 1.0;
  
  const interest = amt * currentApy * fraction;
  const tokenSymbol = activeStakingPool === 'pgt' ? 'PGT' : '1FLR';
  
  estReward.innerText = `${interest.toFixed(4)} ${tokenSymbol}`;
  estTotal.innerText = `${(amt + interest).toFixed(4)} ${tokenSymbol}`;
  
  // Dynamically update APY Breakdown labels based on selected tier
  const activeApyLabel = document.getElementById('staking-active-apy');
  const baseEl = document.getElementById('staking-breakdown-base');
  const nftEl = document.getElementById('staking-breakdown-nft');
  const finalEl = document.getElementById('staking-breakdown-final');
  
  if (activeApyLabel) activeApyLabel.innerText = `${finalApy.toFixed(2)}%`;
  if (baseEl) baseEl.innerText = `${baseApy.toFixed(1)}%`;
  if (nftEl) {
    const nftBonusAbsolute = baseApy * (multis.nftStakingBoost - 1.0);
    nftEl.innerText = `+${nftBonusAbsolute.toFixed(2)}%`;
  }
  if (finalEl) finalEl.innerText = `${finalApy.toFixed(2)}%`;
}

if (stakeInput) {
  stakeInput.addEventListener('input', calculateStakingReward);
}

