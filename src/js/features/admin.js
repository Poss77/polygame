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

    // Fetch and render game metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from('game_metrics')
      .select('*');
    
    const metricsTable = document.getElementById('admin-metrics-table');
    if (metricsTable) {
      if (metricsError || !metricsData || metricsData.length === 0) {
        metricsTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-dim);">No game metrics recorded yet.</td></tr>';
      } else {
        metricsTable.innerHTML = '';
        metricsData.forEach(metric => {
          const profit = (metric.total_wagered || 0) - (metric.total_payout || 0);
          const profitColor = profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)';
          
          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
          tr.innerHTML = `
            <td style="padding: 0.75rem; font-weight: 700;">${metric.game_name}</td>
            <td style="padding: 0.75rem;">${metric.total_wagered} PGT</td>
            <td style="padding: 0.75rem;">${metric.total_payout} PGT</td>
            <td style="padding: 0.75rem; font-weight: 700; color: ${profitColor};">${profit >= 0 ? '+' : ''}${profit} PGT</td>
          `;
          metricsTable.appendChild(tr);
        });
      }
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

      tr.innerHTML = `
        <td style="padding: 0.75rem 0.5rem; font-family: monospace; color: var(--color-accent);">${u.wallet_address.substring(0,6)}...${u.wallet_address.substring(38)}</td>
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

