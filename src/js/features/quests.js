import { appState } from '../core/state.js';
import { supabase } from '../core/config.js';
import { triggerToast } from '../core/ui.js';
import { sfx } from '../core/audio.js';

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
    q = {
      date: today,
      games: 0,
      mining: 0,
      wins: 0,
      games_claimed: false,
      mining_claimed: false,
      wins_claimed: false,
      master_claimed: false,
      streak_days: (q && q.streak_days) || 0,
      last_streak_date: (q && q.last_streak_date) || ''
    };
    appState.state.dailyQuests = q;
    try { localStorage.setItem('polygame_daily_quests', JSON.stringify(q)); } catch(e){}
  } else {
    appState.state.dailyQuests = q;
  }
  return q;
}

export function trackQuestProgress(type, amount = 1) {
  const q = getUserQuests();
  let updated = false;

  if (type === 'games' || type === 'game') {
    q.games = (q.games || 0) + amount;
    updated = true;
  } else if (type === 'mining') {
    q.mining = (q.mining || 0) + amount;
    updated = true;
  } else if (type === 'wins' || type === 'win') {
    q.wins = (q.wins || 0) + amount;
    q.games = (q.games || 0) + amount; // Every win is also a completed game
    updated = true;
  }

  if (updated) {
    appState.update({ dailyQuests: q });
    appState.saveToDB(); // Queue immediate DB save so daily quest progress is never lost
    try { localStorage.setItem('polygame_daily_quests', JSON.stringify(q)); } catch(e){}
    renderDailyQuestsUI();
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

// Live timer tick every second
setInterval(() => {
  const timerEl = document.getElementById('quest-reset-timer');
  if (timerEl) {
    timerEl.innerText = `Resets in: ${getTimeUntilUtcMidnight()}`;
  }
}, 1000);

export function renderDailyQuestsUI() {
  const q = getUserQuests();
  
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
      btnGames.onclick = () => switchTab('games');
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
      btnWins.onclick = () => switchTab('games');
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

  function getQuestWalletAddress() {
    if (typeof window.getStakingWalletAddress === 'function') {
      return window.getStakingWalletAddress();
    }
    const primary = appState.state.walletAddress || '';
    const linked = appState.state.linkedWalletAddress || '';
    const isInternal = (addr) => addr && (addr.startsWith('0xpgt') || addr.startsWith('0xg'));
    if (primary && isInternal(primary)) return primary.toLowerCase();
    if (linked && isInternal(linked)) return linked.toLowerCase();
    return (primary || linked || '').toLowerCase();
  }

  if (appState.isPlayerConnected() && supabase) {
    try {
      let { data: res, error } = await supabase.rpc('claim_daily_quest', {
        p_wallet: getQuestWalletAddress(),
        p_quest_type: questType
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
        return;
      } else {
        const msg = (res && res.message) ? res.message : (error ? error.message : "Quest reward could not be claimed.");
        triggerToast(msg, "info");
        renderDailyQuestsUI();
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
}
window.claimQuestReward = claimQuestReward;
