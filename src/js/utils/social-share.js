/**
 * Polygon Gaming - Social Sharing & Viral Referral Engine
 * Provides 1-click sharing to 𝕏 (Twitter) and Telegram with embedded referral attribution,
 * enabling players to flex high scores, daily cipher results, and invite friends.
 */

import { triggerToast } from '../core/ui.js';
import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';

// Game-specific badges and emojis for social feeds
const GAME_CONFIG = {
  drift: { name: 'Cyber Drift', emoji: '🏎️💨', hashtag: '#CyberDrift' },
  astrododge: { name: 'Astro-Dodge', emoji: '🚀', hashtag: '#AstroDodge' },
  invaders: { name: 'Cyber Invaders', emoji: '👾', hashtag: '#CyberInvaders' },
  stacker: { name: 'Cyber Stacker', emoji: '🧱', hashtag: '#CyberStacker' },
  runner: { name: 'Cyber Runner', emoji: '🏃‍♂️', hashtag: '#CyberRunner' },
  q2048: { name: 'Quantum 2048', emoji: '🧩', hashtag: '#Quantum2048' },
  tetris: { name: 'Cyber Tetris', emoji: '🧱', hashtag: '#CyberTetris' },
  skeet: { name: 'Cyber Skeet', emoji: '🎯', hashtag: '#CyberSkeet' },
  defense: { name: 'Cyber Defense', emoji: '🛡️', hashtag: '#CyberDefense' },
  wordle: { name: 'Cyber Wordle', emoji: '🟩🟨⬛', hashtag: '#CyberWordle' },
  sudoku: { name: 'Cyber Sudoku', emoji: '🔢', hashtag: '#CyberSudoku' }
};

/**
 * Resolves current player's referral code or synthetic player_id
 */
export function getReferralCode() {
  try {
    if (appState && appState.state) {
      if (appState.state.referralCode && appState.state.referralCode !== 'EMPTY') {
        return appState.state.referralCode.trim();
      }
      if (typeof appState.getPlayerId === 'function') {
        const pid = appState.getPlayerId();
        if (pid) return pid.trim();
      }
      if (appState.state.playerId) {
        return appState.state.playerId.trim();
      }
    }
    const refInput = document.getElementById('ref-invite-link');
    if (refInput && refInput.value) {
      const match = refInput.value.match(/[?&]ref=([^&#]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
    const dashRef = document.getElementById('dashboard-ref-link');
    if (dashRef && dashRef.value) {
      const match = dashRef.value.match(/[?&]ref=([^&#]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
  } catch (e) {
    console.warn('[SocialShare] Error resolving referral code:', e);
  }
  return '';
}

/**
 * Returns full referral URL for current player
 */
export function getReferralShareUrl() {
  const code = getReferralCode();
  const baseUrl = 'https://polygongaming.io/';
  return code ? `${baseUrl}?ref=${encodeURIComponent(code)}` : baseUrl;
}

/**
 * Safely opens a centered popup window for social web intents
 */
function openShareWindow(url, title = 'Share on Social') {
  const width = 560;
  const height = 440;
  const left = Math.max(0, (window.screen.width - width) / 2);
  const top = Math.max(0, (window.screen.height - height) / 2);
  
  return window.open(
    url,
    title,
    `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
  );
}

/**
 * 1-Click Share to 𝕏 (Twitter)
 */
export function shareToTwitter(text) {
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  openShareWindow(tweetUrl, 'Share on X');
}

/**
 * 1-Click Share to Telegram
 */
export function shareToTelegram(text, url) {
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url || getReferralShareUrl())}&text=${encodeURIComponent(text)}`;
  openShareWindow(tgUrl, 'Share on Telegram');
}

/**
 * Copies player referral link to clipboard with audio and toast confirmation
 */
export function copyReferralLink(customUrl) {
  const targetUrl = customUrl || getReferralShareUrl();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(targetUrl).then(() => {
      if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
      if (triggerToast) triggerToast('🔗 Referral link copied to clipboard!', 'success');
    }).catch(() => {
      fallbackCopy(targetUrl);
    });
  } else {
    fallbackCopy(targetUrl);
  }
}

function fallbackCopy(text) {
  try {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
    if (triggerToast) triggerToast('🔗 Referral link copied to clipboard!', 'success');
  } catch (err) {
    if (triggerToast) triggerToast('Please copy link manually: ' + text, 'info');
  }
}

/**
 * Share Arcade High Score or Game Over Score
 * @param {string} gameKey - e.g. 'drift', 'astrododge', 'invaders'
 * @param {number} score - player score
 * @param {number} pgtWon - PGT awarded this run
 * @param {'twitter'|'telegram'|'copy'} platform
 */
export function shareGameScore(gameKey, score, pgtWon = 0, platform = 'twitter') {
  const key = (gameKey || 'arcade').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cfg = GAME_CONFIG[key] || { name: gameKey || 'Arcade Game', emoji: '🎮', hashtag: '#Arcade' };
  const shareUrl = getReferralShareUrl();
  const numScore = Number(score || 0).toLocaleString();
  const earnBadge = pgtWon > 0 ? ` +${Number(pgtWon).toFixed(2)} $PGT earned! ⚡` : '';

  const text = `I just scored ${numScore} in ${cfg.name} on @PolygonGaming! ${cfg.emoji}${earnBadge}\n\nPlay free web3 arcade games, solve daily puzzles & earn $PGT tokens:\n${shareUrl}\n\n${cfg.hashtag} #Polygon #Web3Gaming #PlayToEarn`;

  if (platform === 'telegram') {
    const tgText = `I just scored ${numScore} in ${cfg.name} on Polygon Gaming! ${cfg.emoji}${earnBadge}\nPlay free arcade games and earn crypto:`;
    shareToTelegram(tgText, shareUrl);
  } else if (platform === 'copy') {
    copyReferralLink(shareUrl);
  } else {
    shareToTwitter(text);
  }
}

/**
 * Share General Invite to Polygon Gaming
 */
export function shareGeneralInvite(platform = 'twitter') {
  const shareUrl = getReferralShareUrl();
  const text = `Join me on @PolygonGaming! 🎮⚡\n\nClaim free $PGT from the 24h faucet, play retro arcade games, solve daily ciphers, and earn crypto rewards on Polygon.\n\nPlay free with my link:\n${shareUrl}\n\n#Polygon #Web3Gaming #FreeCrypto #CryptoGames`;

  if (platform === 'telegram') {
    const tgText = `Join me on Polygon Gaming! 🎮\nClaim free PGT tokens from the 24h faucet and earn crypto rewards in retro arcade games:`;
    shareToTelegram(tgText, shareUrl);
  } else if (platform === 'copy') {
    copyReferralLink(shareUrl);
  } else {
    shareToTwitter(text);
  }
}

// Window Globals for easy inline onclick handlers
if (typeof window !== 'undefined') {
  window.socialShare = {
    getReferralCode,
    getReferralShareUrl,
    shareToTwitter,
    shareToTelegram,
    copyReferralLink,
    shareGameScore,
    shareGeneralInvite
  };
  
  window.shareCurrentGameScore = function(defaultGameTitle, platform = 'twitter') {
    const res = window.lastArcadeResult || {};
    let score = res.score || 0;
    let pgt = res.pgt || 0;
    const game = res.title || defaultGameTitle || 'Arcade Game';

    // Fallback: extract score from DOM elements if lastArcadeResult is not populated
    if (!score) {
      const elMap = {
        'Cyber Drift': 'drift-final-score',
        'Astro-Dodge': 'game-live-score',
        'Cyber Invaders': 'invaders-final-score',
        'Cyber Stacker': 'stacker-final-score',
        'Cyber Runner': 'runner-final-score',
        'Quantum 2048': 'q2048-final-score',
        'Cyber Tetris': 'tetris-final-score',
        'Cyber Skeet': 'skeet-res-score',
        'Cyber Defense': 'defense-res-score'
      };
      const id = elMap[defaultGameTitle];
      if (id) {
        const el = document.getElementById(id);
        if (el) {
          const val = parseInt(el.innerText.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(val)) score = val;
        }
      }
    }

    shareGameScore(res.game || defaultGameTitle, score, pgt, platform);
  };

  window.shareCurrentGameScoreTg = function(defaultGameTitle) {
    window.shareCurrentGameScore(defaultGameTitle, 'telegram');
  };

  window.copyReferralShareLink = copyReferralLink;
  window.shareDashboardInvite = function(platform = 'twitter') {
    shareGeneralInvite(platform);
  };
}
