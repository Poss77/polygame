import re

with open('c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/features/staking.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update Imports
code = code.replace("import { TOKEN_CONTRACT_ADDRESS, TOKEN_1FLR_CONTRACT_ADDRESS, web3Provider, VAULT_RECEIVER_ADDRESS } from '../core/config.js';",
                    "import { TOKEN_CONTRACT_ADDRESS, TOKEN_1FLR_CONTRACT_ADDRESS, web3Provider, VAULT_RECEIVER_ADDRESS, supabase } from '../core/config.js';")

# 2. harvestIndividualStake
harvest_old = """export function harvestIndividualStake(id) {
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
  
  updates.totalStakingYield = (appState.state.totalStakingYield || 0) + interest;

  appState.update(updates);
  sfx.playSuccess();
  triggerToast(`Harvested +${interest.toFixed(4)} ${stake.pool.toUpperCase()} rewards!`, 'success');
  appState.addActivity('You', `harvested stake position yield`, `+${interest.toFixed(2)} ${stake.pool.toUpperCase()}`);
}"""

harvest_new = """export async function harvestIndividualStake(id) {
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
    const { data: res, error } = await supabase.rpc('harvest_yield', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_stake_id: id
    });
    
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
}"""
code = code.replace(harvest_old, harvest_new)

# 3. unstakeIndividualPosition
unstake_old = """export function unstakeIndividualPosition(id) {
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
  
  updates.totalStakingYield = (appState.state.totalStakingYield || 0) + interest;

  appState.update(updates);
  sfx.playError();
  triggerToast(`Unstaked position & yields! (+${totalPayback.toFixed(2)} ${stake.pool.toUpperCase()})`, 'success');
  appState.addActivity('You', `withdrew staked ${stake.pool.toUpperCase()} position`, `+${totalPayback.toFixed(2)} ${stake.pool.toUpperCase()}`);
}"""

unstake_new = """export async function unstakeIndividualPosition(id) {
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
    const { data: res, error } = await supabase.rpc('unstake_position', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_stake_id: id
    });
    
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
}"""
code = code.replace(unstake_old, unstake_new)

# 4. fastForwardStakingLock
fast_old = """export function fastForwardStakingLock() {
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
}"""

fast_new = """export async function fastForwardStakingLock() {
  if (!appState.state.walletConnected || !supabase) return;
  const pool = activeStakingPool;
  
  try {
    const { data: res } = await supabase.rpc('fast_forward_staking_locks', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_pool: pool
    });
    
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
}"""
code = code.replace(fast_old, fast_new)

with open('c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/features/staking.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated harvest, unstake, and fastforward")
