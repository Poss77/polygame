
function formatLeaderboardName(row, isUser) {
  const wAddr = row.linked_wallet_address || row.wallet_address || '';
  const isRealWallet = wAddr && !wAddr.startsWith('0xg') && wAddr.length >= 42;
  
  let shortAddr = null;
  if (wAddr && wAddr.length >= 42) {
    shortAddr = `${wAddr.substring(0, 6)}...${wAddr.substring(wAddr.length - 4)}`;
  }
  
  let displayName = row.username;
  if (isUser && appState.state.username) {
    displayName = appState.state.username;
  }

  // Strict Privacy Enforcement: Never expose email addresses in public leaderboards
  const clickAttr = wAddr ? `onclick="openPublicProfile('${wAddr}')" style="cursor:pointer; text-decoration:underline; text-decoration-color:rgba(0,240,255,0.3);" title="Click to view public player profile"` : '';

  if (displayName && displayName.trim() !== '') {
    return shortAddr 
      ? `<strong style="color:var(--color-primary); font-family: inherit;" ${clickAttr}>${displayName}</strong> <span style="font-size:0.75rem; color:var(--text-dim); font-family: monospace;">(${shortAddr})</span>`
      : `<strong style="color:var(--color-primary); font-family: inherit;" ${clickAttr}>${displayName}</strong>`;
  }

  return shortAddr ? `<span style="font-family: monospace;" ${clickAttr}>${shortAddr}</span>` : 'Player';
}

import { supabase, ADMIN_WALLET_ADDRESS, web3Provider } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { NFT_REGISTRY } from './nft.js';
import { appState } from '../core/state.js';
import { triggerToast, connectWeb3 } from '../core/ui.js';
import { syncProfileWithDb } from '../core/db-sync.js';

// --- Leaderboard Fetching (Supabase) ---

export function getWeeklyPrizeForRank(rank) {
  if (rank === 1) return 15000;
  if (rank === 2) return 8000;
  if (rank === 3) return 4000;
  if (rank <= 10) return 1000;
  if (rank <= 25) return 400;
  if (rank <= 50) return 200;
  if (rank <= 100) return 100;
  return 0;
}

export async function loadAstroDodgeLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-arcade-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('wallet_address, linked_wallet_address, game_highscore, username, email')
      .gt('game_highscore', 0)
      .order('game_highscore', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No scores recorded yet.</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const prizeAmt = getWeeklyPrizeForRank(rank);
      const prize = prizeAmt > 0 ? `${prizeAmt.toLocaleString()} PGT` : '0 PGT';

      const shortAddr = `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}`;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name">${formatLeaderboardName(row, isUser)} ${isUser ? '<span style="color:var(--color-accent); font-size:0.8rem;">(You)</span>' : ''}</span>
        <span class="leaderboard-score">${(row.game_highscore || 0).toLocaleString()}</span>
        <span class="leaderboard-prize">${prize}</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load arcade leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

export async function loadInvadersLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-invaders-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('wallet_address, linked_wallet_address, invaders_highscore, username, email')
      .gt('invaders_highscore', 0)
      .order('invaders_highscore', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No scores recorded yet.</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const prizeAmt = getWeeklyPrizeForRank(rank);
      const prize = prizeAmt > 0 ? `${prizeAmt.toLocaleString()} PGT` : '0 PGT';

      const shortAddr = `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}`;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name">${formatLeaderboardName(row, isUser)} ${isUser ? '<span style="color:var(--color-accent); font-size:0.8rem;">(You)</span>' : ''}</span>
        <span class="leaderboard-score">${(row.invaders_highscore || 0).toLocaleString()}</span>
        <span class="leaderboard-prize">${prize}</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load invaders leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

export async function loadDriftLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-drift-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('wallet_address, linked_wallet_address, drift_highscore, username, email')
      .gt('drift_highscore', 0)
      .order('drift_highscore', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No drift scores recorded yet.</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const prizeAmt = getWeeklyPrizeForRank(rank);
      const prize = prizeAmt > 0 ? `${prizeAmt.toLocaleString()} PGT` : '0 PGT';

      const shortAddr = `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}`;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name">${formatLeaderboardName(row, isUser)} ${isUser ? '<span style="color:var(--color-accent); font-size:0.8rem;">(You)</span>' : ''}</span>
        <span class="leaderboard-score">${(row.drift_highscore || 0).toLocaleString()}</span>
        <span class="leaderboard-prize">${prize}</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load drift leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}
window.loadDriftLeaderboard = loadDriftLeaderboard;

export async function loadReferralLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-ref-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('wallet_address, linked_wallet_address, referrals_count, total_referral_commission, username, email')
      .gt('referrals_count', 0)
      .order('referrals_count', { ascending: false })
      .limit(10);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No referrers yet.</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const shortAddr = `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}`;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name">${formatLeaderboardName(row, isUser)} ${isUser ? '<span style="color:var(--color-accent); font-size:0.8rem;">(You)</span>' : ''}</span>
        <span class="leaderboard-score" style="color: var(--color-primary); font-weight:700;">${row.referrals_count || 0} Ref(s)</span>
        <span class="leaderboard-prize" style="font-size:0.75rem; color:var(--color-accent); font-weight:700;">+${(row.total_referral_commission || 0).toFixed(0)} PGT</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load referral leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

export async function loadWeeklyWinsLeaderboard() {
  const scoreboard = document.getElementById('weekly-wins-leaderboard');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    // 7 days ago
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    let { data, error } = await supabase.from('bet_wins')
      .select('wallet_address, game, payout, multiplier, created_at')
      .gte('created_at', lastWeek)
      .gt('payout', 0)
      .order('payout', { ascending: false })
      .limit(10);
      
    if (error || !data) {
      const res = await supabase.from('bet_wins')
        .select('wallet_address, game, payout, multiplier, created_at')
        .order('payout', { ascending: false })
        .limit(10);
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.warn("bet_wins table select warning:", error.message);
    }
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-dim);">No big wins yet this week!</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      
      let isUser = false;
      if (appState.state.walletConnected && appState.state.walletAddress) {
        if (row.wallet_address.toLowerCase() === appState.state.walletAddress.toLowerCase()) {
           isUser = true;
        }
      }
      
      let addr = row.wallet_address;
      let shortAddr = addr;
      if (addr.length === 42) {
          shortAddr = `${addr.substring(0,6)}...${addr.substring(38)}`;
      }
      
      item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); ${isUser ? 'background: rgba(0, 240, 255, 0.1); border-radius: 4px;' : ''}`;
      
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-weight: bold; color: ${rank <= 3 ? 'var(--color-warning)' : 'var(--text-muted)'}; min-width: 1.5rem;">#${rank}</span>
          <span style="font-family: monospace; font-size: 0.8rem; color: ${isUser ? '#fff' : 'var(--text-dim)'};">${shortAddr}</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end;">
          <span style="font-weight: 800; color: var(--color-success); font-size: 0.95rem;">+${Number(row.payout).toLocaleString()} PGT</span>
          <span style="font-size: 0.7rem; color: var(--color-accent);">${row.game} (${row.multiplier}x)</span>
        </div>
      `;
      scoreboard.appendChild(item);
    });

  } catch(e) {
    console.error("Failed to fetch weekly wins leaderboard:", e);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--color-danger);">Failed to load wins</div>';
  }
}

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
      if (descEl) descEl.innerText = 'Historical snapshot archive of weekly 50,000 PGT prize pool winners from past weekly resets.';
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
    const { data: allData, error } = await supabase.from('users')
      .select('wallet_address, linked_wallet_address, balance_pgt, stakes, username');
      
    if (error) throw error;
    
    const totalPgtValue = document.getElementById('total-onsite-pgt-value');
    let globalTotal = 0;
    
    cachedHoldersData = (allData || []).map(u => {
      const bal = u.balance_pgt || 0;
      let staked = 0;
      if (u.stakes && Array.isArray(u.stakes)) {
        staked = u.stakes.reduce((sum, s) => (s.pool === 'pgt' ? sum + s.amount : sum), 0);
      }
      const total = bal + staked;
      globalTotal += total;
      return { ...u, totalWealth: total, bal, staked };
    });
    
    if (totalPgtValue) {
      totalPgtValue.innerText = globalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' PGT';
    }
    
    if (holdersMode === 'total') {
      cachedHoldersData.sort((a, b) => b.totalWealth - a.totalWealth);
    } else {
      cachedHoldersData.sort((a, b) => b.staked - a.staked);
    }
    holdersCurrentPage = 1;

    renderHoldersPage(holdersCurrentPage);
    recordSupplySnapshotIfNeeded(globalTotal);
    renderHoldersSupplyChart('day', globalTotal);
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
      const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const shortAddr = `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}`;
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
        <span class="leaderboard-name">${formatLeaderboardName(row, isUser)} ${isUser ? '<span style="color:var(--color-accent); font-size:0.8rem;">(You)</span>' : ''}</span>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
          <span class="leaderboard-score" style="color: ${color}; font-weight:700; font-size:1.1rem;">${primaryScore.toLocaleString([], {minimumFractionDigits:0, maximumFractionDigits:0})} ${scoreLabel}</span>
          <span style="font-size:0.75rem; color:var(--text-dim);">Wallet: ${row.bal.toLocaleString([], {maximumFractionDigits:0})} | Staked: ${row.staked.toLocaleString([], {maximumFractionDigits:0})}</span>
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

  // Query real historical supply snapshots from Supabase database
  if (supabase) {
    try {
      let sinceDate = new Date();
      if (timeframe === 'day') sinceDate.setHours(sinceDate.getHours() - 24);
      else if (timeframe === 'month') sinceDate.setDate(sinceDate.getDate() - 30);
      else if (timeframe === 'year') sinceDate.setFullYear(sinceDate.getFullYear() - 1);

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

  if (timeframe === 'day') {
    const now = new Date();
    const hourlyMap = {};
    
    dbHistory.forEach(item => {
      const d = new Date(item.created_at);
      const hourKey = `${d.getHours()}:00`;
      hourlyMap[hourKey] = parseFloat(item.total_supply || 0);
    });

    let lastKnownVal = currentHoldersTotalSupply;
    for (let i = 23; i >= 0; i--) {
      const slotTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = `${slotTime.getHours()}:00`;
      labels.push(hourKey);
      
      if (hourlyMap[hourKey] !== undefined) {
        lastKnownVal = hourlyMap[hourKey];
      }
      chartData.push(lastKnownVal);
    }
  } else if (dbHistory.length > 0) {
    dbHistory.forEach(item => {
      const d = new Date(item.created_at);
      if (timeframe === 'month') labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      else labels.push(d.toLocaleString('default', { month: 'short' }));
      chartData.push(parseFloat(item.total_supply || 0));
    });
  } else {
    const now = new Date();
    if (timeframe === 'month') {
      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
        chartData.push(currentHoldersTotalSupply);
      }
    } else {
      for (let i = 3; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
        labels.push(d.toLocaleString('default', { month: 'short' }));
        chartData.push(currentHoldersTotalSupply);
      }
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
        pointRadius: timeframe === 'year' ? 4 : 2
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
          ticks: { color: '#8a99ad', font: { size: 10 } }
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

// --- USER PROFILE & PGT LEADERBOARD LOGIC ---


// Fetch Username mapped to connected address
export function getActiveUsername() {
  if (!appState.state.walletConnected || !appState.state.walletAddress) {
    return "Anonymous Player";
  }
  const addr = appState.state.walletAddress.toLowerCase();
  const saved = localStorage.getItem(`polygame_username_${addr}`);
  return saved || `Player_${addr.substring(2, 8)}`;
}

// Sync values inside Profile view
export function syncProfileView() {
  const profileNameInput = document.getElementById('profile-name-input');
  if (profileNameInput && document.activeElement !== profileNameInput) {
    profileNameInput.value = getActiveUsername();
  }

  const googleStatusEl = document.getElementById('profile-auth-google');
  const web3StatusEl = document.getElementById('profile-auth-web3');
  const primaryAddrEl = document.getElementById('profile-primary-address');
  const linkedAddrEl = document.getElementById('profile-linked-address');

  const linkGoogleBtn = document.getElementById('btn-profile-link-google');
  if (googleStatusEl) {
    if (appState.state.authUserEmail) {
      googleStatusEl.innerText = `Connected (${appState.state.authUserEmail})`;
      googleStatusEl.style.color = "var(--color-accent)";
      if (linkGoogleBtn) linkGoogleBtn.style.display = "none";
    } else if (appState.state.authUserId || (appState.state.walletAddress && appState.state.walletAddress.startsWith('0xg'))) {
      googleStatusEl.innerText = "Connected (Google Account)";
      googleStatusEl.style.color = "var(--color-accent)";
      if (linkGoogleBtn) linkGoogleBtn.style.display = "none";
    } else {
      googleStatusEl.innerText = "Not Connected";
      googleStatusEl.style.color = "var(--text-muted)";
      if (linkGoogleBtn) linkGoogleBtn.style.display = "inline-block";
    }
  }

  if (web3StatusEl) {
    const linked = appState.state.linkedWalletAddress;
    const primary = appState.state.walletAddress;
    const realWeb3 = (linked && !linked.startsWith('0xg')) ? linked : (!primary.startsWith('0xg') ? primary : null);

    if (realWeb3 && realWeb3.length >= 42 && appState.state.walletConnected) {
      let provStr = appState.state.walletProvider || 'metamask';
      provStr = provStr.replace('google_linked', 'MetaMask').replace('google', 'MetaMask').toUpperCase();
      web3StatusEl.innerText = `Connected (${provStr})`;
      web3StatusEl.style.color = "var(--color-primary)";
    } else {
      web3StatusEl.innerText = "Not Connected";
      web3StatusEl.style.color = "var(--text-muted)";
    }
  }

  if (primaryAddrEl) {
    const primary = appState.state.walletAddress;
    if (primary && primary.startsWith('0xg')) {
      primaryAddrEl.innerText = primary;
    } else if (appState.state.authUserId) {
      const internalAddr = ('0xg' + appState.state.authUserId.replace(/-/g, '') + '0000000000000000000000000000000000000000').substring(0, 42).toLowerCase();
      primaryAddrEl.innerText = internalAddr;
    } else {
      primaryAddrEl.innerText = primary || "None";
    }
  }

  if (linkedAddrEl) {
    const linked = appState.state.linkedWalletAddress;
    const primary = appState.state.walletAddress;
    if (linked && !linked.startsWith('0xg') && linked.length >= 42) {
      linkedAddrEl.innerText = linked;
      linkedAddrEl.style.color = "var(--color-accent)";
    } else if (primary && !primary.startsWith('0xg') && primary.length >= 42) {
      linkedAddrEl.innerText = primary;
      linkedAddrEl.style.color = "var(--color-accent)";
    } else {
      linkedAddrEl.innerText = "No Web3 Wallet Linked (Click Connect Wallet to link)";
      linkedAddrEl.style.color = "var(--text-muted)";
    }
  }

  // Summary achievements
  const achieveScore = document.getElementById('profile-achieve-score');
  const achieveNft = document.getElementById('profile-achieve-nft');
  const achieveStaked = document.getElementById('profile-achieve-staked');

  if (achieveScore) achieveScore.innerText = appState.state.gameHighScore;
  
  if (achieveNft) {
    if (appState.state.equippedNft) {
      const nft = NFT_REGISTRY.find(n => n.id === appState.state.equippedNft);
      if (nft) {
        achieveNft.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 36px; height: 36px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color-rarity); background: rgba(0,0,0,0.3); display:flex; justify-content:center; align-items:center;">
              <img src="metadata/images/${nft.id}.png" alt="${nft.name}" style="width: 100%; height: 100%; object-fit: cover; position: relative; z-index: 10;" onerror="this.src=''; this.onerror=null; this.parentElement.innerHTML='${nft.svg.replace(/'/g, "&apos;")}';"/>
            </div>
            <span style="font-size: 0.95rem; font-weight: 700; color: var(--color-secondary);">${nft.name}</span>
          </div>
        `;
      } else {
        achieveNft.innerHTML = `<span class="multiplier-value" style="color: var(--color-secondary); font-size: 1rem;">None</span>`;
      }
    } else {
      achieveNft.innerHTML = `<span class="multiplier-value" style="color: var(--color-secondary); font-size: 1rem;">None</span>`;
    }
  }

  if (achieveStaked) {
    let totalStaked = 0;
    (appState.state.stakes || []).forEach(s => {
      totalStaked += parseFloat(s.amount || 0);
    });
    achieveStaked.innerText = `${parseFloat(totalStaked || 0).toFixed(2)} Tokens`;
  }
}

// Profile Save button listener
export const btnSaveProfile = document.getElementById('btn-save-profile');
if (btnSaveProfile) {
  btnSaveProfile.addEventListener('click', () => {
    const input = document.getElementById('profile-name-input');
    if (!input) return;
    
    const nameStr = input.value.trim();
    if (!nameStr) {
      triggerToast("Username cannot be empty!", "error");
      return;
    }

    const address = appState.state.walletAddress || "anonymous";
    localStorage.setItem(`polygame_username_${address.toLowerCase()}`, nameStr);
    
    appState.update({ username: nameStr });
    
    triggerToast("Username saved!", "success");
    sfx.playSuccess();

    appState.syncUI();
    
    // Refresh active leaderboard displays
    loadAstroDodgeLeaderboard();
    loadInvadersLeaderboard();
    loadReferralLeaderboard();
    loadHoldersLeaderboard();
  });
}
window.setupLeaderboardUI = loadAstroDodgeLeaderboard;

export async function autoConnectWeb3() {
  if (appState.state.walletConnected && appState.state.walletAddress) {
    const addr = appState.state.walletAddress;

    // Refresh live on-chain POL and PGT balances via direct RPC
    if (typeof window.getDirectPolygonPOLBalance === 'function') {
      try {
        const livePol = await window.getDirectPolygonPOLBalance(addr);
        const livePgt = await window.getDirectPolygonPGTBalance(addr);
        if (livePol > 0) appState.state.balanceMatic = livePol;
        if (livePgt > 0) appState.state.onchainBalancePgt = livePgt;
        appState.syncUI();
      } catch (e) {
        console.warn("Direct RPC startup balance fetch warning:", e);
      }
    }

    // 1. Re-verify Web3 provider if desktop extension is present
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWeb3(true);
          return;
        }
      } catch (e) {
        console.error("Auto connection check failed:", e);
      }
    }

    // 2. Instantly pull fresh DB data on every page refresh (F5) silently
    try {
      await syncProfileWithDb(
        appState.state.walletAddress,
        appState.state.onchainBalancePgt || 0,
        appState.state.onchainBalance1flr || 0,
        appState.state.balanceMatic || 0,
        null,
        true
      );
    } catch (e) {
      console.error("DB refresh on startup failed:", e);
    }
  }
}

// --- VIP Subscription ---
const btnBuyVip = document.getElementById('btn-buy-vip');
if (btnBuyVip) {
  btnBuyVip.addEventListener('click', () => {
    // Redirect to NFT Marketplace to buy the Consumable VIP Pass
    if (typeof window.switchTab === 'function') {
      window.switchTab('nft');
      if (typeof window.switchNftView === 'function') {
        window.switchNftView('market');
      }
    }
  });
}

export async function loadPastWeeklyArchive(targetWeekLabel = null) {
  const container = document.getElementById('leaderboard-pgt-container');
  const selectDropdown = document.getElementById('weekly-archive-select-week');
  if (!container || !supabase) return;

  try {
    // Populate distinct week labels into dropdown if needed
    if (selectDropdown && selectDropdown.options.length <= 1) {
      const { data: weekLabels } = await supabase.from('weekly_leaderboard_history').select('week_label').order('created_at', { ascending: false });
      if (weekLabels && weekLabels.length > 0) {
        const uniqueWeeks = [...new Set(weekLabels.map(w => w.week_label))];
        selectDropdown.innerHTML = '<option value="">🗓️ All Past Weekly Resets</option>';
        uniqueWeeks.forEach(w => {
          const opt = document.createElement('option');
          opt.value = w;
          opt.innerText = `🗓️ Week of ${w}`;
          selectDropdown.appendChild(opt);
        });
        if (targetWeekLabel) selectDropdown.value = targetWeekLabel;
      }
    }

    let query = supabase.from('weekly_leaderboard_history').select('*');
    if (targetWeekLabel && targetWeekLabel !== '') {
      query = query.eq('week_label', targetWeekLabel);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).order('rank', { ascending: true }).limit(500);

    if (error) throw error;

    container.innerHTML = '';
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No archived weekly leaderboard snapshots found for this timeframe.</div>';
      return;
    }

    // Group by week_label
    const weeksMap = {};
    data.forEach(row => {
      if (!weeksMap[row.week_label]) weeksMap[row.week_label] = [];
      weeksMap[row.week_label].push(row);
    });

    Object.keys(weeksMap).forEach(weekLabel => {
      const weekSection = document.createElement('div');
      weekSection.style.cssText = 'margin-bottom: 1.5rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: var(--border-radius-md); border: 1px solid var(--border-glass);';
      
      const weekHeader = document.createElement('h4');
      weekHeader.style.cssText = 'color: var(--color-primary); margin-bottom: 0.75rem; font-size: 1rem; display: flex; justify-content: space-between; align-items: center;';
      weekHeader.innerHTML = `<span>🗓️ Weekly Reset Snapshot: <strong>${weekLabel}</strong></span> <span style="font-size:0.8rem; color:var(--color-warning);">🏆 50,000 PGT Pool</span>`;
      weekSection.appendChild(weekHeader);

      const rows = weeksMap[weekLabel];
      rows.forEach(row => {
        const item = document.createElement('div');
        const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
        item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.6rem; border-bottom: 1px dashed rgba(255,255,255,0.05); ${isUser ? 'background: rgba(0, 240, 255, 0.1); border-radius: 4px;' : ''}`;
        
        const shortAddr = row.wallet_address.length === 42 ? `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}` : row.wallet_address;
        const displayName = row.username ? row.username : shortAddr;

        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: bold; color: ${row.rank <= 3 ? 'var(--color-warning)' : 'var(--text-muted)'}; min-width: 1.5rem;">#${row.rank}</span>
            <span style="font-family: monospace; font-size: 0.85rem; color: ${isUser ? '#fff' : 'var(--text-white)'};">${displayName} ${isUser ? '<span style="color:var(--color-accent); font-size:0.75rem;">(You)</span>' : ''}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: 0.8rem; color: var(--text-dim);">Score: ${Number(row.best_score).toLocaleString()}</span>
            <span style="font-weight: 800; color: var(--color-success); font-size: 0.85rem;">+${Number(row.prize_pgt).toLocaleString()} PGT</span>
          </div>
        `;
        weekSection.appendChild(item);
      });

      container.appendChild(weekSection);
    });

  } catch (err) {
    console.error("Failed to load past weekly leaderboard archive:", err);
    container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading archive.</div>';
  }
}
window.loadPastWeeklyArchive = loadPastWeeklyArchive;


export function syncAmbassadorProfileBadge() {
  const badgeEl = document.getElementById('ambassador-profile-status-badge');
  if (!badgeEl) return;

  const isAmb = !!appState.state.isAmbassador;
  if (isAmb) {
    badgeEl.innerText = '🎖️ OFFICIAL AMBASSADOR';
    badgeEl.style.background = 'rgba(255, 170, 0, 0.2)';
    badgeEl.style.color = 'var(--color-warning)';
    badgeEl.style.border = '1px solid var(--color-warning)';
  } else {
    badgeEl.innerText = 'REGULAR PLAYER';
    badgeEl.style.background = 'rgba(255, 255, 255, 0.1)';
    badgeEl.style.color = 'var(--text-muted)';
    badgeEl.style.border = '1px solid var(--border-glass)';
  }
}
window.syncAmbassadorProfileBadge = syncAmbassadorProfileBadge;


// Open Public Player Profile Modal
export async function openPublicProfile(walletAddress) {
  if (!walletAddress || typeof window.openModal !== 'function') return;
  walletAddress = walletAddress.toLowerCase().trim();

  window.openModal('public-profile');

  const usernameEl = document.getElementById('pub-profile-username');
  const walletEl = document.getElementById('pub-profile-wallet');
  const avatarEl = document.getElementById('pub-profile-avatar');
  const badgesEl = document.getElementById('pub-profile-badges');

  const scoreInvadersEl = document.getElementById('pub-profile-score-invaders');
  const scoreDodgeEl = document.getElementById('pub-profile-score-dodge');
  const scoreDriftEl = document.getElementById('pub-profile-score-drift');

  const pgtEl = document.getElementById('pub-profile-pgt');
  const stakedEl = document.getElementById('pub-profile-staked');
  const referralsEl = document.getElementById('pub-profile-referrals');
  const nftsGridEl = document.getElementById('pub-profile-nfts-grid');

  if (usernameEl) usernameEl.innerText = "Loading Player...";
  if (walletEl) walletEl.innerText = `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`;
  if (nftsGridEl) nftsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">Loading NFTs...</div>';

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      if (usernameEl) usernameEl.innerText = "Anonymous Player";
      if (nftsGridEl) nftsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">No public profile data available.</div>';
      return;
    }

    const shortAddr = `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`;
    const name = user.username || shortAddr;

    if (usernameEl) usernameEl.innerText = name;
    if (avatarEl) avatarEl.innerText = (name.charAt(0) || '🎮').toUpperCase();
    if (walletEl) walletEl.innerText = walletAddress;

    // Badges
    let badgesHtml = '';
    if (user.is_ambassador) badgesHtml += '<span style="background:rgba(255,170,0,0.15); color:var(--color-warning); border:1px solid var(--color-warning); padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:800;">🎖️ AMBASSADOR</span>';
    if (user.vip_until && new Date(user.vip_until).getTime() > Date.now()) badgesHtml += '<span style="background:rgba(255,215,0,0.15); color:var(--color-warning); border:1px solid var(--color-warning); padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:800;">👑 VIP MEMBER</span>';
    if (badgesEl) badgesHtml ? (badgesEl.innerHTML = badgesHtml) : (badgesEl.innerHTML = '<span style="color:var(--text-dim); font-size:0.75rem;">Regular Player</span>');

    // Arcade High Scores (All-Time Career & Active Weekly)
    const alltimeInv = Math.max(user.alltime_invaders_highscore || 0, user.invaders_highscore || 0);
    const alltimeDod = Math.max(user.alltime_game_highscore || 0, user.game_highscore || 0);
    const alltimeDri = Math.max(user.alltime_drift_highscore || 0, user.drift_highscore || 0);

    if (scoreInvadersEl) scoreInvadersEl.innerText = alltimeInv.toLocaleString();
    if (scoreDodgeEl) scoreDodgeEl.innerText = alltimeDod.toLocaleString();
    if (scoreDriftEl) scoreDriftEl.innerText = alltimeDri.toLocaleString();

    const wInv = document.getElementById('pub-profile-weekly-invaders');
    const wDod = document.getElementById('pub-profile-weekly-dodge');
    const wDri = document.getElementById('pub-profile-weekly-drift');

    if (wInv) wInv.innerText = (user.invaders_highscore || user.invaders_score || 0).toLocaleString();
    if (wDod) wDod.innerText = (user.game_highscore || user.game_score || 0).toLocaleString();
    if (wDri) wDri.innerText = (user.drift_highscore || user.drift_score || 0).toLocaleString();

    // Stats
    if (pgtEl) pgtEl.innerText = `${(user.balance_pgt || 0).toLocaleString([], {maximumFractionDigits:0})} PGT`;
    if (stakedEl) stakedEl.innerText = `${(user.staked_balance_pgt || 0).toLocaleString([], {maximumFractionDigits:0})} PGT`;
    if (referralsEl) referralsEl.innerText = `${user.referrals_count || 0} Players`;

    // NFTs
    const ownedIds = user.owned_nfts || [];
    if (!ownedIds || ownedIds.length === 0) {
      if (nftsGridEl) nftsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">No NFTs in collection yet.</div>';
    } else {
      let nftsHtml = '';
      ownedIds.forEach(nftId => {
        const activeNft = NFT_REGISTRY.find(n => n.id === nftId);
        const nftName = activeNft ? activeNft.name : `NFT #${nftId}`;
        const nftIcon = activeNft ? (activeNft.icon || '🎨') : '🎨';
        nftsHtml += `
          <div style="background: rgba(0,0,0,0.4); border: 1px solid var(--border-glass); padding: 0.4rem 0.65rem; border-radius: 6px; display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem;">
            <span>${nftIcon}</span>
            <strong style="color: #fff;">${nftName}</strong>
          </div>
        `;
      });
      if (nftsGridEl) nftsGridEl.innerHTML = nftsHtml;
    }
  } catch (err) {
    console.error("Public Profile fetch error:", err);
    if (usernameEl) usernameEl.innerText = "Error Loading Player";
  }
}
window.openPublicProfile = openPublicProfile;
