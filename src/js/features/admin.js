import { supabase, TOKEN_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS } from '../core/config.js';

// --- Admin Panel Fetch and Render ---

export async function loadAdminData() {
  if (!supabase) return;
  const tableBody = document.getElementById('admin-users-table');
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-dim);">Loading global database...</td></tr>';

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
            const totalPayout = metric.total_payout != null ? parseFloat(metric.total_payout) : 0;
            const totalPlaytime = metric.total_playtime_seconds != null ? parseFloat(metric.total_playtime_seconds) : 0;

            if (totalPlaytime > 0) {
              const minutes = totalPlaytime / 60;
              playtimeStr = `${Math.floor(minutes)}m ${Math.floor(totalPlaytime % 60)}s`;
              earnRate = (totalPayout / minutes).toFixed(2) + " PGT/min";
            }
            
            tr.innerHTML = `
              <td style="padding: 0.75rem; font-weight: 700;">${metric.game_name}</td>
              <td style="padding: 0.75rem;">${playtimeStr}</td>
              <td style="padding: 0.75rem; color: var(--color-primary); font-weight: 700;">${totalPayout.toFixed(2)} PGT</td>
              <td style="padding: 0.75rem; font-weight: 700; color: var(--color-warning);">${earnRate}</td>
            `;
            arcadeTable.appendChild(tr);
          } else {
            // Casino (Bet) game
            const totalWagered = metric.total_wagered != null ? parseFloat(metric.total_wagered) : 0;
            const totalPayout = metric.total_payout != null ? parseFloat(metric.total_payout) : 0;
            const profit = totalWagered - totalPayout;
            const profitColor = profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)';
            
            let winPctStr = "";
            if (totalWagered > 0) {
              const winPct = (totalPayout / totalWagered) * 100;
              winPctStr = ` (${winPct.toFixed(1)}%)`;
            }

            tr.innerHTML = `
              <td style="padding: 0.75rem; font-weight: 700;">${metric.game_name}</td>
              <td style="padding: 0.75rem;">${totalWagered.toFixed(2)} PGT</td>
              <td style="padding: 0.75rem;">${totalPayout.toFixed(2)} PGT</td>
              <td style="padding: 0.75rem; font-weight: 700; color: ${profitColor};">${profit >= 0 ? '+' : ''}${profit.toFixed(2)} PGT${winPctStr}</td>
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
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--color-danger);">Failed to load data.</td></tr>';
  }
}

// State for Player Database Ledger table
let cachedAdminUsers = [];
let currentSortColumn = 'balance_pgt';
let currentSortOrder = 'desc';
let currentAdminPage = 1;
const ADMIN_PAGE_SIZE = 10;
let tableListenersAttached = false;

export function renderAdminPanel(users) {
  if (users) {
    cachedAdminUsers = users;
  }

  const allUsers = cachedAdminUsers || [];
  
  // Calculate Global Aggregate Stats across ALL users
  let totalUsers = allUsers.length;
  let totalPgt = 0;
  let totalTvl = 0;
  let totalRefs = 0;
  let totalVips = 0;

  allUsers.forEach(u => {
    totalPgt += (u.balance_pgt || 0);
    totalTvl += (u.staked_balance_pgt || 0);
    totalRefs += (u.referrals_count || 0);
    if (u.vip_until && new Date(u.vip_until).getTime() > Date.now()) {
      totalVips++;
    }
  });

  const usersEl = document.getElementById('admin-stat-users');
  const pgtEl = document.getElementById('admin-stat-pgt');
  const tvlEl = document.getElementById('admin-stat-tvl');
  const refsEl = document.getElementById('admin-stat-refs');
  const vipsEl = document.getElementById('admin-stat-vips');
  const vipPolEl = document.getElementById('admin-stat-vip-pol');

  if (usersEl) usersEl.innerText = totalUsers;
  if (pgtEl) pgtEl.innerText = totalPgt.toFixed(2);
  if (tvlEl) tvlEl.innerText = totalTvl.toFixed(2) + ' PGT';
  if (refsEl) refsEl.innerText = totalRefs;
  if (vipsEl) vipsEl.innerText = totalVips;
  if (vipPolEl) vipPolEl.innerText = (totalVips * 100) + ' POL';

  // Attach header sort click handlers if not yet attached
  attachAdminTableListeners();

  // Update header sort icons
  updateSortIcons();

  // Sort Users Array
  const sortedUsers = [...allUsers].sort((a, b) => {
    let valA, valB;

    switch (currentSortColumn) {
      case 'player':
        valA = (a.username || a.wallet_address || '').toLowerCase();
        valB = (b.username || b.wallet_address || '').toLowerCase();
        break;
      case 'balance_pgt':
        valA = a.balance_pgt || 0;
        valB = b.balance_pgt || 0;
        break;
      case 'staked_balance_pgt':
        valA = a.staked_balance_pgt || 0;
        valB = b.staked_balance_pgt || 0;
        break;
      case 'vip':
        valA = (a.vip_until && new Date(a.vip_until).getTime() > Date.now()) ? new Date(a.vip_until).getTime() : 0;
        valB = (b.vip_until && new Date(b.vip_until).getTime() > Date.now()) ? new Date(b.vip_until).getTime() : 0;
        break;
      case 'owned_nfts':
        valA = Array.isArray(a.owned_nfts) ? a.owned_nfts.length : 0;
        valB = Array.isArray(b.owned_nfts) ? b.owned_nfts.length : 0;
        break;
      case 'referrals_count':
        valA = a.referrals_count || 0;
        valB = b.referrals_count || 0;
        break;
      case 'stakes':
        valA = Array.isArray(a.stakes) ? a.stakes.length : 0;
        valB = Array.isArray(b.stakes) ? b.stakes.length : 0;
        break;
      case 'arcade':
        valA = Math.max(a.game_highscore || 0, a.invaders_highscore || 0, a.drift_highscore || 0);
        valB = Math.max(b.game_highscore || 0, b.invaders_highscore || 0, b.drift_highscore || 0);
        break;
      default:
        valA = a.balance_pgt || 0;
        valB = b.balance_pgt || 0;
    }

    if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate Pagination
  const totalPages = Math.ceil(sortedUsers.length / ADMIN_PAGE_SIZE) || 1;
  if (currentAdminPage > totalPages) currentAdminPage = totalPages;
  if (currentAdminPage < 1) currentAdminPage = 1;

  const startIndex = (currentAdminPage - 1) * ADMIN_PAGE_SIZE;
  const pageUsers = sortedUsers.slice(startIndex, startIndex + ADMIN_PAGE_SIZE);

  // Render Table Body
  const tableBody = document.getElementById('admin-users-table');
  if (tableBody) {
    tableBody.innerHTML = '';
    if (pageUsers.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-dim);">No player records found.</td></tr>';
    } else {
      pageUsers.forEach(u => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

        let nftsCount = Array.isArray(u.owned_nfts) ? u.owned_nfts.length : 0;
        let stakesCount = Array.isArray(u.stakes) ? u.stakes.length : 0;

        const shortAddr = u.wallet_address ? `${u.wallet_address.substring(0,6)}...${u.wallet_address.substring(38)}` : 'N/A';
        const nameCol = u.username 
          ? `<strong style="color:var(--color-primary);">${u.username}</strong><br><span style="font-size:0.75rem; color:var(--text-dim);">${shortAddr}</span>`
          : `<span style="font-family: monospace; color: var(--color-accent);">${shortAddr}</span>`;

        const isVip = u.vip_until && new Date(u.vip_until).getTime() > Date.now();
        const vipCol = isVip
          ? `<span style="background: rgba(255,215,0,0.15); color: #ffd700; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem; border: 1px solid rgba(255,215,0,0.3);">👑 VIP</span>`
          : `<span style="color: var(--text-dim); font-size: 0.8rem;">Standard</span>`;

        const dodgeScore = u.game_highscore || 0;
        const invScore = u.invaders_highscore || 0;
        const driftScore = u.drift_highscore || 0;
        const arcadeSummary = `<span style="font-size: 0.75rem; color: var(--text-muted);" title="Dodge: ${dodgeScore} | Invaders: ${invScore} | Drift: ${driftScore}">⚡ ${dodgeScore} | 👾 ${invScore} | 🏎️ ${driftScore}</span>`;

        tr.innerHTML = `
          <td style="padding: 0.75rem 0.5rem;">${nameCol}</td>
          <td style="padding: 0.75rem 0.5rem; color: var(--color-primary); font-weight: 700;">${(u.balance_pgt || 0).toFixed(2)}</td>
          <td style="padding: 0.75rem 0.5rem; color: var(--color-accent); font-weight: 700;">${(u.staked_balance_pgt || 0).toFixed(2)}</td>
          <td style="padding: 0.75rem 0.5rem;">${vipCol}</td>
          <td style="padding: 0.75rem 0.5rem;">${nftsCount}</td>
          <td style="padding: 0.75rem 0.5rem;">${u.referrals_count || 0}</td>
          <td style="padding: 0.75rem 0.5rem;">${stakesCount}</td>
          <td style="padding: 0.75rem 0.5rem;">${arcadeSummary}</td>
        `;
        tableBody.appendChild(tr);
      });
    }
  }

  // Render Pagination Controls
  renderPaginationControls(sortedUsers.length, totalPages);
}

function updateSortIcons() {
  const columns = ['player', 'balance_pgt', 'staked_balance_pgt', 'vip', 'owned_nfts', 'referrals_count', 'stakes', 'arcade'];
  columns.forEach(col => {
    const iconEl = document.getElementById(`sort-icon-${col}`);
    if (iconEl) {
      if (col === currentSortColumn) {
        iconEl.innerText = currentSortOrder === 'asc' ? '▲' : '▼';
        iconEl.style.color = 'var(--color-primary)';
      } else {
        iconEl.innerText = '↕';
        iconEl.style.color = 'var(--text-dim)';
      }
    }
  });
}

function attachAdminTableListeners() {
  if (tableListenersAttached) return;
  tableListenersAttached = true;

  const headers = document.querySelectorAll('.admin-sort-header');
  headers.forEach(h => {
    h.addEventListener('click', () => {
      const col = h.getAttribute('data-sort');
      if (!col) return;
      if (currentSortColumn === col) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortColumn = col;
        currentSortOrder = (col === 'player') ? 'asc' : 'desc';
      }
      currentAdminPage = 1; // Reset to page 1 on sort change
      renderAdminPanel();
    });
  });
}

function renderPaginationControls(totalRecords, totalPages) {
  const infoEl = document.getElementById('admin-users-pagination-info');
  const btnsEl = document.getElementById('admin-users-pagination-btns');
  if (!infoEl || !btnsEl) return;

  if (totalRecords === 0) {
    infoEl.innerText = 'Showing 0 of 0 players';
    btnsEl.innerHTML = '';
    return;
  }

  const startRecord = (currentAdminPage - 1) * ADMIN_PAGE_SIZE + 1;
  const endRecord = Math.min(currentAdminPage * ADMIN_PAGE_SIZE, totalRecords);
  infoEl.innerText = `Showing ${startRecord}-${endRecord} of ${totalRecords} players`;

  btnsEl.innerHTML = '';

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-secondary';
  prevBtn.style.cssText = 'padding: 0.25rem 0.6rem; font-size: 0.8rem; line-height: 1; margin-right: 0.3rem;';
  prevBtn.innerText = '◀ Prev';
  prevBtn.disabled = currentAdminPage === 1;
  prevBtn.onclick = () => {
    if (currentAdminPage > 1) {
      currentAdminPage--;
      renderAdminPanel();
    }
  };
  btnsEl.appendChild(prevBtn);

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && Math.abs(i - currentAdminPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === 2 || i === totalPages - 1) {
        const dots = document.createElement('span');
        dots.innerText = '...';
        dots.style.cssText = 'padding: 0 0.2rem; color: var(--text-dim); font-size: 0.8rem;';
        btnsEl.appendChild(dots);
      }
      continue;
    }

    const pageBtn = document.createElement('button');
    pageBtn.className = i === currentAdminPage ? 'btn btn-primary' : 'btn btn-secondary';
    pageBtn.style.cssText = 'padding: 0.25rem 0.5rem; font-size: 0.8rem; line-height: 1; min-width: 28px; margin: 0 0.1rem;';
    pageBtn.innerText = i.toString();
    pageBtn.onclick = () => {
      currentAdminPage = i;
      renderAdminPanel();
    };
    btnsEl.appendChild(pageBtn);
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-secondary';
  nextBtn.style.cssText = 'padding: 0.25rem 0.6rem; font-size: 0.8rem; line-height: 1; margin-left: 0.3rem;';
  nextBtn.innerText = 'Next ▶';
  nextBtn.disabled = currentAdminPage === totalPages;
  nextBtn.onclick = () => {
    if (currentAdminPage < totalPages) {
      currentAdminPage++;
      renderAdminPanel();
    }
  };
  btnsEl.appendChild(nextBtn);
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

// --- Helper to ensure MetaMask is connected to Polygon Mainnet (Chain ID 137 / 0x89) ---
async function ensurePolygonNetwork() {
  if (!window.ethereum) return;
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== '0x89' && chainId !== '137' && chainId !== '0x89') {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x89',
              chainName: 'Polygon Mainnet',
              nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
              rpcUrls: ['https://polygon-rpc.com/'],
              blockExplorerUrls: ['https://polygonscan.com/']
            }],
          });
        }
      }
    }
  } catch (err) {
    console.warn("Chain switch check:", err);
  }
}

// --- Master Admin Liquidity Pool Minting ---
export async function mintLiquidityPoolPGT() {
  const amountInput = document.getElementById('admin-mint-amount');
  const amount = amountInput ? parseFloat(amountInput.value) : 10000000;

  if (isNaN(amount) || amount <= 0) {
    if (window.triggerToast) window.triggerToast("Please enter a valid PGT amount to mint!", "error");
    return;
  }

  if (!window.ethereum) {
    if (window.triggerToast) window.triggerToast("MetaMask / Web3 Wallet not found! Please install MetaMask extension.", "error");
    return;
  }

  if (typeof window.ethers === 'undefined') {
    if (window.triggerToast) window.triggerToast("Ethers.js library not loaded!", "error");
    return;
  }

  try {
    // 1. Switch to Polygon Mainnet if needed
    await ensurePolygonNetwork();

    // 2. Request accounts from MetaMask
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

    if (userAddress.toLowerCase() !== "0x10b9993990c9ef8a212c9557cb02ad94da9a654d") {
      if (window.triggerToast) window.triggerToast(`Unauthorized: MetaMask connected to ${userAddress.substring(0,6)}... Master Admin Wallet (0x10B9...654d) required!`, "error");
      return;
    }

    if (window.triggerToast) window.triggerToast("Opening MetaMask to confirm On-Chain PGT Token Minting...", "info");

    const tokenAddress = TOKEN_CONTRACT_ADDRESS || "0x701100D19b1a93672cfe7291EA455b4220631209";
    const pgtAbi = [
      "function mint(address to, uint256 amount) external",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address account) view returns (uint256)"
    ];

    const tokenContract = new window.ethers.Contract(tokenAddress, pgtAbi, signer);
    const amountWei = window.ethers.parseUnits(amount.toString(), 18);

    // Trigger MetaMask transaction popup with explicit gas limit
    const tx = await tokenContract.mint(userAddress, amountWei, { gasLimit: 250000 });
    if (window.triggerToast) window.triggerToast(`Transaction Submitted! Tx Hash: ${tx.hash.substring(0,14)}... Confirming...`, "info");

    await tx.wait();

    if (window.appState && window.appState.state) {
      const currentBal = window.appState.state.balancePgt || 0;
      window.appState.update({ balancePgt: currentBal + amount });
    }

    if (window.triggerToast) {
      window.triggerToast(`🎉 ON-CHAIN SUCCESS! Minted ${amount.toLocaleString()} PGT directly to your MetaMask Wallet!`, "success");
    }

    if (typeof loadAdminData === 'function') {
      loadAdminData();
    }
  } catch (err) {
    console.error("Minting Error:", err);
    if (err && (err.code === 4001 || (err.message && err.message.includes('rejected')))) {
      if (window.triggerToast) window.triggerToast("Transaction cancelled in MetaMask.", "warning");
      return;
    }
    const msg = (err && err.reason) ? err.reason : (err && err.message ? err.message : "Transaction failed");
    if (window.triggerToast) window.triggerToast(`Minting Failed: ${msg}`, "error");
  }
}
window.mintLiquidityPoolPGT = mintLiquidityPoolPGT;

// --- Master Admin NFT Minting Studio (OpenSea Ready) ---
export async function mintAdminNFT() {
  const typeSelect = document.getElementById('admin-nft-type');
  const recipientInput = document.getElementById('admin-nft-recipient');
  
  const nftTypeId = typeSelect ? typeSelect.value : 'nft_legendary_king';
  let recipient = recipientInput ? recipientInput.value.trim() : '';

  if (!window.ethereum) {
    if (window.triggerToast) window.triggerToast("MetaMask / Web3 Wallet not found! Please install MetaMask extension.", "error");
    return;
  }

  if (typeof window.ethers === 'undefined') {
    if (window.triggerToast) window.triggerToast("Ethers.js library not loaded!", "error");
    return;
  }

  try {
    // 1. Ensure connected to Polygon Mainnet (0x89 / 137)
    await ensurePolygonNetwork();

    // 2. Request accounts from MetaMask
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const adminAddress = await signer.getAddress();

    if (adminAddress.toLowerCase() !== "0x10b9993990c9ef8a212c9557cb02ad94da9a654d") {
      if (window.triggerToast) window.triggerToast(`Unauthorized: MetaMask connected to ${adminAddress.substring(0,6)}... Master Admin Wallet (0x10B9...654d) required!`, "error");
      return;
    }

    if (!recipient) {
      recipient = adminAddress;
    }

    if (!window.ethers.isAddress(recipient)) {
      if (window.triggerToast) window.triggerToast("Invalid recipient Polygon wallet address!", "error");
      return;
    }

    if (window.triggerToast) window.triggerToast(`Opening MetaMask to mint Utility NFT (${nftTypeId})...`, "info");

    const nftContractAddress = NFT_CONTRACT_ADDRESS || "0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8";
    const nftAbi = [
      "function mintUtilityNFT(address to, string memory nftTypeId) external returns (uint256)",
      "function ownerOf(uint256 tokenId) view returns (address)"
    ];

    const nftContract = new window.ethers.Contract(nftContractAddress, nftAbi, signer);

    // Call mintUtilityNFT with explicit gas limit to bypass gas estimation delay and open MetaMask immediately
    const tx = await nftContract.mintUtilityNFT(recipient, nftTypeId, { gasLimit: 350000 });
    if (window.triggerToast) window.triggerToast(`NFT Mint Submitted! Hash: ${tx.hash.substring(0,14)}... Confirming on Polygon...`, "info");

    await tx.wait();

    if (window.triggerToast) {
      window.triggerToast(`🎉 NFT MINTED ON-CHAIN! Viewable in MetaMask & ready to list/sell on OpenSea!`, "success");
    }

    if (typeof loadAdminData === 'function') {
      loadAdminData();
    }
  } catch (err) {
    console.error("NFT Minting Error:", err);
    if (err && (err.code === 4001 || (err.message && err.message.includes('rejected')))) {
      if (window.triggerToast) window.triggerToast("Transaction cancelled in MetaMask.", "warning");
      return;
    }
    const msg = (err && err.reason) ? err.reason : (err && err.message ? err.message : "Transaction failed");
    if (window.triggerToast) window.triggerToast(`NFT Minting Failed: ${msg}`, "error");
  }
}
window.mintAdminNFT = mintAdminNFT;

