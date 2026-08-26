
function checkIsUserRow(row) {
  if (!appState || !appState.state || !appState.isPlayerConnected()) return false;
  const authId = appState.state.authUserId;
  const playerId = (appState.state.playerId || '').toLowerCase();
  const primary = (appState.state.walletAddress || '').toLowerCase();
  const linked = (appState.state.linkedWalletAddress || '').toLowerCase();

  const rowAuthId = row.user_id;
  const rowPrimary = (row.player_id || '').toLowerCase();
  const rowLinked = (row.linked_wallet_address || '').toLowerCase();

  if (authId && rowAuthId && authId === rowAuthId) return true;
  if (playerId && rowPrimary && playerId === rowPrimary) return true;
  if (playerId && rowLinked && playerId === rowLinked) return true;
  if (primary && rowPrimary && primary === rowPrimary) return true;
  if (linked && rowLinked && linked === rowLinked) return true;
  if (linked && rowPrimary && linked === rowPrimary) return true;
  if (primary && rowLinked && primary === rowLinked) return true;

  return false;
}

function formatLeaderboardName(row, isUser) {
  const isInternalAddr = (addr) => !addr || addr.toLowerCase().startsWith('0xpgt') || addr.toLowerCase().startsWith('0xg');
  
  const realAddr = (row.linked_wallet_address && !isInternalAddr(row.linked_wallet_address)) 
    ? row.linked_wallet_address 
    : (!isInternalAddr(row.player_id) ? row.player_id : '');

  let shortAddr = 'Google_User';
  if (realAddr && realAddr.length >= 42) {
    shortAddr = `${realAddr.substring(0, 6)}...${realAddr.substring(realAddr.length - 4)}`;
  } else {
    const rawId = row.player_id || row.user_id || '';
    shortAddr = rawId.length >= 4 ? rawId.substring(rawId.length - 4) : 'User';
  }
  
  let displayName = row.username;
  if (isUser && appState.state.username) {
    displayName = appState.state.username;
  }

  const clickAddr = realAddr || row.player_id || '';
  const clickAttr = clickAddr ? `onclick="openPublicProfile('${clickAddr}')" style="cursor:pointer; text-decoration:underline; text-decoration-color:rgba(0,240,255,0.3);" title="Click to view public player profile"` : '';

  if (displayName && displayName.trim() !== '') {
    return `<strong style="color:var(--color-primary); font-family: inherit;" ${clickAttr}>${displayName}</strong>`;
  }

  return `<span style="font-family: monospace; color:var(--color-primary);" ${clickAttr}>Player_${shortAddr}</span>`;
}

import { supabase, ADMIN_WALLET_ADDRESS, TOKEN_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS, web3Provider } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { NFT_REGISTRY } from './nft.js';
import { appState } from '../core/state.js';
import { triggerToast, connectWeb3 } from '../core/ui.js';
import { renderRelicsVault, getSeason1Progress, getRelicMeta } from './relics.js';

// --- Leaderboard Fetching (Supabase) ---

export function getWeeklyPrizeForRank(rank, pool = 50000) {
  if (!pool || pool <= 0) return 0;
  if (rank === 1) return Math.round(pool * 0.30);
  if (rank === 2) return Math.round(pool * 0.16);
  if (rank === 3) return Math.round(pool * 0.08);
  if (rank <= 10) return Math.round(pool * 0.02);
  if (rank <= 25) return Math.round(pool * 0.008);
  if (rank <= 50) return Math.round(pool * 0.004);
  if (rank <= 100) return Math.round(pool * 0.002);
  return 0;
}

export async function loadAstroDodgeLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-arcade-container');
  if (!scoreboard) return;

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const pool = (settings.astrododge && settings.astrododge.weekly_pool_pgt !== undefined) ? Number(settings.astrododge.weekly_pool_pgt) : 50000;
  const poolEl = document.getElementById('lb-pool-arcade');
  if (poolEl) poolEl.innerText = `Weekly Pool: ${pool.toLocaleString()} PGT`;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('player_id, linked_wallet_address, game_highscore, username, email, user_id, auth_provider')
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
      const isUser = checkIsUserRow(row);
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const prizeAmt = getWeeklyPrizeForRank(rank, pool);
      const prize = prizeAmt > 0 ? `${prizeAmt.toLocaleString()} PGT` : '0 PGT';

      const pid = row.linked_wallet_address || row.player_id || '';
      const shortAddr = pid.length >= 10 ? `${pid.substring(0,6)}...${pid.substring(pid.length - 4)}` : (pid || 'Player');
      
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
window.loadAstroDodgeLeaderboard = loadAstroDodgeLeaderboard;

export async function loadInvadersLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-invaders-container');
  if (!scoreboard) return;

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const pool = (settings.invaders && settings.invaders.weekly_pool_pgt !== undefined) ? Number(settings.invaders.weekly_pool_pgt) : 50000;
  const poolEl = document.getElementById('lb-pool-invaders');
  if (poolEl) poolEl.innerText = `Weekly Pool: ${pool.toLocaleString()} PGT`;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('player_id, linked_wallet_address, invaders_highscore, username, email, user_id, auth_provider')
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
      const isUser = checkIsUserRow(row);
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const prizeAmt = getWeeklyPrizeForRank(rank, pool);
      const prize = prizeAmt > 0 ? `${prizeAmt.toLocaleString()} PGT` : '0 PGT';

      const pid = row.linked_wallet_address || row.player_id || '';
      const shortAddr = pid.length >= 10 ? `${pid.substring(0,6)}...${pid.substring(pid.length - 4)}` : (pid || 'Player');
      
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
window.loadInvadersLeaderboard = loadInvadersLeaderboard;

export async function loadDriftLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-drift-container');
  if (!scoreboard) return;

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const pool = (settings.drift && settings.drift.weekly_pool_pgt !== undefined) ? Number(settings.drift.weekly_pool_pgt) : 50000;
  const poolEl = document.getElementById('lb-pool-drift');
  if (poolEl) poolEl.innerText = `Weekly Pool: ${pool.toLocaleString()} PGT`;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('player_id, linked_wallet_address, drift_highscore, username, email, user_id, auth_provider')
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
      const isUser = checkIsUserRow(row);
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const prizeAmt = getWeeklyPrizeForRank(rank, pool);
      const prize = prizeAmt > 0 ? `${prizeAmt.toLocaleString()} PGT` : '0 PGT';

      const pid = row.player_id || row.linked_wallet_address || '';
      const shortAddr = pid.length >= 10 ? `${pid.substring(0,6)}...${pid.substring(pid.length - 4)}` : pid;
      
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

export async function loadStackerLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-stacker-container') || document.getElementById('leaderboard-catcher-container');
  if (!scoreboard) return;

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const stackerConf = settings.stacker || settings.catcher || {};
  const pool = (stackerConf.weekly_pool_pgt !== undefined) ? Number(stackerConf.weekly_pool_pgt) : 50000;
  const poolEl = document.getElementById('lb-pool-stacker') || document.getElementById('lb-pool-catcher');
  if (poolEl) poolEl.innerText = `Weekly Pool: ${pool.toLocaleString()} PGT`;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('player_id, linked_wallet_address, stacker_highscore, username, email, user_id, auth_provider')
      .gt('stacker_highscore', 0)
      .order('stacker_highscore', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No stacker scores recorded yet.</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      const isUser = checkIsUserRow(row);
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const prizeAmt = getWeeklyPrizeForRank(rank, pool);
      const prize = prizeAmt > 0 ? `${prizeAmt.toLocaleString()} PGT` : '0 PGT';
      const scoreVal = row.stacker_highscore || 0;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name">${formatLeaderboardName(row, isUser)} ${isUser ? '<span style="color:var(--color-accent); font-size:0.8rem;">(You)</span>' : ''}</span>
        <span class="leaderboard-score">${scoreVal.toLocaleString()}</span>
        <span class="leaderboard-prize">${prize}</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load stacker leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}
window.loadStackerLeaderboard = loadStackerLeaderboard;
window.loadCatcherLeaderboard = loadStackerLeaderboard;

export async function loadSkeetLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-skeet-container');
  if (!scoreboard) return;

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const skeetConf = settings.skeet || {};
  const pool = (skeetConf.weekly_pool_pgt !== undefined) ? Number(skeetConf.weekly_pool_pgt) : 25000;
  const poolEl = document.getElementById('lb-pool-skeet');
  if (poolEl) poolEl.innerText = `Weekly Pool: ${pool.toLocaleString()} PGT`;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('player_id, linked_wallet_address, skeet_highscore, username, email, user_id, auth_provider')
      .gt('skeet_highscore', 0)
      .order('skeet_highscore', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No skeet scores recorded yet.</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      const isUser = checkIsUserRow(row);
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const prizeAmt = getWeeklyPrizeForRank(rank, pool);
      const prize = prizeAmt > 0 ? `${prizeAmt.toLocaleString()} PGT` : '0 PGT';
      const scoreVal = row.skeet_highscore || 0;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name">${formatLeaderboardName(row, isUser)} ${isUser ? '<span style="color:var(--color-accent); font-size:0.8rem;">(You)</span>' : ''}</span>
        <span class="leaderboard-score">${scoreVal.toLocaleString()}</span>
        <span class="leaderboard-prize">${prize}</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load skeet leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}
window.loadSkeetLeaderboard = loadSkeetLeaderboard;

export async function loadReferralLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-ref-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('player_id, linked_wallet_address, referrals_count, total_referral_commission, username, email, user_id, auth_provider')
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
      const isUser = checkIsUserRow(row);
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const pid = row.linked_wallet_address || row.player_id || '';
      const shortAddr = pid.length >= 10 ? `${pid.substring(0,6)}...${pid.substring(pid.length - 4)}` : (pid || 'Player');
      
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
    
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-dim);">No big wins yet this week!</div>';
      return;
    }

    // Fetch user profiles map to resolve display names (usernames & identities)
    const { data: userProfiles } = await supabase.from('users').select('player_id, linked_wallet_address, username, email, user_id');
    const userMap = {};
    if (userProfiles) {
      userProfiles.forEach(u => {
        if (u.player_id) userMap[u.player_id.toLowerCase()] = u;
        if (u.linked_wallet_address) userMap[u.linked_wallet_address.toLowerCase()] = u;
      });
    }

    const activeSt = (typeof getAppState === 'function' ? getAppState() : (window.appState || null));

    // Clear previous elements synchronously before rendering fresh 10 rows
    scoreboard.innerHTML = '';

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      
      const rawAddr = (row.wallet_address || row.player_id || '').toLowerCase();
      const matchedUser = userMap[rawAddr] || { player_id: rawAddr };
      const isUser = checkIsUserRow(matchedUser);

      let displayName = matchedUser.username;
      if (isUser && activeSt?.state?.username) {
        displayName = activeSt.state.username;
      }

      let isCustomName = !!(displayName && displayName.trim() !== '');

      if (!isCustomName) {
        if (rawAddr.length >= 10) {
          displayName = `${rawAddr.substring(0, 6)}...${rawAddr.substring(rawAddr.length - 4)}`;
        } else if (rawAddr.length > 0) {
          displayName = `Player_${rawAddr.substring(Math.max(0, rawAddr.length - 4))}`;
        } else {
          displayName = 'Player';
        }
      }
      
      item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); ${isUser ? 'background: rgba(0, 240, 255, 0.1); border-radius: 4px;' : ''}`;
      
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-weight: bold; color: ${rank <= 3 ? 'var(--color-warning)' : 'var(--text-muted)'}; min-width: 1.5rem;">#${rank}</span>
          <span style="font-size: 0.85rem; font-weight: ${isCustomName ? '700' : '400'}; ${!isCustomName ? 'font-family: monospace;' : ''} color: ${isUser ? '#fff' : 'var(--color-primary)'};">
            ${displayName} ${isUser ? '<span style="font-size: 0.75rem; color: var(--color-accent); margin-left: 0.25rem;">(You)</span>' : ''}
          </span>
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
      supabase.from('users').select('player_id, linked_wallet_address, balance_pgt, username, email, user_id, auth_provider, total_claims, relics, space_state'),
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
    
    const globalArcadePlays = arcadeCount || 0;

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
  if (!appState || !appState.state) {
    return "Anonymous Player";
  }
  
  // 1. Highest priority: Verified database username in appState
  if (appState.state.username && appState.state.username.trim() !== '') {
    return appState.state.username.trim();
  }

  // 2. Second priority: Local storage lookup across all linked identifiers
  const primaryAddr = (appState.state.walletAddress || '').toLowerCase();
  const linkedAddr = (appState.state.linkedWalletAddress || '').toLowerCase();
  const pid = (appState.state.playerId || '').toLowerCase();

  const saved = (primaryAddr && localStorage.getItem(`polygame_username_${primaryAddr}`)) ||
                (linkedAddr && localStorage.getItem(`polygame_username_${linkedAddr}`)) ||
                (pid && localStorage.getItem(`polygame_username_${pid}`));
  if (saved && saved.trim() !== '') return saved.trim();

  // 3. Third priority: Google Auth name/email prefix
  if (appState.state.authUserEmail) {
    return appState.state.authUserEmail.split('@')[0];
  }

  // 4. Default short address tag
  const isInternal = (addr) => !addr || addr.startsWith('0xpgt') || addr.startsWith('0xg');
  const realWeb3 = (linkedAddr && linkedAddr.length >= 42 && !isInternal(linkedAddr)) ? linkedAddr : (!isInternal(primaryAddr) ? primaryAddr : null);
  if (realWeb3 && realWeb3.length >= 42) {
    return `Player_${realWeb3.substring(0, 6)}...${realWeb3.substring(realWeb3.length - 4)}`;
  }
  return pid ? `Player_${pid.substring(pid.length >= 6 ? pid.length - 4 : 2)}` : "Anonymous Player";
}

// --- Web3 Control & Profile Actions (v1.4.497) ---

export function copyProfileAddress() {
  const linked = appState?.state?.linkedWalletAddress;
  const primary = appState?.state?.walletAddress;
  const pid = appState?.state?.playerId;
  const isInternal = (addr) => !addr || addr.startsWith('0xpgt') || addr.startsWith('0xg');
  const targetAddr = (linked && !isInternal(linked)) ? linked : (!isInternal(primary) ? primary : (linked || primary || pid || ''));
  
  if (!targetAddr) {
    triggerToast("No linked wallet address to copy", "warning");
    return;
  }

  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(targetAddr).then(() => {
      triggerToast(`📋 Address copied: ${targetAddr.substring(0, 6)}...${targetAddr.substring(targetAddr.length - 4)}`, "success");
      if (sfx) sfx.play('click');
    }).catch(() => {
      triggerToast("Clipboard copy failed", "error");
    });
  } else {
    // Fallback for non-https / mobile webviews
    const tempInput = document.createElement('input');
    tempInput.value = targetAddr;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    triggerToast(`📋 Address copied: ${targetAddr.substring(0, 6)}...${targetAddr.substring(targetAddr.length - 4)}`, "success");
    if (sfx) sfx.play('click');
  }
}
window.copyProfileAddress = copyProfileAddress;

export function openPolygonScan() {
  const linked = appState?.state?.linkedWalletAddress;
  const primary = appState?.state?.walletAddress;
  const isInternal = (addr) => !addr || addr.startsWith('0xpgt') || addr.startsWith('0xg');
  const realWeb3 = (linked && !isInternal(linked)) ? linked : (!isInternal(primary) ? primary : null);

  if (!realWeb3 || realWeb3.length < 42) {
    triggerToast("Connect or link a Web3 wallet first to inspect on PolygonScan!", "warning");
    return;
  }
  window.open(`https://polygonscan.com/address/${realWeb3}`, '_blank');
}
window.openPolygonScan = openPolygonScan;

export async function addNftToMetaMask() {
  const nftAddr = NFT_CONTRACT_ADDRESS || "0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8";
  try {
    triggerToast("Opening PolygonScan NFT Contract Explorer...", "info");
    window.open(`https://polygonscan.com/token/${nftAddr}`, '_blank');
  } catch (e) {
    console.error("NFT Explorer error:", e);
  }
}
window.addNftToMetaMask = addNftToMetaMask;

// Sync values inside Profile view
export function syncProfileView() {
  if (!appState || !appState.state) return;

  // Toggle Master Admin Control Panel Card & Nav
  const adminCard = document.getElementById('profile-admin-card');
  const adminNav = document.getElementById('nav-item-admin');
  const adminPanel = document.getElementById('view-admin');
  const expectedAdmin = (ADMIN_WALLET_ADDRESS || "0x10b9993990c9ef8a212c9557cb02ad94da9a654d").toLowerCase();
  
  const currentPrimary = (typeof appState.state.walletAddress === 'string' ? appState.state.walletAddress : '').toLowerCase();
  const currentLinked = (typeof appState.state.linkedWalletAddress === 'string' ? appState.state.linkedWalletAddress : '').toLowerCase();
  const pid = (typeof appState.state.playerId === 'string' ? appState.state.playerId : '').toLowerCase();
  const injected = (typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.selectedAddress === 'string' ? window.ethereum.selectedAddress : '').toLowerCase();
  const isAdmin = (
    (currentPrimary && currentPrimary === expectedAdmin) ||
    (currentLinked && currentLinked === expectedAdmin) ||
    (pid && pid === expectedAdmin) ||
    (injected && injected === expectedAdmin)
  );

  if (adminCard) {
    if (isAdmin) {
      adminCard.style.display = 'block';
    } else {
      adminCard.style.setProperty('display', 'none', 'important');
    }
  }
  if (adminNav) {
    if (isAdmin) {
      adminNav.classList.add('admin-unlocked');
      adminNav.style.display = '';
    } else {
      adminNav.classList.remove('admin-unlocked');
      adminNav.style.setProperty('display', 'none', 'important');
    }
  }
  if (adminPanel) {
    if (isAdmin) {
      adminPanel.classList.add('admin-authorized');
      adminPanel.style.display = '';
    } else {
      adminPanel.classList.remove('admin-authorized');
      adminPanel.classList.remove('active');
      adminPanel.style.setProperty('display', 'none', 'important');
    }
  }

  const profileNameInput = document.getElementById('profile-name-input');
  if (profileNameInput && document.activeElement !== profileNameInput) {
    profileNameInput.value = getActiveUsername();
  }

  // --- 1. Financial Wealth Breakdown (Item 4) ---
  const availableBal = parseFloat(appState.state.balancePgt || 0);
  let totalStaked = 0;
  (appState.state.stakes || []).forEach(s => {
    totalStaked += parseFloat(s.amount || 0);
  });
  if (totalStaked === 0 && appState.state.stakedBalancePgt) {
    totalStaked = parseFloat(appState.state.stakedBalancePgt || 0);
  }
  const unclaimedPgt = parseFloat(appState.state.unclaimedReferralPgt || 0);
  const unclaimedPol = parseFloat(appState.state.totalReferralPol || appState.state.unclaimedReferralPol || 0);
  const totalNetWorth = availableBal + totalStaked + unclaimedPgt;

  const wealthAvailEl = document.getElementById('profile-wealth-available');
  const wealthStakedEl = document.getElementById('profile-wealth-staked');
  const wealthUnclaimedEl = document.getElementById('profile-wealth-unclaimed');
  const wealthUnclaimedSubEl = document.getElementById('profile-wealth-unclaimed-sub');
  const wealthNetWorthEl = document.getElementById('profile-wealth-networth');

  if (wealthAvailEl) wealthAvailEl.innerText = `${availableBal.toLocaleString([], {minimumFractionDigits: 2, maximumFractionDigits: 2})} PGT`;
  if (wealthStakedEl) wealthStakedEl.innerText = `${totalStaked.toLocaleString([], {minimumFractionDigits: 2, maximumFractionDigits: 2})} PGT`;
  if (wealthUnclaimedEl) wealthUnclaimedEl.innerText = `${unclaimedPgt.toLocaleString([], {minimumFractionDigits: 2, maximumFractionDigits: 2})} PGT`;
  if (wealthUnclaimedSubEl) wealthUnclaimedSubEl.innerText = `${unclaimedPol.toFixed(4)} POL available`;
  if (wealthNetWorthEl) wealthNetWorthEl.innerText = `${totalNetWorth.toLocaleString([], {minimumFractionDigits: 2, maximumFractionDigits: 2})} PGT`;

  // --- 2. Comprehensive Career Arcade Scorecards (Item 2) ---
  const stackerBest = Math.max(appState.state.alltimeStackerHighScore || 0, appState.state.stackerHighScore || 0, appState.state.alltimeCatcherHighScore || 0, appState.state.catcherHighScore || 0);
  const stackerWeekly = appState.state.stackerHighScore || appState.state.catcherHighScore || 0;
  const driftBest = Math.max(appState.state.alltimeDriftHighScore || 0, appState.state.driftHighScore || 0);
  const driftWeekly = appState.state.driftHighScore || 0;
  const invadersBest = Math.max(appState.state.alltimeInvadersHighScore || 0, appState.state.invadersHighScore || 0);
  const invadersWeekly = appState.state.invadersHighScore || 0;
  const dodgeBest = Math.max(appState.state.alltimeGameHighScore || 0, appState.state.gameHighScore || 0);
  const dodgeWeekly = appState.state.gameHighScore || 0;
  const skeetBest = Math.max(appState.state.alltimeSkeetHighScore || 0, appState.state.skeetHighScore || 0);
  const skeetWeekly = appState.state.skeetHighScore || 0;

  const scoreStackerEl = document.getElementById('profile-score-stacker');
  const weeklyStackerEl = document.getElementById('profile-weekly-stacker');
  const scoreDriftEl = document.getElementById('profile-score-drift');
  const weeklyDriftEl = document.getElementById('profile-weekly-drift');
  const scoreInvadersEl = document.getElementById('profile-score-invaders');
  const weeklyInvadersEl = document.getElementById('profile-weekly-invaders');
  const scoreDodgeEl = document.getElementById('profile-score-dodge');
  const weeklyDodgeEl = document.getElementById('profile-weekly-dodge');
  const scoreSkeetEl = document.getElementById('profile-score-skeet');
  const weeklySkeetEl = document.getElementById('profile-weekly-skeet');

  if (scoreStackerEl) scoreStackerEl.innerText = stackerBest.toLocaleString();
  if (weeklyStackerEl) weeklyStackerEl.innerText = stackerWeekly.toLocaleString();
  if (scoreDriftEl) scoreDriftEl.innerText = driftBest.toLocaleString();
  if (weeklyDriftEl) weeklyDriftEl.innerText = driftWeekly.toLocaleString();
  if (scoreInvadersEl) scoreInvadersEl.innerText = invadersBest.toLocaleString();
  if (weeklyInvadersEl) weeklyInvadersEl.innerText = invadersWeekly.toLocaleString();
  if (scoreDodgeEl) scoreDodgeEl.innerText = dodgeBest.toLocaleString();
  if (weeklyDodgeEl) weeklyDodgeEl.innerText = dodgeWeekly.toLocaleString();
  if (scoreSkeetEl) scoreSkeetEl.innerText = skeetBest.toLocaleString();
  if (weeklySkeetEl) weeklySkeetEl.innerText = skeetWeekly.toLocaleString();

  // PolySpace Fleet Operations
  const spacePowerEl = document.getElementById('profile-space-power');
  const spaceUpgradesEl = document.getElementById('profile-space-upgrades');
  const spaceMinedEl = document.getElementById('profile-space-mined');
  const spaceState = appState.state.spaceState || {};

  if (spacePowerEl) spacePowerEl.innerText = (spaceState.fleetPower || 100).toLocaleString();
  if (spaceUpgradesEl) {
    const maxMod = Math.max(spaceState.warpLevel || 1, spaceState.laserLevel || 1, spaceState.cargoLevel || 1, spaceState.shieldLevel || 1, spaceState.turretLevel || 1);
    spaceUpgradesEl.innerText = `Lv. ${maxMod}`;
  }
  if (spaceMinedEl) {
    const totalMined = spaceState.mineralsMinedTotal || ((spaceState.iron || 0) + (spaceState.titanium || 0) + (spaceState.quantum || 0) + (spaceState.pgtOre || 0));
    spaceMinedEl.innerText = totalMined.toLocaleString();
  }

  // Daily Operations
  const faucetTotalEl = document.getElementById('profile-faucet-total');
  const faucetStreakEl = document.getElementById('profile-faucet-streak');
  const questsCompletedEl = document.getElementById('profile-quests-completed');

  if (faucetTotalEl) faucetTotalEl.innerText = (appState.state.totalClaims || 0).toLocaleString();
  if (faucetStreakEl) faucetStreakEl.innerText = `${appState.state.claimStreak || 0} Days`;
  if (questsCompletedEl) {
    const dq = appState.state.dailyQuests || {};
    let done = 0;
    if (dq.arcade_claimed || dq.arcade_wins >= 3) done++;
    if (dq.mining_claimed || dq.mining_ops >= 1) done++;
    if (dq.wager_claimed || dq.wager_count >= 5) done++;
    questsCompletedEl.innerText = `${done} / 3`;
  }

  // --- 3. Equipped Utility NFT Core & Combined Multipliers (Item 5) ---
  const nftAvatarFrame = document.getElementById('profile-nft-avatar-frame');
  const nftNameEl = document.getElementById('profile-nft-name');
  const nftRarityBadge = document.getElementById('profile-nft-rarity-badge');
  const nftDescEl = document.getElementById('profile-nft-desc');

  const multFaucetEl = document.getElementById('profile-mult-faucet');
  const multArcadeEl = document.getElementById('profile-mult-arcade');
  const multReferralEl = document.getElementById('profile-mult-referral');
  const multStakingEl = document.getElementById('profile-mult-staking');

  const chipFaucet = document.getElementById('chip-mult-faucet');
  const chipArcade = document.getElementById('chip-mult-arcade');
  const chipReferral = document.getElementById('chip-mult-referral');
  const chipStaking = document.getElementById('chip-mult-staking');

  const isVip = !!(window.appState && window.appState.isVipActive ? window.appState.isVipActive() : (appState.state.vipUntil && new Date(appState.state.vipUntil).getTime() > Date.now()));
  const isAmbassador = !!appState.state.isAmbassador;

  let equippedNftObj = null;
  if (appState.state.equippedNft) {
    equippedNftObj = NFT_REGISTRY.find(n => n.id === appState.state.equippedNft) || null;
  }

  if (equippedNftObj) {
    if (nftAvatarFrame) {
      nftAvatarFrame.innerHTML = `
        <img src="metadata/images/${equippedNftObj.id}.png" alt="${equippedNftObj.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src=''; this.onerror=null; this.parentElement.innerHTML='${equippedNftObj.svg.replace(/'/g, "&apos;")}';"/>
      `;
    }
    if (nftNameEl) nftNameEl.innerText = equippedNftObj.name;
    if (nftRarityBadge) {
      const rarity = (equippedNftObj.rarity || 'common').toUpperCase();
      nftRarityBadge.innerText = rarity;
      nftRarityBadge.style.background = (rarity === 'EPIC' || rarity === 'LEGENDARY') ? 'rgba(255, 0, 255, 0.2)' : 'rgba(0, 240, 255, 0.2)';
      nftRarityBadge.style.color = (rarity === 'EPIC' || rarity === 'LEGENDARY') ? '#ff00ff' : 'var(--color-primary)';
    }
    if (nftDescEl) nftDescEl.innerText = equippedNftObj.description || 'Active utility core amplifier.';
  } else {
    if (nftAvatarFrame) nftAvatarFrame.innerHTML = '<span style="font-size: 2rem;">🎨</span>';
    if (nftNameEl) nftNameEl.innerText = 'No NFT Core Equipped';
    if (nftRarityBadge) {
      nftRarityBadge.innerText = 'INACTIVE';
      nftRarityBadge.style.background = 'rgba(255, 255, 255, 0.1)';
      nftRarityBadge.style.color = 'var(--text-muted)';
    }
    if (nftDescEl) nftDescEl.innerText = 'Equip a booster NFT from your backpack to amplify your faucet rewards, arcade payouts, and referral yields.';
  }

  // Calculate Combined Multipliers across Active Utility NFTs, VIP status, Ambassador status, and Whale tiers
  const multis = window.appState ? window.appState.getMultipliers() : {};

  // 1. FAUCET MULTIPLIER:
  // Base x (1 + Total Boost% [NFT + Streak + Referral]) x (1FLR Whale 1.15) x (PGT Staked Whale 1.25) x (Onchain PGT Whale 1.10) x (VIP 2.0) x (Ambassador 2.0)
  const is1FlrWhale = (appState.state.balance1flr || 0) >= 5000000;
  const isPgtWhale = (typeof appState.getStakedPgtTotal === 'function' ? appState.getStakedPgtTotal() : 0) >= 1000000;
  const isPgtOnchainWhale = (appState.state.onchainBalancePgt || 0) >= 1000000;

  const faucetBoostPct = multis.totalFaucetBoostPercent !== undefined ? multis.totalFaucetBoostPercent : (multis.nftFaucetBoost || (equippedNftObj ? (equippedNftObj.faucetBoost || 0) : 0));
  let totalFaucetMult = (1 + faucetBoostPct / 100);
  const isApex = !!multis.isApexUnlocked;
  const apexMult = multis.apexMultiplier || 1.0;

  if (is1FlrWhale) totalFaucetMult *= 1.15;
  if (isPgtWhale) totalFaucetMult *= 1.25;
  if (isPgtOnchainWhale) totalFaucetMult *= 1.10;
  if (isVip) totalFaucetMult *= 2.0;
  if (isAmbassador) totalFaucetMult *= 2.0;
  if (isApex) totalFaucetMult *= apexMult;

  // 2. ARCADE MULTIPLIER:
  // (1 + NFT Game Boost%) x (VIP 2.0) x (Ambassador 2.0) x (Apex 1.5)
  const nftArcadePct = multis.nftGameMultiplier !== undefined ? multis.nftGameMultiplier : (equippedNftObj ? (equippedNftObj.gameMultiplier || 0) : 0);
  let totalArcadeMult = (1 + nftArcadePct / 100);
  if (isVip) totalArcadeMult *= 2.0;
  if (isAmbassador) totalArcadeMult *= 2.0;
  if (isApex) totalArcadeMult *= apexMult;

  // 3. REFERRAL COMMISSION MULTIPLIER:
  // (NFT Referral Multiplier) x (Ambassador 1.5) x (VIP 2.0)
  const nftRefMult = (multis.rawNftReferralMultiplier || multis.nftReferralMultiplier) !== undefined ? (multis.rawNftReferralMultiplier || multis.nftReferralMultiplier) : (equippedNftObj ? (equippedNftObj.referralMultiplier || 1.0) : 1.0);
  let totalReferralMult = nftRefMult * (isAmbassador ? 1.5 : 1.0) * (isVip ? 2.0 : 1.0);

  // 4. STAKING APY BOOST MULTIPLIER:
  // (NFT Staking Boost) x (Ambassador 1.10) x (VIP 2.0)
  const nftStakingBoost = multis.nftStakingBoost !== undefined ? multis.nftStakingBoost : (equippedNftObj ? (1 + (equippedNftObj.stakingBoost || 0) / 100) : 1.0);
  let totalStakingMult = nftStakingBoost * (isAmbassador ? 1.10 : 1.0) * (isVip ? 2.0 : 1.0);

  if (multFaucetEl) multFaucetEl.innerText = `${totalFaucetMult.toFixed(totalFaucetMult % 1 === 0 ? 1 : 2)}x`;
  if (multArcadeEl) multArcadeEl.innerText = `${totalArcadeMult.toFixed(totalArcadeMult % 1 === 0 ? 1 : 2)}x`;
  if (multReferralEl) multReferralEl.innerText = `${totalReferralMult.toFixed(totalReferralMult % 1 === 0 ? 1 : 2)}x`;
  if (multStakingEl) multStakingEl.innerText = `${totalStakingMult.toFixed(totalStakingMult % 1 === 0 ? 1 : 2)}x`;

  if (chipFaucet) chipFaucet.classList.toggle('active', totalFaucetMult > 1.0);
  if (chipArcade) chipArcade.classList.toggle('active', totalArcadeMult > 1.0);
  if (chipReferral) chipReferral.classList.toggle('active', totalReferralMult > 1.0);
  if (chipStaking) chipStaking.classList.toggle('active', totalStakingMult > 1.0);

  // Sync Relics Progress Badge
  const relicProgressBadge = document.getElementById('relics-progress-badge');
  if (relicProgressBadge) {
    const s1Prog = getSeason1Progress(appState.state.relics || {});
    relicProgressBadge.innerText = `${s1Prog.ownedCount}/${s1Prog.totalCount}`;
  }

  // --- 4. Web3 Wallet & Authentication Details (Item 4) ---
  const googleStatusEl = document.getElementById('profile-auth-google');
  const web3StatusEl = document.getElementById('profile-auth-web3');
  const linkedAddrEl = document.getElementById('profile-linked-address');
  const linkGoogleBtn = document.getElementById('btn-profile-link-google');

  if (googleStatusEl) {
    if (appState.state.authUserEmail) {
      googleStatusEl.innerText = `Connected (${appState.state.authUserEmail})`;
      googleStatusEl.style.color = "var(--color-accent)";
      if (linkGoogleBtn) linkGoogleBtn.style.display = "none";
    } else if (appState.state.authUserId) {
      googleStatusEl.innerText = "Connected (Google Account)";
      googleStatusEl.style.color = "var(--color-accent)";
      if (linkGoogleBtn) linkGoogleBtn.style.display = "none";
    } else {
      googleStatusEl.innerText = "Not Connected (Guest Mode)";
      googleStatusEl.style.color = "var(--text-muted)";
      if (linkGoogleBtn) linkGoogleBtn.style.display = "inline-block";
    }
  }

  const linked = appState.state.linkedWalletAddress;
  const primary = appState.state.walletAddress;
  const isInternal = (addr) => !addr || addr.startsWith('0xpgt') || addr.startsWith('0xg');
  const realWeb3 = (linked && !isInternal(linked)) ? linked : (!isInternal(primary) ? primary : null);

  if (web3StatusEl) {
    const hasActiveSigner = !!(window.realSigner || appState.state.walletConnected);
    if (realWeb3 && realWeb3.length >= 42 && hasActiveSigner) {
      let provStr = appState.state.walletProvider || 'metamask';
      provStr = provStr.replace('google_linked', 'MetaMask').replace('google', 'MetaMask').toUpperCase();
      web3StatusEl.innerText = `Connected (${provStr})`;
      web3StatusEl.style.color = "var(--color-primary)";
    } else if (realWeb3 && realWeb3.length >= 42) {
      web3StatusEl.innerText = "Linked (Not Connected this session)";
      web3StatusEl.style.color = "var(--text-muted)";
    } else {
      web3StatusEl.innerText = "Not Connected";
      web3StatusEl.style.color = "var(--text-muted)";
    }
  }

  if (linkedAddrEl) {
    if (realWeb3 && realWeb3.length >= 42) {
      linkedAddrEl.innerText = realWeb3;
      linkedAddrEl.style.color = "var(--color-accent)";
    } else {
      linkedAddrEl.innerText = "No Web3 Wallet Linked (Connect Wallet to link)";
      linkedAddrEl.style.color = "var(--text-muted)";
    }
  }

  syncAmbassadorProfileBadge();
}

// Profile Save button listener
export const btnSaveProfile = document.getElementById('btn-save-profile');
if (btnSaveProfile) {
  btnSaveProfile.addEventListener('click', async () => {
    const input = document.getElementById('profile-name-input');
    if (!input) return;
    
    const nameStr = input.value.trim();
    if (!nameStr) {
      triggerToast("Username cannot be empty!", "error");
      return;
    }

    const primary = (appState.state.walletAddress || '').toLowerCase();
    const linked = (appState.state.linkedWalletAddress || '').toLowerCase();
    const pid = (appState.state.playerId || '').toLowerCase();

    if (primary) localStorage.setItem(`polygame_username_${primary}`, nameStr);
    if (linked) localStorage.setItem(`polygame_username_${linked}`, nameStr);
    if (pid) localStorage.setItem(`polygame_username_${pid}`, nameStr);
    
    appState.update({ username: nameStr });
    appState.saveToDB(); // Persist directly to DB

    // Direct DB update to guarantee persistence across sessions & devices
    if (supabase && (pid || primary || appState.state.authUserId)) {
      try {
        const canonical = pid || primary;
        await supabase.from('users').update({ username: nameStr }).eq('player_id', canonical);
        if (appState.state.authUserId) {
          await supabase.from('users').update({ username: nameStr }).eq('user_id', appState.state.authUserId);
        }
      } catch (dbErr) {
        console.warn("[btnSaveProfile] DB username sync notice:", dbErr);
      }
    }
    
    triggerToast("Username saved!", "success");
    sfx.playSuccess();

    appState.syncUI();
    
    // Refresh active leaderboard displays
    loadAstroDodgeLeaderboard();
    loadInvadersLeaderboard();
    loadReferralLeaderboard();
    loadHoldersLeaderboard();
    if (window.polySpace && typeof window.polySpace.loadFleetPowerLeaderboard === 'function') {
      window.polySpace.loadFleetPowerLeaderboard();
    }
  });
}
window.setupLeaderboardUI = loadAstroDodgeLeaderboard;

export async function autoConnectWeb3() {
  if (localStorage.getItem('polygame_user_logged_out') === 'true') {
    console.log("[autoConnectWeb3] User explicitly logged out. Skipping auto-connect.");
    return;
  }

  // Startup silent check for injected window.ethereum (e.g. inside MetaMask Browser or Desktop extension)
  if (typeof window.ethereum !== 'undefined') {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        console.log("[autoConnectWeb3] Injected account detected on boot:", accounts[0]);
        await connectWeb3(true);
        return;
      }
    } catch (e) {
      console.warn("Silent eth_accounts startup check warning:", e);
    }
  }

  const activeAddr = appState && typeof appState.getActiveWeb3Address === 'function' ? appState.getActiveWeb3Address() : (appState && appState.state ? (appState.state.linkedWalletAddress || appState.state.walletAddress) : null);
  const isConnected = appState && typeof appState.isPlayerConnected === 'function' && appState.isPlayerConnected();

  if (isConnected && activeAddr && !activeAddr.startsWith('0xguest') && !activeAddr.startsWith('0xpgt')) {
    const addr = activeAddr;

    // Refresh live on-chain POL and PGT balances via direct RPC
    if (typeof window.getDirectPolygonPOLBalance === 'function') {
      try {
        const livePol = await window.getDirectPolygonPOLBalance(addr);
        const livePgt = typeof window.getDirectPolygonPGTBalance === 'function' ? await window.getDirectPolygonPGTBalance(addr) : 0;
        if (livePol > 0) appState.state.balanceMatic = livePol;
        if (livePgt > 0) appState.state.onchainBalancePgt = livePgt;
        appState.syncUI();
      } catch (e) {
        console.warn("Direct RPC startup balance fetch warning:", e);
      }
    }

    // Instantly pull fresh DB profile & PolySpace data on every page refresh (F5) silently
    try {
      await syncProfileWithDb(
        addr,
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
      'catcher': '👑 Cyber Stacker Tournament Pool'
    };

    Object.keys(weeksMap).forEach(weekLabel => {
      const weekSection = document.createElement('div');
      weekSection.style.cssText = 'margin-bottom: 2rem; background: rgba(0,0,0,0.25); padding: 1.25rem; border-radius: var(--border-radius-md); border: 1px solid var(--border-glass);';
      
      const rows = weeksMap[weekLabel];
      const weekTotalDistributed = rows.reduce((sum, r) => sum + (Number(r.prize_pgt) || 0), 0);

      const weekHeader = document.createElement('h4');
      weekHeader.style.cssText = 'color: var(--color-primary); margin-bottom: 1rem; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;';
      weekHeader.innerHTML = `<span>🗓️ Weekly Reset Snapshot: <strong>${weekLabel}</strong></span> <span style="font-size:0.85rem; color:var(--color-warning); font-weight:bold;">🏆 ${weekTotalDistributed > 0 ? weekTotalDistributed.toLocaleString() + ' PGT Awarded' : 'Weekly Tournament Pool'}</span>`;
      weekSection.appendChild(weekHeader);

      // Sub-group strictly by mini-game (Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker)
      const gameGroupMap = {};
      rows.forEach(r => {
        let gKey = (r.game_type || '').toLowerCase();
        if (!gKey || gKey === 'overall') {
          if ((r.astrododge_score || 0) > 0) gKey = 'astrododge';
          else if ((r.invaders_score || 0) > 0) gKey = 'invaders';
          else if ((r.drift_score || 0) > 0) gKey = 'drift';
          else if ((r.catcher_score || 0) > 0 || (r.stacker_score || 0) > 0) gKey = 'stacker';
          else return; // Ignore unclassifiable rows
        }
        if (!gameTitles[gKey]) return; // Strictly ignore overall/unknown categories

        if (!gameGroupMap[gKey]) gameGroupMap[gKey] = [];
        gameGroupMap[gKey].push(r);
      });

      Object.keys(gameGroupMap).forEach(gKey => {
        const gameBox = document.createElement('div');
        gameBox.style.cssText = 'margin-bottom: 1rem; background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);';

        const gSum = gameGroupMap[gKey].reduce((sum, r) => sum + (Number(r.prize_pgt) || 0), 0);

        const gTitle = document.createElement('div');
        gTitle.style.cssText = 'font-weight: 700; color: var(--color-accent); margin-bottom: 0.5rem; font-size: 0.95rem; display: flex; justify-content: space-between; align-items: center;';
        gTitle.innerHTML = `<span>${gameTitles[gKey] || (gKey.toUpperCase() + ' Tournament Pool')}</span> <span style="font-size:0.75rem; color:var(--text-dim);">${gameGroupMap[gKey].length} Winners (${gSum.toLocaleString()} PGT)</span>`;
        gameBox.appendChild(gTitle);

        gameGroupMap[gKey].forEach(row => {
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

          const scoreVal = row.best_score || row.astrododge_score || row.invaders_score || row.drift_score || 0;

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

  const scoreStackerEl = document.getElementById('pub-profile-score-stacker');
  const scoreDriftEl = document.getElementById('pub-profile-score-drift');
  const scoreInvadersEl = document.getElementById('pub-profile-score-invaders');
  const scoreDodgeEl = document.getElementById('pub-profile-score-dodge');

  const pgtEl = document.getElementById('pub-profile-pgt');
  const stakedEl = document.getElementById('pub-profile-staked');
  const spacePowerEl = document.getElementById('pub-profile-space-power');
  const referralsEl = document.getElementById('pub-profile-referrals');
  const nftsGridEl = document.getElementById('pub-profile-nfts-grid');

  if (usernameEl) usernameEl.innerText = "Loading Player...";
  if (walletEl) walletEl.innerText = `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`;
  if (nftsGridEl) nftsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">Loading NFTs...</div>';

  try {
    const normAddr = walletAddress.toLowerCase().trim();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`player_id.ilike.${normAddr},linked_wallet_address.ilike.${normAddr}`)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      if (usernameEl) usernameEl.innerText = "Anonymous Player";
      if (nftsGridEl) nftsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">No public profile data available.</div>';
      return;
    }

    const isInternal = (addr) => !addr || addr.toLowerCase().startsWith('0xpgt') || addr.toLowerCase().startsWith('0xg');
    const displayAddr = (user.linked_wallet_address && !isInternal(user.linked_wallet_address)) ? user.linked_wallet_address : (!isInternal(user.player_id) ? user.player_id : normAddr);
    const shortAddr = (!isInternal(displayAddr) && displayAddr.length >= 42) 
      ? `Player_${displayAddr.substring(0, 6)}...${displayAddr.substring(displayAddr.length - 4)}` 
      : (user.email ? user.email.split('@')[0] : 'Google Player');
    const name = user.username || shortAddr;

    if (usernameEl) usernameEl.innerText = name;
    if (avatarEl) avatarEl.innerText = (name.charAt(0) || '🎮').toUpperCase();
    if (walletEl) walletEl.innerText = isInternal(displayAddr) ? 'Google Account (No Web3 Wallet Linked)' : displayAddr;

    // Badges & Showcase NFT
    let badgesHtml = '';
    const equippedId = user.equipped_nft || user.equippedNft || null;
    let showcaseNftObj = equippedId ? NFT_REGISTRY.find(n => n.id === equippedId) : null;
    if (showcaseNftObj) {
      badgesHtml += `<span style="background:rgba(0,240,255,0.15); color:var(--color-primary); border:1px solid var(--color-primary); padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:800;">⭐ Showcase: ${showcaseNftObj.name}</span> `;
    }
    if (user.is_ambassador) badgesHtml += '<span style="background:rgba(255,170,0,0.15); color:var(--color-warning); border:1px solid var(--color-warning); padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:800;">🎖️ AMBASSADOR</span> ';
    if (user.vip_until && new Date(user.vip_until).getTime() > Date.now()) badgesHtml += '<span style="background:rgba(255,215,0,0.15); color:var(--color-warning); border:1px solid var(--color-warning); padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:800;">👑 VIP MEMBER</span> ';
    if (badgesEl) badgesHtml ? (badgesEl.innerHTML = badgesHtml) : (badgesEl.innerHTML = '<span style="color:var(--text-dim); font-size:0.75rem;">Regular Player</span>');

    // Arcade High Scores (All-Time Career & Active Weekly)
    const alltimeStack = Math.max(user.alltime_stacker_highscore || 0, user.stacker_highscore || 0);
    const alltimeDri = Math.max(user.alltime_drift_highscore || 0, user.drift_highscore || 0);
    const alltimeInv = Math.max(user.alltime_invaders_highscore || 0, user.invaders_highscore || 0);
    const alltimeDod = Math.max(user.alltime_game_highscore || 0, user.game_highscore || 0);
    const alltimeSke = Math.max(user.alltime_skeet_highscore || 0, user.skeet_highscore || 0);

    const scoreSkeetEl = document.getElementById('pub-profile-score-skeet');
    if (scoreStackerEl) scoreStackerEl.innerText = alltimeStack.toLocaleString();
    if (scoreDriftEl) scoreDriftEl.innerText = alltimeDri.toLocaleString();
    if (scoreInvadersEl) scoreInvadersEl.innerText = alltimeInv.toLocaleString();
    if (scoreDodgeEl) scoreDodgeEl.innerText = alltimeDod.toLocaleString();
    if (scoreSkeetEl) scoreSkeetEl.innerText = alltimeSke.toLocaleString();

    const wStack = document.getElementById('pub-profile-weekly-stacker');
    const wDri = document.getElementById('pub-profile-weekly-drift');
    const wInv = document.getElementById('pub-profile-weekly-invaders');
    const wDod = document.getElementById('pub-profile-weekly-dodge');
    const wSke = document.getElementById('pub-profile-weekly-skeet');

    if (wStack) wStack.innerText = (user.stacker_highscore || 0).toLocaleString();
    if (wDri) wDri.innerText = (user.drift_highscore || user.drift_score || 0).toLocaleString();
    if (wInv) wInv.innerText = (user.invaders_highscore || user.invaders_score || 0).toLocaleString();
    if (wDod) wDod.innerText = (user.game_highscore || user.game_score || 0).toLocaleString();
    if (wSke) wSke.innerText = (user.skeet_highscore || 0).toLocaleString();

    // Stats & Referral Earnings
    if (pgtEl) pgtEl.innerText = `${(user.balance_pgt || 0).toLocaleString([], {maximumFractionDigits:0})} PGT`;
    if (stakedEl) stakedEl.innerText = `${(user.staked_balance_pgt || 0).toLocaleString([], {maximumFractionDigits:0})} PGT`;
    if (spacePowerEl) {
      const fleetPwr = user.polyspace_power || user.space_fleet_power || (user.space_state ? user.space_state.fleetPower : 100) || 100;
      spacePowerEl.innerText = `${Number(fleetPwr).toLocaleString()} Power`;
    }
    if (referralsEl) referralsEl.innerText = `${user.referrals_count || 0} Players`;

    const refPgtEl = document.getElementById('pub-profile-ref-pgt');
    const refPolEl = document.getElementById('pub-profile-ref-pol');

    if (refPgtEl) refPgtEl.innerText = `${parseFloat(user.total_referral_commission || 0).toFixed(2)} PGT`;
    if (refPolEl) refPolEl.innerText = `${parseFloat(user.total_referral_pol || 0).toFixed(4)} POL`;

    // Utility NFTs
    const ownedIds = user.owned_nfts || [];
    const nftsCountEl = document.getElementById('pub-profile-nfts-count');
    if (nftsCountEl) nftsCountEl.innerText = ownedIds.length;

    if (!ownedIds || ownedIds.length === 0) {
      if (nftsGridEl) nftsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">No NFTs in collection yet.</div>';
    } else {
      let nftsHtml = '';
      ownedIds.forEach(nftId => {
        const activeNft = NFT_REGISTRY.find(n => n.id === nftId);
        const nftName = activeNft ? activeNft.name : `NFT #${nftId}`;
        const nftIcon = activeNft ? (activeNft.icon || '🎨') : '🎨';
        const isShowcase = (nftId === equippedId);
        nftsHtml += `
          <div style="background: ${isShowcase ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0,0,0,0.4)'}; border: 1px solid ${isShowcase ? 'var(--color-primary)' : 'var(--border-glass)'}; padding: 0.4rem 0.65rem; border-radius: 6px; display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem;">
            <span>${nftIcon}</span>
            <strong style="color: #fff;">${nftName}</strong>
            ${isShowcase ? '<span style="color:var(--color-primary); font-size:0.7rem; font-weight:800; margin-left:2px;">⭐ Displayed</span>' : ''}
          </div>
        `;
      });
      if (nftsGridEl) nftsGridEl.innerHTML = nftsHtml;
    }

    // Quantum Relics Stash
    const relicsData = user.relics || {};
    const relicsCountEl = document.getElementById('pub-profile-relics-count');
    const relicsBreakdownEl = document.getElementById('pub-profile-relics-breakdown');
    const relicsGridEl = document.getElementById('pub-profile-relics-grid');

    let totalRelics = 0;
    let onchainRelics = 0;
    let inGameRelics = 0;
    const unlockedRelicsList = [];

    Object.keys(relicsData).forEach(relicId => {
      const r = relicsData[relicId];
      if (r && (r.total > 0 || r.unminted > 0 || r.onchain > 0)) {
        const count = r.total || ((r.unminted || 0) + (r.onchain || 0));
        const onchainCount = r.onchain || 0;
        const unmintedCount = r.unminted || (count - onchainCount);
        
        totalRelics += count;
        onchainRelics += onchainCount;
        inGameRelics += unmintedCount;

        const meta = getRelicMeta(relicId) || { name: relicId, rarity: 'rare' };
        unlockedRelicsList.push({
          id: relicId,
          name: meta.name,
          rarity: meta.rarity,
          total: count,
          onchain: onchainCount,
          unminted: unmintedCount
        });
      }
    });

    if (relicsCountEl) relicsCountEl.innerText = totalRelics;
    if (relicsBreakdownEl) relicsBreakdownEl.innerText = `${onchainRelics} Polygon • ${inGameRelics} In-Game`;

    if (relicsGridEl) {
      if (unlockedRelicsList.length === 0) {
        relicsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">No Quantum Relics unlocked yet.</div>';
      } else {
        const rarityStyles = {
          rare: { border: '#00f0ff', color: '#00f0ff', bg: 'rgba(0,240,255,0.1)' },
          epic: { border: '#bd00ff', color: '#bd00ff', bg: 'rgba(189,0,255,0.1)' },
          legendary: { border: '#ffd700', color: '#ffd700', bg: 'rgba(255,215,0,0.1)' },
          mythic: { border: '#ff0055', color: '#ff0055', bg: 'rgba(255,0,85,0.1)' }
        };

        let relicsHtml = '';
        unlockedRelicsList.forEach(r => {
          const style = rarityStyles[r.rarity] || rarityStyles.rare;
          relicsHtml += `
            <div style="background: rgba(0,0,0,0.4); border: 1px solid ${style.border}; padding: 0.4rem 0.65rem; border-radius: 6px; display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem;">
              <span style="font-size: 0.95rem;">🏺</span>
              <div style="display: flex; flex-direction: column;">
                <span style="color: #fff; font-weight: 700;">${r.name} <span style="color: ${style.color}; font-size: 0.7rem; text-transform: uppercase;">(${r.rarity})</span></span>
                <span style="color: var(--text-muted); font-size: 0.68rem;">
                  x${r.total} total ${r.onchain > 0 ? `• <span style="color:#b388ff; font-weight:600;">${r.onchain} Polygon</span>` : ''} ${r.unminted > 0 ? `• <span style="color:#00f0ff; font-weight:600;">${r.unminted} In-Game</span>` : ''}
                </span>
              </div>
            </div>
          `;
        });
        relicsGridEl.innerHTML = relicsHtml;
      }
    }
  } catch (err) {
    console.error("Public Profile fetch error:", err);
    if (usernameEl) usernameEl.innerText = "Error Loading Player";
  }
}
window.openPublicProfile = openPublicProfile;

// Switch Sub-Tabs in My Profile (Career & Account vs Quantum Relics Vault)
export function switchProfileSubTab(subTab) {
  const careerSection = document.getElementById('profile-career-section');
  const relicsSection = document.getElementById('profile-relics-section');
  const tabCareerBtn = document.getElementById('tab-btn-profile-career');
  const tabRelicsBtn = document.getElementById('tab-btn-profile-relics');

  if (subTab === 'relics') {
    if (careerSection) careerSection.style.display = 'none';
    if (relicsSection) relicsSection.style.display = 'block';
    if (tabCareerBtn) {
      tabCareerBtn.classList.remove('active');
      tabCareerBtn.style.background = 'rgba(255,255,255,0.05)';
      tabCareerBtn.style.color = 'var(--text-muted)';
      tabCareerBtn.style.borderColor = 'var(--border-glass)';
    }
    if (tabRelicsBtn) {
      tabRelicsBtn.classList.add('active');
      tabRelicsBtn.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(0,240,255,0.15) 100%)';
      tabRelicsBtn.style.color = '#fff';
      tabRelicsBtn.style.borderColor = 'var(--border-cyan)';
    }
    renderRelicsVault();
  } else {
    if (careerSection) careerSection.style.display = 'block';
    if (relicsSection) relicsSection.style.display = 'none';
    if (tabCareerBtn) {
      tabCareerBtn.classList.add('active');
      tabCareerBtn.style.background = 'rgba(0,240,255,0.15)';
      tabCareerBtn.style.color = 'var(--color-primary)';
      tabCareerBtn.style.borderColor = 'var(--border-cyan)';
    }
    if (tabRelicsBtn) {
      tabRelicsBtn.classList.remove('active');
      tabRelicsBtn.style.background = 'rgba(255,255,255,0.05)';
      tabRelicsBtn.style.color = 'var(--text-muted)';
      tabRelicsBtn.style.borderColor = 'var(--border-glass)';
    }
  }
}
window.switchProfileSubTab = switchProfileSubTab;

