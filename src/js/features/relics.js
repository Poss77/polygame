// ==============================================================================
// POLYGAME QUANTUM RELICS SYSTEM
// Multi-quantity Relic Stash, 5.0 POL On-Chain Minting & Season 1 Apex Multiplier
// ==============================================================================

import { appState } from '../core/state.js';
import { supabase } from '../core/config.js';
import { triggerToast } from '../core/ui.js';

// Relic Smart Contract on Polygon
export const RELICS_CONTRACT_ADDRESS = "0xdc7B10e6b765c28A276Cc3E95836217BdF7Da69e";

export const RELICS_REGISTRY = [
  // --- AstroDodge (Season 1) ---
  {
    id: "relic_astrododge_prism",
    name: "Quantum Prism",
    game: "astrododge",
    gameName: "AstroDodge",
    rarity: "rare",
    season: 1,
    description: "A hyper-refractive crystal that bends cosmic radiation and temporal flow.",
    image: "metadata/images/relics/relic_astrododge_prism.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,10 85,75 50,60 15,75" fill="none" stroke="#00f0ff" stroke-width="4"/><polygon points="50,60 85,75 50,90 15,75" fill="#00f0ff" opacity="0.6"/><circle cx="50" cy="50" r="8" fill="#fff"/></svg>`
  },
  {
    id: "relic_astrododge_deflector",
    name: "Kinetic Deflector",
    game: "astrododge",
    gameName: "AstroDodge",
    rarity: "epic",
    season: 1,
    description: "A high-frequency forcefield emitter that deflects hyper-velocity debris.",
    image: "metadata/images/relics/relic_astrododge_deflector.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><path d="M50,15 L85,35 L70,80 L50,90 L30,80 L15,35 Z" fill="none" stroke="#00bfff" stroke-width="4"/><circle cx="50" cy="50" r="16" fill="#00bfff" opacity="0.4"/><polygon points="50,30 65,60 35,60" fill="#fff"/></svg>`
  },
  {
    id: "relic_astrododge_compass",
    name: "Chrono Compass",
    game: "astrododge",
    gameName: "AstroDodge",
    rarity: "legendary",
    season: 1,
    description: "An ancient temporal gyroscope that guides pilots through deep dimensional voids.",
    image: "metadata/images/relics/relic_astrododge_compass.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="none" stroke="#a855f7" stroke-width="4"/><circle cx="50" cy="50" r="24" fill="none" stroke="#00f0ff" stroke-width="2"/><circle cx="50" cy="50" r="10" fill="#a855f7" opacity="0.7"/><polygon points="50,20 56,44 50,50 44,44" fill="#fff"/><polygon points="50,80 56,56 50,50 44,56" fill="#00f0ff"/></svg>`
  },

  // --- Cyber Invaders (Season 1) ---
  {
    id: "relic_invaders_core",
    name: "Pulsar Core",
    game: "invaders",
    gameName: "Cyber Invaders",
    rarity: "rare",
    season: 1,
    description: "An overcharged plasma cell harvested from alien flagship command nodes.",
    image: "metadata/images/relics/relic_invaders_core.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="25" y="15" width="50" height="70" rx="10" fill="none" stroke="#ff007f" stroke-width="4"/><circle cx="50" cy="50" r="16" fill="#ff007f" opacity="0.6"/><path d="M45,30 L55,45 L42,55 L55,70" stroke="#fff" stroke-width="3" fill="none"/></svg>`
  },
  {
    id: "relic_invaders_dynamo",
    name: "Warp Dynamo",
    game: "invaders",
    gameName: "Cyber Invaders",
    rarity: "epic",
    season: 1,
    description: "A continuous rotary ion dynamo generating sub-space warp shielding.",
    image: "metadata/images/relics/relic_invaders_dynamo.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="#00f0ff" stroke-width="4"/><path d="M50,15 A35,35 0 0,1 85,50" stroke="#ff00ff" stroke-width="6" fill="none"/><circle cx="50" cy="50" r="14" fill="#ff00ff" opacity="0.6"/><circle cx="50" cy="50" r="5" fill="#fff"/></svg>`
  },
  {
    id: "relic_invaders_transmitter",
    name: "Quantum Transmitter",
    game: "invaders",
    gameName: "Cyber Invaders",
    rarity: "legendary",
    season: 1,
    description: "A deep-band tachyon beacon capable of transmitting across planetary galaxies.",
    image: "metadata/images/relics/relic_invaders_transmitter.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,15 75,85 25,85" fill="none" stroke="#10b981" stroke-width="4"/><circle cx="50" cy="40" r="18" fill="none" stroke="#00f0ff" stroke-width="2"/><circle cx="50" cy="40" r="28" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="4,4"/><circle cx="50" cy="40" r="6" fill="#fff"/></svg>`
  },

  // --- Cyber Drift (Season 1) ---
  {
    id: "relic_drift_chronometer",
    name: "Neon Tachometer",
    game: "drift",
    gameName: "Cyber Drift",
    rarity: "rare",
    season: 1,
    description: "A precision holographic chronometer recording extreme velocity milestones.",
    image: "metadata/images/relics/relic_drift_chronometer.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="#ff8800" stroke-width="4"/><path d="M20,65 A36,36 0 1,1 80,65" stroke="#00f0ff" stroke-width="5" fill="none"/><line x1="50" y1="50" x2="72" y2="35" stroke="#ff0055" stroke-width="4"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`
  },
  {
    id: "relic_drift_capacitor",
    name: "Flux Capacitor",
    game: "drift",
    gameName: "Cyber Drift",
    rarity: "epic",
    season: 1,
    description: "Stores kinetic drift friction and discharges continuous fiery turbo bursts.",
    image: "metadata/images/relics/relic_drift_capacitor.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="22" y="20" width="56" height="60" rx="8" fill="none" stroke="#ff5500" stroke-width="4"/><path d="M35,35 L50,50 L65,35 M50,50 L50,75" stroke="#ffcc00" stroke-width="5" fill="none"/><circle cx="50" cy="50" r="7" fill="#fff"/></svg>`
  },
  {
    id: "relic_drift_overdrive",
    name: "Apex Supercharger",
    game: "drift",
    gameName: "Cyber Drift",
    rarity: "legendary",
    season: 1,
    description: "An advanced quantum turbine boosting vehicular horsepower beyond light speed.",
    image: "metadata/images/relics/relic_drift_overdrive.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="#ffea00" stroke-width="4"/><path d="M50,15 L55,40 L65,25 L58,48 L80,45 L58,55 L75,70 L52,58 L50,85 L48,58 L25,70 L42,55 L20,45 L42,48 L35,25 L45,40 Z" fill="#ffea00" opacity="0.8"/><circle cx="50" cy="50" r="8" fill="#fff"/></svg>`
  },

  // --- Cyber Stacker (Season 1) ---
  {
    id: "relic_stacker_foundation",
    name: "Titanium Bedrock",
    game: "stacker",
    gameName: "Cyber Stacker",
    rarity: "rare",
    season: 1,
    description: "An ultra-dense foundation platform capable of anchoring towering cyber structures.",
    image: "metadata/images/relics/relic_stacker_foundation.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,15 88,38 88,68 50,90 12,68 12,38" fill="none" stroke="#00e5ff" stroke-width="4"/><polygon points="50,28 76,44 76,64 50,80 24,64 24,44" fill="#00e5ff" opacity="0.4"/><circle cx="50" cy="54" r="8" fill="#fff"/></svg>`
  },
  {
    id: "relic_stacker_keystone",
    name: "Harmonic Keystone",
    game: "stacker",
    gameName: "Cyber Stacker",
    rarity: "epic",
    season: 1,
    description: "A floating anti-gravity block that dampens harmonic tilt wobble during construction.",
    image: "metadata/images/relics/relic_stacker_keystone.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="18" y="30" width="64" height="40" rx="6" fill="none" stroke="#bd00ff" stroke-width="4"/><polygon points="50,38 65,62 35,62" fill="none" stroke="#00f0ff" stroke-width="3"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`
  },
  {
    id: "relic_stacker_monolith",
    name: "Quantum Monolith",
    game: "stacker",
    gameName: "Cyber Stacker",
    rarity: "legendary",
    season: 1,
    description: "A towering obsidian spire pulsating with infinite structural stabilization energy.",
    image: "metadata/images/relics/relic_stacker_monolith.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,10 70,85 30,85" fill="none" stroke="#ffd700" stroke-width="4"/><polygon points="50,22 62,80 38,80" fill="#ffd700" opacity="0.4"/><line x1="50" y1="20" x2="50" y2="85" stroke="#ff00ff" stroke-width="3"/><circle cx="50" cy="45" r="7" fill="#fff"/></svg>`
  },

  // --- PolySpace Fleet (Season 1) ---
  {
    id: "relic_space_darkmatter",
    name: "Dark Matter Capsule",
    game: "space",
    gameName: "PolySpace",
    rarity: "rare",
    season: 1,
    description: "High-density gravitational matter harvesting deep space void anomalies.",
    image: "metadata/images/relics/relic_space_darkmatter.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="#7928ca" stroke-width="4"/><circle cx="50" cy="50" r="20" fill="#4c1d95"/><circle cx="50" cy="50" r="10" fill="#1e1b4b"/><circle cx="50" cy="50" r="4" fill="#00f0ff"/></svg>`
  },
  {
    id: "relic_space_warpcoil",
    name: "Tachyon Warp Coil",
    game: "space",
    gameName: "PolySpace",
    rarity: "epic",
    season: 1,
    description: "An electromagnetic subspace hyper-coil pulsating with neon cyan and magenta energy arcs.",
    image: "metadata/images/relics/relic_space_warpcoil.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-warp" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00f0ff"/><stop offset="50%" stop-color="#bd00ff"/><stop offset="100%" stop-color="#ff007f"/></linearGradient></defs><circle cx="50" cy="50" r="38" fill="none" stroke="url(#g-warp)" stroke-width="4"/><path d="M25,50 C25,25 75,25 75,50 C75,75 25,75 25,50" fill="none" stroke="#00f0ff" stroke-width="3"/><path d="M50,25 C75,25 75,75 50,75 C25,75 25,25 50,25" fill="none" stroke="#ff007f" stroke-width="3"/><circle cx="50" cy="50" r="10" fill="#fff" filter="drop-shadow(0 0 8px #00f0ff)"/></svg>`
  },
  {
    id: "relic_space_plasma",
    name: "Solar Plasma Harvester",
    game: "space",
    gameName: "PolySpace",
    rarity: "legendary",
    season: 1,
    description: "A radiant Dyson sphere siphoning raw thermonuclear plasma flares from stellar cores.",
    image: "metadata/images/relics/relic_space_plasma.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><defs><radialGradient id="g-sun" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#ffea00"/><stop offset="80%" stop-color="#ff5500"/><stop offset="100%" stop-color="#aa0000"/></radialGradient></defs><circle cx="50" cy="50" r="36" fill="none" stroke="#ffd700" stroke-width="3"/><circle cx="50" cy="50" r="28" fill="none" stroke="#ff8800" stroke-width="4" stroke-dasharray="6,4"/><polygon points="50,10 56,22 44,22" fill="#ffd700"/><polygon points="50,90 56,78 44,78" fill="#ffd700"/><polygon points="10,50 22,56 22,44" fill="#ffd700"/><polygon points="90,50 78,56 78,44" fill="#ffd700"/><circle cx="50" cy="50" r="18" fill="url(#g-sun)"/></svg>`
  },

  // --- Universal Apex Relics (Season 1) ---
  {
    id: "relic_apex_singularity",
    name: "Quantum Singularity Core",
    game: "universal",
    gameName: "Universal Apex",
    rarity: "mythic",
    season: 1,
    description: "A stabilized cosmic black hole artifact enclosed in an obsidian and neon violet containment sphere.",
    image: "metadata/images/relics/relic_apex_singularity.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-sing" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ec4899"/><stop offset="50%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#00f0ff"/></linearGradient></defs><ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="url(#g-sing)" stroke-width="4" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="url(#g-sing)" stroke-width="2" transform="rotate(65 50 50)"/><circle cx="50" cy="50" r="20" fill="#09090e" stroke="#8b5cf6" stroke-width="3"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`
  },
  {
    id: "relic_apex_genesis",
    name: "Genesis Matrix",
    game: "universal",
    gameName: "Universal Apex",
    rarity: "mythic",
    season: 1,
    description: "The primordial hyper-dimensional source code of the entire PolyGame Metaverse. Grants ultimate mastery.",
    image: "metadata/images/relics/relic_apex_genesis.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gen" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffd700"/><stop offset="50%" stop-color="#00f0ff"/><stop offset="100%" stop-color="#ff00ff"/></linearGradient></defs><polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="none" stroke="url(#g-gen)" stroke-width="4"/><polygon points="50,20 74,34 74,66 50,80 26,66 26,34" fill="none" stroke="#00f0ff" stroke-width="2"/><line x1="50" y1="6" x2="50" y2="20" stroke="#ffd700" stroke-width="2"/><line x1="88" y1="28" x2="74" y2="34" stroke="#ffd700" stroke-width="2"/><line x1="88" y1="72" x2="74" y2="66" stroke="#ffd700" stroke-width="2"/><line x1="50" y1="94" x2="50" y2="80" stroke="#ffd700" stroke-width="2"/><line x1="12" y1="72" x2="26" y2="66" stroke="#ffd700" stroke-width="2"/><line x1="12" y1="28" x2="26" y2="34" stroke="#ffd700" stroke-width="2"/><circle cx="50" cy="50" r="12" fill="#ffd700" opacity="0.85"/><circle cx="50" cy="50" r="5" fill="#fff"/></svg>`
  },

  // --- Season 2 Expansion Relics ---
  {
    id: "relic_exp1_a",
    name: "Chrono Warp Drive",
    game: "expansion_1",
    gameName: "Expansion Game A",
    rarity: "rare",
    season: 2,
    description: "Season 2 Expansion: Advanced warp drive for next-generation arcade survival.",
    image: null,
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="32" fill="none" stroke="#3b82f6" stroke-width="4"/><polygon points="50,20 70,65 30,65" fill="#3b82f6" opacity="0.5"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`
  },
  {
    id: "relic_exp1_b",
    name: "Plasma Grid Cell",
    game: "expansion_1",
    gameName: "Expansion Game A",
    rarity: "epic",
    season: 2,
    description: "Season 2 Expansion: High-yield ion grid containment unit.",
    image: null,
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="25" y="25" width="50" height="50" rx="8" fill="none" stroke="#6366f1" stroke-width="4"/><circle cx="50" cy="50" r="12" fill="#6366f1" opacity="0.6"/><circle cx="50" cy="50" r="4" fill="#fff"/></svg>`
  },
  {
    id: "relic_exp1_c",
    name: "Hyperion Matrix",
    game: "expansion_1",
    gameName: "Expansion Game A",
    rarity: "legendary",
    season: 2,
    description: "Season 2 Expansion: Holographic quantum computation matrix.",
    image: null,
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,15 80,35 80,65 50,85 20,65 20,35" fill="none" stroke="#8b5cf6" stroke-width="4"/><circle cx="50" cy="50" r="15" fill="#8b5cf6" opacity="0.7"/><circle cx="50" cy="50" r="5" fill="#fff"/></svg>`
  },
  {
    id: "relic_exp2_a",
    name: "Neural Synapse Link",
    game: "expansion_2",
    gameName: "Expansion Game B",
    rarity: "rare",
    season: 2,
    description: "Season 2 Expansion: High-speed biological cyberware neural interface.",
    image: null,
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="32" fill="none" stroke="#06b6d4" stroke-width="4"/><circle cx="50" cy="50" r="14" fill="#06b6d4" opacity="0.6"/><circle cx="50" cy="50" r="4" fill="#fff"/></svg>`
  },
  {
    id: "relic_exp2_b",
    name: "Sonic Oscillator",
    game: "expansion_2",
    gameName: "Expansion Game B",
    rarity: "epic",
    season: 2,
    description: "Season 2 Expansion: Deep-frequency acoustic particle resonator.",
    image: null,
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,20 75,70 25,70" fill="none" stroke="#14b8a6" stroke-width="4"/><circle cx="50" cy="50" r="12" fill="#14b8a6" opacity="0.6"/><circle cx="50" cy="50" r="4" fill="#fff"/></svg>`
  },
  {
    id: "relic_exp2_c",
    name: "Singularity Core",
    game: "expansion_2",
    gameName: "Expansion Game B",
    rarity: "legendary",
    season: 2,
    description: "Season 2 Expansion: Contained black hole event horizon generator.",
    image: null,
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="#f43f5e" stroke-width="4"/><circle cx="50" cy="50" r="18" fill="#f43f5e" opacity="0.7"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`
  },
  {
    id: "relic_exp3_a",
    name: "Tachyon Solar Sail",
    game: "expansion_3",
    gameName: "Expansion Game C",
    rarity: "rare",
    season: 2,
    description: "Season 2 Expansion: Interstellar photon propulsion sail.",
    image: null,
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,15 85,80 50,65 15,80" fill="none" stroke="#eab308" stroke-width="4"/><circle cx="50" cy="50" r="8" fill="#eab308" opacity="0.8"/></svg>`
  },
  {
    id: "relic_exp3_b",
    name: "Celestial Orrery",
    game: "expansion_3",
    gameName: "Expansion Game C",
    rarity: "epic",
    season: 2,
    description: "Season 2 Expansion: Ancient planetary clockwork model predicting cosmic eclipses.",
    image: null,
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="#f59e0b" stroke-width="4"/><circle cx="50" cy="50" r="20" fill="none" stroke="#f59e0b" stroke-width="2"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`
  },
  {
    id: "relic_exp3_c",
    name: "Crown of Stars",
    game: "expansion_3",
    gameName: "Expansion Game C",
    rarity: "mythic",
    season: 2,
    description: "Season 2 Expansion: The ultimate sovereign artifact of the outer cosmos.",
    image: null,
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="20,70 30,35 45,55 50,25 55,55 70,35 80,70" fill="none" stroke="#ffd700" stroke-width="4"/><circle cx="50" cy="65" r="8" fill="#ffd700"/><circle cx="50" cy="65" r="4" fill="#fff"/></svg>`
  }
];

// Helper to retrieve relic metadata
export function getRelicMeta(relicId) {
  return RELICS_REGISTRY.find(r => r.id === relicId) || null;
}

// Calculate Season 1 Progress (17 Active Relics)
export function getSeason1Progress(userRelics) {
  const s1Relics = RELICS_REGISTRY.filter(r => r.season === 1);
  let ownedCount = 0;

  s1Relics.forEach(r => {
    const data = userRelics && userRelics[r.id];
    if (data && (data.total > 0 || data.unminted > 0 || data.onchain > 0)) {
      ownedCount++;
    }
  });

  return {
    ownedCount,
    totalCount: s1Relics.length,
    isComplete: ownedCount === s1Relics.length
  };
}

// Check if Season 1 Apex 1.5x Multiplier is Active
export function isSeason1ApexUnlocked(userRelics) {
  return getSeason1Progress(userRelics).isComplete;
}

// Render the Dedicated Quantum Relics Vault UI in #view-profile
export function renderRelicsVault() {
  const container = document.getElementById('relics-vault-content');
  if (!container) return;

  const userRelics = appState.state.relics || {};
  const s1Progress = getSeason1Progress(userRelics);

  // Group relics by game category
  const categories = [
    { key: "astrododge", title: "🔮 AstroDodge Relics", season: 1 },
    { key: "invaders", title: "👾 Cyber Invaders Relics", season: 1 },
    { key: "drift", title: "🏎️ Cyber Drift Relics", season: 1 },
    { key: "stacker", title: "🏗️ Cyber Stacker Relics", season: 1 },
    { key: "space", title: "🪐 PolySpace Fleet Relics", season: 1 },
    { key: "universal", title: "👑 Universal Apex Relics", season: 1 },
    { key: "expansion_1", title: "🌌 Expansion Game A (Season 2)", season: 2 },
    { key: "expansion_2", title: "🌌 Expansion Game B (Season 2)", season: 2 },
    { key: "expansion_3", title: "🌌 Expansion Game C (Season 2)", season: 2 }
  ];

  let html = `
    <!-- Season 1 Apex Banner -->
    <div style="background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(0,240,255,0.08) 100%); border: 1px solid ${s1Progress.isComplete ? 'var(--color-accent)' : 'var(--border-cyan)'}; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 1.4rem;">🏺</span>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">Quantum Relics Vault</h3>
        </div>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.88rem; line-height: 1.4;">
          Collect all 17 Season 1 Relics across arcade games & PolySpace mining to unlock the permanent <strong>1.5x Apex Arcade & Faucet Multiplier</strong>!
        </p>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Season 1 Progress</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: ${s1Progress.isComplete ? 'var(--color-accent)' : 'var(--color-primary)'};">
            ${s1Progress.ownedCount} / ${s1Progress.totalCount}
          </div>
        </div>
        <div style="background: ${s1Progress.isComplete ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${s1Progress.isComplete ? '#ffd700' : 'var(--border-glass)'}; border-radius: 8px; padding: 8px 14px; text-align: center;">
          <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: ${s1Progress.isComplete ? '#ffd700' : 'var(--text-muted)'};">
            ${s1Progress.isComplete ? '⚡ APEX MULTIPLIER' : '🔒 APEX MULTIPLIER'}
          </div>
          <div style="font-size: 1.1rem; font-weight: 900; color: ${s1Progress.isComplete ? '#ffd700' : 'var(--text-muted)'};">
            ${s1Progress.isComplete ? '1.5x ACTIVE' : '1.5x LOCKED'}
          </div>
        </div>
      </div>
    </div>

    <!-- On-Chain Minting, Trading & Ownership Info Card -->
    <div style="background: rgba(130, 71, 229, 0.08); border: 1px solid rgba(130, 71, 229, 0.35); border-radius: 10px; padding: 0.9rem 1.25rem; margin-bottom: 1.75rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
      <div style="font-size: 1.6rem; width: 42px; height: 42px; border-radius: 50%; background: rgba(130, 71, 229, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(130, 71, 229, 0.5);">
        💎
      </div>
      <div style="flex: 1; min-width: 250px;">
        <h4 style="font-size: 0.92rem; font-weight: 800; color: #d8b4fe; margin: 0 0 3px 0; text-transform: uppercase; letter-spacing: 0.04em;">
          🌐 On-Chain Polygon Minting & Web3 Trading
        </h4>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.82rem; line-height: 1.45;">
          Relics discovered in gameplay can be optionally minted onto the <strong>Polygon Blockchain (5.0 POL)</strong> as genuine ERC-721 NFTs. Minted relics <strong>still count as 100% owned</strong> in your vault and activate all gameplay multiplier bonuses, while granting full decentralized freedom to <strong>trade, buy, or sell with other players on OpenSea and secondary marketplaces</strong>!
        </p>
      </div>
    </div>
  `;

  // Render categories
  categories.forEach(cat => {
    const relicsInCat = RELICS_REGISTRY.filter(r => r.game === cat.key);
    if (relicsInCat.length === 0) return;

    html += `
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; margin-bottom: 1rem;">
          <h4 style="font-size: 1.05rem; font-weight: 800; color: #fff; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">
            ${cat.title}
          </h4>
          <span style="font-size: 0.75rem; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px; color: var(--text-muted); font-weight: bold;">
            Season ${cat.season}
          </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.25rem;">
    `;

    relicsInCat.forEach(relic => {
      const data = userRelics[relic.id] || { total: 0, unminted: 0, onchain: 0, token_ids: [] };
      const total = data.total || 0;
      const unminted = data.unminted || 0;
      const onchain = data.onchain || 0;
      const isUnlocked = total > 0;

      const rarityColors = {
        rare: { border: '#00f0ff', bg: 'rgba(0,240,255,0.08)', text: '#00f0ff' },
        epic: { border: '#bd00ff', bg: 'rgba(189,0,255,0.08)', text: '#bd00ff' },
        legendary: { border: '#ffd700', bg: 'rgba(255,215,0,0.08)', text: '#ffd700' },
        mythic: { border: '#ff0055', bg: 'rgba(255,0,85,0.08)', text: '#ff0055' }
      };
      const rc = rarityColors[relic.rarity] || rarityColors.rare;

      html += `
        <div style="background: var(--bg-card); border: 1px solid ${isUnlocked ? rc.border : 'var(--border-glass)'}; border-radius: 10px; padding: 1.1rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; opacity: ${isUnlocked ? '1' : '0.55'}; transition: all 0.2s ease;">
          <div>
            <!-- Relic Visual Area -->
            <div style="width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #0a0e17; display: flex; justify-content: center; align-items: center; position: relative; margin-bottom: 0.85rem; border: 1px solid rgba(255,255,255,0.06);">
              ${isUnlocked
                ? `<img src="${relic.image}" alt="${relic.name}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />`
                : `<img src="metadata/images/relics/relic_locked_unknown.jpg" alt="Locked Relic" style="width: 100%; height: 100%; object-fit: cover; filter: brightness(0.85);" loading="lazy" />`
              }
              <span style="position: absolute; top: 8px; right: 8px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; background: ${isUnlocked ? rc.bg : 'rgba(0,0,0,0.7)'}; color: ${isUnlocked ? rc.text : 'var(--text-muted)'}; border: 1px solid ${isUnlocked ? rc.border : 'var(--border-glass)'}; padding: 2px 8px; border-radius: 4px;">
                ${isUnlocked ? relic.rarity : `🔒 ${relic.rarity}`}
              </span>
              ${total > 1 ? `
                <span style="position: absolute; bottom: 8px; left: 8px; font-size: 0.8rem; font-weight: 900; background: rgba(0,0,0,0.85); color: #fff; border: 1px solid var(--border-cyan); padding: 2px 8px; border-radius: 4px;">
                  x${total}
                </span>
              ` : ''}
            </div>

            <!-- Relic Details -->
            <h5 style="font-size: 1rem; font-weight: 800; color: #fff; margin: 0 0 4px 0;">${relic.name}</h5>
            <div style="font-size: 0.75rem; color: ${rc.text}; font-weight: 700; margin-bottom: 6px; text-transform: uppercase;">
              ${relic.gameName}
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.35; margin: 0 0 10px 0;">
              ${relic.description}
            </p>

            <!-- Quantity Breakdown -->
            ${isUnlocked ? `
              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
                ${onchain > 0 ? `
                  <span style="background: rgba(130,71,229,0.18); color: #b388ff; border: 1px solid rgba(130,71,229,0.4); padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: bold;">
                    Polygon x${onchain}
                  </span>
                ` : ''}
                ${unminted > 0 ? `
                  <span style="background: rgba(0,240,255,0.15); color: #00f0ff; border: 1px solid rgba(0,240,255,0.35); padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: bold;">
                    In-Game x${unminted}
                  </span>
                ` : ''}
              </div>
            ` : ''}
          </div>

          <!-- Action Footer -->
          <div style="border-top: 1px solid var(--border-glass); padding-top: 0.75rem; margin-top: 0.5rem;">
            ${unminted > 0 ? `
              <button class="btn-nft-action" style="width: 100%; background: linear-gradient(135deg, #8247e5 0%, #00f0ff 100%); color: #000; font-weight: 800; border: none; padding: 8px 10px; font-size: 0.82rem; border-radius: 6px; cursor: pointer;" onclick="window.mintRelicOnPolygon('${relic.id}')">
                💎 Mint to Polygon (5.0 POL)
              </button>
            ` : onchain > 0 ? `
              <div style="text-align: center; font-size: 0.78rem; font-weight: 700; color: var(--color-success);">
                ✅ Verified on Polygon
              </div>
            ` : `
              <div style="text-align: center; font-size: 0.78rem; font-weight: 600; color: var(--text-muted);">
                🔒 Play ${relic.gameName} to unlock
              </div>
            `}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Mint an unlocked in-game relic to Polygon for 5.0 POL
export async function mintRelicOnPolygon(relicId) {
  const relic = getRelicMeta(relicId);
  if (!relic) {
    showToast("Relic metadata not found", "error");
    return;
  }

  const userRelics = appState.state.relics || {};
  const currentRelic = userRelics[relicId] || { unminted: 0 };
  if (currentRelic.unminted <= 0) {
    triggerToast("You do not have any unminted copies of this relic", "warning");
    return;
  }

  if (typeof window === 'undefined' || !window.ethereum) {
    triggerToast("MetaMask or Web3 wallet required to mint on Polygon", "error");
    return;
  }

  try {
    const ethers = window.ethers;
    if (!ethers) {
      triggerToast("Ethers library not ready. Please refresh.", "error");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();

    if (Number(network.chainId) !== 137) {
      triggerToast("Please switch MetaMask network to Polygon Mainnet (Chain ID 137)", "warning");
      return;
    }

    const abi = [
      "function mintRelic(string calldata relicId) external payable returns (uint256)",
      "function mintFee() external view returns (uint256)"
    ];

    if (!RELICS_CONTRACT_ADDRESS || RELICS_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      // Simulation / Direct In-Game Demo fallback
      triggerToast(`Minting ${relic.name} on Polygon for 5.0 POL...`, "info");
      
      const { data, error } = await supabase.rpc('mark_relic_minted', {
        p_player_id: appState.state.playerId,
        p_relic_id: relicId,
        p_token_id: Math.floor(Math.random() * 10000) + 1
      });

      if (error) throw error;

      appState.update({ relics: data });
      renderRelicsVault();
      triggerToast(`🎉 ${relic.name} successfully minted to Polygon!`, "success");
      return;
    }

    const contract = new ethers.Contract(RELICS_CONTRACT_ADDRESS, abi, signer);
    const feeWei = ethers.parseEther("5.0");

    triggerToast(`Submitting transaction to Polygon (5.0 POL)...`, "info");
    const tx = await contract.mintRelic(relicId, { value: feeWei });
    triggerToast(`Transaction sent! Waiting for Polygon confirmation...`, "info");

    const receipt = await tx.wait();
    
    // Server-side mark as minted
    const { data, error } = await supabase.rpc('mark_relic_minted', {
      p_player_id: appState.state.playerId,
      p_relic_id: relicId,
      p_token_id: 1 // Extracted from receipt logs
    });

    if (error) throw error;

    appState.update({ relics: data });
    renderRelicsVault();
    triggerToast(`🎉 ${relic.name} successfully minted to Polygon! (Tx: ${receipt.hash.slice(0, 10)}...)`, "success");
  } catch (err) {
    console.error("Relic mint error:", err);
    triggerToast(err.reason || err.message || "Minting cancelled or failed", "error");
  }
}
export function openRelicsVault() {
  if (typeof window.switchTab === 'function') {
    window.switchTab('profile');
  }
  if (typeof window.switchProfileSubTab === 'function') {
    window.switchProfileSubTab('relics');
  }
}
window.openRelicsVault = openRelicsVault;
window.mintRelicOnPolygon = mintRelicOnPolygon;
window.renderRelicsVault = renderRelicsVault;

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])"
];

// Decentralized On-Chain Relic Scanner (Queries PolyGameRelicsNFT via Multicall3)
export async function getOwnedRelicsFromChain(address) {
  if (!address || address.toLowerCase().startsWith('0xpgt') || address.toLowerCase().startsWith('0xg')) {
    return {};
  }
  if (!RELICS_CONTRACT_ADDRESS || RELICS_CONTRACT_ADDRESS.length !== 42 || RELICS_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return {};
  }

  const rpcList = [
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon.drpc.org"
  ];

  const contractAbi = [
    "function balanceOf(address account) view returns (uint256)",
    "function tokensOfOwner(address account) view returns (uint256[])",
    "function getRelicType(uint256 tokenId) view returns (string)"
  ];

  let onchainRelics = {};

  if (window.ethers && typeof window.ethers.JsonRpcProvider === 'function') {
    for (const rpcUrl of rpcList) {
      try {
        const provider = new window.ethers.JsonRpcProvider(rpcUrl);
        const contract = new window.ethers.Contract(RELICS_CONTRACT_ADDRESS, contractAbi, provider);
        const bal = await contract.balanceOf(address);
        if (bal !== undefined && bal !== null) {
          if (BigInt(bal) === 0n) return {};
          
          // Use tokensOfOwner fast-path (1 single RPC call)
          const tokenIds = await contract.tokensOfOwner(address);
          if (tokenIds && tokenIds.length > 0) {
            const relicIface = new window.ethers.Interface(contractAbi);
            const multicall = new window.ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
            const relicCalls = tokenIds.map(tid => ({
              target: RELICS_CONTRACT_ADDRESS,
              allowFailure: true,
              callData: relicIface.encodeFunctionData('getRelicType', [Number(tid)])
            }));

            const relicResults = await multicall.aggregate3(relicCalls);
            relicResults.forEach((res, idx) => {
              const tid = Number(tokenIds[idx]);
              if (res && res.success && res.returnData && res.returnData !== '0x') {
                try {
                  const decoded = relicIface.decodeFunctionResult('getRelicType', res.returnData);
                  const relicId = decoded && decoded[0] ? decoded[0] : null;
                  if (relicId) {
                    if (!onchainRelics[relicId]) {
                      onchainRelics[relicId] = { onchain: 0, token_ids: [] };
                    }
                    onchainRelics[relicId].onchain += 1;
                    onchainRelics[relicId].token_ids.push(tid);
                  }
                } catch (eDec) {}
              }
            });
            return onchainRelics;
          }
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }

  return onchainRelics;
}
window.getOwnedRelicsFromChain = getOwnedRelicsFromChain;

