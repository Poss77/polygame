/**
 * Polygon Gaming: Seasonal Events & Holiday Skins System
 * Extensible registry for recurring annual and scheduled platform events
 * (Halloween, Christmas / Winter Holiday, Easter, etc.)
 */

export const DEFAULT_CAPTCHA_SYMBOLS = ['⚡', '💎', '👑', '👾', '🛸', '🎮', '🍒', '🎲'];

export const SEASONAL_EVENTS = [
  {
    id: 'halloween',
    name: 'Spooky Halloween',
    icon: '🎃',
    bonusPercent: 10,
    skinClass: 'halloween-skin',
    badgeText: '🎃 +10% Spooky Bonus Active!',
    bannerTitle: 'HALLOWEEN SPOOKTACULAR',
    bannerSubtitle: 'Trick or Treat! Enjoy an exclusive <strong>+10% Faucet Boost</strong> on all claims until Oct 31st! 🍬',
    bannerIconsLeft: '🎃👻',
    bannerIconsRight: '🦇🕷️',
    gradientColors: { start: '#ff7700', middle: '#ff3b00', end: '#9d4edd' },
    claimToastPgt: (amount) => `🎃 Spooky Treat! Claimed +${amount.toFixed(2)} PGT (+10% Event Boost included)!`,
    claimToastPol: (amount) => `🎃 VIP Spooky Treat! Claimed +${amount.toFixed(4)} POL (+10% Event Boost included)!`,
    captchaSymbols: ['🎃', '👻', '🦇', '🍬', '🕸️', '🕷️', '💀', '🧙'],
    // Annual recurring: October 1 through October 31 23:59:59 UTC
    recurring: {
      startMonth: 10, // 1-indexed
      startDay: 1,
      endMonth: 10,
      endDay: 31
    }
  },
  {
    id: 'christmas',
    name: 'Winter Holiday Festival',
    icon: '🎄',
    bonusPercent: 10,
    skinClass: 'christmas-skin',
    badgeText: '🎄 +10% Holiday Joy Bonus!',
    bannerTitle: 'WINTER HOLIDAY WONDERLAND',
    bannerSubtitle: 'Season of Giving! Enjoy an exclusive <strong>+10% Holiday Faucet Boost</strong> on all claims! 🎁❄️',
    bannerIconsLeft: '🎄🎅',
    bannerIconsRight: '🎁❄️',
    gradientColors: { start: '#00b894', middle: '#ffd700', end: '#ff3838' },
    claimToastPgt: (amount) => `🎄 Season of Giving! Claimed +${amount.toFixed(2)} PGT (+10% Holiday Boost included)!`,
    claimToastPol: (amount) => `🎄 VIP Holiday Joy! Claimed +${amount.toFixed(4)} POL (+10% Holiday Boost included)!`,
    captchaSymbols: ['🎄', '🎅', '🎁', '❄️', '⛄', '⭐', '🔔', '🍪'],
    // Annual recurring: December 15 through January 2 23:59:59 UTC
    recurring: {
      startMonth: 12,
      startDay: 15,
      endMonth: 1,
      endDay: 2
    }
  },
  {
    id: 'easter',
    name: 'Easter Extravaganza',
    icon: '🐰',
    bonusPercent: 10,
    skinClass: 'easter-skin',
    badgeText: '🐰 +10% Easter Egg Boost!',
    bannerTitle: 'EASTER EGG EXTRAVAGANZA',
    bannerSubtitle: 'Hoppy Spring! Hunt down an extra <strong>+10% Faucet Boost</strong> on all claims! 🥚🌸',
    bannerIconsLeft: '🐰🥚',
    bannerIconsRight: '🌷🐣',
    gradientColors: { start: '#a29bfe', middle: '#55efc4', end: '#ff7675' },
    claimToastPgt: (amount) => `🐰 Easter Joy! Claimed +${amount.toFixed(2)} PGT (+10% Easter Boost included)!`,
    claimToastPol: (amount) => `🐰 VIP Easter Joy! Claimed +${amount.toFixed(4)} POL (+10% Easter Boost included)!`,
    captchaSymbols: ['🐰', '🥚', '🌷', '🐣', '🌸', '🍫', '🎀', '🥕'],
    // Spring recurring window
    recurring: {
      startMonth: 3,
      startDay: 20,
      endMonth: 4,
      endDay: 10
    }
  }
];

/**
 * Returns the currently active seasonal event based on current time (UTC)
 * @param {Date|number} now
 * @returns {object|null} Active event definition or null
 */
export function getActiveSeasonalEvent(now = new Date()) {
  const date = typeof now === 'number' ? new Date(now) : now;
  const curYear = date.getUTCFullYear();
  const curMonth = date.getUTCMonth() + 1; // 1-12
  const curDay = date.getUTCDate();
  const nowMs = date.getTime();

  for (const event of SEASONAL_EVENTS) {
    // 1. Check explicit dates if configured
    if (event.startDate && event.endDate) {
      const startMs = new Date(event.startDate).getTime();
      const endMs = new Date(event.endDate).getTime();
      if (nowMs >= startMs && nowMs <= endMs) {
        return { ...event, eventEndMs: endMs };
      }
    }

    // 2. Check annual recurring rules
    if (event.recurring) {
      const { startMonth, startDay, endMonth, endDay } = event.recurring;
      let isActive = false;
      let targetEndMs = null;

      if (startMonth <= endMonth) {
        // Intra-year window (e.g. Oct 1 to Oct 31)
        if (
          (curMonth > startMonth || (curMonth === startMonth && curDay >= startDay)) &&
          (curMonth < endMonth || (curMonth === endMonth && curDay <= endDay))
        ) {
          isActive = true;
          targetEndMs = Date.UTC(curYear, endMonth - 1, endDay, 23, 59, 59, 999);
        }
      } else {
        // Year-wrap window (e.g. Dec 15 to Jan 2)
        if (
          (curMonth > startMonth || (curMonth === startMonth && curDay >= startDay)) ||
          (curMonth < endMonth || (curMonth === endMonth && curDay <= endDay))
        ) {
          isActive = true;
          const endYear = curMonth >= startMonth ? curYear + 1 : curYear;
          targetEndMs = Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
        }
      }

      if (isActive) {
        return { ...event, eventEndMs: targetEndMs };
      }
    }
  }

  return null;
}

/**
 * Returns captcha symbols for active event or default symbols
 */
export function getSeasonalCaptchaSymbols() {
  const active = getActiveSeasonalEvent();
  if (active && Array.isArray(active.captchaSymbols) && active.captchaSymbols.length > 0) {
    return active.captchaSymbols;
  }
  return DEFAULT_CAPTCHA_SYMBOLS;
}

/**
 * Formats a remaining countdown string (e.g. "17d 03h 22m 14s")
 */
export function formatSeasonalCountdown(endMs, nowMs = Date.now()) {
  const diffSec = Math.max(0, Math.floor((endMs - nowMs) / 1000));
  const days = Math.floor(diffSec / 86400);
  const hrs = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return `${days}d ${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
}
