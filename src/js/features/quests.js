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

  if (type === 'games') {
    q.games = (q.games || 0) + amount;
    updated = true;
  } else if (type === 'mining') {
    q.mining = (q.mining || 0) + amount;
    updated = true;
  } else if (type === 'wins') {
    q.wins = (q.wins || 0) + amount;
    updated = true;
  }

  if (updated) {
    appState.update({ dailyQuests: q });
    try { localStorage.setItem('polygame_daily_quests', JSON.stringify(q)); } catch(e){}
    renderDailyQuestsUI();
  }
}
window.trackQuestProgress = trackQuestProgress;

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

  if (gamesStatusEl) gamesStatusEl.innerText = `${Math.min(q.games || 0, 3)} / 3 Rounds`;
  if (miningStatusEl) miningStatusEl.innerText = `${Math.min(q.mining || 0, 3)} / 3 Ores`;
  if (winsStatusEl) winsStatusEl.innerText = `${Math.min(q.wins || 0, 3)} / 3 Wins`;

  let completedCount = 0;

  // Quest 1: Play 3 Mini-Games (+10 PGT)
  if (btnGames) {
    if (q.games_claimed) {
      btnGames.innerText = '✅ Claimed';
      btnGames.disabled = true;
      btnGames.style.opacity = '0.6';
      completedCount++;
    } else if ((q.games || 0) >= 3) {
      btnGames.innerText = 'Claim +10';
      btnGames.disabled = false;
      btnGames.style.opacity = '1';
      btnGames.onclick = () => claimQuestReward('games');
    } else {
      btnGames.innerText = 'Play Games';
      btnGames.disabled = false;
      btnGames.style.opacity = '1';
      btnGames.onclick = () => switchTab('games');
    }
  }

  // Quest 2: Space Mining (+10 PGT)
  if (btnMining) {
    if (q.mining_claimed) {
      btnMining.innerText = '✅ Claimed';
      btnMining.disabled = true;
      btnMining.style.opacity = '0.6';
      completedCount++;
    } else if ((q.mining || 0) >= 3) {
      btnMining.innerText = 'Claim +10';
      btnMining.disabled = false;
      btnMining.style.opacity = '1';
      btnMining.onclick = () => claimQuestReward('mining');
    } else {
      btnMining.innerText = 'Mine Ores';
      btnMining.disabled = false;
      btnMining.style.opacity = '1';
      btnMining.onclick = () => launchPolySpace();
    }
  }

  // Quest 3: Win 3 Rounds (+10 PGT)
  if (btnWins) {
    if (q.wins_claimed) {
      btnWins.innerText = '✅ Claimed';
      btnWins.disabled = true;
      btnWins.style.opacity = '0.6';
      completedCount++;
    } else if ((q.wins || 0) >= 3) {
      btnWins.innerText = 'Claim +10';
      btnWins.disabled = false;
      btnWins.style.opacity = '1';
      btnWins.onclick = () => claimQuestReward('wins');
    } else {
      btnWins.innerText = 'Play Games';
      btnWins.disabled = false;
      btnWins.style.opacity = '1';
      btnWins.onclick = () => switchTab('games');
    }
  }

  // Master Quest (+25 PGT)
  if (masteryProgressEl) masteryProgressEl.innerText = `Complete & claim all 3 quests (${completedCount}/3)`;
  if (btnMaster) {
    if (q.master_claimed) {
      btnMaster.innerText = '🏆 Mastery Claimed!';
      btnMaster.disabled = true;
      btnMaster.style.opacity = '0.6';
    } else if (completedCount >= 3) {
      btnMaster.innerText = 'Claim +25 PGT Mastery';
      btnMaster.disabled = false;
      btnMaster.style.opacity = '1';
      btnMaster.onclick = () => claimQuestReward('master');
    } else {
      btnMaster.innerText = 'Claim +25 PGT Mastery';
      btnMaster.disabled = true;
      btnMaster.style.opacity = '0.5';
    }
  }
}
window.renderDailyQuestsUI = renderDailyQuestsUI;

export async function claimQuestReward(questType) {
  const q = getUserQuests();
  
  if (questType === 'games' && (q.games || 0) < 3) {
    triggerToast("Play at least 3 Mini-Game rounds first!", "error");
    return;
  }
  if (questType === 'mining' && (q.mining || 0) < 3) {
    triggerToast("Mine at least 3 Ore Shards in PolySpace first!", "error");
    return;
  }
  if (questType === 'wins' && (q.wins || 0) < 3) {
    triggerToast("Win at least 3 Game rounds first today!", "error");
    return;
  }

  if (appState.state.walletConnected && supabase) {
    try {
      let { data: res, error } = await supabase.rpc('claim_daily_quest', {
        p_wallet: appState.state.walletAddress.toLowerCase(),
        p_quest_type: questType
      });

      if (Array.isArray(res)) res = res[0];
      if (res && res.success) {
        const reward = parseFloat(res.reward || 0);
        const newQuests = res.daily_quests || q;
        appState.update({
          balancePgt: (appState.state.balancePgt || 0) + reward,
          dailyQuests: newQuests
        });
        try { localStorage.setItem('polygame_daily_quests', JSON.stringify(newQuests)); } catch(e){}
        sfx.playSuccess();
        triggerToast(`🎉 Claimed +${reward} PGT Daily Quest Reward!`, "success");
        appState.addActivity('You', `completed ${questType} daily quest`, `+${reward} PGT`);
        renderDailyQuestsUI();
        return;
      } else if (res && res.message) {
        triggerToast(res.message, "error");
        return;
      }
    } catch (err) {
      console.warn("RPC claim_daily_quest error, falling back to local claim:", err);
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
  try { localStorage.setItem('polygame_daily_quests', JSON.stringify(q)); } catch(e){}
  sfx.playSuccess();
  triggerToast(`🎉 Claimed +${rewardAmt} PGT Daily Quest Reward!`, "success");
  appState.addActivity('You', `completed ${questType} daily quest`, `+${rewardAmt} PGT`);
  renderDailyQuestsUI();
}
window.claimQuestReward = claimQuestReward;
