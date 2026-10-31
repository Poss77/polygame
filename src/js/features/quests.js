import { appState } from '../core/state.js';
import { supabase } from '../core/config.js';
import { triggerToast, openModal, closeModal } from '../core/ui.js';
import { sfx } from '../core/audio.js';
import { executeAuthenticatedRpc } from '../core/auth-web3.js';

export function getTodayDateStr() {
  return new Date().toISOString().split('T')[0];
}

export function getUserQuests() {
  const today = getTodayDateStr();

  let q = appState.state.dailyQuests;
  if (!q || typeof q !== 'object' || !q.date) {
    try {
      const localStr = localStorage.getItem('polygame_daily_quests');
      if (localStr) q = JSON.parse(localStr);
    } catch(e) {}
  }

  if (!q || typeof q !== 'object' || q.date !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastDate = (q && q.last_streak_date) || '';
    // If last streak date is older than yesterday, the active streak has expired back to 0
    let validStreak = (q && q.streak_days) || 0;
    if (lastDate !== yesterday && lastDate !== today) {
      validStreak = 0;
    }

    q = {
      date: today,
      games: 0,
      mining: 0,
      wins: 0,
      games_claimed: false,
      mining_claimed: false,
      wins_claimed: false,
      master_claimed: false,
      streak_days: validStreak,
      last_streak_date: lastDate,
      streak_wheel_available: (q && q.streak_wheel_available) || false
    };
    appState.state.dailyQuests = q;
    try { localStorage.setItem('polygame_daily_quests', JSON.stringify(q)); } catch(e){}
  } else {
    appState.state.dailyQuests = q;
  }
  return q;
}
window.getUserQuests = getUserQuests;

export function getCompletedQuestsCount(q) {
  const questObj = q || getUserQuests();
  const gamesDone = (questObj.games || 0) >= 3 || !!questObj.games_claimed || !!questObj.arcade_claimed || (questObj.arcade_wins || 0) >= 3;
  const miningDone = (questObj.mining || 0) >= 3 || !!questObj.mining_claimed || (questObj.mining_ops || 0) >= 3;
  const winsDone = (questObj.wins || 0) >= 3 || !!questObj.wins_claimed || !!questObj.wager_claimed || (questObj.wager_count || 0) >= 3;
  return (gamesDone ? 1 : 0) + (miningDone ? 1 : 0) + (winsDone ? 1 : 0);
}
window.getCompletedQuestsCount = getCompletedQuestsCount;

export function getQuestWalletAddress() {
  const pid = (appState?.state?.playerId || '').toLowerCase();
  const primary = (appState?.state?.walletAddress || '').toLowerCase();
  const linked = (appState?.state?.linkedWalletAddress || '').toLowerCase();
  const isInternal = (addr) => addr && (addr.startsWith('0xpgt') || addr.startsWith('0xg'));
  if (pid && isInternal(pid)) return pid;
  if (typeof window.getStakingWalletAddress === 'function') {
    const stakeAddr = window.getStakingWalletAddress();
    if (stakeAddr) return stakeAddr.toLowerCase();
  }
  if (primary && isInternal(primary)) return primary;
  if (linked && isInternal(linked)) return linked;
  return pid || primary || linked || '';
}
window.getQuestWalletAddress = getQuestWalletAddress;

let _syncDebounceTimer = null;
let _isSyncing = false;
let _lastSyncedQuestsSignature = null;

export async function syncDailyQuests(forceImmediate = false) {
  if (!appState.isPlayerConnected() || !supabase) return null;
  // Never perform asynchronous network quest sync during real-time gameplay
  if (typeof window !== 'undefined' && typeof window.isAnyArcadeGamePlaying === 'function' && window.isAnyArcadeGamePlaying()) {
    return null;
  }

  if (!forceImmediate && _syncDebounceTimer) {
    clearTimeout(_syncDebounceTimer);
  }

  const executeSync = async () => {
    if (_isSyncing) return null;
    _isSyncing = true;
    try {
      const q = getUserQuests();
      const currentSignature = JSON.stringify(q);
      if (!forceImmediate && _lastSyncedQuestsSignature === currentSignature) {
        return null; // Skip redundant network RPC when quest values are unchanged
      }
      const wallet = getQuestWalletAddress();
      if (!wallet) return null;

      const { data: res, error } = await executeAuthenticatedRpc('sync_daily_quests', {
        p_wallet: wallet,
        p_client_quests: q
      });

      if (error) {
        console.warn('[Quests] sync_daily_quests RPC error:', error);
        return null;
      }

      let payload = res;
      if (Array.isArray(payload)) payload = payload[0];
      if (payload && payload.success && payload.daily_quests) {
        const synced = payload.daily_quests;
        if (!synced.streak_days && q.streak_days) synced.streak_days = q.streak_days;
        if (!synced.last_streak_date && q.last_streak_date) synced.last_streak_date = q.last_streak_date;
        if (synced.streak_wheel_available === undefined && q.streak_wheel_available) synced.streak_wheel_available = q.streak_wheel_available;

        appState.state.dailyQuests = synced;
        _lastSyncedQuestsSignature = JSON.stringify(synced);
        try {
          localStorage.setItem('polygame_daily_quests', JSON.stringify(synced));
        } catch (e) {}

        renderDailyQuestsUI();
        if (typeof window.syncProfileView === 'function') {
          window.syncProfileView();
        }
        return synced;
      }
    } catch (e) {
      console.warn('[Quests] Exception in syncDailyQuests:', e);
    } finally {
      _isSyncing = false;
    }
    return null;
  };

  if (forceImmediate) {
    if (_syncDebounceTimer) {
      clearTimeout(_syncDebounceTimer);
      _syncDebounceTimer = null;
    }
    return executeSync();
  } else {
    _syncDebounceTimer = setTimeout(executeSync, 1200);
  }
}
window.syncDailyQuests = syncDailyQuests;

// Auto-sync quests when tab becomes visible or receives focus
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && appState?.isPlayerConnected()) {
      syncDailyQuests(true);
    }
  });
  window.addEventListener('focus', () => {
    if (appState?.isPlayerConnected()) {
      syncDailyQuests(true);
    }
  });
}

export function trackQuestProgress(type, amount = 1) {
  const q = getUserQuests();
  let updated = false;

  if (type === 'arcade' || type === 'games' || type === 'game') {
    q.games = (q.games || 0) + amount;
    updated = true;
  } else if (type === 'mining') {
    q.mining = (q.mining || 0) + amount;
    updated = true;
  } else if (type === 'wins' || type === 'win') {
    q.wins = (q.wins || 0) + amount;
    updated = true;
  }

  if (updated) {
    appState.update({ dailyQuests: q });
    // If an objective reached target completion (>= 3), sync immediately so claim RPC never encounters stale counters
    const isGoalReached = (type === 'arcade' || type === 'games' || type === 'game') ? (q.games >= 3)
      : (type === 'mining') ? (q.mining >= 3)
      : (type === 'wins' || type === 'win') ? (q.wins >= 3)
      : false;
    try { localStorage.setItem('polygame_daily_quests', JSON.stringify(q)); } catch(e){}
    renderDailyQuestsUI();
    if (typeof window.syncProfileView === 'function') {
      window.syncProfileView();
    }
    // Authoritatively sync to Supabase so mobile and desktop stay aligned
    syncDailyQuests(isGoalReached);
  }
}
window.trackQuestProgress = trackQuestProgress;

export function getTimeUntilUtcMidnight() {
  const now = new Date();
  const nextUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const diffMs = nextUtc - now;
  const hrs = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  return `${hrs}h ${mins < 10 ? '0' : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}

// Live timer tick every second (paused during active arcade gameplay or hidden tab)
setInterval(() => {
  if (typeof document !== 'undefined' && document.hidden) return;
  if (typeof window !== 'undefined' && typeof window.isAnyArcadeGamePlaying === 'function' && window.isAnyArcadeGamePlaying()) return;
  const timerEl = document.getElementById('quest-reset-timer');
  if (timerEl) {
    timerEl.innerText = `Resets in: ${getTimeUntilUtcMidnight()}`;
  }
}, 1000);

export function renderDailyQuestsUI() {
  const q = getUserQuests();

  // 7-Day Quest Streak Stepper & Special Wheel UI
  const streakDays = Math.max(0, parseInt(q.streak_days || 0, 10));
  const streakWheelAvailable = !!q.streak_wheel_available || (streakDays >= 7);

  const streakBadge = document.getElementById('quest-streak-badge');
  const streakSubtext = document.getElementById('quest-streak-subtext');
  const btnOpenStreakWheel = document.getElementById('btn-open-streak-wheel');
  const stepperEl = document.getElementById('quest-streak-stepper');

  if (streakBadge) {
    streakBadge.innerText = `Streak: ${streakDays} / 7 Days`;
  }
  if (streakSubtext) {
    if (streakWheelAvailable) {
      streakSubtext.innerHTML = '<span style="color:#00ff88; font-weight:700;">🎉 7-Day Milestone Unlocked! Your Special Wheel Spin is Ready!</span>';
    } else {
      streakSubtext.innerText = `Complete daily quests 7 days in a row to earn a Special Wheel Spin! (${streakDays}/7)`;
    }
  }
  if (btnOpenStreakWheel) {
    if (streakWheelAvailable) {
      btnOpenStreakWheel.style.display = 'inline-flex';
    } else {
      btnOpenStreakWheel.style.display = 'none';
    }
  }

  if (stepperEl) {
    let stepperHtml = '';
    for (let day = 1; day <= 7; day++) {
      const isDone = streakDays >= day;
      const isToday = (streakDays + 1 === day && !q.master_claimed);
      const isMilestone = (day === 7);

      let bg = 'rgba(255, 255, 255, 0.04)';
      let border = 'rgba(255, 255, 255, 0.12)';
      let textColor = 'var(--text-dim)';
      let icon = `${day}`;

      if (isMilestone) {
        if (streakWheelAvailable || isDone) {
          bg = 'linear-gradient(135deg, rgba(255, 0, 122, 0.35), rgba(0, 240, 255, 0.35))';
          border = '#ff007a';
          textColor = '#ff007a';
          icon = '🎡';
        } else {
          bg = 'rgba(255, 0, 122, 0.08)';
          border = 'rgba(255, 0, 122, 0.35)';
          textColor = '#ff66b2';
          icon = '🎁';
        }
      } else if (isDone) {
        bg = 'rgba(0, 255, 136, 0.15)';
        border = 'rgba(0, 255, 136, 0.5)';
        textColor = '#00ff88';
        icon = '✓';
      } else if (isToday) {
        bg = 'rgba(0, 240, 255, 0.12)';
        border = 'rgba(0, 240, 255, 0.5)';
        textColor = '#00f0ff';
      }

      const cursor = (isMilestone && streakWheelAvailable) ? 'cursor: pointer;' : '';
      const onclick = (isMilestone && streakWheelAvailable) ? 'onclick="openStreakWheelModal()"' : '';

      stepperHtml += `
        <div ${onclick} style="background: ${bg}; border: 1px solid ${border}; border-radius: 8px; padding: 0.5rem 0.2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; transition: transform 0.2s; ${cursor}">
          <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px; color: ${textColor}; font-weight: 700;">Day ${day}</span>
          <span style="font-size: 0.95rem; font-weight: 900; color: ${isDone ? '#00ff88' : textColor};">${icon}</span>
        </div>
      `;
    }
    stepperEl.innerHTML = stepperHtml;
  }
  
  const gamesStatusEl = document.getElementById('quest-games-status');
  const miningStatusEl = document.getElementById('quest-mining-status');
  const winsStatusEl = document.getElementById('quest-wins-status');
  const masteryProgressEl = document.getElementById('quest-mastery-progress');

  const btnGames = document.getElementById('btn-claim-quest-games');
  const btnMining = document.getElementById('btn-claim-quest-mining');
  const btnWins = document.getElementById('btn-claim-quest-wins');
  const btnMaster = document.getElementById('btn-claim-quest-master');

  if (gamesStatusEl) gamesStatusEl.innerText = `${Math.min(q.games || 0, 3)} / 3 Games`;
  if (miningStatusEl) miningStatusEl.innerText = `${Math.min(q.mining || 0, 3)} / 3 Ores`;
  if (winsStatusEl) winsStatusEl.innerText = `${Math.min(q.wins || 0, 3)} / 3 Wins`;

  const gamesDone = (q.games || 0) >= 3 || q.games_claimed;
  const miningDone = (q.mining || 0) >= 3 || q.mining_claimed;
  const winsDone = (q.wins || 0) >= 3 || q.wins_claimed;
  const completedCount = (gamesDone ? 1 : 0) + (miningDone ? 1 : 0) + (winsDone ? 1 : 0);

  // Quest 1: Play 3 Mini-Games (+10 PGT)
  if (btnGames) {
    if (q.games_claimed) {
      btnGames.innerText = '✅ Claimed';
      btnGames.disabled = true;
      btnGames.style.cssText = 'padding: 0.35rem 0.75rem; font-size: 0.75rem; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.4); opacity: 1; font-weight: 700; border-radius: 6px; cursor: default;';
    } else if ((q.games || 0) >= 3) {
      btnGames.innerText = 'CLAIM +10';
      btnGames.disabled = false;
      btnGames.style.cssText = 'padding: 0.4rem 0.85rem; font-size: 0.8rem; background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%); color: #02200f; font-weight: 900; border: 1px solid #66ffb3; border-radius: 6px; opacity: 1; cursor: pointer; box-shadow: 0 0 12px rgba(0, 255, 136, 0.5); text-transform: uppercase; letter-spacing: 0.5px;';
      btnGames.onclick = () => claimQuestReward('games');
    } else {
      btnGames.innerText = 'Play Games';
      btnGames.disabled = false;
      btnGames.style.cssText = 'padding: 0.35rem 0.75rem; font-size: 0.75rem; background: rgba(0, 240, 255, 0.12); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.4); font-weight: 700; border-radius: 6px; opacity: 1; cursor: pointer;';
      btnGames.onclick = () => switchTab('games', 'earn');
    }
  }

  // Quest 2: Space Mining (+10 PGT)
  if (btnMining) {
    if (q.mining_claimed) {
      btnMining.innerText = '✅ Claimed';
      btnMining.disabled = true;
      btnMining.style.cssText = 'padding: 0.35rem 0.75rem; font-size: 0.75rem; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.4); opacity: 1; font-weight: 700; border-radius: 6px; cursor: default;';
    } else if ((q.mining || 0) >= 3) {
      btnMining.innerText = 'CLAIM +10';
      btnMining.disabled = false;
      btnMining.style.cssText = 'padding: 0.4rem 0.85rem; font-size: 0.8rem; background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%); color: #02200f; font-weight: 900; border: 1px solid #66ffb3; border-radius: 6px; opacity: 1; cursor: pointer; box-shadow: 0 0 12px rgba(0, 255, 136, 0.5); text-transform: uppercase; letter-spacing: 0.5px;';
      btnMining.onclick = () => claimQuestReward('mining');
    } else {
      btnMining.innerText = 'Mine Ores';
      btnMining.disabled = false;
      btnMining.style.cssText = 'padding: 0.35rem 0.75rem; font-size: 0.75rem; background: rgba(189, 0, 255, 0.12); color: #bd00ff; border: 1px solid rgba(189, 0, 255, 0.4); font-weight: 700; border-radius: 6px; opacity: 1; cursor: pointer;';
      btnMining.onclick = () => launchPolySpace();
    }
  }

  // Quest 3: Win 3 Rounds (+10 PGT)
  if (btnWins) {
    if (q.wins_claimed) {
      btnWins.innerText = '✅ Claimed';
      btnWins.disabled = true;
      btnWins.style.cssText = 'padding: 0.35rem 0.75rem; font-size: 0.75rem; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.4); opacity: 1; font-weight: 700; border-radius: 6px; cursor: default;';
    } else if ((q.wins || 0) >= 3) {
      btnWins.innerText = 'CLAIM +10';
      btnWins.disabled = false;
      btnWins.style.cssText = 'padding: 0.4rem 0.85rem; font-size: 0.8rem; background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%); color: #02200f; font-weight: 900; border: 1px solid #66ffb3; border-radius: 6px; opacity: 1; cursor: pointer; box-shadow: 0 0 12px rgba(0, 255, 136, 0.5); text-transform: uppercase; letter-spacing: 0.5px;';
      btnWins.onclick = () => claimQuestReward('wins');
    } else {
      btnWins.innerText = 'Play Games';
      btnWins.disabled = false;
      btnWins.style.cssText = 'padding: 0.35rem 0.75rem; font-size: 0.75rem; background: rgba(255, 170, 0, 0.12); color: #ffaa00; border: 1px solid rgba(255, 170, 0, 0.4); font-weight: 700; border-radius: 6px; opacity: 1; cursor: pointer;';
      btnWins.onclick = () => switchTab('games', 'bet');
    }
  }

  // Master Quest (+25 PGT)
  if (masteryProgressEl) masteryProgressEl.innerText = `Complete all 3 quests (${completedCount}/3)`;
  if (btnMaster) {
    if (q.master_claimed) {
      btnMaster.innerText = '🏆 Mastery Claimed!';
      btnMaster.disabled = true;
      btnMaster.style.cssText = 'background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.5); font-weight: 800; font-size: 0.8rem; padding: 0.4rem 1rem; opacity: 1; cursor: default; box-shadow: 0 0 10px rgba(74, 222, 128, 0.2);';
    } else if (completedCount >= 3) {
      btnMaster.innerText = 'Claim +25 PGT Mastery';
      btnMaster.disabled = false;
      btnMaster.style.cssText = 'background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-weight: 900; font-size: 0.85rem; padding: 0.45rem 1.1rem; border: none; opacity: 1; cursor: pointer; box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);';
      btnMaster.onclick = () => claimQuestReward('master');
    } else {
      btnMaster.innerText = 'Claim +25 PGT Mastery';
      btnMaster.disabled = true;
      btnMaster.style.cssText = 'background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); font-weight: 700; font-size: 0.8rem; padding: 0.4rem 1rem; border: 1px solid rgba(255,255,255,0.1); opacity: 0.8; cursor: not-allowed;';
    }
  }
}
window.renderDailyQuestsUI = renderDailyQuestsUI;

export async function claimQuestReward(questType) {
  const q = getUserQuests();
  
  if (questType === 'games' && (q.games || 0) < 3) {
    triggerToast("Play & finish 3 Arcade games first!", "error");
    return;
  }
  if (questType === 'mining' && (q.mining || 0) < 3) {
    triggerToast("Mine at least 3 Ore Shards in PolySpace first!", "error");
    return;
  }
  if (questType === 'wins' && (q.wins || 0) < 3) {
    triggerToast("Win at least 3 PGT wager rounds first today!", "error");
    return;
  }
  if (questType === 'master') {
    const gDone = (q.games || 0) >= 3 || q.games_claimed;
    const mDone = (q.mining || 0) >= 3 || q.mining_claimed;
    const wDone = (q.wins || 0) >= 3 || q.wins_claimed;
    if (!gDone || !mDone || !wDone) {
      triggerToast("Complete all 3 daily quests first!", "error");
      return;
    }
  }

  if (appState.isPlayerConnected() && supabase) {
    try {

      let { data: res, error } = await executeAuthenticatedRpc('claim_daily_quest', {
        p_wallet: getQuestWalletAddress(),
        p_quest_type: questType,
        p_client_quests: q
      });

      if (Array.isArray(res)) res = res[0];
      if (res && res.success) {
        const reward = parseFloat(res.reward || 0);
        const newQuests = res.daily_quests || q;
        const newBal = (typeof res.new_balance === 'number' && res.new_balance >= 0)
          ? res.new_balance
          : ((appState.state.balancePgt || 0) + reward);

        appState.update({
          balancePgt: newBal,
          dailyQuests: newQuests
        });
        try { localStorage.setItem('polygame_daily_quests', JSON.stringify(newQuests)); } catch(e){}
        sfx.playSuccess();
        triggerToast(`🎉 Claimed +${reward} PGT Daily Quest Reward!`, "success");
        appState.addActivity('You', `completed ${questType} daily quest`, `+${reward} PGT`);
        renderDailyQuestsUI();
        if (typeof window.syncProfileView === 'function') {
          window.syncProfileView();
        }
        return;
      } else {
        const msg = (res && res.message) ? res.message : (error ? error.message : "Quest reward could not be claimed.");
        triggerToast(msg, "info");
        renderDailyQuestsUI();
        if (typeof window.syncProfileView === 'function') {
          window.syncProfileView();
        }
        return; // Strict return: prevent falling through to local guest fallback on connected accounts
      }
    } catch (err) {
      console.warn("RPC claim_daily_quest error:", err);
      triggerToast("Failed to claim quest: " + (err.message || err), "error");
      return;
    }
  }

  // Local / Guest Fallback
  let rewardAmt = 0;
  if (questType === 'games') {
    q.games_claimed = true;
    rewardAmt = 10;
  } else if (questType === 'mining') {
    q.mining_claimed = true;
    rewardAmt = 10;
  } else if (questType === 'wins') {
    q.wins_claimed = true;
    rewardAmt = 10;
  } else if (questType === 'master') {
    q.master_claimed = true;
    rewardAmt = 25;
    const today = getTodayDateStr();
    if (q.last_streak_date !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (q.last_streak_date === yesterday) {
        q.streak_days = (q.streak_days || 0) + 1;
      } else {
        q.streak_days = 1;
      }
      q.last_streak_date = today;
      if (q.streak_days >= 7) {
        q.streak_wheel_available = true;
      }
    }
  }

  appState.update({
    balancePgt: (appState.state.balancePgt || 0) + rewardAmt,
    dailyQuests: q
  });
  appState.saveToDB(); // Queue immediate DB save so claimed PGT reward persists
  try { localStorage.setItem('polygame_daily_quests', JSON.stringify(q)); } catch(e){}
  sfx.playSuccess();
  triggerToast(`🎉 Claimed +${rewardAmt} PGT Daily Quest Reward!`, "success");
  appState.addActivity('You', `completed ${questType} daily quest`, `+${rewardAmt} PGT`);
  renderDailyQuestsUI();
  if (typeof window.syncProfileView === 'function') {
    window.syncProfileView();
  }
}
window.claimQuestReward = claimQuestReward;

// -----------------------------------------------------------------------------
// 🎡 7-Day Quest Streak Special Wheel Implementation
// -----------------------------------------------------------------------------

export const STREAK_WHEEL_SLICES = [
  { id: '10000_pgt',    angle: 12, label: '10,000 PGT', short: '10K PGT', icon: '👑', color: '#ffd700', bgGrad: ['#ffd700', '#ff8800'], textCol: '#000000' },
  { id: '500_pgt',      angle: 36, label: '500 PGT',    short: '500 PGT', icon: '💎', color: '#a855f7', bgGrad: ['#a855f7', '#6d28d9'], textCol: '#ffffff' },
  { id: '200_pgt',      angle: 50, label: '200 PGT',    short: '200 PGT', icon: '⚡', color: '#00f0ff', bgGrad: ['#00f0ff', '#0284c7'], textCol: '#000000' },
  { id: '150_pgt',      angle: 54, label: '150 PGT',    short: '150 PGT', icon: '🪙', color: '#10b981', bgGrad: ['#10b981', '#047857'], textCol: '#ffffff' },
  { id: '100_pgt',      angle: 58, label: '100 PGT',    short: '100 PGT', icon: '🪙', color: '#3b82f6', bgGrad: ['#3b82f6', '#1d4ed8'], textCol: '#ffffff' },
  { id: 'mystery_crate',angle: 45, label: 'Cyber Crate', short: 'Cyber Crate', icon: '🎁', color: '#ec4899', bgGrad: ['#ec4899', '#be185d'], textCol: '#ffffff' },
  { id: 'minerals',     angle: 55, label: '20k Ti + 5k Q', short: 'Minerals', icon: '🟣', color: '#9333ea', bgGrad: ['#9333ea', '#581c87'], textCol: '#ffffff' },
  { id: 'vip_silver',   angle: 50, label: '+3D VIP Pass', short: '+3D VIP', icon: '⭐', color: '#eab308', bgGrad: ['#eab308', '#a16207'], textCol: '#000000' }
];

let _currentWheelRotation = 0;
let _isSpinningStreakWheel = false;
let _pendingCrateResult = null;

export function drawStreakWheelCanvas() {
  const canvas = document.getElementById('streak-wheel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = (w / 2) - 6;

  ctx.clearRect(0, 0, w, h);

  let currentAngle = 0;
  for (const slice of STREAK_WHEEL_SLICES) {
    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = ((currentAngle + slice.angle) * Math.PI) / 180;
    const midRad = ((currentAngle + slice.angle / 2) * Math.PI) / 180;

    // Draw slice wedge
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startRad, endRad);
    ctx.closePath();

    const grad = ctx.createRadialGradient(cx, cy, 25, cx, cy, radius);
    grad.addColorStop(0, slice.bgGrad[0]);
    grad.addColorStop(1, slice.bgGrad[1]);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = slice.id === '10000_pgt' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = slice.id === '10000_pgt' ? 2 : 1;
    ctx.stroke();

    // Draw text radially outward towards edge
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(midRad);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = slice.textCol;

    if (slice.id === '10000_pgt') {
      ctx.font = '900 9px monospace';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${slice.icon} 10K PGT`, radius - 14, 0);
    } else if (slice.angle < 45) {
      ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`${slice.icon} ${slice.label}`, radius - 16, 0);
    } else {
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`${slice.icon} ${slice.label}`, radius - 16, 0);
    }
    ctx.restore();

    currentAngle += slice.angle;
  }

  // Outer glowing border
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = '#ff007a';
  ctx.lineWidth = 3;
  ctx.stroke();
}
window.drawStreakWheelCanvas = drawStreakWheelCanvas;

export function openStreakWheelModal() {
  _pendingCrateResult = null;
  const actionSec = document.getElementById('streak-wheel-action-section');
  const resultSec = document.getElementById('streak-wheel-result-section');
  const btnSpin = document.getElementById('btn-spin-streak-wheel');
  const amountEl = document.getElementById('streak-wheel-prize-amount');

  if (actionSec) actionSec.style.display = 'block';
  if (resultSec) resultSec.style.display = 'none';
  if (amountEl) amountEl.innerText = '';
  if (btnSpin) {
    btnSpin.disabled = false;
    btnSpin.innerText = '🎡 SPIN THE WHEEL!';
  }

  if (typeof openModal === 'function') {
    openModal('streak-wheel');
  }

  // Render canvas
  setTimeout(() => {
    drawStreakWheelCanvas();
  }, 60);
}
window.openStreakWheelModal = openStreakWheelModal;

export async function spinStreakWheelAction() {
  if (_isSpinningStreakWheel) return;

  const q = getUserQuests();
  const streakDays = Math.max(0, parseInt(q.streak_days || 0, 10));
  const streakWheelAvailable = !!q.streak_wheel_available || (streakDays >= 7);

  if (!streakWheelAvailable) {
    triggerToast("7-Day Quest Streak required to spin!", "warning");
    return;
  }

  const btnSpin = document.getElementById('btn-spin-streak-wheel');
  if (btnSpin) {
    btnSpin.disabled = true;
    btnSpin.innerText = 'Spinning... ⏳';
  }
  _isSpinningStreakWheel = true;
  sfx.playPowerUp();

  try {
    const wallet = getQuestWalletAddress();
    let res = null;

    if (appState.isPlayerConnected() && supabase) {
      const { data, error } = await executeAuthenticatedRpc('spin_streak_wheel', {
        p_wallet: wallet
      });

      if (error) {
        triggerToast("Spin failed: " + (error.message || error), "error");
        _isSpinningStreakWheel = false;
        if (btnSpin) {
          btnSpin.disabled = false;
          btnSpin.innerText = '🎡 SPIN THE WHEEL!';
        }
        return;
      }
      res = Array.isArray(data) ? data[0] : data;
    } else {
      // Local / Guest Fallback Roll
      const roll = Math.floor(Math.random() * 1000);
      let segIdx = 4;
      let prizeId = '100_pgt';
      let prizeTitle = '🪙 100 PGT Prize';
      let prizeType = 'pgt';
      let amount = 100;
      let crateData = null;

      if (roll < 2) {
        segIdx = 0; prizeId = '10000_pgt'; prizeTitle = '🌟 10,000 PGT GRAND JACKPOT'; prizeType = 'pgt'; amount = 10000;
      } else if (roll < 62) {
        segIdx = 1; prizeId = '500_pgt'; prizeTitle = '💎 500 PGT Mega Win'; prizeType = 'pgt'; amount = 500;
      } else if (roll < 262) {
        segIdx = 2; prizeId = '200_pgt'; prizeTitle = '⚡ 200 PGT Big Win'; prizeType = 'pgt'; amount = 200;
      } else if (roll < 562) {
        segIdx = 3; prizeId = '150_pgt'; prizeTitle = '🪙 150 PGT Prize'; prizeType = 'pgt'; amount = 150;
      } else if (roll < 862) {
        segIdx = 4; prizeId = '100_pgt'; prizeTitle = '🪙 100 PGT Prize'; prizeType = 'pgt'; amount = 100;
      } else if (roll < 912) {
        segIdx = 5; prizeId = 'mystery_crate'; prizeTitle = '📦 PGT Cyber Mystery Crate'; prizeType = 'crate';
        const cratePgt = Math.round(200 + Math.random() * 1300);
        crateData = { reward_pgt: cratePgt, crate_type: 'PGT Cyber Mystery Crate' };
      } else if (roll < 972) {
        segIdx = 6; prizeId = 'minerals'; prizeTitle = '🟣 20,000 Titanium + 5,000 Quantum Shards'; prizeType = 'minerals';
      } else {
        segIdx = 7; prizeId = 'vip_silver'; prizeTitle = '👑 3 Days Silver VIP Pass'; prizeType = 'vip';
      }

      const updatedStreak = Math.max(0, streakDays - 7);
      q.streak_days = updatedStreak;
      q.streak_wheel_available = false;
      let newBal = (appState.state.balancePgt || 0) + (prizeType === 'pgt' ? amount : (crateData ? crateData.reward_pgt : 0));

      res = {
        success: true,
        segment_index: segIdx,
        prize_id: prizeId,
        prize_title: prizeTitle,
        prize_type: prizeType,
        amount: amount,
        new_balance: newBal,
        crate_data: crateData,
        daily_quests: q
      };
    }

    if (!res || !res.success) {
      triggerToast(res?.message || "Spin failed.", "error");
      _isSpinningStreakWheel = false;
      if (btnSpin) {
        btnSpin.disabled = false;
        btnSpin.innerText = '🎡 SPIN THE WHEEL!';
      }
      return;
    }

    // Identify target slice index
    let targetSegmentIndex = typeof res.segment_index === 'number' ? res.segment_index : 0;
    if (res.prize_id) {
      const foundIdx = STREAK_WHEEL_SLICES.findIndex(s => s.id === res.prize_id);
      if (foundIdx !== -1) targetSegmentIndex = foundIdx;
    }

    // Calculate center angle of the target slice in degrees (0..360)
    let accumDeg = 0;
    for (let i = 0; i < targetSegmentIndex; i++) {
      accumDeg += STREAK_WHEEL_SLICES[i].angle;
    }
    const sliceCenterDeg = accumDeg + (STREAK_WHEEL_SLICES[targetSegmentIndex].angle / 2);

    // Needle pointer is at the top (270 degrees).
    // Calculate rotation offset to bring sliceCenterDeg directly under needle:
    const currentNorm = _currentWheelRotation % 360;
    const targetOffset = ((270 - sliceCenterDeg - currentNorm) % 360 + 360) % 360;
    const fullSpins = 1800; // 5 full rotations
    _currentWheelRotation += fullSpins + targetOffset;

    const canvas = document.getElementById('streak-wheel-canvas');
    if (canvas) {
      canvas.style.transition = 'transform 6s cubic-bezier(0.15, 0.95, 0.35, 1)';
      canvas.style.transform = `rotate(${_currentWheelRotation}deg)`;
    }

    // Complete spin after 6.2s
    setTimeout(() => {
      _isSpinningStreakWheel = false;
      handleStreakWheelLanding(res, targetSegmentIndex);
    }, 6200);

  } catch (err) {
    console.error('[StreakWheel] Error in spin:', err);
    triggerToast("Error spinning wheel: " + (err.message || err), "error");
    _isSpinningStreakWheel = false;
    if (btnSpin) {
      btnSpin.disabled = false;
      btnSpin.innerText = '🎡 SPIN THE WHEEL!';
    }
  }
}
window.spinStreakWheelAction = spinStreakWheelAction;

export function handleStreakWheelLanding(res, segmentIdx) {
  const slice = STREAK_WHEEL_SLICES[segmentIdx] || STREAK_WHEEL_SLICES[0];

  if (slice.id === '10000_pgt') {
    sfx.playRelicFanfare();
  } else {
    sfx.playSuccess();
    setTimeout(() => {
      try { sfx.playCoin(); } catch(e){}
    }, 250);
  }

  // Neon Confetti Blast Celebration
  if (typeof window.triggerConfetti === 'function') {
    window.triggerConfetti({
      count: slice.id === '10000_pgt' ? 180 : 120,
      colors: ['#ffd700', '#ff007a', '#00f0ff', '#00ff88', '#a855f7']
    });
    if (slice.id === '10000_pgt' || slice.id === '500_pgt') {
      setTimeout(() => {
        if (typeof window.triggerConfetti === 'function') {
          window.triggerConfetti({ count: 90, spread: 80 });
        }
      }, 350);
    }
  }

  // Update client state from authoritative server response
  const updates = {};
  if (typeof res.new_balance === 'number') {
    updates.balancePgt = res.new_balance;
  }
  if (res.daily_quests) {
    updates.dailyQuests = res.daily_quests;
    try { localStorage.setItem('polygame_daily_quests', JSON.stringify(res.daily_quests)); } catch(e){}
  }
  if (res.space_state) {
    updates.spaceState = res.space_state;
    try { localStorage.setItem('polygame_space_state', JSON.stringify(res.space_state)); } catch(e){}
  }
  if (res.vip_until) {
    updates.vipUntil = res.vip_until;
  }
  if (typeof res.vip_level === 'number') {
    updates.vipLevel = res.vip_level;
  }
  if (res.crate_data && res.crate_data.won_nft) {
    let currentCrateNfts = Array.isArray(appState.state.crateNfts) ? [...appState.state.crateNfts] : [];
    currentCrateNfts.push(res.crate_data.won_nft);
    updates.crateNfts = currentCrateNfts;
  }

  appState.update(updates);
  appState.saveToDB();
  renderDailyQuestsUI();
  if (typeof window.syncProfileView === 'function') {
    window.syncProfileView();
  }

  // Display Reveal View
  const actionSec = document.getElementById('streak-wheel-action-section');
  const resultSec = document.getElementById('streak-wheel-result-section');
  const iconEl = document.getElementById('streak-wheel-result-icon');
  const amountEl = document.getElementById('streak-wheel-prize-amount');
  const titleEl = document.getElementById('streak-wheel-result-title');
  const descEl = document.getElementById('streak-wheel-result-desc');

  if (actionSec) actionSec.style.display = 'none';
  if (resultSec) resultSec.style.display = 'block';

  if (iconEl) iconEl.innerText = slice.icon;

  if (amountEl) {
    if (res.prize_type === 'pgt') {
      const amtNum = parseFloat(res.amount || slice.label.replace(/[^0-9]/g, '')) || 500;
      amountEl.innerText = `+${amtNum.toLocaleString()} PGT`;
      amountEl.style.color = (slice.id === '10000_pgt') ? '#ffd700' : '#00ff88';
      amountEl.style.textShadow = (slice.id === '10000_pgt') 
        ? '0 0 25px rgba(255, 215, 0, 0.9)' 
        : '0 0 25px rgba(0, 255, 136, 0.8)';
    } else if (res.prize_type === 'crate') {
      amountEl.innerText = `🎁 1x CYBER CRATE`;
      amountEl.style.color = '#ec4899';
      amountEl.style.textShadow = '0 0 25px rgba(236, 72, 153, 0.8)';
    } else if (res.prize_type === 'minerals') {
      amountEl.innerText = `+20,000 Ti / +5,000 Q`;
      amountEl.style.color = '#bd00ff';
      amountEl.style.textShadow = '0 0 25px rgba(189, 0, 255, 0.8)';
    } else if (res.prize_type === 'vip') {
      amountEl.innerText = `+3 DAYS SILVER VIP`;
      amountEl.style.color = '#eab308';
      amountEl.style.textShadow = '0 0 25px rgba(234, 179, 8, 0.8)';
    }
  }

  if (titleEl) {
    titleEl.innerText = res.prize_title || slice.label;
    titleEl.style.color = slice.color;
  }

  if (descEl) {
    if (res.prize_type === 'crate') {
      _pendingCrateResult = res.crate_data;
      descEl.innerText = `You won 1x PGT Cyber Mystery Crate! Click below to open and claim your quantum loot!`;
    } else if (res.prize_type === 'minerals') {
      descEl.innerText = `+20,000 Titanium and +5,000 Quantum Shards have been delivered directly to your PolySpace cargo hold!`;
    } else if (res.prize_type === 'vip') {
      descEl.innerText = `Silver VIP Status activated for 3 days! Enjoy 1.5x arcade payouts and reduced faucet cooldown!`;
    } else {
      descEl.innerText = `+${res.amount || slice.label} has been credited directly to your PGT game balance!`;
    }
  }

  appState.addActivity('You', 'won 7-Day Quest Streak Wheel', res.prize_title || slice.label);
}
window.handleStreakWheelLanding = handleStreakWheelLanding;

export function closeStreakWheelResult() {
  if (typeof closeModal === 'function') {
    closeModal('streak-wheel');
  }

  if (_pendingCrateResult) {
    const crateData = _pendingCrateResult;
    _pendingCrateResult = null;
    setTimeout(() => {
      if (typeof openModal === 'function') {
        openModal('mystery-box');
      }
      if (typeof window.showMysteryBoxResult === 'function') {
        window.showMysteryBoxResult(crateData, 'PGT Cyber Mystery Crate');
      }
    }, 300);
  }
}
window.closeStreakWheelResult = closeStreakWheelResult;
