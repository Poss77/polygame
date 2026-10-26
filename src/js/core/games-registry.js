// ============================================================
// POLYGAME: UNIFIED ARCADE GAMES REGISTRY (SINGLE SOURCE OF TRUTH)
// Centralizes all 9 Earn Arcade game metadata, DOM selectors,
// state keys, database fields, and leaderboard configurations.
// ============================================================

export const ARCADE_GAMES_REGISTRY = {
  astrododge: {
    key: 'astrododge',
    modeView: 'arcade',
    settingKey: 'astrododge',
    panelId: 'panel-game-arcade',
    lbColId: 'leaderboard-col-arcade',
    lbContainerId: 'leaderboard-arcade-container',
    poolElId: 'lb-pool-arcade',
    startOverlayId: 'game-ui-overlay',
    scoreField: 'game_highscore',
    alltimeField: 'alltime_game_highscore',
    stateScoreKey: 'gameHighScore',
    careerKey: 'alltimeGameHighScore',
    profileScoreElId: 'profile-score-dodge',
    profileWeeklyElId: 'profile-weekly-dodge',
    pubScoreElId: 'pub-profile-score-dodge',
    pubWeeklyElId: 'pub-profile-weekly-dodge',
    windowInstance: 'dodgeGame',
    playingProp: 'isPlaying',
    title: 'Astro-Dodge',
    shortTitle: 'Astro',
    icon: '🚀',
    defaultPool: 50000,
    lbCardTitle: 'Astro-Dodge High Scores',
    lbCardColor: 'var(--color-primary)',
    lbPoolColor: 'var(--color-warning)',
    lbSubtitle: 'Top players win bonus PGT weekly! Pool resets every Sunday (reset can be delayed by a few hours).',
    archiveTitle: '🚀 Astro-Dodge Tournament Pool',
    archiveScoreField: 'astrododge_score'
  },
  invaders: {
    key: 'invaders',
    modeView: 'invaders',
    settingKey: 'invaders',
    panelId: 'panel-game-invaders',
    lbColId: 'leaderboard-col-invaders',
    lbContainerId: 'leaderboard-invaders-container',
    poolElId: 'lb-pool-invaders',
    startOverlayId: 'invaders-ui-overlay',
    scoreField: 'invaders_highscore',
    alltimeField: 'alltime_invaders_highscore',
    stateScoreKey: 'invadersHighScore',
    careerKey: 'alltimeInvadersHighScore',
    profileScoreElId: 'profile-score-invaders',
    profileWeeklyElId: 'profile-weekly-invaders',
    pubScoreElId: 'pub-profile-score-invaders',
    pubWeeklyElId: 'pub-profile-weekly-invaders',
    windowInstance: 'invadersGame',
    playingProp: 'isPlaying',
    title: 'Cyber Invaders',
    shortTitle: 'Invaders',
    icon: '👾',
    defaultPool: 50000,
    lbCardTitle: 'Cyber Invaders High Scores',
    lbCardColor: 'var(--color-primary)',
    lbPoolColor: 'var(--color-warning)',
    lbSubtitle: 'Top defenders win bonus PGT weekly! Pool resets every Sunday (reset can be delayed by a few hours).',
    archiveTitle: '👾 Cyber Invaders Tournament Pool',
    archiveScoreField: 'invaders_score'
  },
  drift: {
    key: 'drift',
    modeView: 'drift',
    settingKey: 'drift',
    panelId: 'panel-game-drift',
    lbColId: 'leaderboard-col-drift',
    lbContainerId: 'leaderboard-drift-container',
    poolElId: 'lb-pool-drift',
    startOverlayId: 'drift-start-screen',
    gameoverOverlayId: 'drift-gameover-screen',
    scoreField: 'drift_highscore',
    alltimeField: 'alltime_drift_highscore',
    stateScoreKey: 'driftHighScore',
    careerKey: 'alltimeDriftHighScore',
    profileScoreElId: 'profile-score-drift',
    profileWeeklyElId: 'profile-weekly-drift',
    pubScoreElId: 'pub-profile-score-drift',
    pubWeeklyElId: 'pub-profile-weekly-drift',
    windowInstance: 'cyberDrift',
    playingProp: 'isRunning',
    title: 'Cyber Drift',
    shortTitle: 'Drift',
    icon: '🏎️',
    defaultPool: 50000,
    lbCardTitle: 'Cyber Drift High Scores',
    lbCardColor: 'var(--color-accent)',
    lbPoolColor: 'var(--color-warning)',
    lbSubtitle: 'Top racers win bonus PGT weekly! Pool resets every Sunday (reset can be delayed by a few hours).',
    archiveTitle: '🏎️ Cyber Drift Tournament Pool',
    archiveScoreField: 'drift_score'
  },
  stacker: {
    key: 'stacker',
    modeView: 'stacker',
    settingKey: 'stacker',
    panelId: 'panel-game-stacker',
    fallbackPanelId: 'panel-game-catcher',
    lbColId: 'leaderboard-col-stacker',
    fallbackLbColId: 'leaderboard-col-catcher',
    lbContainerId: 'leaderboard-stacker-container',
    fallbackContainerId: 'leaderboard-catcher-container',
    poolElId: 'lb-pool-stacker',
    fallbackPoolElId: 'lb-pool-catcher',
    startOverlayId: 'stacker-start-screen',
    gameoverOverlayId: 'stacker-gameover-screen',
    scoreField: 'stacker_highscore',
    alltimeField: 'alltime_stacker_highscore',
    stateScoreKey: 'stackerHighScore',
    careerKey: 'alltimeStackerHighScore',
    profileScoreElId: 'profile-score-stacker',
    profileWeeklyElId: 'profile-weekly-stacker',
    pubScoreElId: 'pub-profile-score-stacker',
    pubWeeklyElId: 'pub-profile-weekly-stacker',
    windowInstance: 'cyberStacker',
    playingProp: 'isPlaying',
    title: 'Cyber Stacker',
    shortTitle: 'Stacker',
    icon: '🧱',
    defaultPool: 50000,
    lbCardTitle: '👑 Cyber Stacker VIP Leaderboard',
    lbCardColor: 'var(--color-warning)',
    lbPoolColor: 'var(--color-warning)',
    lbSubtitle: 'Top architects win bonus PGT weekly! Pool resets every Sunday (reset can be delayed by a few hours).',
    archiveTitle: '👑 Cyber Stacker Tournament Pool',
    archiveScoreField: 'stacker_score'
  },
  skeet: {
    key: 'skeet',
    modeView: 'skeet',
    settingKey: 'skeet',
    panelId: 'panel-game-skeet',
    lbColId: 'leaderboard-col-skeet',
    lbContainerId: 'leaderboard-skeet-container',
    poolElId: 'lb-pool-skeet',
    startOverlayId: 'skeet-overlay-start',
    gameoverOverlayId: 'skeet-overlay-gameover',
    scoreField: 'skeet_highscore',
    alltimeField: 'alltime_skeet_highscore',
    stateScoreKey: 'skeetHighScore',
    careerKey: 'alltimeSkeetHighScore',
    profileScoreElId: 'profile-score-skeet',
    profileWeeklyElId: 'profile-weekly-skeet',
    pubScoreElId: 'pub-profile-score-skeet',
    pubWeeklyElId: 'pub-profile-weekly-skeet',
    windowInstance: 'skeetEngine',
    playingProp: 'isPlaying',
    title: 'Cyber Skeet',
    shortTitle: 'Skeet',
    icon: '🎯',
    defaultPool: 25000,
    lbCardTitle: '🎯 Cyber Skeet Leaderboard',
    lbCardColor: 'var(--color-accent)',
    lbPoolColor: 'var(--color-accent)',
    lbSubtitle: 'Top sharpshooters win bonus PGT weekly! Pool resets every Sunday (reset can be delayed by a few hours).',
    archiveTitle: '🎯 Cyber Skeet Tournament Pool',
    archiveScoreField: 'skeet_score'
  },
  defense: {
    key: 'defense',
    modeView: 'defense',
    settingKey: 'defense',
    panelId: 'panel-game-defense',
    lbColId: 'leaderboard-col-defense',
    lbContainerId: 'leaderboard-defense-container',
    poolElId: 'lb-pool-defense',
    startOverlayId: 'defense-overlay-start',
    gameoverOverlayId: 'defense-overlay-gameover',
    scoreField: 'defense_highscore',
    alltimeField: 'defense_alltime_best',
    stateScoreKey: 'defenseHighScore',
    careerKey: 'alltimeDefenseHighScore',
    profileScoreElId: 'profile-score-defense',
    profileWeeklyElId: 'profile-weekly-defense',
    pubScoreElId: 'pub-profile-score-defense',
    pubWeeklyElId: 'pub-profile-weekly-defense',
    windowInstance: 'defenseEngine',
    playingProp: 'isPlaying',
    title: 'Cyber Defense',
    shortTitle: 'Defense',
    icon: '🛡️',
    defaultPool: 25000,
    lbCardTitle: '🛡️ Cyber Defense Leaderboard',
    lbCardColor: 'var(--color-primary)',
    lbPoolColor: 'var(--color-primary)',
    lbSubtitle: 'Top tactical commanders win bonus PGT weekly! Pool resets every Sunday (reset can be delayed by a few hours).',
    archiveTitle: '🛡️ Cyber Defense Tournament Pool',
    archiveScoreField: 'defense_score'
  },
  runner: {
    key: 'runner',
    modeView: 'runner',
    settingKey: 'runner',
    panelId: 'panel-game-runner',
    lbColId: 'leaderboard-col-runner',
    lbContainerId: 'leaderboard-runner-container',
    poolElId: 'lb-pool-runner',
    startOverlayId: 'runner-start-screen',
    gameoverOverlayId: 'runner-gameover-screen',
    scoreField: 'runner_highscore',
    alltimeField: 'alltime_runner_highscore',
    stateScoreKey: 'runnerHighScore',
    careerKey: 'alltimeRunnerHighScore',
    profileScoreElId: 'profile-score-runner',
    profileWeeklyElId: 'profile-weekly-runner',
    pubScoreElId: 'pub-profile-score-runner',
    pubWeeklyElId: 'pub-profile-weekly-runner',
    windowInstance: 'cyberRunner',
    playingProp: 'isRunning',
    title: 'Cyber Runner',
    shortTitle: 'Runner',
    icon: '⚡',
    defaultPool: 50000,
    lbCardTitle: '⚡ Cyber Runner Leaderboard',
    lbCardColor: 'var(--color-primary)',
    lbPoolColor: 'var(--color-primary)',
    lbSubtitle: 'Top parkour runners win bonus PGT weekly! Pool resets every Sunday (reset can be delayed by a few hours).',
    archiveTitle: '🏃 Cyber Runner Tournament Pool',
    archiveScoreField: 'runner_score'
  },
  q2048: {
    key: 'q2048',
    modeView: 'q2048',
    settingKey: 'q2048',
    panelId: 'panel-game-q2048',
    lbColId: 'leaderboard-col-q2048',
    lbContainerId: 'leaderboard-q2048-container',
    poolElId: 'lb-pool-q2048',
    startOverlayId: 'q2048-start-screen',
    gameoverOverlayId: 'q2048-gameover-screen',
    scoreField: 'q2048_highscore',
    alltimeField: 'alltime_q2048_highscore',
    stateScoreKey: 'q2048HighScore',
    careerKey: 'alltimeQ2048HighScore',
    profileScoreElId: 'profile-score-q2048',
    profileWeeklyElId: 'profile-weekly-q2048',
    pubScoreElId: 'pub-profile-score-q2048',
    pubWeeklyElId: 'pub-profile-weekly-q2048',
    windowInstance: 'cyber2048',
    playingProp: 'isPlaying',
    title: 'Cyber 2048',
    shortTitle: '2048',
    icon: '🧩',
    defaultPool: 50000,
    lbCardTitle: '🧩 Cyber 2048 Leaderboard',
    lbCardColor: 'var(--color-accent)',
    lbPoolColor: 'var(--color-accent)',
    lbSubtitle: 'Top quantum puzzle masters win bonus PGT weekly! Pool resets every Sunday (reset can be delayed by a few hours).',
    archiveTitle: '🧩 Cyber 2048 Tournament Pool',
    archiveScoreField: 'q2048_score'
  },
  tetris: {
    key: 'tetris',
    modeView: 'tetris',
    settingKey: 'tetris',
    panelId: 'panel-game-tetris',
    lbColId: 'leaderboard-col-tetris',
    lbContainerId: 'leaderboard-tetris-container',
    poolElId: 'lb-pool-tetris',
    startOverlayId: 'tetris-start-screen',
    gameoverOverlayId: 'tetris-gameover-screen',
    pauseOverlayId: 'tetris-pause-screen',
    scoreField: 'tetris_highscore',
    alltimeField: 'alltime_tetris_highscore',
    stateScoreKey: 'tetrisHighScore',
    careerKey: 'alltimeTetrisHighScore',
    profileScoreElId: 'profile-score-tetris',
    profileWeeklyElId: 'profile-weekly-tetris',
    pubScoreElId: 'pub-profile-score-tetris',
    pubWeeklyElId: 'pub-profile-weekly-tetris',
    windowInstance: 'cyberTetrisGame',
    playingProp: 'isPlaying',
    title: 'Cyber Tetris',
    shortTitle: 'Tetris',
    icon: '🧱',
    defaultPool: 50000,
    lbCardTitle: '🧱 Cyber Tetris Leaderboard',
    lbCardColor: '#d500f9',
    lbPoolColor: '#d500f9',
    lbSubtitle: 'Top falling-block matrix architects win weekly tournament prizes! Pool resets every Sunday (reset can be delayed by a few hours).',
    archiveTitle: '🧱 Cyber Tetris Tournament Pool',
    archiveScoreField: 'tetris_score'
  }
};

export const ARCADE_GAMES_LIST = Object.values(ARCADE_GAMES_REGISTRY);

/**
 * Generates and populates the inner HTML of all 9 arcade leaderboard cards
 * from the unified ARCADE_GAMES_REGISTRY so index.html only needs mount divs.
 */
export function initArcadeLeaderboardCards() {
  if (typeof document === 'undefined') return;
  for (const game of ARCADE_GAMES_LIST) {
    const colEl = document.getElementById(game.lbColId);
    if (!colEl) continue;
    // Only populate if not already rendered
    if (colEl.querySelector(`#${game.lbContainerId}`)) continue;

    colEl.innerHTML = `
      <h3 class="card-title" style="margin-bottom: 1rem; color: ${game.lbCardColor};" data-i18n="lb.title.${game.key}">${game.lbCardTitle}</h3>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;" data-i18n="lb.subtitle.${game.key}">${game.lbSubtitle}</p>
      <div style="font-size: 0.85rem; color: ${game.lbPoolColor}; font-weight: 700; margin-bottom: 1rem; display: flex; justify-content: space-between;">
        <span id="${game.poolElId}">Weekly Pool: ${game.defaultPool.toLocaleString()} PGT</span>
        <span class="leaderboard-reset-timer">Resets: --d --h --m</span>
      </div>
      <div class="leaderboard-list" id="${game.lbContainerId}">
        <div style="text-align: center; padding: 1.5rem; color: var(--text-dim);">Loading leaderboard...</div>
      </div>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.ARCADE_GAMES_REGISTRY = ARCADE_GAMES_REGISTRY;
  window.ARCADE_GAMES_LIST = ARCADE_GAMES_LIST;
  window.initArcadeLeaderboardCards = initArcadeLeaderboardCards;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initArcadeLeaderboardCards, { once: true });
    } else {
      initArcadeLeaderboardCards();
    }
  }
}
