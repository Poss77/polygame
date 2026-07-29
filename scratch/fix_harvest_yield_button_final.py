import re

# 1. Update src/js/features/staking.js
with open('src/js/features/staking.js', 'r', encoding='utf-8') as f:
    code = f.read()

target_harvest_listener = '''const btnHarvest = document.getElementById('btn-staking-harvest');
if (btnHarvest) {
  btnHarvest.addEventListener('click', async () => {
    if (btnHarvest.disabled) return;
    const pool = activeStakingPool;
    const isPgt = pool === 'pgt';
    const stakes = appState.state.stakes || [];
    const poolStakes = stakes.filter(s => s.pool === pool);

    if (poolStakes.length === 0) {
      triggerToast("No active stakes in this pool", "error");
      return;
    }

    // Calculate total pending yield locally
    let totalPending = 0;
    poolStakes.forEach(s => {
      totalPending += (s.interest || 0);
    });

    if (totalPending <= 0.0001) {
      triggerToast("No substantial yield to harvest", "error");
      return;
    }

    btnHarvest.disabled = true;
    const origText = btnHarvest.innerText;
    btnHarvest.innerText = 'Harvesting...';

    try {
      // 1. Web3 Connected Mode
      if (appState.state.walletConnected && supabase) {
        let { data: res, error } = await supabase.rpc('harvest_all_yield', {
          p_wallet: appState.state.walletAddress.toLowerCase(),
          p_pool: pool
        });
        
        if (Array.isArray(res)) res = res[0];
        if (res && res.success && res.total_yield > 0) {
          const harvestedAmt = res.total_yield;
          const updates = {
            stakes: stakes.map(s => {
              if (s.pool === pool) return { ...s, interest: 0.0, lastHarvest: Date.now() };
              return s;
            })
          };

          if (isPgt) {
            updates.balancePgt = (appState.state.balancePgt || 0) + harvestedAmt;
            supabase.rpc('process_referral_commissions', {
              claiming_wallet: appState.state.walletAddress.toLowerCase(),
              claim_amount: harvestedAmt
            }).catch(() => {});
          } else {
            updates.balance1flr = (appState.state.balance1flr || 0) + harvestedAmt;
          }

          updates.totalStakingYield = (appState.state.totalStakingYield || 0) + harvestedAmt;
          appState.addActivity('You', `harvested all ${pool.toUpperCase()} staking yield`, `+${harvestedAmt.toFixed(2)} ${pool.toUpperCase()}`);
          appState.update(updates);
          renderStakingLedger();

          sfx.playSuccess();
          triggerToast(`Harvested +${harvestedAmt.toFixed(4)} ${pool.toUpperCase()} rewards from all positions!`, 'success');
          return;
        }
      }

      // 2. Local Fallback / Guest Mode Harvest All
      const updates = {
        stakes: stakes.map(s => {
          if (s.pool === pool) return { ...s, interest: 0.0, lastHarvest: Date.now() };
          return s;
        })
      };

      if (isPgt) {
        updates.balancePgt = (appState.state.balancePgt || 0) + totalPending;
      } else {
        updates.balance1flr = (appState.state.balance1flr || 0) + totalPending;
      }

      updates.totalStakingYield = (appState.state.totalStakingYield || 0) + totalPending;
      appState.addActivity('You', `harvested all ${pool.toUpperCase()} staking yield`, `+${totalPending.toFixed(2)} ${pool.toUpperCase()}`);
      appState.update(updates);
      renderStakingLedger();

      sfx.playSuccess();
      triggerToast(`Harvested +${totalPending.toFixed(4)} ${pool.toUpperCase()} rewards from all positions!`, 'success');
    } catch (err) {
      console.error(err);
      triggerToast("Harvest failed: " + (err.message || err), "error");
    } finally {
      btnHarvest.disabled = false;
      btnHarvest.innerText = origText;
    }
  });
}'''

replacement_harvest_listener = '''export async function harvestAllYield() {
  const btnHarvest = document.getElementById('btn-staking-harvest');
  if (btnHarvest && btnHarvest.disabled) return;
  
  const origText = btnHarvest ? btnHarvest.innerText : 'Harvest Yield';
  if (btnHarvest) {
    btnHarvest.disabled = true;
    btnHarvest.innerText = 'Harvesting...';
  }

  try {
    const stakes = appState.state.stakes || [];
    if (stakes.length === 0) {
      triggerToast("No active stakes to harvest", "error");
      return;
    }

    // Calculate real-time pending yield across all positions
    const nowMs = Date.now();
    let totalPending = 0;
    stakes.forEach(s => {
      const lastH = s.lastHarvest || s.createdAt || nowMs;
      const elapsedSec = Math.max(0, (nowMs - lastH) / 1000);
      const apy = s.apy || 1.0;
      const amount = parseFloat(s.amount || 0);
      const calcYield = (amount * (apy / 100.0) * (elapsedSec / 31536000.0));
      totalPending += Math.max(calcYield, parseFloat(s.interest || 0));
    });

    if (totalPending <= 0.000001) {
      triggerToast("No substantial yield accumulated yet", "error");
      return;
    }

    // 1. Web3 Connected Mode via Supabase RPC
    if (appState.state.walletConnected && supabase) {
      try {
        let { data: res, error } = await supabase.rpc('harvest_all_yield', {
          p_wallet: appState.state.walletAddress.toLowerCase(),
          p_pool: 'pgt'
        });
        
        if (Array.isArray(res)) res = res[0];
        if (res && res.success && res.total_yield > 0) {
          const harvestedAmt = parseFloat(res.total_yield);
          const updates = {
            stakes: stakes.map(s => ({ ...s, interest: 0.0, lastHarvest: nowMs }))
          };

          updates.balancePgt = (appState.state.balancePgt || 0) + harvestedAmt;
          updates.totalStakingYield = (appState.state.totalStakingYield || 0) + harvestedAmt;
          
          supabase.rpc('process_referral_commissions', {
            claiming_wallet: appState.state.walletAddress.toLowerCase(),
            claim_amount: harvestedAmt
          }).catch(() => {});

          appState.addActivity('You', `harvested all staking yield`, `+${harvestedAmt.toFixed(2)} PGT`);
          appState.update(updates);
          renderStakingLedger();

          sfx.playSuccess();
          triggerToast(`Harvested +${harvestedAmt.toFixed(4)} PGT rewards from all positions!`, 'success');
          return;
        }
      } catch (err) {
        console.warn("DB harvest_all_yield RPC error, using local fallback...", err);
      }
    }

    // 2. Fallback / Local Mode Harvest All
    const updates = {
      stakes: stakes.map(s => ({ ...s, interest: 0.0, lastHarvest: nowMs }))
    };
    updates.balancePgt = (appState.state.balancePgt || 0) + totalPending;
    updates.totalStakingYield = (appState.state.totalStakingYield || 0) + totalPending;
    
    appState.addActivity('You', `harvested all staking yield`, `+${totalPending.toFixed(2)} PGT`);
    appState.update(updates);
    renderStakingLedger();

    sfx.playSuccess();
    triggerToast(`Harvested +${totalPending.toFixed(4)} PGT rewards from all positions!`, 'success');

  } catch (err) {
    console.error("Harvest all error:", err);
    triggerToast("Harvest failed: " + (err.message || err), "error");
  } finally {
    if (btnHarvest) {
      btnHarvest.disabled = false;
      btnHarvest.innerText = origText;
    }
  }
}
window.harvestAllYield = harvestAllYield;

const btnHarvest = document.getElementById('btn-staking-harvest');
if (btnHarvest) {
  btnHarvest.addEventListener('click', harvestAllYield);
}'''

if target_harvest_listener in code:
    code = code.replace(target_harvest_listener, replacement_harvest_listener)
    with open('src/js/features/staking.js', 'w', encoding='utf-8') as f:
        f.write(code)
    print('Successfully updated harvestAllYield in staking.js')
else:
    print('target_harvest_listener not found in staking.js')

# 2. Update index.html to add onclick="harvestAllYield()" directly to button
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

target_btn_html = '<button class="btn-primary" style="flex: 1; background: var(--color-accent); color: var(--bg-darkest);" id="btn-staking-harvest">Harvest Yield</button>'
replacement_btn_html = '<button class="btn-primary" style="flex: 1; background: var(--color-accent); color: var(--bg-darkest);" id="btn-staking-harvest" onclick="harvestAllYield()">Harvest Yield</button>'

if target_btn_html in html:
    html = html.replace(target_btn_html, replacement_btn_html)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('Successfully added onclick="harvestAllYield()" to index.html')
else:
    print('target_btn_html not found in index.html')
