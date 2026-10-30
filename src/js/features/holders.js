// ============================================================
// POLYGAME: HOLDERS LEADERBOARD & TOKEN SUPPLY METRICS
// Manages top PGT holders, staking ranks, supply history chart & weekly archive
// ============================================================

import { ARCADE_GAMES_REGISTRY, ARCADE_GAMES_LIST } from '../core/games-registry.js';
import { supabase, ADMIN_WALLET_ADDRESS, TOKEN_CONTRACT_ADDRESS } from '../core/config.js';
import { appState } from '../core/state.js';
import { escapeHtml } from '../core/ui.js';
import { checkIsUserRow, formatLeaderboardName, getLeaderboardStarshipBadge } from './leaderboards.js';

let holdersCurrentPage = 1;
const holdersPerPage = 20;
let cachedHoldersData = [];
let holdersChartInstance = null;
let currentHoldersTotalSupply = 0;
let holdersMode = 'total'; // 'total' or 'staking'

export function switchHoldersMode(mode) {
  holdersMode = mode;
  const tabTotal = document.getElementById('tab-holders-total');
  const tabStaking = document.getElementById('tab-holders-staking');
  const tabArchive = document.getElementById('tab-holders-archive');
  const descEl = document.getElementById('holders-desc-text');
  const totalSupplyBanner = document.getElementById('total-onsite-pgt-display');
  const paginationControls = document.getElementById('holders-pagination-container');
  const archiveSelector = document.getElementById('holders-archive-selector-wrapper');

  if (tabTotal && tabStaking && tabArchive) {
    tabTotal.classList.remove('active');
    tabStaking.classList.remove('active');
    tabArchive.classList.remove('active');

    if (mode === 'total') {
      tabTotal.classList.add('active');
      if (descEl) descEl.innerText = 'Global ranking of wallets by total wealth (Wallet + Staked PGT).';
      if (totalSupplyBanner) totalSupplyBanner.style.display = 'block';
      if (paginationControls) paginationControls.style.display = 'flex';
      if (archiveSelector) archiveSelector.style.display = 'none';
      cachedHoldersData.sort((a, b) => b.totalWealth - a.totalWealth);
      holdersCurrentPage = 1;
      renderHoldersPage(holdersCurrentPage);
    } else if (mode === 'staking') {
      tabStaking.classList.add('active');
      if (descEl) descEl.innerText = 'Global ranking of wallets by PGT locked in Staking Vaults.';
      if (totalSupplyBanner) totalSupplyBanner.style.display = 'block';
      if (paginationControls) paginationControls.style.display = 'flex';
      if (archiveSelector) archiveSelector.style.display = 'none';
      cachedHoldersData.sort((a, b) => b.staked - a.staked);
      holdersCurrentPage = 1;
      renderHoldersPage(holdersCurrentPage);
    } else if (mode === 'archive') {
      tabArchive.classList.add('active');
      if (descEl) descEl.innerText = 'Historical snapshot archive of weekly arcade tournament prize pool winners from past weekly resets.';
      if (totalSupplyBanner) totalSupplyBanner.style.display = 'none';
      if (paginationControls) paginationControls.style.display = 'none';
      if (archiveSelector) archiveSelector.style.display = 'flex';
      loadPastWeeklyArchive(document.getElementById('weekly-archive-select-week')?.value || null);
    }
  }
}

export async function loadHoldersLeaderboard() {
  holdersMode = 'total';
  if (typeof window.switchHoldersMode === 'function') window.switchHoldersMode('total');
  const scoreboard = document.getElementById('leaderboard-pgt-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const [{ data: allData, error }, { data: activeStakes, error: stakesErr }, { count: arcadeCount }] = await Promise.all([
      supabase.from('users').select('player_id, linked_wallet_address, balance_pgt, username, user_id, auth_provider, total_claims, relics, space_state, total_arcade_plays, vip_until, vip_level'),
      supabase.from('user_stakes').select('wallet_address, amount, pool').eq('active', true),
      supabase.from('arcade_sessions').select('id', { count: 'exact', head: true })
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
    let globalSpaceMissions = 0;
    
    cachedHoldersData = (allData || []).map(u => {
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

      // Space missions completed
      const spaceState = u.space_state || {};
      if (typeof spaceState === 'object' && spaceState !== null) {
        const logs = spaceState.missionLogs || spaceState.miningLogs || [];
        if (Array.isArray(logs)) {
          globalSpaceMissions += logs.length;
        }
      }

      return { ...u, totalWealth: total, bal, staked };
    });
    
    let userArcadePlays = 0;
    let hasUserArcadePlays = false;
    (allData || []).forEach(u => {
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
    } else {
      cachedHoldersData.sort((a, b) => b.staked - a.staked);
    }
    holdersCurrentPage = 1;

    renderHoldersPage(holdersCurrentPage);
    recordSupplySnapshotIfNeeded(globalTotalWealth);
    renderHoldersSupplyChart('day', globalTotalWealth);
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
    
    const { error: rpcErr } = await supabase.rpc('record_supply_snapshot', {
      p_created_at: currentHourStr,
      p_total_supply: total
    });

    if (rpcErr) {
      const { data } = await supabase
        .from('pgt_supply_history')
        .select('id')
        .gte('created_at', currentHourStr)
        .limit(1);

      if (!data || data.length === 0) {
        await supabase.from('pgt_supply_history').insert({
          created_at: currentHourStr,
          total_supply: total
        });
      }
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
        ? `<strong style="color:var(--color-primary);">${displayName}</strong> <span style="font-size:0.75rem; color:var(--text-dim);">(${shortAddr})</span>` 
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
              <span style="font-family: monospace; font-size: 0.85rem; color: ${isUser ? '#fff' : 'var(--text-white)'}; font-weight: ${isUser ? 'bold' : 'normal'};">${displayName} ${isUser ? '<span style="color:var(--color-accent); font-size:0.75rem;">(You)</span>' : ''}</span>
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


