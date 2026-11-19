// ============================================================
// POLYGAME: ON-DEMAND GAME ENGINE & ASSET LAZY LOADER
// Defers ~1.1+ MB of game engines and dictionaries until needed.
// Uses DOM <script> injection (zero dynamic import() syntax).
// ============================================================

import { APP_VERSION } from './config.js';

const GAME_SCRIPT_MAP = {
  arcade: { file: 'game.js', type: 'classic' },
  astrododge: { file: 'game.js', type: 'classic' },
  invaders: { file: 'invaders.js', type: 'classic' },
  drift: { file: 'drift.js', type: 'classic' },
  stacker: { file: 'stacker.js', type: 'classic' },
  catcher: { file: 'stacker.js', type: 'classic' },
  skeet: { file: 'skeet.js', type: 'module' },
  defense: { file: 'defense.js', type: 'module' },
  runner: { file: 'runner.js', type: 'module' },
  q2048: { file: 'q2048.js', type: 'module' },
  tetris: { file: 'tetris.js', type: 'classic' },
  bubble: { file: 'bubble.js', type: 'classic' },
  space: { file: 'space.js', type: 'classic' },
  'wordle-words': { file: 'src/js/features/wordle-words.js', type: 'module' }
};

const LAZY_START_STUBS = [
  ['startInvadersGame', 'invaders'],
  ['startCyberDrift', 'drift'],
  ['launchCyberStackerGame', 'stacker'],
  ['startCyberSkeet', 'skeet'],
  ['startCyberDefense', 'defense'],
  ['startCyberRunner', 'runner'],
  ['startCyber2048', 'q2048'],
  ['startCyberTetris', 'tetris'],
  ['startBubbleGame', 'bubble']
];

const _scriptPromises = new Map();
const _loadedFiles = new Set();

/**
 * Returns true if the engine script for the given game key has finished loading.
 * @param {string} key
 * @returns {boolean}
 */
export function isGameLoaded(key) {
  const spec = GAME_SCRIPT_MAP[key];
  if (!spec) return true;
  return _loadedFiles.has(spec.file);
}

/**
 * Lazily injects and caches the script for the requested game key or asset.
 * Safe under concurrent calls: multiple callers share the same in-flight Promise.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export function ensureGameLoaded(key) {
  const spec = GAME_SCRIPT_MAP[key];
  if (!spec || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  if (_loadedFiles.has(spec.file)) {
    return Promise.resolve(true);
  }
  if (_scriptPromises.has(spec.file)) {
    return _scriptPromises.get(spec.file);
  }

  const versionedSrc = `${spec.file}?v=${encodeURIComponent(APP_VERSION || '1.0.0')}`;
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    if (spec.type === 'module') {
      script.type = 'module';
    }
    script.async = true;
    script.src = versionedSrc;
    script.onload = () => {
      _loadedFiles.add(spec.file);
      resolve(true);
    };
    script.onerror = () => {
      _scriptPromises.delete(spec.file);
      if (script.parentNode) script.parentNode.removeChild(script);
      reject(new Error(`Failed to load script: ${versionedSrc}`));
    };
    (document.head || document.body || document.documentElement).appendChild(script);
  });

  _scriptPromises.set(spec.file, promise);
  return promise;
}

/**
 * Exposes loader helpers and safe pre-load global start stubs on window
 * so HTML onclick handlers never fail if clicked before an engine finishes loading.
 */
export function initLazyGameLaunchers() {
  if (typeof window === 'undefined') return;
  window.ensureGameLoaded = ensureGameLoaded;
  window.isGameLoaded = isGameLoaded;

  LAZY_START_STUBS.forEach(([fnName, gameKey]) => {
    if (typeof window[fnName] === 'function') return;
    const stub = function() {
      const args = arguments;
      return ensureGameLoaded(gameKey)
        .then(() => {
          if (typeof window[fnName] === 'function' && window[fnName] !== stub) {
            return window[fnName].apply(window, args);
          }
          return null;
        })
        .catch((err) => {
          console.error(`[GameLoader] Failed to load ${gameKey}:`, err);
          if (typeof window.triggerToast === 'function') {
            window.triggerToast('Failed to load game engine. Please try again.', 'error');
          }
        });
    };
    stub._isLazyStub = true;
    window[fnName] = stub;
  });
}
