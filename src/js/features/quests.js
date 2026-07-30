import { appState } from '../core/state.js';
import { supabase } from '../core/config.js';
import { triggerToast } from '../core/ui.js';
import { sfx } from '../core/audio.js';

export function getTodayDateStr() {
  return new Date().toISOString().split('T')[0];
}

export function getUserQuests() {
  const q = appState.state.dailyQuests || {};
  const today = getTodayDateStr();

  if (q.date !== today) {
    return {
      date: today,
      faucet: false,
      games: 0,
      mining: 0,
      faucet_claimed: false,
      games_claimed: false,
      mining_claimed: false,
      master_claimed: false,
      streak_days: q.streak_days || 0,
      last_streak_date: q.last_streak_date || ''
    };
  }
  return q;
}

export function trackQuestProgress(type, amount = 1) {
  const q = getUserQuests();
  let updated = false;

  if (type === 'faucet' && !q.faucet) {
    q.faucet = true;
    updated = true;
  } else if (type === 'games') {
    q.games = (q.games || 0) + amount;
    updated = true;
  } else if (type === 'mining') {
    q.mining = (q.mining || 0) + amount;
    updated = true;
  }

  if (updated) {
    appState.update({ dailyQuests: q });
    renderDailyQuestsUI();
  }
}
window.trackQuestProgress = trackQuestProgress;

export function renderDailyQuestsUI() {
  const q = getUserQuests();
  
  const faucetStatusEl = document.getElementById('quest-faucet-status');
  const gamesStatusEl = document.getElementById('quest-games-status');
  const miningStatusEl = document.getElementById('quest-mining-status');
  const masteryProgressEl = document.getElementById('quest-mastery-progress');

  const btnFaucet = document.getElementById('btn-claim-quest-faucet');
  const btnGames = document.getElementById('btn-claim-quest-games');
  const btnMining = document.getElementById('btn-claim-quest-mining');
  const btnMaster = document.getElementById('btn-claim-quest-master');

  if (faucetStatusEl) faucetStatusEl.innerText = q.faucet ? '1 / 1 Claimed' : '0 / 1 Claimed';
  if (gamesStatusEl) gamesStatusEl.innerText = `${Math.min(q.games || 0, 3)} / 3 Rounds`;
  if (miningStatusEl) miningStatusEl.innerText = `${Math.min(q.mining || 0, 3)} / 3 Ores`;

  let completedCount = 0;

  // Quest 1: Faucet
  if (btnFaucet) {
    if (q.faucet_claimed) {
      btnFaucet.innerText = '✅ Claimed';
      btnFaucet.disabled = true;
      btnFaucet.style.opacity = '0.6';
      completedCount++;
    } else if (q.faucet) {
      btnFaucet.innerText = 'Claim +15';
      btnFaucet.disabled = false;
      btnFaucet.style.opacity = '1';
    } else {
      btnFaucet.innerText = 'Go to Faucet';
      btnFaucet.disabled = false;
      btnFaucet.onclick = () => switchTab('faucet');
    }
  }

  // Quest 2: Games
  if (btnGames) {
    if (q.games_claimed) {
      btnGames.innerText = '✅ Claimed';
      btnGames.disabled = true;
      btnGames.style.opacity = '0.6';
      completedCount++;
    } else if ((q.games || 0) >= 3) {
      btnGames.innerText = 'Claim +25';
      btnGames.disabled = false;
      btnGames.style.opacity = '1';
      btnGames.onclick = () => claimQuestReward('games');
    } else {
      btnGames.innerText = 'Play Games';
      btnGames.disabled = false;
      btnGames.onclick = () => switchTab('games');
    }
  }

  // Quest 3: Mining
  if (btnMining) {
    if (q.mining_claimed) {
      btnMining.innerText = '✅ Claimed';
      btnMining.disabled = true;
      btnMining.style.opacity = '0.6';
      completedCount++;
    } else if ((q.mining || 0) >= 3) {
      btnMining.innerText = 'Claim +20';
      btnMining.disabled = false;
      btnMining.style.opacity = '1';
      btnMining.onclick = () => claimQuestReward('mining');
    } else {
      btnMining.innerText = 'Mine Ores';
      btnMining.disabled = false;
      btnMining.onclick = () => launchPolySpace();
    }
  }

  // Master Quest
  if (masteryProgressEl) masteryProgressEl.innerText = `Complete & claim all 3 quests (${completedCount}/3)`;
  if (btnMaster) {
    if (q.master_claimed) {
      btnMaster.innerText = '🏆 Mastery Claimed!';
      btnMaster.disabled = true;
      btnMaster.style.opacity = '0.6';
    } else if (completedCount >= 3) {
      btnMaster.innerText = 'Claim +50 PGT Mastery';
      btnMaster.disabled = false;
      btnMaster.style.opacity = '1';
    } else {
      btnMaster.innerText = 'Claim +50 PGT Mastery';
      btnMaster.disabled = true;
      btnMaster.style.opacity = '0.5';
    }
  }
}
window.renderDailyQuestsUI = renderDailyQuestsUI;

export async function claimQuestReward(questType) {
  const q = getUserQuests();
  
  // Local Validation Check
  if (questType === 'faucet' && !q.faucet) {
    triggerToast("Claim your Daily Faucet first today!", "error");
    return;
  }
  if (questType === 'games' && (q.games || 0) < 3) {
    triggerToast("Play at least 3 Arcade rounds first!", "error");
    return;
  }
  if (questType === 'mining' && (q.mining || 0) < 3) {
    triggerToast("Mine at least 3 Ore Shards in PolySpace first!", "error");
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
        appState.update({
          balancePgt: (appState.state.balancePgt || 0) + reward,
          dailyQuests: res.daily_quests
        });
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
  if (questType === 'faucet') {
    q.faucet_claimed = true;
    rewardAmt = 15;
  } else if (questType === 'games') {
    q.games_claimed = true;
    rewardAmt = 25;
  } else if (questType === 'mining') {
    q.mining_claimed = true;
    rewardAmt = 20;
  } else if (questType === 'master') {
    q.master_claimed = true;
    rewardAmt = 50;
  }

  appState.update({
    balancePgt: (appState.state.balancePgt || 0) + rewardAmt,
    dailyQuests: q
  });
  sfx.playSuccess();
  triggerToast(`🎉 Claimed +${rewardAmt} PGT Daily Quest Reward!`, "success");
  appState.addActivity('You', `completed ${questType} daily quest`, `+${rewardAmt} PGT`);
  renderDailyQuestsUI();
}
window.claimQuestReward = claimQuestReward;
