// ============================================================
// POLYGAME: HOLDERS LEADERBOARD & TOKEN SUPPLY METRICS
// Manages top PGT holders, staking ranks, supply history chart & weekly archive
// ============================================================

import { ARCADE_GAMES_REGISTRY, ARCADE_GAMES_LIST } from '../core/games-registry.js';
import { supabase, SUPABASE_URL, SUPABASE_KEY, ADMIN_WALLET_ADDRESS, TOKEN_CONTRACT_ADDRESS, STARSHIP_CONTRACT_ADDRESS } from '../core/config.js';
import { appState } from '../core/state.js';
import { escapeHtml } from '../core/ui.js';
import { checkIsUserRow, formatLeaderboardName, getLeaderboardStarshipBadge } from './leaderboards.js';

let holdersCurrentPage = 1;
const holdersPerPage = 20;
let cachedHoldersData = [];
let holdersChartInstance = null;
let currentHoldersTotalSupply = 0;
let holdersMode = 'total'; // 'total', 'staking', 'starships', or 'archive'
let pendingHoldersMode = null;

export function switchHoldersMode(mode) {
  holdersMode = mode;
  const tabTotal = document.getElementById('tab-holders-total');
  const tabStaking = document.getElementById('tab-holders-staking');
  const tabStarships = document.getElementById('tab-holders-starships');
  const tabArchive = document.getElementById('tab-holders-archive');
  const descEl = document.getElementById('holders-desc-text');
  const totalSupplyBanner = document.getElementById('total-onsite-pgt-display');
  const globalStatsGrid = document.getElementById('holders-global-stats-grid');
  const paginationControls = document.getElementById('holders-pagination-container');
  const archiveSelector = document.getElementById('holders-archive-selector-wrapper');
  const pgtContainer = document.getElementById('leaderboard-pgt-container');
  const starshipsWrapper = document.getElementById('leaderboard-starships-wrapper');

  [tabTotal, tabStaking, tabStarships, tabArchive].forEach(t => {
    if (t) t.classList.remove('active');
  });

  if (mode === 'total') {
    if (tabTotal) tabTotal.classList.add('active');
    if (descEl) descEl.innerText = 'Global ranking of wallets by total wealth (Wallet + Staked PGT).';
    if (totalSupplyBanner) totalSupplyBanner.style.display = 'block';
    if (globalStatsGrid) globalStatsGrid.style.display = 'grid';
    if (pgtContainer) pgtContainer.style.display = '';
    if (starshipsWrapper) starshipsWrapper.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'flex';
    if (archiveSelector) archiveSelector.style.display = 'none';
    cachedHoldersData.sort((a, b) => b.totalWealth - a.totalWealth);
    holdersCurrentPage = 1;
    renderHoldersPage(holdersCurrentPage);
  } else if (mode === 'staking') {
    if (tabStaking) tabStaking.classList.add('active');
    if (descEl) descEl.innerText = 'Global ranking of wallets by PGT locked in Staking Vaults.';
    if (totalSupplyBanner) totalSupplyBanner.style.display = 'block';
    if (globalStatsGrid) globalStatsGrid.style.display = 'grid';
    if (pgtContainer) pgtContainer.style.display = '';
    if (starshipsWrapper) starshipsWrapper.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'flex';
    if (archiveSelector) archiveSelector.style.display = 'none';
    cachedHoldersData.sort((a, b) => b.staked - a.staked);
    holdersCurrentPage = 1;
    renderHoldersPage(holdersCurrentPage);
  } else if (mode === 'starships') {
    if (tabStarships) tabStarships.classList.add('active');
    if (descEl) descEl.innerText = 'Top 10 On-Chain Astro-Dodge NFT Starships ranked by upgraded combat module levels & live OpenSea secondary market listings.';
    if (totalSupplyBanner) totalSupplyBanner.style.display = 'none';
    if (globalStatsGrid) globalStatsGrid.style.display = 'none';
    if (pgtContainer) pgtContainer.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'none';
    if (archiveSelector) archiveSelector.style.display = 'none';
    if (starshipsWrapper) starshipsWrapper.style.display = 'block';
    loadStarshipLeaderboard();
  } else if (mode === 'archive') {
    if (tabArchive) tabArchive.classList.add('active');
    if (descEl) descEl.innerText = 'Historical snapshot archive of weekly arcade tournament prize pool winners from past weekly resets.';
    if (totalSupplyBanner) totalSupplyBanner.style.display = 'none';
    if (globalStatsGrid) globalStatsGrid.style.display = 'grid';
    if (pgtContainer) pgtContainer.style.display = '';
    if (starshipsWrapper) starshipsWrapper.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'none';
    if (archiveSelector) archiveSelector.style.display = 'flex';
    loadPastWeeklyArchive(document.getElementById('weekly-archive-select-week')?.value || null);
  }
}

export async function loadHoldersLeaderboard(initialMode = null) {
  const targetMode = initialMode || pendingHoldersMode || 'total';
  pendingHoldersMode = null;
  holdersMode = targetMode;
  if (typeof window.switchHoldersMode === 'function') window.switchHoldersMode(targetMode);
  const scoreboard = document.getElementById('leaderboard-pgt-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const [{ data: allData, error }, { data: activeStakes, error: stakesErr }, { count: arcadeCount }, spaceMissionsRpcRes, { count: radarCount }] = await Promise.all([
      supabase.from('users').select('player_id, linked_wallet_address, balance_pgt, username, user_id, auth_provider, total_claims, relics, space_state, total_arcade_plays, vip_until, vip_level, is_banned'),
      supabase.from('user_stakes').select('wallet_address, amount, pool').eq('active', true),
      supabase.from('arcade_sessions').select('id', { count: 'exact', head: true }),
      Promise.resolve(supabase.rpc('get_global_space_missions_count')).catch(() => ({ data: null })),
      Promise.resolve(supabase.from('polyspace_radar_harvests').select('id', { count: 'exact', head: true })).catch(() => ({ count: 0 }))
    ]);
      
    if (error) throw error;
    if (stakesErr) console.warn("[loadHoldersLeaderboard] user_stakes query warning:", stakesErr);
    
    // Map active stakes from user_stakes table by lowercase wallet_address / player_id
    const stakesMap = {};
    let globalTotalStaked = 0;
    if (activeStakes && Array.isArray(activeStakes)) {
      activeStakes.forEach(s => {
        if (s.pool === 'pgt' || !s.pool) {
          const key = (s.wallet_address || '').toLowerCase().trim();
          const amt = parseFloat(s.amount) || 0;
          if (key) stakesMap[key] = (stakesMap[key] || 0) + amt;
          globalTotalStaked += amt;
        }
      });
    }

    let globalTotalWealth = 0;
    let globalFaucetClaims = 0;
    let globalRelicsFound = 0;
    let globalSpaceMissionsFallback = (Number(radarCount) || 0);
    
    const activeUsers = (allData || []).filter(u => !u.is_banned);
    cachedHoldersData = activeUsers.map(u => {
      const bal = parseFloat(u.balance_pgt) || 0;
      const pidKey = (u.player_id || '').toLowerCase().trim();
      const walletKey = (u.linked_wallet_address || '').toLowerCase().trim();
      
      // Calculate active staked PGT strictly from user_stakes table
      let staked = 0;
      if (stakesMap[pidKey] !== undefined || (walletKey && stakesMap[walletKey] !== undefined)) {
        staked = (stakesMap[pidKey] || 0) + (walletKey && walletKey !== pidKey ? (stakesMap[walletKey] || 0) : 0);
      }
      
      const total = bal + staked;
      globalTotalWealth += total;

      // Faucet claims
      globalFaucetClaims += (parseInt(u.total_claims) || 0);

      // Quantum Relics found
      const relics = u.relics || {};
      if (typeof relics === 'object' && relics !== null) {
        Object.values(relics).forEach(r => {
          if (r && typeof r === 'object') {
            globalRelicsFound += (parseInt(r.total) || ((parseInt(r.unminted) || 0) + (parseInt(r.onchain) || 0)));
          }
        });
      }

      // Space missions completed (use uncapped missionsCompleted counter when available, plus raids & boss attacks)
      const spaceState = u.space_state || {};
      if (typeof spaceState === 'object' && spaceState !== null) {
        const logs = spaceState.missionLogs || spaceState.miningLogs || [];
        const logCount = Array.isArray(logs) ? logs.length : 0;
        const expCount = Math.max(parseInt(spaceState.missionsCompleted, 10) || 0, logCount);
        const raidsWon = parseInt(spaceState.raidsWon, 10) || 0;
        const bossAttacks = parseInt(spaceState.bossAttacksCount, 10) || 0;
        globalSpaceMissionsFallback += expCount + raidsWon + bossAttacks;
      }

      return { ...u, totalWealth: total, bal, staked };
    });

    const rpcTotalMissions = (!spaceMissionsRpcRes?.error && spaceMissionsRpcRes?.data?.total_missions !== undefined)
      ? Number(spaceMissionsRpcRes.data.total_missions || 0)
      : 0;
    const globalSpaceMissions = Math.max(rpcTotalMissions, globalSpaceMissionsFallback);
    
    let userArcadePlays = 0;
    let hasUserArcadePlays = false;
    activeUsers.forEach(u => {
      if (u.total_arcade_plays !== undefined && u.total_arcade_plays !== null) {
        hasUserArcadePlays = true;
        userArcadePlays += (parseInt(u.total_arcade_plays) || 0);
      }
    });

    const globalArcadePlays = (hasUserArcadePlays && userArcadePlays > 0) ? userArcadePlays : (arcadeCount || 0);

    // Populate Global Stat Cards UI
    const totalPgtEl = document.getElementById('global-stat-total-pgt');
    const legacyTotalPgtEl = document.getElementById('total-onsite-pgt-value');
    const stakedPgtEl = document.getElementById('global-stat-staked-pgt');
    const arcadeGamesEl = document.getElementById('global-stat-arcade-games');
    const spaceMissionsEl = document.getElementById('global-stat-space-missions');
    const relicsFoundEl = document.getElementById('global-stat-relics-found');
    const faucetClaimsEl = document.getElementById('global-stat-faucet-claims');

    const formattedTotalPgt = globalTotalWealth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' PGT';
    if (totalPgtEl) totalPgtEl.innerText = formattedTotalPgt;
    if (legacyTotalPgtEl) legacyTotalPgtEl.innerText = formattedTotalPgt;

    if (stakedPgtEl) stakedPgtEl.innerText = globalTotalStaked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' PGT';
    if (arcadeGamesEl) arcadeGamesEl.innerText = globalArcadePlays.toLocaleString();
    if (spaceMissionsEl) spaceMissionsEl.innerText = globalSpaceMissions.toLocaleString();
    if (relicsFoundEl) relicsFoundEl.innerText = globalRelicsFound.toLocaleString();
    if (faucetClaimsEl) faucetClaimsEl.innerText = globalFaucetClaims.toLocaleString();

    // Also update Dashboard Sitewide Stats Badges
    const sitewideArcadeEl = document.getElementById('sitewide-stat-arcade-plays');
    const sitewideRelicsEl = document.getElementById('sitewide-stat-relics-found');
    const sitewideFaucetEl = document.getElementById('sitewide-stat-faucet-claims');
    if (sitewideArcadeEl) sitewideArcadeEl.innerText = globalArcadePlays.toLocaleString();
    if (sitewideRelicsEl) sitewideRelicsEl.innerText = globalRelicsFound.toLocaleString();
    if (sitewideFaucetEl) sitewideFaucetEl.innerText = globalFaucetClaims.toLocaleString();

    try {
      localStorage.setItem('polygame_cached_sitewide_stats', JSON.stringify({
        arcadePlays: globalArcadePlays,
        relicsFound: globalRelicsFound,
        faucetClaims: globalFaucetClaims,
        updatedAt: Date.now()
      }));
    } catch (e) {}
    
    if (holdersMode === 'total') {
      cachedHoldersData.sort((a, b) => b.totalWealth - a.totalWealth);
    } else if (holdersMode === 'staking') {
      cachedHoldersData.sort((a, b) => b.staked - a.staked);
    }
    holdersCurrentPage = 1;

    if (holdersMode === 'total' || holdersMode === 'staking') {
      renderHoldersPage(holdersCurrentPage);
    }
    await recordSupplySnapshotIfNeeded(globalTotalWealth);
    renderHoldersSupplyChart('day', currentHoldersTotalSupply || globalTotalWealth);
    // Note: loadPastWeeklyArchive is only invoked when mode === 'archive'

  } catch (err) {
    console.error("Failed to load holders leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

async function recordSupplySnapshotIfNeeded(total) {
  if (!supabase || total <= 0) return;
  try {
    const now = new Date();
    const currentHourStr = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0).toISOString();
    
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('record_supply_snapshot', {
      p_created_at: currentHourStr,
      p_total_supply: total
    });

    if (!rpcErr && rpcRes && rpcRes.total_supply) {
      currentHoldersTotalSupply = parseFloat(rpcRes.total_supply);
    }

    if (rpcErr) {
      console.warn("Supply snapshot RPC notice:", rpcErr.message);
    }
  } catch (e) {
    console.warn("Supply snapshot insert error:", e);
  }
}

export function renderHoldersPage(page) {
  const scoreboard = document.getElementById('leaderboard-pgt-container');
  if (!scoreboard) return;

  const totalPages = Math.ceil(cachedHoldersData.length / holdersPerPage) || 1;
  holdersCurrentPage = Math.max(1, Math.min(page, totalPages));

  const startIdx = (holdersCurrentPage - 1) * holdersPerPage;
  const pageData = cachedHoldersData.slice(startIdx, startIdx + holdersPerPage);

  scoreboard.innerHTML = '';
  if (pageData.length === 0) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No token holders found.</div>';
  } else {
    pageData.forEach((row, idx) => {
      const rank = startIdx + idx + 1;
      const item = document.createElement('div');
      const isUser = checkIsUserRow(row);
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const pid = row.linked_wallet_address || row.player_id || '';
      const shortAddr = pid.length >= 10 ? `${pid.substring(0,6)}...${pid.substring(pid.length - 4)}` : (pid || 'Player');
      let displayName = row.username || shortAddr;
      if (isUser && appState.state.username) displayName = appState.state.username;
      
      const nameHtml = row.username || (isUser && appState.state.username) 
        ? `<strong style="color:var(--color-primary);">${escapeHtml(displayName)}</strong> <span style="font-size:0.75rem; color:var(--text-dim);">(${escapeHtml(shortAddr)})</span>` 
        : shortAddr;
      
      const primaryScore = holdersMode === 'total' ? row.totalWealth : row.staked;
      const scoreLabel = holdersMode === 'total' ? 'Total' : 'Staked';
      const color = holdersMode === 'total' ? 'var(--color-accent)' : 'var(--color-primary)';

      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <div class="leaderboard-info">
          <div class="leaderboard-info-top">
            <span class="leaderboard-name">${formatLeaderboardName(row, isUser)}</span>
            ${isUser ? '<span class="badge-you" style="color:var(--color-accent); font-size:0.75rem; font-weight:700; margin-left:4px;">(You)</span>' : ''}
          </div>
        </div>
        <div class="leaderboard-stats">
          <span class="leaderboard-score" style="color: ${color}; font-weight:700; font-size:1.05rem;">${primaryScore.toLocaleString([], {minimumFractionDigits:0, maximumFractionDigits:0})} <span class="score-unit">${scoreLabel}</span></span>
          <span class="leaderboard-prize" style="font-size:0.75rem; color:var(--text-dim);">Wallet: ${row.bal.toLocaleString([], {maximumFractionDigits:0})} | Staked: ${row.staked.toLocaleString([], {maximumFractionDigits:0})}</span>
        </div>
      `;
      scoreboard.appendChild(item);
    });
  }

  const pageIndicator = document.getElementById('holders-page-indicator');
  const btnPrev = document.getElementById('btn-holders-prev');
  const btnNext = document.getElementById('btn-holders-next');

  if (pageIndicator) pageIndicator.innerText = `Page ${holdersCurrentPage} of ${totalPages}`;
  if (btnPrev) btnPrev.disabled = holdersCurrentPage <= 1;
  if (btnNext) btnNext.disabled = holdersCurrentPage >= totalPages;
}

export function changeHoldersPage(delta) {
  renderHoldersPage(holdersCurrentPage + delta);
}

export async function renderHoldersSupplyChart(timeframe = 'day', currentTotal = 0) {
  if (currentTotal > 0) currentHoldersTotalSupply = currentTotal;
  const canvas = document.getElementById('holders-supply-chart');
  if (!canvas || !window.Chart) return;

  const labels = [];
  const chartData = [];
  let dbHistory = [];
  let priorBaseline = null;

  const now = new Date();
  let sinceDate = new Date();
  if (timeframe === 'day') sinceDate.setHours(sinceDate.getHours() - 24);
  else if (timeframe === 'month') sinceDate.setDate(sinceDate.getDate() - 30);
  else if (timeframe === 'year') sinceDate.setFullYear(sinceDate.getFullYear() - 1);

  // Query real historical supply snapshots from Supabase database
  if (supabase) {
    try {
      // 1. Fetch the most recent snapshot immediately before sinceDate to establish accurate baseline
      const { data: prior } = await supabase
        .from('pgt_supply_history')
        .select('created_at, total_supply')
        .lt('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (prior && prior.length > 0 && prior[0].total_supply !== null) {
        priorBaseline = parseFloat(prior[0].total_supply);
      }

      // 2. Fetch history records within the window
      const { data: history, error } = await supabase
        .from('pgt_supply_history')
        .select('created_at, total_supply')
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: true });

      if (!error && history) {
        dbHistory = history;
      }
    } catch (e) {
      console.warn("Supply history DB fetch failed:", e);
    }
  }

  // Fallback initial baseline: prior snapshot -> earliest available in window -> current live total
  let initialBaseline = (priorBaseline !== null && !isNaN(priorBaseline))
    ? priorBaseline
    : (dbHistory.length > 0 && dbHistory[0].total_supply !== null
        ? parseFloat(dbHistory[0].total_supply)
        : currentHoldersTotalSupply);

  if (timeframe === 'day') {
    // 24 Hourly Slots with Date-Aware Keys (Prevents Day-to-Day Hour Collisions)
    const toHourSlotKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}_${d.getHours()}`;
    const hourlyMap = {};

    dbHistory.forEach(item => {
      const d = new Date(item.created_at);
      hourlyMap[toHourSlotKey(d)] = parseFloat(item.total_supply || 0);
    });

    let lastKnownVal = initialBaseline;
    for (let i = 23; i >= 0; i--) {
      const slotTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      const slotKey = toHourSlotKey(slotTime);
      labels.push(`${slotTime.getHours()}:00`);

      if (hourlyMap[slotKey] !== undefined) {
        lastKnownVal = hourlyMap[slotKey];
      }
      if (i === 0 && currentHoldersTotalSupply > 0) {
        lastKnownVal = currentHoldersTotalSupply;
      }
      chartData.push(lastKnownVal);
    }
  } else if (timeframe === 'month') {
    // 30 Daily Slots (Downsampled: 1 point per day, never keeping every hour in memory)
    const toDaySlotKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dailyMap = {};

    // Group hourly records into daily end-of-day snapshots
    dbHistory.forEach(item => {
      const d = new Date(item.created_at);
      // Chronological ascending: later hour in the day naturally overwrites earlier hour
      dailyMap[toDaySlotKey(d)] = parseFloat(item.total_supply || 0);
    });

    let lastKnownVal = initialBaseline;
    for (let i = 29; i >= 0; i--) {
      const slotTime = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const slotKey = toDaySlotKey(slotTime);
      labels.push(`${slotTime.getMonth() + 1}/${slotTime.getDate()}`);

      if (dailyMap[slotKey] !== undefined) {
        lastKnownVal = dailyMap[slotKey];
      }
      if (i === 0 && currentHoldersTotalSupply > 0) {
        lastKnownVal = currentHoldersTotalSupply;
      }
      chartData.push(lastKnownVal);
    }
  } else {
    // 52 Weekly Slots (Downsampled: 1 point per week, never keeping hourly noise in memory)
    const toWeekSlotKey = (d) => {
      const start = new Date(d.getFullYear(), 0, 1);
      const weekIndex = Math.floor((d - start) / (7 * 24 * 60 * 60 * 1000));
      return `${d.getFullYear()}_w${weekIndex}`;
    };
    const weeklyMap = {};

    dbHistory.forEach(item => {
      const d = new Date(item.created_at);
      weeklyMap[toWeekSlotKey(d)] = parseFloat(item.total_supply || 0);
    });

    let lastKnownVal = initialBaseline;
    for (let i = 51; i >= 0; i--) {
      const slotTime = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const slotKey = toWeekSlotKey(slotTime);
      labels.push(`${slotTime.toLocaleString('default', { month: 'short' })} ${slotTime.getDate()}`);

      if (weeklyMap[slotKey] !== undefined) {
        lastKnownVal = weeklyMap[slotKey];
      }
      if (i === 0 && currentHoldersTotalSupply > 0) {
        lastKnownVal = currentHoldersTotalSupply;
      }
      chartData.push(lastKnownVal);
    }
  }

  ['day', 'month', 'year'].forEach(tf => {
    const btn = document.getElementById(`btn-holders-tf-${tf}`);
    if (btn) {
      if (tf === timeframe) {
        btn.style.background = 'var(--color-primary)';
        btn.style.color = '#000';
        btn.style.fontWeight = '700';
      } else {
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.color = 'var(--text-muted)';
        btn.style.fontWeight = 'normal';
      }
    }
  });

  if (holdersChartInstance) {
    holdersChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 250);
  gradient.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

  holdersChartInstance = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Onsite PGT Supply',
        data: chartData,
        borderColor: '#00f0ff',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#ff00ff',
        pointRadius: timeframe === 'year' ? 1.5 : (timeframe === 'month' ? 2 : 2.5)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` Supply: ${context.parsed.y.toLocaleString()} PGT`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#8a99ad',
            font: { size: 10 },
            maxTicksLimit: timeframe === 'year' ? 12 : (timeframe === 'month' ? 10 : 8),
            maxRotation: 0
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#8a99ad',
            font: { size: 10 },
            callback: (val) => val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val
          }
        }
      }
    }
  });
}

window.changeHoldersPage = changeHoldersPage;
window.switchHoldersMode = switchHoldersMode;
window.switchHoldersTimeframe = (tf) => renderHoldersSupplyChart(tf, currentHoldersTotalSupply);


export async function loadPastWeeklyArchive(targetWeekLabel = null) {
  const container = document.getElementById('leaderboard-pgt-container');
  const selectDropdown = document.getElementById('weekly-archive-select-week');
  if (!container || !supabase) return;

  try {
    let uniqueWeeks = [];
    const { data: weekLabels } = await supabase.from('weekly_leaderboard_history').select('week_label').order('created_at', { ascending: false });
    if (weekLabels && weekLabels.length > 0) {
      uniqueWeeks = [...new Set(weekLabels.map(w => w.week_label))];
      
      // Populate dropdown if needed
      if (selectDropdown && (selectDropdown.options.length <= 1 || selectDropdown.dataset.loadedWeeks !== uniqueWeeks.join(','))) {
        selectDropdown.dataset.loadedWeeks = uniqueWeeks.join(',');
        selectDropdown.innerHTML = '';
        uniqueWeeks.forEach((w, idx) => {
          const opt = document.createElement('option');
          opt.value = w;
          opt.innerText = (idx === 0) ? `🗓️ Previous Week (${w}) [Latest]` : `🗓️ Week of ${w}`;
          selectDropdown.appendChild(opt);
        });
        const allOpt = document.createElement('option');
        allOpt.value = 'ALL';
        allOpt.innerText = '🌐 All Past Weekly Resets';
        selectDropdown.appendChild(allOpt);
      }
    }

    // Default selection: previous week (i.e. uniqueWeeks[0]) unless user explicitly requested a specific week or ALL
    let selectedWeek = targetWeekLabel;
    if (!selectedWeek || selectedWeek === '') {
      selectedWeek = (selectDropdown && selectDropdown.value && selectDropdown.value !== '') 
        ? selectDropdown.value 
        : (uniqueWeeks.length > 0 ? uniqueWeeks[0] : null);
    }
    
    if (selectDropdown && selectedWeek) {
      selectDropdown.value = selectedWeek;
    }

    let query = supabase.from('weekly_leaderboard_history').select('*');
    if (selectedWeek && selectedWeek !== 'ALL') {
      query = query.eq('week_label', selectedWeek);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).order('rank', { ascending: true }).limit(500);

    if (error) throw error;

    container.innerHTML = '';
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No archived weekly leaderboard snapshots found for this timeframe.</div>';
      return;
    }

    // Fetch user profiles map to resolve real usernames instead of internal IDs
    const { data: userProfiles } = await supabase.from('users').select('player_id, username, linked_wallet_address');
    const userMap = {};
    if (userProfiles) {
      userProfiles.forEach(u => {
        if (u.player_id) userMap[u.player_id.toLowerCase()] = u.username;
        if (u.linked_wallet_address) userMap[u.linked_wallet_address.toLowerCase()] = u.username;
      });
    }

    // Group by week_label
    const weeksMap = {};
    data.forEach(row => {
      if (!weeksMap[row.week_label]) weeksMap[row.week_label] = [];
      weeksMap[row.week_label].push(row);
    });

    const gameTitles = {
      'astrododge': '🚀 Astro-Dodge Tournament Pool',
      'game': '🚀 Astro-Dodge Tournament Pool',
      'invaders': '👾 Cyber Invaders Tournament Pool',
      'drift': '🏎️ Cyber Drift Tournament Pool',
      'stacker': '👑 Cyber Stacker Tournament Pool',
      'catcher': '👑 Cyber Stacker Tournament Pool',
      'skeet': '🎯 Cyber Skeet Tournament Pool',
      'defense': '🛡️ Cyber Defense Tournament Pool',
      'runner': '🏃 Cyber Runner Tournament Pool',
      'q2048': '🧩 Cyber 2048 Tournament Pool',
      'tetris': '🧱 Cyber Tetris Tournament Pool'
    };

    Object.keys(weeksMap).forEach(weekLabel => {
      const weekSection = document.createElement('div');
      weekSection.style.cssText = 'margin-bottom: 2rem; background: rgba(0,0,0,0.25); padding: 1.25rem; border-radius: var(--border-radius-md); border: 1px solid var(--border-glass);';
      
      const rows = weeksMap[weekLabel];

      // Sub-group strictly by mini-game (Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker, Cyber Skeet, Cyber Defense, Cyber Runner, Cyber 2048, Cyber Tetris)
      const gameGroupMap = {};

      rows.forEach(r => {
        let gKey = (r.game_type || '').toLowerCase();
        if (!gKey || gKey === 'overall') {
          if ((r.astrododge_score || 0) > 0) gKey = 'astrododge';
          else if ((r.invaders_score || 0) > 0) gKey = 'invaders';
          else if ((r.drift_score || 0) > 0) gKey = 'drift';
          else if ((r.catcher_score || 0) > 0 || (r.stacker_score || 0) > 0) gKey = 'stacker';
          else if ((r.skeet_score || 0) > 0) gKey = 'skeet';
          else if ((r.defense_score || 0) > 0) gKey = 'defense';
          else if ((r.runner_score || 0) > 0) gKey = 'runner';
          else if ((r.q2048_score || 0) > 0) gKey = 'q2048';
          else if ((r.tetris_score || 0) > 0) gKey = 'tetris';
          else return; // Ignore unclassifiable rows
        }
        if (!gameTitles[gKey]) return; // Strictly ignore overall/unknown categories

        if (!gameGroupMap[gKey]) gameGroupMap[gKey] = [];
        gameGroupMap[gKey].push(r);
      });

      // 1. Process and deduplicate each game
      const processedGames = {};
      let weekTotalDistributed = 0;

      Object.keys(gameGroupMap).forEach(gKey => {
        const playerBestMap = new Map();
        gameGroupMap[gKey].forEach(r => {
          const pid = (r.player_id || r.wallet_address || '').toLowerCase();
          const score = Number(r.best_score || r.runner_score || r.q2048_score || r.tetris_score || r.defense_score || r.skeet_score || r.stacker_score || r.astrododge_score || r.invaders_score || r.drift_score || 0);
          const prize = Number(r.prize_pgt || 0);

          if (!playerBestMap.has(pid)) {
            playerBestMap.set(pid, r);
          } else {
            const existing = playerBestMap.get(pid);
            const existScore = Number(existing.best_score || existing.runner_score || existing.q2048_score || existing.tetris_score || existing.defense_score || existing.skeet_score || existing.stacker_score || existing.astrododge_score || existing.invaders_score || existing.drift_score || 0);
            if (score > existScore || (score === existScore && prize > (Number(existing.prize_pgt) || 0))) {
              playerBestMap.set(pid, r);
            }
          }
        });

        const sortedRows = Array.from(playerBestMap.values()).sort((a, b) => {
          const scoreA = Number(a.best_score || a.runner_score || a.q2048_score || a.tetris_score || a.defense_score || a.skeet_score || a.stacker_score || a.astrododge_score || a.invaders_score || a.drift_score || 0);
          const scoreB = Number(b.best_score || b.runner_score || b.q2048_score || b.tetris_score || b.defense_score || b.skeet_score || b.stacker_score || b.astrododge_score || b.invaders_score || b.drift_score || 0);
          if (scoreB !== scoreA) return scoreB - scoreA;
          return (Number(a.rank) || 0) - (Number(b.rank) || 0);
        });

        sortedRows.forEach((r, idx) => {
          r.rank = idx + 1;
        });

        processedGames[gKey] = sortedRows;
        weekTotalDistributed += sortedRows.reduce((sum, r) => sum + (Number(r.prize_pgt) || 0), 0);
      });

      // 2. Render Week Header
      const weekHeader = document.createElement('h4');
      weekHeader.style.cssText = 'color: var(--color-primary); margin-bottom: 1rem; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;';
      weekHeader.innerHTML = `<span>🗓️ Weekly Reset Snapshot: <strong>${weekLabel}</strong></span> <span style="font-size:0.85rem; color:var(--color-warning); font-weight:bold;">🏆 ${weekTotalDistributed > 0 ? weekTotalDistributed.toLocaleString() + ' PGT Awarded' : 'Weekly Tournament Pool'}</span>`;
      weekSection.appendChild(weekHeader);

      // 3. Render Game Pools
      Object.keys(processedGames).forEach(gKey => {
        const sortedRows = processedGames[gKey];
        const gameBox = document.createElement('div');
        gameBox.style.cssText = 'margin-bottom: 1rem; background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);';

        const gSum = sortedRows.reduce((sum, r) => sum + (Number(r.prize_pgt) || 0), 0);

        const gTitle = document.createElement('div');
        gTitle.style.cssText = 'font-weight: 700; color: var(--color-accent); margin-bottom: 0.5rem; font-size: 0.95rem; display: flex; justify-content: space-between; align-items: center;';
        gTitle.innerHTML = `<span>${gameTitles[gKey] || (gKey.toUpperCase() + ' Tournament Pool')}</span> <span style="font-size:0.75rem; color:var(--text-dim);">${sortedRows.length} Winners (${gSum.toLocaleString()} PGT)</span>`;
        gameBox.appendChild(gTitle);

        sortedRows.forEach(row => {
          const item = document.createElement('div');
          const isUser = checkIsUserRow(row);
          item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.6rem; border-bottom: 1px dashed rgba(255,255,255,0.05); ${isUser ? 'background: rgba(0, 240, 255, 0.1); border-radius: 4px;' : ''}`;
          
          const pid = (row.player_id || '').toLowerCase();
          const waddr = (row.linked_wallet_address || '').toLowerCase();
          
          let displayName = row.username || userMap[pid] || userMap[waddr] || '';
          if (!displayName || displayName.trim() === '') {
            if (waddr && !waddr.startsWith('0xpgt') && !waddr.startsWith('0xg') && waddr.length >= 42) {
              displayName = 'Player_' + waddr.substring(0, 6) + '...' + waddr.substring(waddr.length - 4);
            } else if (pid && !pid.startsWith('0xpgt') && !pid.startsWith('0xg') && pid.length >= 42) {
              displayName = 'Player_' + pid.substring(0, 6) + '...' + pid.substring(pid.length - 4);
            } else {
              displayName = 'Player_' + (pid ? pid.substring(pid.length - 4) : 'User');
            }
          }

          const scoreVal = row.best_score || row.runner_score || row.q2048_score || row.tetris_score || row.defense_score || row.skeet_score || row.stacker_score || row.astrododge_score || row.invaders_score || row.drift_score || 0;

          item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-weight: bold; color: ${row.rank <= 3 ? 'var(--color-warning)' : 'var(--text-muted)'}; min-width: 1.5rem;">#${row.rank}</span>
              <span style="font-family: monospace; font-size: 0.85rem; color: ${isUser ? '#fff' : 'var(--text-white)'}; font-weight: ${isUser ? 'bold' : 'normal'};">${escapeHtml(displayName)} ${isUser ? '<span style="color:var(--color-accent); font-size:0.75rem;">(You)</span>' : ''}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <span style="font-size: 0.8rem; color: var(--text-dim);">Score: ${Number(scoreVal).toLocaleString()}</span>
              <span style="font-weight: 800; color: var(--color-success); font-size: 0.85rem;">+${Number(row.prize_pgt).toLocaleString()} PGT</span>
            </div>
          `;
          gameBox.appendChild(item);
        });

        weekSection.appendChild(gameBox);
      });

      container.appendChild(weekSection);
    });

  } catch (err) {
    console.error("Failed to load past weekly leaderboard archive:", err);
    container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading archive.</div>';
  }
}
window.loadPastWeeklyArchive = loadPastWeeklyArchive;

// ============================================================
// ASTRO-DODGE NFT STARSHIPS LEADERBOARD & OPENSEA MARKET
// ============================================================
let cachedStarshipLeaderboard = null;
let lastStarshipFetchAt = 0;
const STARSHIP_LB_CACHE_TTL_MS = 60 * 1000;

export function openStarshipLeaderboard() {
  pendingHoldersMode = 'starships';
  const viewHolders = document.getElementById('view-holders');
  const isAlreadyOnHolders = viewHolders && viewHolders.classList.contains('active');
  if (isAlreadyOnHolders) {
    pendingHoldersMode = null;
    switchHoldersMode('starships');
  } else if (typeof window.switchTab === 'function') {
    window.switchTab('holders');
  }
}
window.openStarshipLeaderboard = openStarshipLeaderboard;

function formatStarshipOwnerHtml(ownerAddress, ownerUser) {
  const addrLower = (ownerAddress || '').toLowerCase();
  const myPid = (appState?.state?.playerId || '').toLowerCase();
  const myWallet = (appState?.state?.walletAddress || '').toLowerCase();
  const myLinked = (appState?.state?.linkedWalletAddress || '').toLowerCase();

  const isMine = Boolean(
    addrLower && (
      (myWallet && addrLower === myWallet) ||
      (myLinked && addrLower === myLinked) ||
      (myPid && addrLower === myPid)
    )
  ) || Boolean(ownerUser && checkIsUserRow(ownerUser));

  if (ownerUser) {
    const formatted = formatLeaderboardName(ownerUser, isMine, false);
    return `${formatted}${isMine ? ' <span class="badge-you" style="color:var(--color-accent); font-size:0.75rem; font-weight:700;">(You)</span>' : ''}`;
  }

  if (addrLower && addrLower.length >= 10) {
    const shortAddr = `${addrLower.substring(0, 6)}...${addrLower.substring(addrLower.length - 4)}`;
    const safeShort = escapeHtml(shortAddr);
    const safeClick = encodeURIComponent(addrLower);
    return `<span style="font-family:monospace; color:var(--color-primary); cursor:pointer; text-decoration:underline; text-decoration-color:rgba(0,240,255,0.3);" onclick="openPublicProfile('${safeClick}')" title="Click to inspect wallet">${safeShort}</span>${isMine ? ' <span class="badge-you" style="color:var(--color-accent); font-size:0.75rem; font-weight:700;">(You)</span>' : ''}`;
  }

  return '<span style="color:var(--text-dim);">Unresolved Pilot</span>';
}

export async function loadStarshipLeaderboard(forceRefresh = false) {
  const container = document.getElementById('leaderboard-starships-wrapper');
  if (!container) return;

  const now = Date.now();
  if (!forceRefresh && cachedStarshipLeaderboard && (now - lastStarshipFetchAt < STARSHIP_LB_CACHE_TTL_MS)) {
    renderStarshipLeaderboard(cachedStarshipLeaderboard, container);
    return;
  }

  container.innerHTML = `
    <div style="text-align: center; padding: 2.25rem 1rem; color: var(--text-dim);">
      <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🛸</div>
      <div>Scanning Polygon blockchain &amp; OpenSea fleet listings...</div>
    </div>
  `;

  try {
    const endpoint = `${SUPABASE_URL}/functions/v1/starship-leaderboard${forceRefresh ? '?refresh=1' : ''}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (!payload || !payload.success) {
      throw new Error(payload?.error || 'Failed to retrieve Starship leaderboard');
    }

    cachedStarshipLeaderboard = payload;
    lastStarshipFetchAt = Date.now();
    renderStarshipLeaderboard(payload, container);
  } catch (err) {
    console.warn('[loadStarshipLeaderboard] Edge function error, falling back to cached DB data:', err);
    await renderStarshipLeaderboardFallback(container);
  }
}
window.loadStarshipLeaderboard = loadStarshipLeaderboard;

async function renderStarshipLeaderboardFallback(container) {
  const collectionUrl = 'https://opensea.io/collection/polygame-starship-fleet';
  try {
    const { data: usersData } = await supabase
      .from('users')
      .select('player_id, username, linked_wallet_address, vip_until, vip_level, equipped_starship, is_banned')
      .not('equipped_starship', 'is', null)
      .limit(200);

    const ships = [];
    const seen = new Set();
    for (const u of (usersData || [])) {
      if (u.is_banned) continue;
      const s = u.equipped_starship;
      const tid = Number(s?.tokenId || 0);
      if (!s || s.isDemo || tid <= 0 || seen.has(tid)) continue;
      seen.add(tid);

      const rf = Number(s.rapidFireLevel || 1);
      const pl = Number(s.plasmaDamageLevel || 1);
      const od = Number(s.overdriveLevel || 1);
      const ms = Number(s.missilePodLevel || 1);
      const tier = Number(s.shipTier || 1);
      const totalLevel = rf + pl + od + ms;
      const rarity = String(s.rarity || 'Rare');
      const rNorm = rarity.toLowerCase();
      const rarityColor = rNorm === 'mythic' ? '#ff0055' : rNorm === 'legendary' ? '#ffd700' : rNorm === 'epic' ? '#bd00ff' : '#00f0ff';
      const baseMult = Number(s.baseEarnMultiplier || (rNorm === 'mythic' ? 1.5 : rNorm === 'legendary' ? 1.3 : rNorm === 'epic' ? 1.2 : 1.1));
      const isT3 = tier >= 3 || (rf >= 3 && pl >= 3 && od >= 3 && ms >= 3);

      ships.push({
        tokenId: tid,
        dna: Number(s.dna || 0),
        name: s.name || `Starship #${tid}`,
        rapidFireLevel: rf,
        plasmaDamageLevel: pl,
        overdriveLevel: od,
        missilePodLevel: ms,
        shipTier: tier,
        totalLevel,
        maxTotalLevel: 20,
        rarity,
        rarityColor,
        rarityBg: 'rgba(0,240,255,0.14)',
        rarityBorder: rarityColor,
        effectiveMultiplier: isT3 ? parseFloat((baseMult * 1.5).toFixed(2)) : baseMult,
        imageUrl: `https://jgtfnsufemvqkyytscgl.supabase.co/functions/v1/starship-metadata/images/${tid}.svg?dna=${s.dna || 0}&t=${tier}`,
        openSeaUrl: `https://opensea.io/assets/matic/${STARSHIP_CONTRACT_ADDRESS}/${tid}`,
        ownerAddress: (u.linked_wallet_address || u.player_id || '').toLowerCase(),
        ownerUser: u
      });
    }

    ships.sort((a, b) => (b.totalLevel - a.totalLevel) || (b.shipTier - a.shipTier) || (a.tokenId - b.tokenId));

    renderStarshipLeaderboard({
      totalSupply: ships.length,
      upgradedShipsCount: ships.filter(s => s.totalLevel > 4 || s.shipTier > 1).length,
      mintFeePol: '2.0',
      collectionUrl,
      collectionStats: null,
      topShips: ships.slice(0, 10),
      openSeaListings: []
    }, container);
  } catch (fallbackErr) {
    console.error('Starship fallback render error:', fallbackErr);
    container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Unable to load Starship rankings right now.</div>';
  }
}

export function renderStarshipLeaderboard(payload, container) {
  if (!container) return;

  const topShips = Array.isArray(payload?.topShips) ? payload.topShips : [];
  const listings = Array.isArray(payload?.openSeaListings) ? payload.openSeaListings : [];
  const totalSupply = Number(payload?.totalSupply || 0);
  const upgradedCount = Number(payload?.upgradedShipsCount || 0);
  const uniqueOwners = payload?.collectionStats?.num_owners ?? '--';
  const mintFee = payload?.mintFeePol || '2.0';
  const collectionUrl = payload?.collectionUrl || 'https://opensea.io/collection/polygame-starship-fleet';

  const buyActionCode = `if(window.PolyHangar && typeof window.PolyHangar.openHangarModal==='function'){window.PolyHangar.openHangarModal();}else if(window.switchTab){window.switchTab('games');}`;

  let html = `
    <!-- Top Banner: Mint / Buy Ship & OpenSea Market Actions -->
    <div style="background: linear-gradient(135deg, rgba(0, 240, 255, 0.08), rgba(189, 0, 255, 0.08)); border: 1px solid rgba(0, 240, 255, 0.35); border-radius: 12px; padding: 1.15rem; margin-bottom: 1.35rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
      <div>
        <div style="font-size: 1.05rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.35rem;">
          <span>🚀</span> <span>Astro-Dodge On-Chain Starship Fleet</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.65rem; font-size: 0.78rem; color: var(--text-muted);">
          <span>🛸 Minted: <strong style="color: var(--color-primary);">${totalSupply.toLocaleString()}</strong></span>
          <span>•</span>
          <span>⚡ Upgraded Ships: <strong style="color: var(--color-warning);">${upgradedCount.toLocaleString()}</strong></span>
          <span>•</span>
          <span>👥 Owners: <strong style="color: #fff;">${uniqueOwners}</strong></span>
          <span>•</span>
          <span>⛵ Listed on OpenSea: <strong style="color: var(--color-success);">${listings.length}</strong></span>
        </div>
      </div>
      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem;">
        <button type="button" onclick="${buyActionCode}" class="btn-primary" style="padding: 0.55rem 1rem; font-size: 0.85rem; font-weight: 800; background: linear-gradient(135deg, #00f0ff, #0077ff); color: #000; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 0 14px rgba(0,240,255,0.3); display: inline-flex; align-items: center; gap: 0.35rem;">
          🚀 Buy / Mint New Ship (${escapeHtml(String(mintFee))} POL)
        </button>
        <a href="${escapeHtml(collectionUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="padding: 0.52rem 0.95rem; font-size: 0.84rem; font-weight: 700; text-decoration: none; border-color: rgba(32, 129, 226, 0.7); color: #60b5ff; background: rgba(32, 129, 226, 0.12); border-radius: 8px; display: inline-flex; align-items: center; gap: 0.35rem;">
          ⛵ OpenSea Collection ↗
        </a>
        <button type="button" onclick="window.loadStarshipLeaderboard(true)" class="btn-secondary" title="Refresh on-chain &amp; OpenSea data" style="padding: 0.52rem 0.75rem; font-size: 0.82rem; border-radius: 8px; cursor: pointer;">
          🔄
        </button>
      </div>
    </div>

    <!-- Section 1: Top 10 Upgraded Ships -->
    <div style="margin-bottom: 1.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
        <h4 style="margin: 0; font-size: 0.98rem; color: var(--color-warning); display: flex; align-items: center; gap: 0.45rem;">
          <span>🏆</span> <span>Top 10 Upgraded Astro-Dodge Starships</span>
        </h4>
        <span style="font-size: 0.75rem; color: var(--text-dim);">Ranked by Total Module Level (Max Lv. 20) &amp; Ship Tier</span>
      </div>
  `;

  if (topShips.length === 0) {
    html += `<div style="text-align:center; padding:1.5rem; color:var(--text-dim); background:rgba(0,0,0,0.2); border-radius:8px;">No minted NFT Starships found yet.</div>`;
  } else {
    html += `<div class="leaderboard-list" style="display: flex; flex-direction: column; gap: 0.65rem;">`;

    topShips.forEach((ship, idx) => {
      const rank = idx + 1;
      const rankContent = rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `#${rank}`;
      const podiumRowClass = rank === 1 ? 'podium-row-1' : rank === 2 ? 'podium-row-2' : rank === 3 ? 'podium-row-3' : '';
      const rankClass = `leaderboard-rank rank-${rank} ${rank <= 3 ? `podium-rank podium-rank-${rank}` : ''}`;

      const safeName = escapeHtml(ship.name || `Starship #${ship.tokenId}`);
      const safeRarity = escapeHtml(ship.rarity || 'Rare');
      const rColor = ship.rarityColor || '#00f0ff';
      const rBg = ship.rarityBg || 'rgba(0,240,255,0.15)';
      const rBorder = ship.rarityBorder || 'rgba(0,240,255,0.45)';
      const pct = Math.min(100, Math.round(((ship.totalLevel || 4) / (ship.maxTotalLevel || 20)) * 100));
      const ownerHtml = formatStarshipOwnerHtml(ship.ownerAddress, ship.ownerUser);
      const isListedOnOs = listings.some(l => Number(l.tokenId) === Number(ship.tokenId));

      html += `
        <div class="leaderboard-row ${podiumRowClass}" style="display: flex; align-items: center; justify-content: space-between; gap: 0.85rem; padding: 0.75rem 0.9rem; border-radius: 10px; background: rgba(15, 23, 42, 0.55); border: 1px solid ${rank <= 3 ? rBorder : 'rgba(255,255,255,0.08)'}; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 220px; flex: 1 1 260px;">
            <span class="${rankClass}" style="min-width: 2.1rem; font-weight: 900; font-size: ${rank <= 3 ? '1.05rem' : '0.9rem'};">${rankContent}</span>
            <a href="${escapeHtml(ship.openSeaUrl)}" target="_blank" rel="noopener noreferrer" title="View ${safeName} on OpenSea" style="flex-shrink: 0; display: block; width: 52px; height: 52px; border-radius: 8px; overflow: hidden; border: 1.5px solid ${rBorder}; box-shadow: 0 0 10px ${rBg}; background: #030712;">
              <img src="${escapeHtml(ship.imageUrl)}" alt="${safeName}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
            </a>
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.2rem;">
                <strong style="color: #fff; font-size: 0.94rem;">${safeName}</strong>
                <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; color: ${rColor}; background: ${rBg}; border: 1px solid ${rBorder};">${safeRarity}</span>
                <span style="font-size: 0.65rem; font-weight: 800; padding: 1px 6px; border-radius: 4px; color: #ffd700; background: rgba(255,215,0,0.12); border: 1px solid rgba(255,215,0,0.4);">TIER ${ship.shipTier || 1}</span>
                <span style="font-size: 0.65rem; font-weight: 800; padding: 1px 6px; border-radius: 4px; color: #00ff88; background: rgba(0,255,136,0.12); border: 1px solid rgba(0,255,136,0.35);">⚡ ${ship.effectiveMultiplier}x</span>
                ${isListedOnOs ? `<span style="font-size: 0.64rem; font-weight: 800; padding: 1px 6px; border-radius: 4px; color: #60b5ff; background: rgba(32,129,226,0.2); border: 1px solid rgba(32,129,226,0.6);">⛵ ON SALE</span>` : ''}
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem;">
                <span>Pilot:</span> ${ownerHtml}
              </div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem; flex: 0 1 auto;">
            <div style="display: flex; align-items: center; gap: 0.6rem; width: 100%; justify-content: flex-end;">
              <div style="width: 90px; height: 6px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, ${rColor}, #00ff88); border-radius: 99px;"></div>
              </div>
              <span style="font-weight: 900; font-size: 0.92rem; color: #fff;">Lv. ${ship.totalLevel} <span style="font-size: 0.74rem; color: var(--text-dim); font-weight: 600;">/ ${ship.maxTotalLevel || 20}</span></span>
              <a href="${escapeHtml(ship.openSeaUrl)}" target="_blank" rel="noopener noreferrer" title="Inspect on OpenSea" style="font-size: 0.72rem; font-weight: 700; color: #60b5ff; text-decoration: none; padding: 2px 7px; border-radius: 5px; background: rgba(32,129,226,0.14); border: 1px solid rgba(32,129,226,0.38); white-space: nowrap;">
                ⛵ OpenSea ↗
              </a>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: flex-end;">
              <span style="font-size: 0.67rem; padding: 1px 5px; border-radius: 4px; background: rgba(0,240,255,0.08); border: 1px solid rgba(0,240,255,0.22); color: #7dd3fc;" title="Rapid Fire Level">⚡ RF Lv.${ship.rapidFireLevel}</span>
              <span style="font-size: 0.67rem; padding: 1px 5px; border-radius: 4px; background: rgba(255,85,0,0.08); border: 1px solid rgba(255,85,0,0.25); color: #fdba74;" title="Plasma Beam Level">🔥 PL Lv.${ship.plasmaDamageLevel}</span>
              <span style="font-size: 0.67rem; padding: 1px 5px; border-radius: 4px; background: rgba(189,0,255,0.09); border: 1px solid rgba(189,0,255,0.25); color: #e9d5ff;" title="Overdrive Matrix Level">⏱️ OD Lv.${ship.overdriveLevel}</span>
              <span style="font-size: 0.67rem; padding: 1px 5px; border-radius: 4px; background: rgba(0,255,136,0.08); border: 1px solid rgba(0,255,136,0.25); color: #86efac;" title="Micro-Missiles Level">🚀 MS Lv.${ship.missilePodLevel}</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
  }

  html += `</div>`;

  // Section 2: Ships on Sale on OpenSea
  html += `
    <div style="border-top: 1px solid var(--border-glass); padding-top: 1.35rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
        <h4 style="margin: 0; font-size: 0.98rem; color: #60b5ff; display: flex; align-items: center; gap: 0.45rem;">
          <span>⛵</span> <span>Starships on Sale on OpenSea</span>
          <span style="font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: rgba(32,129,226,0.2); border: 1px solid rgba(32,129,226,0.5); color: #93c5fd;">${listings.length} Listed</span>
        </h4>
        <a href="${escapeHtml(collectionUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.8rem; color: #60b5ff; font-weight: 700; text-decoration: none;">
          View All on OpenSea ↗
        </a>
      </div>
  `;

  if (listings.length === 0) {
    html += `
      <div style="background: rgba(32, 129, 226, 0.06); border: 1px dashed rgba(32, 129, 226, 0.35); border-radius: 10px; padding: 1.35rem; text-align: center;">
        <div style="font-size: 1.4rem; margin-bottom: 0.35rem;">⛵</div>
        <div style="color: #fff; font-weight: 700; font-size: 0.92rem; margin-bottom: 0.3rem;">No Astro-Dodge NFT Starships are currently listed on OpenSea</div>
        <div style="color: var(--text-dim); font-size: 0.8rem; margin-bottom: 1rem;">All ${totalSupply.toLocaleString()} minted ships are currently held in player fleets! You can mint a brand-new procedural Starship directly or place a collection offer on OpenSea.</div>
        <div style="display: flex; justify-content: center; gap: 0.65rem; flex-wrap: wrap;">
          <button type="button" onclick="${buyActionCode}" class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 800; background: linear-gradient(135deg, #00f0ff, #0077ff); color: #000; border: none; border-radius: 7px; cursor: pointer;">
            🚀 Mint New Starship (${escapeHtml(String(mintFee))} POL)
          </button>
          <a href="${escapeHtml(collectionUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 700; text-decoration: none; border-color: rgba(32,129,226,0.6); color: #60b5ff; border-radius: 7px;">
            ⛵ Make Collection Offer on OpenSea ↗
          </a>
        </div>
      </div>
    `;
  } else {
    html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.85rem;">`;
    listings.forEach(item => {
      const safeName = escapeHtml(item.name || `Starship #${item.tokenId}`);
      const safeRarity = escapeHtml(item.rarity || 'Rare');
      const rColor = item.rarityColor || '#00f0ff';
      const rBg = item.rarityBg || 'rgba(0,240,255,0.15)';
      const rBorder = item.rarityBorder || 'rgba(0,240,255,0.45)';
      const sellerHtml = formatStarshipOwnerHtml(item.sellerAddress, item.sellerUser);

      html += `
        <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(32, 129, 226, 0.45); border-radius: 10px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.65rem; justify-content: space-between;">
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <a href="${escapeHtml(item.openSeaUrl)}" target="_blank" rel="noopener noreferrer" style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 1.5px solid ${rBorder}; flex-shrink: 0; background: #030712;">
              <img src="${escapeHtml(item.imageUrl)}" alt="${safeName}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
            </a>
            <div style="min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.2rem;">
                <strong style="color: #fff; font-size: 0.92rem;">${safeName}</strong>
                <span style="font-size: 0.64rem; font-weight: 800; padding: 1px 5px; border-radius: 4px; color: ${rColor}; background: ${rBg}; border: 1px solid ${rBorder};">${safeRarity}</span>
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">
                Tier ${item.shipTier || 1} &bull; <strong style="color: #fff;">Lv. ${item.totalLevel || 4}/20</strong> &bull; <span style="color: #00ff88;">⚡ ${item.effectiveMultiplier || 1.1}x</span>
              </div>
              <div style="font-size: 0.73rem; color: var(--text-dim); margin-top: 2px;">
                Seller: ${sellerHtml}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.55rem; border-top: 1px solid rgba(255,255,255,0.07); gap: 0.5rem;">
            <div>
              <div style="font-size: 0.66rem; color: var(--text-dim); text-transform: uppercase;">OpenSea Price</div>
              <div style="font-size: 0.98rem; font-weight: 900; color: #60b5ff;">${escapeHtml(String(item.priceFormatted || '0'))} ${escapeHtml(String(item.currency || 'WETH'))}</div>
            </div>
            <a href="${escapeHtml(item.openSeaUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 800; text-decoration: none; background: linear-gradient(135deg, #2081e2, #00c6ff); color: #fff; border-radius: 7px; white-space: nowrap;">
              Buy on OpenSea ↗
            </a>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}
window.renderStarshipLeaderboard = renderStarshipLeaderboard;



