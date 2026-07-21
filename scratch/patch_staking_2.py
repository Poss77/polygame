import re

with open('c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/features/staking.js', 'r', encoding='utf-8') as f:
    code = f.read()

deposit_old = """document.getElementById('btn-staking-deposit').addEventListener('click', async () => {
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
  let finalApy = baseApy * multis.nftStakingBoost;
  
  // Apply 2x VIP Multiplier for new stakes
  if (appState.isVipActive()) {
    finalApy *= 2.0;
  }

  // --- Onsite Staking Only ---

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
});"""

deposit_new = """document.getElementById('btn-staking-deposit').addEventListener('click', async () => {
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
    const { data: res, error } = await supabase.rpc('deposit_stake', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_pool: pool,
      p_amount: amt,
      p_tier: activeStakingTier,
      p_apy: finalApy,
      p_duration_ms: durationMs
    });

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
});"""
code = code.replace(deposit_old, deposit_new)


harvest_all_old = """document.getElementById('btn-staking-harvest').addEventListener('click', () => {
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
  
  updates.totalStakingYield = (appState.state.totalStakingYield || 0) + totalInterest;

  appState.update(updates);
  sfx.playSuccess();
  triggerToast(`Harvested +${totalInterest.toFixed(4)} ${pool.toUpperCase()} rewards from all positions!`, 'success');
  appState.addActivity('You', `harvested all ${pool.toUpperCase()} staking yield`, `+${totalInterest.toFixed(2)} ${pool.toUpperCase()}`);
});"""

harvest_all_new = """document.getElementById('btn-staking-harvest').addEventListener('click', async () => {
  const pool = activeStakingPool;
  const isPgt = pool === 'pgt';
  if (!appState.state.walletConnected || !supabase) return;
  
  try {
    const { data: res, error } = await supabase.rpc('harvest_all_yield', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_pool: pool
    });
    
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
});"""
code = code.replace(harvest_all_old, harvest_all_new)


unstake_all_old = """document.getElementById('btn-staking-unstake').addEventListener('click', () => {
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
  let totalInterest = 0;
  maturedStakes.forEach(s => {
    totalPayback += s.amount + (s.interest || 0);
    totalInterest += s.interest || 0;
  });

  const updates = {
    stakes: stakes.filter(s => s.pool !== pool || (s.lockUntil && now < s.lockUntil))
  };

  if (isPgt) {
    updates.balancePgt = appState.state.balancePgt + totalPayback;
  } else {
    updates.balance1flr = appState.state.balance1flr + totalPayback;
  }
  
  updates.totalStakingYield = (appState.state.totalStakingYield || 0) + totalInterest;

  appState.update(updates);
  sfx.playError();
  triggerToast(`Unstaked ${maturedStakes.length} matured positions! (+${totalPayback.toFixed(2)} ${pool.toUpperCase()})`, 'success');
  appState.addActivity('You', `unstaked matured ${pool.toUpperCase()} positions`, `+${totalPayback.toFixed(2)} ${pool.toUpperCase()}`);
});"""

unstake_all_new = """document.getElementById('btn-staking-unstake').addEventListener('click', async () => {
  const pool = activeStakingPool;
  const isPgt = pool === 'pgt';
  if (!appState.state.walletConnected || !supabase) return;
  
  try {
    const { data: res, error } = await supabase.rpc('unstake_all_matured', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_pool: pool
    });
    
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
});"""
code = code.replace(unstake_all_old, unstake_all_new)

with open('c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/features/staking.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated deposit, harvest all, and unstake all")
