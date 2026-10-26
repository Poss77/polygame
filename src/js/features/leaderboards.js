// ============================================================
// POLYGAME: ARCADE & SITAWIDE LEADERBOARDS MODULE
// Manages live pagination, scoreboards, weekly resets & rankings
// ============================================================

import { ARCADE_GAMES_REGISTRY, ARCADE_GAMES_LIST } from '../core/games-registry.js';
import { supabase, ADMIN_WALLET_ADDRESS } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { NFT_REGISTRY } from './nft.js';
import { appState } from '../core/state.js';
import { triggerToast, escapeHtml } from '../core/ui.js';

export function checkIsUserRow(row) {
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

export function formatLeaderboardName(row, isUser = false, includeStarship = false) {
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
  const safeDisplayName = typeof escapeHtml === 'function' ? escapeHtml(displayName) : (displayName || '');
  const safeShortAddr = typeof escapeHtml === 'function' ? escapeHtml(shortAddr) : (shortAddr || '');
  const safeClickAddr = encodeURIComponent(clickAddr);
  const clickAttr = clickAddr ? `onclick="openPublicProfile('${safeClickAddr}')" style="cursor:pointer; text-decoration:underline; text-decoration-color:rgba(0,240,255,0.3);" title="Click to view public player profile"` : '';

  // VIP Badge Check (Symbol only to save space)
  let vipBadge = '';
  const now = new Date();
  const vipUntil = row.vip_until ? new Date(row.vip_until) : null;
  const isVip = vipUntil && vipUntil > now;
  if (isVip) {
    const rawLvl = row.vip_level != null ? Number(row.vip_level) : 2;
    const vipLevel = rawLvl === 1 ? 1 : 2;
    if (vipLevel >= 2) {
      vipBadge = ` <span class="badge-vip-gold" style="display:inline-flex; align-items:center; justify-content:center; background:linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,0,127,0.25)); border:1px solid #ffd700; font-size:0.8rem; padding:1px 4px; border-radius:4px; margin-left:3px; line-height:1;" title="Gold VIP Member (2.0x Arcade & Staking, 2.0x Leaderboard, 2.5x Faucet)">👑</span>`;
    } else {
      vipBadge = ` <span class="badge-vip-silver" style="display:inline-flex; align-items:center; justify-content:center; background:linear-gradient(135deg, rgba(192,192,192,0.25), rgba(0,240,255,0.25)); border:1px solid #c0c0c0; font-size:0.8rem; padding:1px 4px; border-radius:4px; margin-left:3px; line-height:1;" title="Silver VIP Member (1.5x Arcade, 1.25x Staking & Leaderboard, 1.5x Faucet)">🥈</span>`;
    }
  }

  let result = '';
  if (displayName && displayName.trim() !== '') {
    result = `<strong class="leaderboard-player-title" style="color:var(--color-primary); font-family: inherit;" ${clickAttr}>${safeDisplayName}</strong>${vipBadge}`;
  } else {
    result = `<span class="leaderboard-player-title" style="font-family: monospace; color:var(--color-primary);" ${clickAttr}>Player_${safeShortAddr}</span>${vipBadge}`;
  }

  if (includeStarship) {
    const sBadge = getLeaderboardStarshipBadge(row, isUser);
    if (sBadge) result += ' ' + sBadge;
  }

  return result;
}

// Dedicated Starship Rarity Badge Generator for 2-Line Leaderboards
export function getLeaderboardStarshipBadge(row, isUser = false) {
  if (!row) return '';
  let ship = row.equipped_starship || (row.space_state && row.space_state.equippedStarship);
  if (isUser && (!ship || Object.keys(ship).length === 0)) {
    if (window.appState && window.appState.state && window.appState.state.equippedStarship) {
      ship = window.appState.state.equippedStarship;
    }
  }
  if (ship && typeof ship === 'object') {
    // Ignore demo or unowned ships (must be a real minted on-chain starship with tokenId > 0)
    if (ship.isDemo === true || !ship.tokenId || ship.tokenId === 0 || String(ship.name || '').toLowerCase().includes('demo')) {
      return '';
    }
    let rarity = ship.rarity;
    if (!rarity && ship.dna && window.PolyHangar && typeof window.PolyHangar.getStarshipRarity === 'function') {
      const rMeta = window.PolyHangar.getStarshipRarity(ship.dna);
      if (rMeta && rMeta.tier) rarity = rMeta.tier;
    }
    if (rarity) {
      const rNorm = String(rarity).toLowerCase();
      let color = '#00f0ff';
      let icon = '🛸';
      let bg = 'rgba(0, 240, 255, 0.15)';
      let border = 'rgba(0, 240, 255, 0.4)';
      if (rNorm === 'mythic') {
        color = '#ff0055';
        icon = '🔴';
        bg = 'rgba(255, 0, 85, 0.2)';
        border = 'rgba(255, 0, 85, 0.6)';
      } else if (rNorm === 'legendary') {
        color = '#ff8800';
        icon = '🟡';
        bg = 'rgba(255, 136, 0, 0.2)';
        border = 'rgba(255, 136, 0, 0.6)';
      } else if (rNorm === 'epic') {
        color = '#bd00ff';
        icon = '🟣';
        bg = 'rgba(189, 0, 255, 0.2)';
        border = 'rgba(189, 0, 255, 0.6)';
      } else {
        color = '#00f0ff';
        icon = '🔵';
        bg = 'rgba(0, 240, 255, 0.18)';
        border = 'rgba(0, 240, 255, 0.5)';
      }

      const canonicalName = (window.PolyHangar && typeof window.PolyHangar.formatCanonicalShipName === 'function')
        ? window.PolyHangar.formatCanonicalShipName(ship.name, ship.tokenId)
        : (ship.name || (ship.tokenId ? `Starship #${ship.tokenId}` : ''));
      const shipTitle = `Equipped Starship: ${rarity} Starship${canonicalName ? ` (${canonicalName})` : ''}`;
      return `<span class="badge-starship badge-starship-${rNorm}" style="display:inline-flex; align-items:center; gap:4px; background:${bg}; border:1px solid ${border}; color:${color}; font-size:0.66rem; font-weight:800; padding:1.5px 6px; border-radius:4px; line-height:1.2; text-transform:uppercase; letter-spacing:0.3px;" title="${typeof escapeHtml === 'function' ? escapeHtml(shipTitle) : shipTitle}"><span style="font-size:0.75rem;">${icon}</span> ${rarity} Starship</span>`;
    }
  }
  return '';
}


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

export function getRowLeaderboardMultiplier(row, isUser = false) {
  // If this is the current active player, read directly from live appState multipliers
  if (isUser && window.appState && typeof window.appState.getMultipliers === 'function') {
    const multis = window.appState.getMultipliers();
    if (multis && multis.totalLeaderboardMultiplier !== undefined) {
      return multis.totalLeaderboardMultiplier;
    }
  }

  // 1. VIP Leaderboard Factor (Gold 2.0x / Silver 1.25x)
  let vipMult = 1.0;
  if (row && row.vip_until && new Date(row.vip_until) > new Date()) {
    const rawLvl = row.vip_level != null ? Number(row.vip_level) : 2;
    const lvl = rawLvl === 1 ? 1 : 2;
    vipMult = lvl >= 2 ? 2.0 : 1.25;
  }

  // 2. Leaderboard NFT Cores (owned_nfts + crate_nfts)
  let nftMult = 1.0;
  const nfts = Array.isArray(row?.owned_nfts) ? [...row.owned_nfts, ...(Array.isArray(row?.crate_nfts) ? row.crate_nfts : [])] : [];
  if (nfts.length > 0) {
    const uniqueIds = Array.from(new Set(nfts));
    uniqueIds.forEach(id => {
      const active = NFT_REGISTRY.find(n => n.id === id);
      if (active && active.leaderboardMultiplier && active.leaderboardMultiplier > 1.0) {
        nftMult *= active.leaderboardMultiplier;
      }
    });
  }

  return parseFloat((vipMult * nftMult).toFixed(2));
}

// --- Paginated Arcade Game Leaderboards Engine (10 items / page + Pinned User Standing) ---

const GAME_LB_PAGE_SIZE = 10;

const GAME_LEADERBOARDS_CONFIG = {
  astrododge: {
    containerId: 'leaderboard-arcade-container',
    poolElId: 'lb-pool-arcade',
    scoreField: 'game_highscore',
    stateScoreKey: 'gameHighScore',
    defaultPool: 50000,
    settingKey: 'astrododge'
  },
  invaders: {
    containerId: 'leaderboard-invaders-container',
    poolElId: 'lb-pool-invaders',
    scoreField: 'invaders_highscore',
    stateScoreKey: 'invadersHighScore',
    defaultPool: 50000,
    settingKey: 'invaders'
  },
  drift: {
    containerId: 'leaderboard-drift-container',
    poolElId: 'lb-pool-drift',
    scoreField: 'drift_highscore',
    stateScoreKey: 'driftHighScore',
    defaultPool: 50000,
    settingKey: 'drift'
  },
  stacker: {
    containerId: 'leaderboard-stacker-container',
    fallbackContainerId: 'leaderboard-catcher-container',
    poolElId: 'lb-pool-stacker',
    fallbackPoolElId: 'lb-pool-catcher',
    scoreField: 'stacker_highscore',
    stateScoreKey: 'stackerHighScore',
    defaultPool: 50000,
    settingKey: 'stacker'
  },
  skeet: {
    containerId: 'leaderboard-skeet-container',
    poolElId: 'lb-pool-skeet',
    scoreField: 'skeet_highscore',
    stateScoreKey: 'skeetHighScore',
    defaultPool: 25000,
    settingKey: 'skeet'
  },
  defense: {
    containerId: 'leaderboard-defense-container',
    poolElId: 'lb-pool-defense',
    scoreField: 'defense_highscore',
    stateScoreKey: 'defenseHighScore',
    defaultPool: 25000,
    settingKey: 'defense'
  },
  runner: {
    containerId: 'leaderboard-runner-container',
    poolElId: 'lb-pool-runner',
    scoreField: 'runner_highscore',
    stateScoreKey: 'runnerHighScore',
    defaultPool: 50000,
    settingKey: 'runner'
  },
  q2048: {
    containerId: 'leaderboard-q2048-container',
    poolElId: 'lb-pool-q2048',
    scoreField: 'q2048_highscore',
    stateScoreKey: 'q2048HighScore',
    defaultPool: 50000,
    settingKey: 'q2048'
  },
  tetris: {
    containerId: 'leaderboard-tetris-container',
    poolElId: 'lb-pool-tetris',
    scoreField: 'tetris_highscore',
    stateScoreKey: 'tetrisHighScore',
    defaultPool: 50000,
    settingKey: 'tetris'
  }
};

const gameLeaderboardsState = {
  astrododge: { data: [], page: 1, pool: 50000 },
  invaders: { data: [], page: 1, pool: 50000 },
  drift: { data: [], page: 1, pool: 50000 },
  stacker: { data: [], page: 1, pool: 50000 },
  skeet: { data: [], page: 1, pool: 25000 },
  defense: { data: [], page: 1, pool: 25000 },
  runner: { data: [], page: 1, pool: 50000 },
  q2048: { data: [], page: 1, pool: 50000 },
  tetris: { data: [], page: 1, pool: 50000 }
};
window.gameLeaderboardsState = gameLeaderboardsState;

// 90-second in-memory client cache (TTL) to slash redundant Supabase queries during tab switching
const LEADERBOARD_CACHE_TTL_MS = 90 * 1000;
const leaderboardDataCache = {};

export function invalidateGameLeaderboardCache(gameKey = null) {
  if (gameKey) {
    delete leaderboardDataCache[gameKey];
  } else {
    Object.keys(leaderboardDataCache).forEach(k => delete leaderboardDataCache[k]);
  }
}
window.invalidateGameLeaderboardCache = invalidateGameLeaderboardCache;

export function renderGameLeaderboard(gameKey) {
  const conf = GAME_LEADERBOARDS_CONFIG[gameKey];
  if (!conf) return;

  const scoreboard = document.getElementById(conf.containerId) || (conf.fallbackContainerId ? document.getElementById(conf.fallbackContainerId) : null);
  if (!scoreboard) return;

  const state = gameLeaderboardsState[gameKey] || { data: [], page: 1, pool: conf.defaultPool };
  const data = state.data || [];
  const pool = (state.pool !== undefined && state.pool !== null) ? Number(state.pool) : conf.defaultPool;
  const totalRows = data.length;

  if (totalRows === 0) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No tournament scores recorded yet for this week.<br><span style="font-size:0.8rem; color:var(--color-primary);">Play now to claim #1 on the leaderboard!</span></div>';

    if (appState && typeof appState.isPlayerConnected === 'function' && appState.isPlayerConnected()) {
      const userDisplayName = (appState.state && appState.state.username) || '';
      const userPlayerId = (appState.state && appState.state.playerId) || '';
      const userLinked = (appState.state && appState.state.linkedWalletAddress) || '';
      const mockRow = { username: userDisplayName, player_id: userPlayerId, linked_wallet_address: userLinked };
      const pinnedWrapper = document.createElement('div');
      pinnedWrapper.className = 'leaderboard-pinned-wrapper';
      const mockStarship = getLeaderboardStarshipBadge(mockRow, true);
      const mockStarshipLine = mockStarship
        ? `<div class="leaderboard-info-bottom">${mockStarship}</div>`
        : `<div class="leaderboard-info-bottom"><span class="badge-starship-empty" style="font-size:0.64rem; color:var(--text-dim); opacity:0.4; display:inline-flex; align-items:center; gap:3px;"><span>🛸</span> Standard Hull</span></div>`;

      pinnedWrapper.innerHTML = `
        <div class="leaderboard-pinned-header"><span>⚡ YOUR STANDING</span></div>
        <div class="leaderboard-row pinned-user-row user-row" style="opacity: 0.85;">
          <span class="leaderboard-rank" style="font-size:0.8rem; color:var(--text-dim);">--</span>
          <div class="leaderboard-info">
            <div class="leaderboard-info-top">
              <span class="leaderboard-name">${formatLeaderboardName(mockRow, true)}</span>
              <span class="badge-you" style="color:var(--color-accent); font-size:0.75rem; font-weight:700; margin-left:4px;">(You)</span>
            </div>
            ${mockStarshipLine}
          </div>
          <div class="leaderboard-stats">
            <div class="leaderboard-score" style="color:var(--text-muted);">0 <span class="score-unit">pts</span></div>
            <div class="leaderboard-prize" style="color:var(--text-dim);">0 PGT</div>
          </div>
        </div>
      `;
      scoreboard.appendChild(pinnedWrapper);
    }
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / GAME_LB_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, state.page || 1), totalPages);
  state.page = currentPage;

  const startIndex = (currentPage - 1) * GAME_LB_PAGE_SIZE;
  const endIndex = Math.min(startIndex + GAME_LB_PAGE_SIZE, totalRows);
  const pageRows = data.slice(startIndex, endIndex);

  scoreboard.innerHTML = '';

  // Render current page 10 rows (2-Line Mobile-First Layout)
  pageRows.forEach((row, idx) => {
    const rank = startIndex + idx + 1;
    const isUser = checkIsUserRow(row);
    const item = document.createElement('div');
    const podiumRowClass = rank === 1 ? 'podium-row-1' : rank === 2 ? 'podium-row-2' : rank === 3 ? 'podium-row-3' : '';
    item.className = `leaderboard-row ${isUser ? 'user-row' : ''} ${podiumRowClass}`.trim();

    const prizeAmt = getWeeklyPrizeForRank(rank, pool);
    const lbMult = getRowLeaderboardMultiplier(row, isUser);
    const multStr = lbMult % 1 === 0 ? lbMult.toFixed(0) : lbMult.toFixed(2).replace(/0$/, '');
    const multBadge = `<span class="leaderboard-mult-badge" style="font-size:0.72rem; font-weight:800; margin-left:3px; color:${lbMult > 1.0 ? '#ffd700' : 'var(--text-dim)'};" title="Leaderboard Multiplier: ${multStr}x (Final Prize: ${(prizeAmt * lbMult).toLocaleString()} PGT)">(${multStr}x)</span>`;
    const prize = (pool <= 0) 
      ? '<span style="color:var(--text-dim); opacity:0.6;">0 PGT</span>' 
      : (prizeAmt > 0 ? `${prizeAmt.toLocaleString()} PGT ${multBadge}` : '0 PGT');
    const scoreVal = row[conf.scoreField] || 0;
    const rankContent = rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `${rank}`;
    const rankClass = `leaderboard-rank rank-${rank} ${rank <= 3 ? `podium-rank podium-rank-${rank}` : ''}`;

    const starshipBadge = getLeaderboardStarshipBadge(row, isUser);
    const starshipLine = starshipBadge 
      ? `<div class="leaderboard-info-bottom">${starshipBadge}</div>` 
      : `<div class="leaderboard-info-bottom"><span class="badge-starship-empty" style="font-size:0.64rem; color:var(--text-dim); opacity:0.4; display:inline-flex; align-items:center; gap:3px;"><span>🛸</span> Standard Hull</span></div>`;

    item.innerHTML = `
      <span class="${rankClass}">${rankContent}</span>
      <div class="leaderboard-info">
        <div class="leaderboard-info-top">
          <span class="leaderboard-name">${formatLeaderboardName(row, isUser)}</span>
          ${isUser ? '<span class="badge-you" style="color:var(--color-accent); font-size:0.75rem; font-weight:700; margin-left:4px;">(You)</span>' : ''}
        </div>
        ${starshipLine}
      </div>
      <div class="leaderboard-stats">
        <div class="leaderboard-score">${scoreVal.toLocaleString()} <span class="score-unit">pts</span></div>
        <div class="leaderboard-prize">${prize}</div>
      </div>
    `;
    scoreboard.appendChild(item);
  });

  // Check if current user is in the overall dataset
  const userIdx = data.findIndex(r => checkIsUserRow(r));
  const isUserOnActivePage = (userIdx >= startIndex && userIdx < endIndex);

  // If user is NOT on the active page, render the pinned (You) row at the bottom
  if (!isUserOnActivePage) {
    const pinnedWrapper = document.createElement('div');
    pinnedWrapper.className = 'leaderboard-pinned-wrapper';

    if (userIdx >= 0) {
      // User found in leaderboard dataset (e.g. rank 14 while viewing page 1)
      const userRank = userIdx + 1;
      const userRowData = data[userIdx];
      const userPrizeAmt = getWeeklyPrizeForRank(userRank, pool);
      const userLbMult = getRowLeaderboardMultiplier(userRowData, true);
      const userMultStr = userLbMult % 1 === 0 ? userLbMult.toFixed(0) : userLbMult.toFixed(2).replace(/0$/, '');
      const userMultBadge = `<span class="leaderboard-mult-badge" style="font-size:0.72rem; font-weight:800; margin-left:3px; color:${userLbMult > 1.0 ? '#ffd700' : 'var(--text-dim)'};" title="Leaderboard Multiplier: ${userMultStr}x (Final Prize: ${(userPrizeAmt * userLbMult).toLocaleString()} PGT)">(${userMultStr}x)</span>`;
      const userPrize = (pool <= 0) 
        ? '<span style="color:var(--text-dim); opacity:0.6;">0 PGT</span>' 
        : (userPrizeAmt > 0 ? `${userPrizeAmt.toLocaleString()} PGT ${userMultBadge}` : '0 PGT');
      const userScoreVal = userRowData[conf.scoreField] || 0;

      const userStarship = getLeaderboardStarshipBadge(userRowData, true);
      const userStarshipLine = userStarship 
        ? `<div class="leaderboard-info-bottom">${userStarship}</div>` 
        : `<div class="leaderboard-info-bottom"><span class="badge-starship-empty" style="font-size:0.64rem; color:var(--text-dim); opacity:0.4; display:inline-flex; align-items:center; gap:3px;"><span>🛸</span> Standard Hull</span></div>`;

      pinnedWrapper.innerHTML = `
        <div class="leaderboard-pinned-header"><span>⚡ YOUR STANDING</span></div>
        <div class="leaderboard-row pinned-user-row user-row">
          <span class="leaderboard-rank rank-${userRank}">#${userRank}</span>
          <div class="leaderboard-info">
            <div class="leaderboard-info-top">
              <span class="leaderboard-name">${formatLeaderboardName(userRowData, true)}</span>
              <span class="badge-you" style="color:var(--color-accent); font-size:0.75rem; font-weight:700; margin-left:4px;">(You)</span>
            </div>
            ${userStarshipLine}
          </div>
          <div class="leaderboard-stats">
            <div class="leaderboard-score">${userScoreVal.toLocaleString()} <span class="score-unit">pts</span></div>
            <div class="leaderboard-prize">${userPrize}</div>
          </div>
        </div>
      `;
    } else if (appState && typeof appState.isPlayerConnected === 'function' && appState.isPlayerConnected()) {
      // User connected but not in top 100 rows in database
      const userLocalScore = (appState.state && appState.state[conf.stateScoreKey]) ? parseInt(appState.state[conf.stateScoreKey], 10) : 0;
      const userDisplayName = (appState.state && appState.state.username) || '';
      const userPlayerId = (appState.state && appState.state.playerId) || '';
      const userLinked = (appState.state && appState.state.linkedWalletAddress) || '';
      const mockRow = { username: userDisplayName, player_id: userPlayerId, linked_wallet_address: userLinked };
      const userLocalLbMult = getRowLeaderboardMultiplier(mockRow, true);
      const userLocalMultStr = userLocalLbMult % 1 === 0 ? userLocalLbMult.toFixed(0) : userLocalLbMult.toFixed(2).replace(/0$/, '');
      const userLocalMultBadge = `<span class="leaderboard-mult-badge" style="font-size:0.72rem; font-weight:800; margin-left:3px; color:${userLocalLbMult > 1.0 ? '#ffd700' : 'var(--text-dim)'};" title="Leaderboard Multiplier: ${userLocalMultStr}x">(${userLocalMultStr}x)</span>`;

      const mockStarship = getLeaderboardStarshipBadge(mockRow, true);
      const mockStarshipLine = mockStarship 
        ? `<div class="leaderboard-info-bottom">${mockStarship}</div>` 
        : `<div class="leaderboard-info-bottom"><span class="badge-starship-empty" style="font-size:0.64rem; color:var(--text-dim); opacity:0.4; display:inline-flex; align-items:center; gap:3px;"><span>🛸</span> Standard Hull</span></div>`;

      pinnedWrapper.innerHTML = `
        <div class="leaderboard-pinned-header"><span>⚡ YOUR STANDING</span></div>
        <div class="leaderboard-row pinned-user-row user-row" style="${userLocalScore === 0 ? 'opacity: 0.85;' : ''}">
          <span class="leaderboard-rank" style="font-size:0.8rem; color:${userLocalScore > 0 ? 'var(--text-muted)' : 'var(--text-dim)'};">${userLocalScore > 0 ? '100+' : '--'}</span>
          <div class="leaderboard-info">
            <div class="leaderboard-info-top">
              <span class="leaderboard-name">${formatLeaderboardName(mockRow, true)}</span>
              <span class="badge-you" style="color:var(--color-accent); font-size:0.75rem; font-weight:700; margin-left:4px;">(You)</span>
            </div>
            ${mockStarshipLine}
          </div>
          <div class="leaderboard-stats">
            <div class="leaderboard-score" style="${userLocalScore === 0 ? 'color:var(--text-muted);' : ''}">${userLocalScore.toLocaleString()} <span class="score-unit">pts</span></div>
            <div class="leaderboard-prize" style="${userLocalScore === 0 ? 'color:var(--text-dim);' : ''}">0 PGT ${userLocalMultBadge}</div>
          </div>
        </div>
      `;
    }

    if (pinnedWrapper.innerHTML.trim() !== '') {
      scoreboard.appendChild(pinnedWrapper);
    }
  }

  // Pagination navigation bar (if more than 1 page)
  if (totalPages > 1) {
    const pagDiv = document.createElement('div');
    pagDiv.className = 'leaderboard-pagination';
    pagDiv.innerHTML = `
      <button class="lb-page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="window.changeGameLeaderboardPage('${gameKey}', ${currentPage - 1})">◀ PREV</button>
      <span class="lb-page-info">PAGE ${currentPage} / ${totalPages}</span>
      <button class="lb-page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.changeGameLeaderboardPage('${gameKey}', ${currentPage + 1})">NEXT ▶</button>
    `;
    scoreboard.appendChild(pagDiv);
  }
}
window.renderGameLeaderboard = renderGameLeaderboard;

export function changeGameLeaderboardPage(gameKey, newPage) {
  if (gameLeaderboardsState[gameKey]) {
    gameLeaderboardsState[gameKey].page = newPage;
    renderGameLeaderboard(gameKey);
    try {
      if (sfx && typeof sfx.click === 'function') sfx.click();
    } catch (e) {}
  }
}
window.changeGameLeaderboardPage = changeGameLeaderboardPage;

async function fetchAndLoadGameLeaderboard(gameKey, forceRefresh = false) {
  const conf = GAME_LEADERBOARDS_CONFIG[gameKey];
  if (!conf) return;

  const scoreboard = document.getElementById(conf.containerId) || (conf.fallbackContainerId ? document.getElementById(conf.fallbackContainerId) : null);
  if (!scoreboard) return;

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const gameConf = settings[conf.settingKey] || (conf.settingKey === 'stacker' ? settings.catcher : {}) || {};
  const pool = (gameConf.weekly_pool_pgt !== undefined && gameConf.weekly_pool_pgt !== null) ? Number(gameConf.weekly_pool_pgt) : conf.defaultPool;
  
  const poolEl = document.getElementById(conf.poolElId) || (conf.fallbackPoolElId ? document.getElementById(conf.fallbackPoolElId) : null);
  if (poolEl) {
    poolEl.innerText = pool > 0 ? `Weekly Pool: ${pool.toLocaleString()} PGT` : 'Weekly Pool: 0 PGT (Paused)';
  }

  // 90-second in-memory client cache check to eliminate duplicate Supabase reads on tab switching
  const now = Date.now();
  const cached = leaderboardDataCache[gameKey];
  if (!forceRefresh && cached && (now - cached.timestamp < LEADERBOARD_CACHE_TTL_MS)) {
    gameLeaderboardsState[gameKey] = {
      data: cached.data || [],
      page: gameLeaderboardsState[gameKey]?.page || 1,
      pool
    };
    renderGameLeaderboard(gameKey);
    return;
  }

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    // Strip heavy columns (owned_nfts, crate_nfts, space_state) to slash API traffic by ~98%
    let selectFields = `player_id, linked_wallet_address, ${conf.scoreField}, username, user_id, auth_provider, vip_until, vip_level, equipped_starship`;
    let { data, error } = await supabase.from('users')
      .select(selectFields)
      .gt(conf.scoreField, 0)
      .order(conf.scoreField, { ascending: false })
      .limit(100);

    if (error && (error.code === 'PGRST204' || (error.message && error.message.includes('equipped_starship')))) {
      const fallbackFields = `player_id, linked_wallet_address, ${conf.scoreField}, username, user_id, auth_provider, vip_until, vip_level`;
      const res = await supabase.from('users')
        .select(fallbackFields)
        .gt(conf.scoreField, 0)
        .order(conf.scoreField, { ascending: false })
        .limit(100);
      data = res.data;
      error = res.error;
    }

    if (error) {
      if (error.code === 'PGRST204' || (error.message && error.message.includes(conf.scoreField))) {
        gameLeaderboardsState[gameKey] = { data: [], page: 1, pool };
        leaderboardDataCache[gameKey] = { data: [], timestamp: now };
        renderGameLeaderboard(gameKey);
        return;
      }
      throw error;
    }

    // Cache the clean dataset in memory with fresh timestamp
    leaderboardDataCache[gameKey] = {
      data: data || [],
      timestamp: Date.now()
    };

    gameLeaderboardsState[gameKey] = {
      data: data || [],
      page: gameLeaderboardsState[gameKey]?.page || 1,
      pool
    };
    renderGameLeaderboard(gameKey);
  } catch (err) {
    console.error(`Failed to load ${gameKey} leaderboard:`, err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

export async function loadAstroDodgeLeaderboard(forceRefresh = false) {
  return fetchAndLoadGameLeaderboard('astrododge', forceRefresh);
}
window.loadAstroDodgeLeaderboard = loadAstroDodgeLeaderboard;

export async function loadInvadersLeaderboard(forceRefresh = false) {
  return fetchAndLoadGameLeaderboard('invaders', forceRefresh);
}
window.loadInvadersLeaderboard = loadInvadersLeaderboard;

export async function loadDriftLeaderboard(forceRefresh = false) {
  return fetchAndLoadGameLeaderboard('drift', forceRefresh);
}
window.loadDriftLeaderboard = loadDriftLeaderboard;

export async function loadStackerLeaderboard(forceRefresh = false) {
  return fetchAndLoadGameLeaderboard('stacker', forceRefresh);
}
window.loadStackerLeaderboard = loadStackerLeaderboard;
window.loadCatcherLeaderboard = loadStackerLeaderboard;

export async function loadSkeetLeaderboard(forceRefresh = false) {
  return fetchAndLoadGameLeaderboard('skeet', forceRefresh);
}
window.loadSkeetLeaderboard = loadSkeetLeaderboard;

export async function loadDefenseLeaderboard(forceRefresh = false) {
  return fetchAndLoadGameLeaderboard('defense', forceRefresh);
}
window.loadDefenseLeaderboard = loadDefenseLeaderboard;

export async function loadRunnerLeaderboard(forceRefresh = false) {
  return fetchAndLoadGameLeaderboard('runner', forceRefresh);
}
window.loadRunnerLeaderboard = loadRunnerLeaderboard;

export async function loadQ2048Leaderboard(forceRefresh = false) {
  return fetchAndLoadGameLeaderboard('q2048', forceRefresh);
}
window.loadQ2048Leaderboard = loadQ2048Leaderboard;

export async function loadTetrisLeaderboard(forceRefresh = false) {
  return fetchAndLoadGameLeaderboard('tetris', forceRefresh);
}
window.loadTetrisLeaderboard = loadTetrisLeaderboard;
window.loadGameLeaderboard = fetchAndLoadGameLeaderboard;

let cachedRefLeaderboardData = null;
let lastRefLeaderboardFetchTime = 0;
const REF_LB_CACHE_TTL_MS = 90 * 1000;

export async function loadReferralLeaderboard(forceRefresh = false) {
  const scoreboard = document.getElementById('leaderboard-ref-container');
  if (!scoreboard) return;

  const now = Date.now();
  if (!forceRefresh && cachedRefLeaderboardData && (now - lastRefLeaderboardFetchTime < REF_LB_CACHE_TTL_MS)) {
    renderReferralLeaderboardRows(cachedRefLeaderboardData, scoreboard);
    return;
  }

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('player_id, linked_wallet_address, referrals_count, total_referral_commission, username, user_id, auth_provider')
      .gt('referrals_count', 0)
      .order('referrals_count', { ascending: false })
      .limit(10);
      
    if (error) throw error;
    
    cachedRefLeaderboardData = data || [];
    lastRefLeaderboardFetchTime = Date.now();
    renderReferralLeaderboardRows(cachedRefLeaderboardData, scoreboard);
  } catch (err) {
    console.error("Failed to load referral leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

function renderReferralLeaderboardRows(data, scoreboard) {
  scoreboard.innerHTML = '';
  if (!data || data.length === 0) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No referrers yet.</div>';
    return;
  }

  data.forEach((row, idx) => {
    const rank = idx + 1;
    const item = document.createElement('div');
    const isUser = checkIsUserRow(row);
    const podiumRowClass = rank === 1 ? 'podium-row-1' : rank === 2 ? 'podium-row-2' : rank === 3 ? 'podium-row-3' : '';
    item.className = `leaderboard-row ${isUser ? 'user-row' : ''} ${podiumRowClass}`.trim();
    
    const rankContent = rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `${rank}`;
    const rankClass = `leaderboard-rank rank-${rank} ${rank <= 3 ? `podium-rank podium-rank-${rank}` : ''}`;
    
    item.innerHTML = `
      <span class="${rankClass}">${rankContent}</span>
      <div class="leaderboard-info">
        <div class="leaderboard-info-top">
          <span class="leaderboard-name">${formatLeaderboardName(row, isUser)}</span>
          ${isUser ? '<span class="badge-you" style="color:var(--color-accent); font-size:0.75rem; font-weight:700; margin-left:4px;">(You)</span>' : ''}
        </div>
      </div>
      <div class="leaderboard-stats">
        <div class="leaderboard-score">${row.referrals_count || 0} <span class="score-unit">Ref(s)</span></div>
        <div class="leaderboard-prize">+${(row.total_referral_commission || 0).toFixed(0)} PGT</div>
      </div>
    `;
    scoreboard.appendChild(item);
  });
}

let cachedWeeklyWinsData = null;
let lastWeeklyWinsFetchTime = 0;
const WEEKLY_WINS_CACHE_TTL_MS = 90 * 1000;

export async function loadWeeklyWinsLeaderboard(forceRefresh = false) {
  const scoreboard = document.getElementById('weekly-wins-leaderboard');
  if (!scoreboard) return;

  const now = Date.now();
  if (!forceRefresh && cachedWeeklyWinsData && (now - lastWeeklyWinsFetchTime < WEEKLY_WINS_CACHE_TTL_MS)) {
    renderWeeklyWinsRows(cachedWeeklyWinsData.data, cachedWeeklyWinsData.userMap, scoreboard);
    return;
  }

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
        .gt('payout', 0)
        .order('payout', { ascending: false })
        .limit(10);
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.warn("bet_wins table select warning:", error.message);
    }
    
    if (!data || data.length === 0) {
      cachedWeeklyWinsData = { data: [], userMap: {} };
      lastWeeklyWinsFetchTime = Date.now();
      scoreboard.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-dim);">No big wins yet this week!</div>';
      return;
    }

    // Fetch user profiles ONLY for the specific winning addresses to slash DB reads
    const rawAddrs = Array.from(new Set(data.map(r => (r.wallet_address || r.player_id || '').toLowerCase()).filter(Boolean)));
    const userMap = {};
    if (rawAddrs.length > 0) {
      try {
        const orFilters = rawAddrs.map(a => `player_id.eq.${a},linked_wallet_address.eq.${a}`).join(',');
        const { data: userProfiles } = await supabase.from('users')
          .select('player_id, linked_wallet_address, username, user_id')
          .or(orFilters)
          .limit(20);
        if (userProfiles) {
          userProfiles.forEach(u => {
            if (u.player_id) userMap[u.player_id.toLowerCase()] = u;
            if (u.linked_wallet_address) userMap[u.linked_wallet_address.toLowerCase()] = u;
          });
        }
      } catch (profileErr) {
        console.warn("User profiles fetch warning for weekly wins:", profileErr);
      }
    }

    cachedWeeklyWinsData = { data, userMap };
    lastWeeklyWinsFetchTime = Date.now();
    renderWeeklyWinsRows(data, userMap, scoreboard);
  } catch(e) {
    console.error("Failed to fetch weekly wins leaderboard:", e);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--color-danger);">Failed to load wins</div>';
  }
}

function renderWeeklyWinsRows(data, userMap, scoreboard) {
  const activeSt = (typeof getAppState === 'function' ? getAppState() : (window.appState || null));
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
}


// Window bindings for backward compatibility
if (typeof window !== 'undefined') {
  window.checkIsUserRow = checkIsUserRow;
  window.formatLeaderboardName = formatLeaderboardName;
  window.getLeaderboardStarshipBadge = getLeaderboardStarshipBadge;
  window.getWeeklyPrizeForRank = getWeeklyPrizeForRank;
  window.getRowLeaderboardMultiplier = getRowLeaderboardMultiplier;
  window.gameLeaderboardsState = gameLeaderboardsState;
  window.invalidateGameLeaderboardCache = invalidateGameLeaderboardCache;
  window.renderGameLeaderboard = renderGameLeaderboard;
  window.changeGameLeaderboardPage = changeGameLeaderboardPage;
  window.loadAstroDodgeLeaderboard = loadAstroDodgeLeaderboard;
  window.loadInvadersLeaderboard = loadInvadersLeaderboard;
  window.loadDriftLeaderboard = loadDriftLeaderboard;
  window.loadStackerLeaderboard = loadStackerLeaderboard;
  window.loadCatcherLeaderboard = loadStackerLeaderboard;
  window.loadSkeetLeaderboard = loadSkeetLeaderboard;
  window.loadDefenseLeaderboard = loadDefenseLeaderboard;
  window.loadRunnerLeaderboard = loadRunnerLeaderboard;
  window.loadQ2048Leaderboard = loadQ2048Leaderboard;
  window.loadTetrisLeaderboard = loadTetrisLeaderboard;
  window.loadGameLeaderboard = fetchAndLoadGameLeaderboard;
  window.loadReferralLeaderboard = loadReferralLeaderboard;
  window.loadWeeklyWinsLeaderboard = loadWeeklyWinsLeaderboard;
  window.setupLeaderboardUI = loadAstroDodgeLeaderboard;
}
