import { supabase } from '../core/config.js';

// --- Admin Panel Fetch and Render ---

export async function loadAdminData() {
  if (!supabase) return;
  const tableBody = document.getElementById('admin-users-table');
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-dim);">Loading global database...</td></tr>';

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('balance_pgt', { ascending: false });

    if (error) throw error;
    
    renderAdminPanel(users || []);
    updateTreasuryBalances();
    renderPolRevenueChart('day');

    // Fetch and render game metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from('game_metrics')
      .select('*');
    
    const casinoTable = document.getElementById('admin-casino-metrics-table');
    const arcadeTable = document.getElementById('admin-arcade-metrics-table');
    const faucetTable = document.getElementById('admin-faucet-metrics-table');
    
    // Aggregate user-level faucet stats
    let totalUserClaims = 0;
    let activeClaimersCount = 0;
    (users || []).forEach(u => {
      const claims = u.total_claims || 0;
      totalUserClaims += claims;
      if (claims > 0) activeClaimersCount++;
    });

    let faucetMetric = (metricsData || []).filter(m => m.game_name === 'Faucet')[0];
    let totalFaucetPayout = faucetMetric ? (faucetMetric.total_payout || 0) : (totalUserClaims * 50.0);
    let totalClaimsCount = faucetMetric ? Math.max(totalUserClaims, faucetMetric.total_wagered || 0) : totalUserClaims;

    const totalUsersCount = (users || []).length;
    const avgClaims = totalUsersCount > 0 ? (totalUserClaims / totalUsersCount).toFixed(1) : "0";

    if (faucetTable) {
      faucetTable.innerHTML = `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 0.75rem; font-weight: 700;">24-Hour PGT Faucet</td>
          <td style="padding: 0.75rem;">${totalClaimsCount} claims</td>
          <td style="padding: 0.75rem;">${activeClaimersCount} / ${totalUsersCount} players</td>
          <td style="padding: 0.75rem; color: var(--color-primary); font-weight: 700;">${totalFaucetPayout.toFixed(2)} PGT</td>
          <td style="padding: 0.75rem; font-weight: 700; color: var(--color-warning);">${avgClaims} claims/player</td>
        </tr>
      `;
    }
    
    if (casinoTable && arcadeTable) {
      if (metricsError || !metricsData || metricsData.length === 0) {
        casinoTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-dim);">No game metrics recorded yet.</td></tr>';
        arcadeTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-dim);">No game metrics recorded yet.</td></tr>';
      } else {
        casinoTable.innerHTML = '';
        arcadeTable.innerHTML = '';
        
        metricsData.forEach(metric => {
          const profit = (metric.total_wagered || 0) - (metric.total_payout || 0);
          const profitColor = profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)';
          
          let winPctStr = "";
          if (metric.total_wagered > 0) {
            const winPct = ((metric.total_payout || 0) / metric.total_wagered) * 100;
            winPctStr = ` (${winPct.toFixed(1)}%)`;
          }
          
          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
          
          // Check if it's an Arcade (Earn) game or Faucet
          if (metric.game_name === 'Faucet') {
            // Handled separately in faucetTable above
            return;
          } else if (metric.game_name === 'AstroDodge' || metric.game_name === 'Cyber Invaders' || metric.game_name === 'Cyber Drift') {
            let earnRate = "N/A";
            let playtimeStr = "0m";
            if (metric.total_playtime_seconds && metric.total_playtime_seconds > 0) {
              const minutes = metric.total_playtime_seconds / 60;
              playtimeStr = `${Math.floor(minutes)}m ${Math.floor(metric.total_playtime_seconds % 60)}s`;
              earnRate = ((metric.total_payout || 0) / minutes).toFixed(2);
            }
            
            tr.innerHTML = `
              <td style="padding: 0.75rem; font-weight: 700;">${metric.game_name}</td>
              <td style="padding: 0.75rem;">${playtimeStr}</td>
              <td style="padding: 0.75rem;">${metric.total_payout} PGT</td>
              <td style="padding: 0.75rem; font-weight: 700; color: var(--color-warning);">${earnRate}</td>
            `;
            arcadeTable.appendChild(tr);
          } else {
            // Casino (Bet) game
            tr.innerHTML = `
              <td style="padding: 0.75rem; font-weight: 700;">${metric.game_name}</td>
              <td style="padding: 0.75rem;">${metric.total_wagered} PGT</td>
              <td style="padding: 0.75rem;">${metric.total_payout} PGT</td>
              <td style="padding: 0.75rem; font-weight: 700; color: ${profitColor};">${profit >= 0 ? '+' : ''}${profit} PGT${winPctStr}</td>
            `;
            casinoTable.appendChild(tr);
          }
        });
      }
    }

    // Aggregate PolySpace metrics across all users
    let activePilots = 0;
    let totalFleetPower = 0;
    let totalIron = 0;
    let totalTit = 0;
    let totalQuant = 0;
    let totalRaids = 0;
    let sumWarpLvl = 0;

    (users || []).forEach(u => {
      if (u.space_state && typeof u.space_state === 'object') {
        const sp = u.space_state;
        activePilots++;
        totalFleetPower += (sp.fleetPower || 100);
        totalIron += (sp.iron || 0);
        totalTit += (sp.titanium || 0);
        totalQuant += (sp.quantum || 0);
        totalRaids += (sp.raidsWon || 0);
        sumWarpLvl += (sp.warpLevel || 1);
      }
    });

    const avgWarpLvl = activePilots > 0 ? (sumWarpLvl / activePilots).toFixed(1) : "1.0";
    const polyspaceTable = document.getElementById('admin-polyspace-metrics-table');
    if (polyspaceTable) {
      polyspaceTable.innerHTML = `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 0.75rem; font-weight: 700; color: var(--color-accent);">🚀 ${activePilots} Starships</td>
          <td style="padding: 0.75rem; font-weight: 800; color: var(--color-warning);">⚡ ${totalFleetPower.toLocaleString()} Power</td>
          <td style="padding: 0.75rem;">🪨 ${Math.floor(totalIron).toLocaleString()} Iron | 💎 ${Math.floor(totalTit).toLocaleString()} Tit | ✨ ${Math.floor(totalQuant).toLocaleString()} Quant</td>
          <td style="padding: 0.75rem; color: var(--color-danger); font-weight: 700;">⚔️ ${totalRaids} Raids Won</td>
          <td style="padding: 0.75rem; font-weight: 700;">Lvl ${avgWarpLvl} Warp Avg</td>
        </tr>
      `;
    }

    // Fetch and render daily metrics chart
    const { data: dailyMetrics, error: dailyError } = await supabase
      .from('game_metrics_daily')
      .select('*')
      .order('metric_date', { ascending: true });
      
    if (!dailyError && dailyMetrics && dailyMetrics.length > 0) {
      renderMetricsChart(dailyMetrics);
    }

    // Fetch and render global settings
    const { data: settingsData } = await supabase
      .from('global_settings')
      .select('earn_multiplier, site_message')
      .eq('id', 1)
      .single();
    
    if (settingsData) {
      if (settingsData.earn_multiplier !== undefined) {
        const inputEl = document.getElementById('admin-earn-multiplier');
        if (inputEl) inputEl.value = parseFloat(settingsData.earn_multiplier);
      }
      if (settingsData.site_message !== undefined) {
        const msgEl = document.getElementById('admin-site-message');
        if (msgEl) msgEl.value = settingsData.site_message;
      }
    }

  } catch (err) {
    console.error("Failed to fetch admin data:", err);
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--color-danger);">Failed to load data.</td></tr>';
  }
}

export function renderAdminPanel(users) {
  // Global Aggregates
  let totalUsers = users.length;
  let totalPgt = 0;
  let totalTvl = 0;
  let totalRefs = 0;
  let totalVips = 0;

  const tableBody = document.getElementById('admin-users-table');
  if (tableBody) tableBody.innerHTML = '';

  users.forEach(u => {
    totalPgt += (u.balance_pgt || 0);
    totalTvl += (u.staked_balance_pgt || 0);
    totalRefs += (u.referrals_count || 0);
    if (u.vip_until && new Date(u.vip_until).getTime() > Date.now()) {
      totalVips++;
    }

    // Build Row
    if (tableBody) {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      
      let nftsCount = 0;
      if (Array.isArray(u.owned_nfts)) nftsCount = u.owned_nfts.length;
      
      let stakesCount = 0;
      if (Array.isArray(u.stakes)) stakesCount = u.stakes.length;

      const shortAddr = `${u.wallet_address.substring(0,6)}...${u.wallet_address.substring(38)}`;
      const nameCol = u.username 
        ? `<strong style="color:var(--color-primary);">${u.username}</strong><br><span style="font-size:0.75rem; color:var(--text-dim);">${shortAddr}</span>`
        : `<span style="font-family: monospace; color: var(--color-accent);">${shortAddr}</span>`;

      tr.innerHTML = `
        <td style="padding: 0.75rem 0.5rem;">${nameCol}</td>
        <td style="padding: 0.75rem 0.5rem; color: var(--color-primary); font-weight: 700;">${(u.balance_pgt || 0).toFixed(2)}</td>
        <td style="padding: 0.75rem 0.5rem;">${u.game_highscore || 0}</td>
        <td style="padding: 0.75rem 0.5rem;">${nftsCount}</td>
        <td style="padding: 0.75rem 0.5rem;">${u.referrals_count || 0}</td>
        <td style="padding: 0.75rem 0.5rem;">${stakesCount}</td>
      `;
      tableBody.appendChild(tr);
    }
  });

  document.getElementById('admin-stat-users').innerText = totalUsers;
  document.getElementById('admin-stat-pgt').innerText = totalPgt.toFixed(2);
  document.getElementById('admin-stat-tvl').innerText = totalTvl.toFixed(2) + ' PGT';
  document.getElementById('admin-stat-refs').innerText = totalRefs;
  
  const vipsEl = document.getElementById('admin-stat-vips');
  const vipPolEl = document.getElementById('admin-stat-vip-pol');
  if (vipsEl) vipsEl.innerText = totalVips;
  if (vipPolEl) vipPolEl.innerText = (totalVips * 100) + ' POL';
}

// Update Global Settings
export async function updateGlobalSettings() {
  const { triggerToast } = await import('../core/ui.js?v=8');
  if (!supabase) return;
  const inputEl = document.getElementById('admin-earn-multiplier');
  if (!inputEl) return;
  
  const newVal = parseFloat(inputEl.value);
  if (isNaN(newVal) || newVal < 0) {
    triggerToast('Invalid multiplier value', 'error');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({ id: 1, earn_multiplier: newVal });
      
    if (error) throw error;
    
    triggerToast(`Global Earn Multiplier updated to ${newVal}x`, 'success');
    
    // Also update locally so admin doesn't need to refresh to feel effects
    if (window.appState) {
      window.appState.update({ globalEarnMultiplier: newVal });
    }
  } catch (err) {
    console.error("Failed to update global settings:", err);
    triggerToast('Failed to save settings', 'error');
  }
}
window.updateGlobalSettings = updateGlobalSettings;

// Update Site Message
export async function updateSiteMessage() {
  const { triggerToast } = await import('../core/ui.js?v=8');
  if (!supabase) return;
  const inputEl = document.getElementById('admin-site-message');
  if (!inputEl) return;
  
  const msg = inputEl.value;
  
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({ id: 1, site_message: msg });
      
    if (error) throw error;
    
    triggerToast('Site announcement updated successfully!', 'success');
    
    // Also update locally
    if (window.appState) {
      window.appState.update({ siteMessage: msg });
      
      // Update UI immediately
      const banner = document.getElementById('site-announcement-banner');
      const bannerText = document.getElementById('site-announcement-text');
      if (banner && bannerText) {
        if (msg.trim().length > 0) {
          bannerText.innerText = msg;
          banner.style.display = 'flex';
        } else {
          banner.style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.error("Failed to update site message:", err);
    triggerToast('Failed to update message', 'error');
  }
}
window.updateSiteMessage = updateSiteMessage;

export async function updateTreasuryBalances() {
  const { web3Provider, NFT_CONTRACT_ADDRESS, TOKEN_CONTRACT_ADDRESS } = await import('../core/config.js');
  
  if (!web3Provider) return;
  
  try {
    if (NFT_CONTRACT_ADDRESS && NFT_CONTRACT_ADDRESS.length === 42) {
      const balance = await web3Provider.getBalance(NFT_CONTRACT_ADDRESS);
      document.getElementById('admin-nft-balance').innerText = window.ethers.formatEther(balance) + " POL";
    }
    if (TOKEN_CONTRACT_ADDRESS && TOKEN_CONTRACT_ADDRESS.length === 42) {
      const balance = await web3Provider.getBalance(TOKEN_CONTRACT_ADDRESS);
      document.getElementById('admin-token-balance').innerText = window.ethers.formatEther(balance) + " POL";
    }
  } catch (e) {
    console.error("Failed to fetch treasury balances:", e);
  }
}

export async function withdrawNFTTreasury() {
  const { realSigner, NFT_CONTRACT_ADDRESS } = await import('../core/config.js');
  const { triggerToast } = await import('../core/ui.js?v=8');

  if (!realSigner) { triggerToast("Admin wallet not connected.", "error"); return; }
  if (!NFT_CONTRACT_ADDRESS || NFT_CONTRACT_ADDRESS.length !== 42) return;

  try {
    triggerToast("Initiating NFT Treasury Withdrawal...", "success");
    const nftContract = new window.ethers.Contract(NFT_CONTRACT_ADDRESS, ["function withdrawFunds() external"], realSigner);
    const tx = await nftContract.withdrawFunds();
    triggerToast("Withdrawal pending on-chain...", "success");
    await tx.wait();
    triggerToast("Successfully swept NFT revenue to Admin Wallet!", "success");
    updateTreasuryBalances();
  } catch (err) {
    console.error("Treasury withdrawal failed:", err);
    triggerToast("Withdrawal failed: " + (err.reason || err.message), "error");
  }
}

export async function withdrawTokenTreasury() {
  const { realSigner, TOKEN_CONTRACT_ADDRESS } = await import('../core/config.js');
  const { triggerToast } = await import('../core/ui.js?v=8');

  if (!realSigner) { triggerToast("Admin wallet not connected.", "error"); return; }
  if (!TOKEN_CONTRACT_ADDRESS || TOKEN_CONTRACT_ADDRESS.length !== 42) return;

  try {
    triggerToast("Initiating Token Fee Withdrawal...", "success");
    const tokenContract = new window.ethers.Contract(TOKEN_CONTRACT_ADDRESS, ["function withdrawFunds() external"], realSigner);
    const tx = await tokenContract.withdrawFunds();
    triggerToast("Withdrawal pending on-chain...", "success");
    await tx.wait();
    triggerToast("Successfully swept Token fees to Admin Wallet!", "success");
    updateTreasuryBalances();
  } catch (err) {
    console.error("Treasury withdrawal failed:", err);
    triggerToast("Withdrawal failed: " + (err.reason || err.message), "error");
  }
}

window.withdrawNFTTreasury = withdrawNFTTreasury;
window.withdrawTokenTreasury = withdrawTokenTreasury;

// --- Chart Rendering ---
let adminMetricsChartInstance = null;

function renderMetricsChart(dailyData) {
  const ctx = document.getElementById('admin-metrics-chart');
  if (!ctx || !window.Chart) return;
  
  // Group by date, then by game
  const datesSet = new Set();
  const gameData = {};
  
  dailyData.forEach(d => {
    datesSet.add(d.metric_date);
    if (!gameData[d.game_name]) gameData[d.game_name] = {};
    const profit = (d.total_wagered || 0) - (d.total_payout || 0);
    gameData[d.game_name][d.metric_date] = profit;
  });
  
  const dates = Array.from(datesSet).sort(); // Sort chronologically
  
  // Generate datasets
  const colors = [
    '#00ffaa', // primary
    '#ff3366', // danger
    '#ffd700', // warning
    '#00d4ff', // accent
    '#ff66ff'
  ];
  
  const datasets = Object.keys(gameData).map((gameName, index) => {
    const color = colors[index % colors.length];
    return {
      label: gameName,
      data: dates.map(date => gameData[gameName][date] || 0),
      borderColor: color,
      backgroundColor: color + '33', // 20% opacity
      tension: 0.3,
      fill: true
    };
  });
  
  if (adminMetricsChartInstance) {
    adminMetricsChartInstance.destroy();
  }
  
  window.Chart.defaults.color = '#8e96a3'; // text-muted
  window.Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  
  adminMetricsChartInstance = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'House Net Profit (Daily)',
          color: '#00ffaa'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

let polChartInstance = null;

export async function renderPolRevenueChart(timeframe = 'day') {
  const canvas = document.getElementById('admin-pol-chart');
  if (!canvas || !window.Chart) return;

  ['day', 'week', 'month', 'year'].forEach(tf => {
    const btn = document.getElementById(`btn-pol-tf-${tf}`);
    if (btn) {
      if (tf === timeframe) {
        btn.style.background = 'var(--color-warning)';
        btn.style.color = '#000';
        btn.style.fontWeight = '700';
      } else {
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.color = 'var(--text-muted)';
        btn.style.fontWeight = 'normal';
      }
    }
  });

  const labels = [];
  const chartData = [];
  const now = new Date();

  if (timeframe === 'day') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      labels.push(`${d.getHours()}:00`);
      chartData.push(0);
    }
  } else if (timeframe === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
      chartData.push(0);
    }
  } else if (timeframe === 'month') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      chartData.push(0);
    }
  } else if (timeframe === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString('default', { month: 'short' }));
      chartData.push(0);
    }
  }

  if (supabase) {
    try {
      const { data: users } = await supabase.from('users').select('activities');
      if (users) {
        users.forEach(u => {
          if (Array.isArray(u.activities)) {
            u.activities.forEach(act => {
              if (act.val && act.val.includes('POL')) {
                const polVal = Math.abs(parseFloat(act.val.replace(/[^0-9.]/g, '')));
                if (!isNaN(polVal) && polVal > 0 && chartData.length > 0) {
                  chartData[chartData.length - 1] += polVal;
                }
              }
            });
          }
        });
      }
    } catch(e) {}
  }

  if (polChartInstance) {
    polChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 180);
  gradient.addColorStop(0, 'rgba(255, 170, 0, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 170, 0, 0.0)');

  polChartInstance = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'POL Revenue',
        data: chartData,
        backgroundColor: gradient,
        borderColor: '#ffaa00',
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` POL Revenue: ${context.parsed.y.toFixed(2)} POL`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#8a99ad', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#8a99ad',
            font: { size: 10 },
            callback: (val) => val.toFixed(1) + ' POL'
          }
        }
      }
    }
  });
}

window.switchPolTimeframe = (tf) => renderPolRevenueChart(tf);

