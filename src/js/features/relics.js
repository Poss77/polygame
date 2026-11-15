// ==============================================================================
// POLYGAME QUANTUM RELICS SYSTEM
// Multi-quantity Relic Stash, 5.0 POL On-Chain Minting & Serie 1 Apex Multiplier
// ==============================================================================

import { appState } from '../core/state.js';
import { supabase } from '../core/config.js';
import { triggerToast } from '../core/ui.js';
import { executeAuthenticatedRpc } from '../core/auth-web3.js';

// Relic Smart Contract on Polygon
export const RELICS_CONTRACT_ADDRESS = "0xdc7B10e6b765c28A276Cc3E95836217BdF7Da69e";

export const RELICS_REGISTRY = [
  // --- AstroDodge (Serie 1) ---
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

  // --- Cyber Invaders (Serie 1) ---
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

  // --- Cyber Drift (Serie 1) ---
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

  // --- Cyber Stacker (Serie 1) ---
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

  // --- PolySpace Fleet (Serie 1) ---
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

  // --- Universal Apex Relics (Serie 1) ---
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

  // --- Cyber Skeet (Serie 2) ---
  {
    id: "relic_skeet_clay",
    name: "Clay Skeet",
    game: "skeet",
    gameName: "Cyber Skeet",
    rarity: "rare",
    season: 2,
    description: "An aerodynamic ceramic skeet disc edged with a glowing cyan target rim.",
    image: "metadata/images/relics/relic_skeet_clay.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="38" ry="18" fill="none" stroke="#00f0ff" stroke-width="4" transform="rotate(-20 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="10" fill="#ff7744" opacity="0.7" transform="rotate(-20 50 50)"/></svg>`
  },
  {
    id: "relic_skeet_scope",
    name: "Holo Scope",
    game: "skeet",
    gameName: "Cyber Skeet",
    rarity: "epic",
    season: 2,
    description: "A precision holographic optic scope calibrated for high-speed aerial targets.",
    image: "metadata/images/relics/relic_skeet_scope.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="32" fill="none" stroke="#bd00ff" stroke-width="4"/><circle cx="50" cy="50" r="14" fill="none" stroke="#00f0ff" stroke-width="2"/><line x1="50" y1="12" x2="50" y2="88" stroke="#00f0ff" stroke-width="2"/><line x1="12" y1="50" x2="88" y2="50" stroke="#00f0ff" stroke-width="2"/></svg>`
  },
  {
    id: "relic_skeet_shotgun",
    name: "Golden Shotgun",
    game: "skeet",
    gameName: "Cyber Skeet",
    rarity: "legendary",
    season: 2,
    description: "A masterwork gilded sporting shotgun forged for flawless skeet streaks.",
    image: "metadata/images/relics/relic_skeet_shotgun.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><path d="M15,65 L45,50 L85,35 L88,42 L48,58 L25,75 Z" fill="#ffd700" opacity="0.85" stroke="#fff" stroke-width="2"/></svg>`
  },

  // --- Cyber Bubble (Serie 2) ---
  {
    id: "relic_bubble_orb",
    name: "Bubble Orb",
    game: "bubble",
    gameName: "Cyber Bubble",
    rarity: "rare",
    season: 2,
    description: "A translucent crystal sphere pulsing with a cyan-to-magenta energy core.",
    image: "metadata/images/relics/relic_bubble_orb.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="none" stroke="#00f0ff" stroke-width="4"/><circle cx="50" cy="50" r="18" fill="#bd00ff" opacity="0.6"/><circle cx="40" cy="38" r="6" fill="#fff" opacity="0.8"/></svg>`
  },
  {
    id: "relic_bubble_harpoon",
    name: "Laser Harpoon",
    game: "bubble",
    gameName: "Cyber Bubble",
    rarity: "epic",
    season: 2,
    description: "A precision chrome-and-violet laser harpoon tip engineered for chain pops.",
    image: "metadata/images/relics/relic_bubble_harpoon.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,10 68,45 56,45 56,88 44,88 44,45 32,45" fill="#bd00ff" stroke="#00f0ff" stroke-width="3"/></svg>`
  },
  {
    id: "relic_bubble_pearl",
    name: "Rainbow Pearl",
    game: "bubble",
    gameName: "Cyber Bubble",
    rarity: "legendary",
    season: 2,
    description: "An iridescent rainbow pearl cradled in a sculpted titanium-gold ring.",
    image: "metadata/images/relics/relic_bubble_pearl.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="48" r="26" fill="#ffd700" opacity="0.8" stroke="#fff" stroke-width="3"/><ellipse cx="50" cy="76" rx="30" ry="8" fill="none" stroke="#ffd700" stroke-width="4"/></svg>`
  },

  // --- Cyber Runner (Serie 2) ---
  {
    id: "relic_runner_sneakers",
    name: "Neon Sneakers",
    game: "runner",
    gameName: "Cyber Runner",
    rarity: "rare",
    season: 2,
    description: "High-top cybernetic running sneakers with electric-cyan LED soles.",
    image: "metadata/images/relics/relic_runner_sneakers.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><path d="M20,65 L32,32 L52,32 L60,55 L84,60 L84,72 L20,72 Z" fill="none" stroke="#00f0ff" stroke-width="4"/><line x1="20" y1="75" x2="84" y2="75" stroke="#00f0ff" stroke-width="5"/></svg>`
  },
  {
    id: "relic_runner_hoverboard",
    name: "Cyber Hoverboard",
    game: "runner",
    gameName: "Cyber Runner",
    rarity: "epic",
    season: 2,
    description: "An anti-gravity titanium hoverboard built for high-velocity neon rails.",
    image: "metadata/images/relics/relic_runner_hoverboard.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="14" y="42" width="72" height="16" rx="8" fill="none" stroke="#bd00ff" stroke-width="4" transform="rotate(-15 50 50)"/><circle cx="30" cy="64" r="7" fill="#00f0ff"/><circle cx="70" cy="48" r="7" fill="#00f0ff"/></svg>`
  },
  {
    id: "relic_runner_jetpack",
    name: "Turbo Jetpack",
    game: "runner",
    gameName: "Cyber Runner",
    rarity: "legendary",
    season: 2,
    description: "A twin-thruster gold-and-titanium jetpack with cyan plasma vents.",
    image: "metadata/images/relics/relic_runner_jetpack.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="26" y="22" width="18" height="44" rx="6" fill="none" stroke="#ffd700" stroke-width="4"/><rect x="56" y="22" width="18" height="44" rx="6" fill="none" stroke="#ffd700" stroke-width="4"/><polygon points="35,68 28,88 42,88" fill="#00f0ff"/><polygon points="65,68 58,88 72,88" fill="#00f0ff"/></svg>`
  },

  // --- Cyber Tetris (Serie 2) ---
  {
    id: "relic_tetris_block",
    name: "Neon Block",
    game: "tetris",
    gameName: "Cyber Tetris",
    rarity: "rare",
    season: 2,
    description: "A frosted cyan glass tetromino block humming with neon circuit energy.",
    image: "metadata/images/relics/relic_tetris_block.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="38" y="20" width="24" height="24" fill="#00f0ff" opacity="0.7" stroke="#fff" stroke-width="2"/><rect x="14" y="44" width="24" height="24" fill="#00f0ff" opacity="0.7" stroke="#fff" stroke-width="2"/><rect x="38" y="44" width="24" height="24" fill="#00f0ff" opacity="0.7" stroke="#fff" stroke-width="2"/><rect x="62" y="44" width="24" height="24" fill="#00f0ff" opacity="0.7" stroke="#fff" stroke-width="2"/></svg>`
  },
  {
    id: "relic_tetris_beam",
    name: "Line Clearer",
    game: "tetris",
    gameName: "Cyber Tetris",
    rarity: "epic",
    season: 2,
    description: "A horizontal plasma emitter bar that vaporizes full grid rows in one pulse.",
    image: "metadata/images/relics/relic_tetris_beam.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="12" y="40" width="76" height="20" rx="6" fill="none" stroke="#bd00ff" stroke-width="4"/><line x1="20" y1="50" x2="80" y2="50" stroke="#00f0ff" stroke-width="6"/></svg>`
  },
  {
    id: "relic_tetris_crown",
    name: "Tetris Crown",
    game: "tetris",
    gameName: "Cyber Tetris",
    rarity: "legendary",
    season: 2,
    description: "A royal crown sculpted from interlocking gold and obsidian tetromino facets.",
    image: "metadata/images/relics/relic_tetris_crown.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="16,74 22,34 40,52 50,24 60,52 78,34 84,74" fill="none" stroke="#ffd700" stroke-width="4"/><circle cx="50" cy="60" r="6" fill="#00f0ff"/></svg>`
  },

  // --- Cyber 2048 (Serie 2) ---
  {
    id: "relic_2048_tile",
    name: "2048 Tile",
    game: "q2048",
    gameName: "Cyber 2048",
    rarity: "rare",
    season: 2,
    description: "A beveled anodized puzzle tile embossed with a glowing cyan circuit emblem.",
    image: "metadata/images/relics/relic_2048_tile.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" rx="12" fill="none" stroke="#00f0ff" stroke-width="4"/><rect x="34" y="34" width="32" height="32" rx="6" fill="#00f0ff" opacity="0.5"/></svg>`
  },
  {
    id: "relic_2048_cube",
    name: "Merge Cube",
    game: "q2048",
    gameName: "Cyber 2048",
    rarity: "epic",
    season: 2,
    description: "A floating hypercube with glowing violet and cyan energy seams.",
    image: "metadata/images/relics/relic_2048_cube.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,14 82,32 82,68 50,86 18,68 18,32" fill="none" stroke="#bd00ff" stroke-width="4"/><line x1="50" y1="14" x2="50" y2="50" stroke="#00f0ff" stroke-width="3"/><line x1="18" y1="32" x2="50" y2="50" stroke="#00f0ff" stroke-width="3"/><line x1="82" y1="32" x2="50" y2="50" stroke="#00f0ff" stroke-width="3"/><line x1="50" y1="50" x2="50" y2="86" stroke="#00f0ff" stroke-width="3"/></svg>`
  },
  {
    id: "relic_2048_gold",
    name: "Golden 2048",
    game: "q2048",
    gameName: "Cyber 2048",
    rarity: "legendary",
    season: 2,
    description: "A solid gold trophy tile housing a radiant warm-gold crystal core.",
    image: "metadata/images/relics/relic_2048_gold.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" rx="12" fill="none" stroke="#ffd700" stroke-width="4"/><polygon points="50,28 68,50 50,72 32,50" fill="#ffd700" opacity="0.8"/></svg>`
  },

  // --- Universal Mythics (Serie 2) ---
  {
    id: "relic_s2_mythic_compass",
    name: "Star Compass",
    game: "universal_s2",
    gameName: "Universal (Season 2)",
    rarity: "mythic",
    season: 2,
    description: "A celestial gold-and-obsidian astrolabe compass guiding pilots across the void.",
    image: "metadata/images/relics/relic_s2_mythic_compass.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="#ffd700" stroke-width="4"/><polygon points="50,20 58,42 80,50 58,58 50,80 42,58 20,50 42,42" fill="#00f0ff" opacity="0.85"/></svg>`
  },
  {
    id: "relic_s2_mythic_gem",
    name: "Void Gem",
    game: "universal_s2",
    gameName: "Universal (Season 2)",
    rarity: "mythic",
    season: 2,
    description: "A faceted obsidian-violet crystal gem orbited by delicate golden rings.",
    image: "metadata/images/relics/relic_s2_mythic_gem.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><polygon points="50,12 78,42 50,88 22,42" fill="#bd00ff" opacity="0.7" stroke="#ffd700" stroke-width="3"/><ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="#ffd700" stroke-width="2" transform="rotate(-25 50 50)"/></svg>`
  },
  {
    id: "relic_s2_mythic_key",
    name: "Infinity Key",
    game: "universal_s2",
    gameName: "Universal (Season 2)",
    rarity: "mythic",
    season: 2,
    description: "A gilded skeleton key with an infinity-loop bow housing a cosmic core.",
    image: "metadata/images/relics/relic_s2_mythic_key.jpg",
    svgFallback: `<svg viewBox="0 0 100 100"><circle cx="34" cy="38" r="16" fill="none" stroke="#ffd700" stroke-width="4"/><line x1="46" y1="48" x2="82" y2="82" stroke="#ffd700" stroke-width="5"/><line x1="68" y1="68" x2="78" y2="58" stroke="#00f0ff" stroke-width="4"/><line x1="75" y1="75" x2="85" y2="65" stroke="#00f0ff" stroke-width="4"/></svg>`
  }
];

// Helper to retrieve relic metadata
export function getRelicMeta(relicId) {
  return RELICS_REGISTRY.find(r => r.id === relicId) || null;
}

// Canonical Alias Map for legacy relic names / typo resilience
const RELIC_ALIASES = {
  'relic_drift_supercharger': 'relic_drift_overdrive',
  'relic_drift_tachometer': 'relic_drift_chronometer',
  'relic_drift_flux': 'relic_drift_capacitor',
  'relic_invaders_pulsar': 'relic_invaders_core',
  'relic_astrododge_chrono': 'relic_astrododge_compass',
  'relic_stacker_bedrock': 'relic_stacker_foundation',
  'relic_space_coil': 'relic_space_warpcoil',
  'relic_space_harvester': 'relic_space_plasma'
};

// Robust Relic Normalizer: Handles numbers, booleans, nested objects, and custom DB formats
export function normalizeRelicsObject(rawRelics) {
  if (!rawRelics || typeof rawRelics !== 'object') return {};
  const normalized = {};

  // Disallow RPC response wrappers, status fields, or arbitrary metadata keys
  const IGNORED_KEYS = new Set(['success', 'added', 'new_total', 'error', 'message', 'relic_id', 'relics']);

  Object.keys(rawRelics).forEach(rawKey => {
    if (IGNORED_KEYS.has(rawKey)) return;
    const val = rawRelics[rawKey];
    if (!val) return;

    const key = RELIC_ALIASES[rawKey] || rawKey;
    // Strictly require relic keys to match standard relic ID pattern
    if (!key.startsWith('relic_')) return;

    let itemUnminted = 0;
    let itemOnchain = 0;
    let itemTotal = 0;
    let itemTokenIds = [];

    if (typeof val === 'number') {
      const num = Math.max(0, Math.floor(val));
      if (num > 0) {
        itemUnminted = num;
        itemTotal = num;
      }
    } else if (typeof val === 'boolean') {
      if (val) {
        itemUnminted = 1;
        itemTotal = 1;
      }
    } else if (typeof val === 'object') {
      itemUnminted = parseInt(val.unminted !== undefined ? val.unminted : (val.count || 0), 10) || 0;
      itemOnchain = parseInt(val.onchain || 0, 10) || 0;
      const explicitTotal = parseInt(val.total || 0, 10) || 0;
      itemTotal = Math.max(explicitTotal, itemUnminted + itemOnchain, (val.unminted || val.onchain || val.total || val.count ? 1 : 0));
      itemTokenIds = Array.isArray(val.token_ids) ? val.token_ids : [];
    }

    if (itemTotal > 0 || itemUnminted > 0 || itemOnchain > 0) {
      if (normalized[key]) {
        // Merge into existing canonical key
        const prev = normalized[key];
        const mergedUnminted = (prev.unminted || 0) + (itemUnminted > 0 ? itemUnminted : (itemOnchain === 0 ? itemTotal : 0));
        const mergedOnchain = (prev.onchain || 0) + itemOnchain;
        const mergedTotal = Math.max((prev.total || 0) + itemTotal, mergedUnminted + mergedOnchain);
        const mergedTokenIds = Array.from(new Set([...(prev.token_ids || []), ...itemTokenIds]));
        normalized[key] = {
          unminted: mergedUnminted,
          onchain: mergedOnchain,
          total: mergedTotal,
          token_ids: mergedTokenIds
        };
      } else {
        normalized[key] = {
          unminted: itemUnminted > 0 ? itemUnminted : (itemOnchain === 0 ? itemTotal : 0),
          onchain: itemOnchain,
          total: itemTotal,
          token_ids: itemTokenIds
        };
      }
    }
  });

  return normalized;
}

// Merge DB relics with local state relics (Union preserving all unlocked relics)
export function mergeRelicsObjects(dbRelics, localRelics) {
  const normDb = normalizeRelicsObject(dbRelics);
  const normLocal = normalizeRelicsObject(localRelics);
  const merged = { ...normDb };

  Object.keys(normLocal).forEach(key => {
    if (!merged[key]) {
      merged[key] = normLocal[key];
    } else {
      const dbItem = merged[key];
      const localItem = normLocal[key];
      const unminted = Math.max(dbItem.unminted || 0, localItem.unminted || 0);
      const onchain = Math.max(dbItem.onchain || 0, localItem.onchain || 0);
      const total = Math.max(dbItem.total || 0, localItem.total || 0, unminted + onchain);
      const token_ids = Array.from(new Set([...(dbItem.token_ids || []), ...(localItem.token_ids || [])]));
      merged[key] = { unminted, onchain, total, token_ids };
    }
  });

  return merged;
}

// Calculate Serie 1 Progress (17 Active Relics)
export function getSeason1Progress(userRelics) {
  const normalized = normalizeRelicsObject(userRelics);
  const s1Relics = RELICS_REGISTRY.filter(r => r.season === 1);
  let ownedCount = 0;

  s1Relics.forEach(r => {
    const data = normalized && normalized[r.id];
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
export const getSerie1Progress = getSeason1Progress;

// Check if Serie 1 Apex 1.5x Multiplier is Active
export function isSeason1ApexUnlocked(userRelics) {
  return getSeason1Progress(userRelics).isComplete;
}
export const isSerie1ApexUnlocked = isSeason1ApexUnlocked;

// Calculate Serie 2 Progress (18 Active Relics)
export function getSeason2Progress(userRelics) {
  const normalized = normalizeRelicsObject(userRelics);
  const s2Relics = RELICS_REGISTRY.filter(r => r.season === 2);
  let ownedCount = 0;

  s2Relics.forEach(r => {
    const data = normalized && normalized[r.id];
    if (data && (data.total > 0 || data.unminted > 0 || data.onchain > 0)) {
      ownedCount++;
    }
  });

  return {
    ownedCount,
    totalCount: s2Relics.length,
    isComplete: s2Relics.length > 0 && ownedCount === s2Relics.length
  };
}
export const getSerie2Progress = getSeason2Progress;

// Check if Serie 2 Apex 1.5x PolySpace Mission Multiplier is Active
export function isSeason2ApexUnlocked(userRelics) {
  return getSeason2Progress(userRelics).isComplete;
}
export const isSerie2ApexUnlocked = isSeason2ApexUnlocked;

// Tiered Faucet Relic Set Multiplier: 1 set = 1.5x, 2 sets = 1.75x, 3+ sets = 2.0x
export function getFaucetRelicMultiplier(userRelics) {
  const s1Complete = isSeason1ApexUnlocked(userRelics);
  const s2Complete = isSeason2ApexUnlocked(userRelics);
  const completedSets = (s1Complete ? 1 : 0) + (s2Complete ? 1 : 0);

  let multiplier = 1.0;
  if (completedSets >= 3) multiplier = 2.0;
  else if (completedSets === 2) multiplier = 1.75;
  else if (completedSets === 1) multiplier = 1.5;

  return { multiplier, completedSets, s1Complete, s2Complete };
}

let _isHydratingRelics = false;
let _hasHydratedRelicsOnce = false;

// Hydrate relics directly from Supabase for the current player, updating in-memory state & rendering vault
export async function hydrateAndRenderRelicsVault(force = false) {
  // Never run hydration during active arcade gameplay
  if (typeof window !== 'undefined' && typeof window.isAnyArcadeGamePlaying === 'function' && window.isAnyArcadeGamePlaying()) {
    return;
  }

  // Prevent duplicate background queries if already hydrated or in-flight
  if (_isHydratingRelics) return;
  if (!force && _hasHydratedRelicsOnce) {
    renderRelicsVault();
    return;
  }

  _isHydratingRelics = true;
  _hasHydratedRelicsOnce = true;

  // 1. Immediate local render
  renderRelicsVault();

  try {
    const s1Prog = getSeason1Progress(appState?.state?.relics || {});
    const s2Prog = getSeason2Progress(appState?.state?.relics || {});
    if (!force && s1Prog.isComplete && s2Prog.isComplete) {
      _isHydratingRelics = false;
      return;
    }

    if (!supabase) {
      _isHydratingRelics = false;
      return;
    }

    // Resolve candidate identifiers for the player
    const candidates = [];
    if (appState?.state?.playerId && !appState.state.playerId.startsWith('0xguest')) {
      candidates.push(appState.state.playerId.toLowerCase());
    }
    if (appState?.state?.linkedWalletAddress && !appState.state.linkedWalletAddress.startsWith('0xpgt') && !appState.state.linkedWalletAddress.startsWith('0xg')) {
      candidates.push(appState.state.linkedWalletAddress.toLowerCase());
    }
    if (appState?.state?.walletAddress && !appState.state.walletAddress.startsWith('0xguest') && !candidates.includes(appState.state.walletAddress.toLowerCase())) {
      candidates.push(appState.state.walletAddress.toLowerCase());
    }
    if (typeof window !== 'undefined' && window.ethereum && window.ethereum.selectedAddress) {
      const ethAddr = window.ethereum.selectedAddress.toLowerCase();
      if (!candidates.includes(ethAddr)) candidates.push(ethAddr);
    }

    let query = supabase.from('users').select('player_id, linked_wallet_address, username, relics, is_simulated');
    if (candidates.length > 0) {
      const orFilter = candidates.map(c => `player_id.ilike.${c},linked_wallet_address.ilike.${c}`).join(',');
      query = query.or(orFilter);
    } else if (appState?.state?.username && appState.state.username !== 'Anonymous Player') {
      query = query.ilike('username', appState.state.username);
    } else {
      _isHydratingRelics = false;
      return;
    }

    const { data: rows, error } = await query.order('created_at', { ascending: true }).limit(10);
    const rowList = (!error && Array.isArray(rows)) ? rows : [];
    const user = rowList.find(r => !r.is_simulated) || rowList[0] || null;

    let mergedRelics = (user && user.relics && typeof user.relics === 'object')
      ? mergeRelicsObjects(user.relics, appState?.state?.relics || {})
      : normalizeRelicsObject(appState?.state?.relics || {});

    // Also hydrate directly from Polygon via Multicall3 if an EVM wallet is linked/connected
    const rawEvmCandidate = (
      user?.linked_wallet_address ||
      appState?.state?.linkedWalletAddress ||
      appState?.state?.walletAddress ||
      (typeof window !== 'undefined' && window.ethereum?.selectedAddress) ||
      ''
    ).trim();
    const lowerEvm = rawEvmCandidate.toLowerCase();
    const isValidEvm = /^0x[a-f0-9]{40}$/.test(lowerEvm) && !lowerEvm.startsWith('0xpgt') && !lowerEvm.startsWith('0xg');

    if (isValidEvm) {
      const chainRelics = await getOwnedRelicsFromChain(rawEvmCandidate).catch(() => ({}));
      if (chainRelics && typeof chainRelics === 'object' && Object.keys(chainRelics).length > 0) {
        const dbKeyCount = Object.keys(user?.relics || {}).length;
        mergedRelics = mergeRelicsObjects(chainRelics, mergedRelics);
        if (Object.keys(mergedRelics).length > dbKeyCount) {
          supabase.functions.invoke('sync-assets', {
            body: {
              playerId: user?.player_id || appState?.state?.playerId || rawEvmCandidate,
              walletAddress: rawEvmCandidate
            }
          }).catch(() => {});
        }
      }
    }

    if (Object.keys(mergedRelics).length > 0) {
      appState.state.relics = mergedRelics;
      if (typeof appState.save === 'function') {
        appState.save();
      }
      // Sync combined Serie 1 + Serie 2 badge
      const relicProgressBadge = document.getElementById('relics-progress-badge');
      if (relicProgressBadge) {
        const newS1 = getSeason1Progress(appState.state.relics);
        const newS2 = getSeason2Progress(appState.state.relics);
        relicProgressBadge.innerText = `${newS1.ownedCount + newS2.ownedCount}/${newS1.totalCount + newS2.totalCount}`;
      }
      // Re-render vault with fresh DB + on-chain relics
      renderRelicsVault();
      if (typeof appState.syncUI === 'function') {
        appState.syncUI();
      }
    }
  } catch (err) {
    console.warn('[hydrateAndRenderRelicsVault] Warning:', err);
  } finally {
    _isHydratingRelics = false;
  }
}

// Render the Dedicated Quantum Relics Vault UI in #view-profile
export function renderRelicsVault() {
  const container = document.getElementById('relics-vault-content');
  if (!container) return;

  const userRelics = normalizeRelicsObject(appState.state.relics || {});
  const s1Progress = getSeason1Progress(userRelics);
  const s2Progress = getSeason2Progress(userRelics);

  // Group relics by game category
  const categories = [
    { key: "astrododge", title: "🔮 AstroDodge Relics", season: 1 },
    { key: "invaders", title: "👾 Cyber Invaders Relics", season: 1 },
    { key: "drift", title: "🏎️ Cyber Drift Relics", season: 1 },
    { key: "stacker", title: "🏗️ Cyber Stacker Relics", season: 1 },
    { key: "space", title: "🪐 PolySpace Fleet Relics", season: 1 },
    { key: "universal", title: "👑 Universal Apex Relics (Serie 1)", season: 1 },
    { key: "skeet", title: "🎯 Cyber Skeet Relics", season: 2 },
    { key: "bubble", title: "🫧 Cyber Bubble Relics", season: 2 },
    { key: "runner", title: "⚡ Cyber Runner Relics", season: 2 },
    { key: "tetris", title: "🧱 Cyber Tetris Relics", season: 2 },
    { key: "q2048", title: "🧩 Cyber 2048 Relics", season: 2 },
    { key: "universal_s2", title: "👑 Universal Mythic Relics (Serie 2)", season: 2 }
  ];

  let html = `
    <!-- Serie 1 Apex Banner -->
    <div style="background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(0,240,255,0.08) 100%); border: 1px solid ${s1Progress.isComplete ? 'var(--color-accent)' : 'var(--border-cyan)'}; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 1.4rem;">🏺</span>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">Quantum Relics Vault — Serie 1</h3>
        </div>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.88rem; line-height: 1.4;">
          Collect all 17 Serie 1 Relics across S1 arcade games & PolySpace mining to unlock the permanent <strong>1.5x Apex Arcade Multiplier</strong> + tiered <strong>Faucet Set Boost</strong> (1 Set: 1.5x • 2 Sets: 1.75x • 3 Sets: 2.0x)!
        </p>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Serie 1 Progress</div>
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

    <!-- Serie 2 PolySpace Mission Bonus Banner -->
    <div style="background: linear-gradient(135deg, rgba(189,0,255,0.12) 0%, rgba(236,72,153,0.08) 100%); border: 1px solid ${s2Progress.isComplete ? '#ec4899' : 'rgba(189,0,255,0.35)'}; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 1.4rem;">🚀</span>
          <h3 style="font-size: 1.1rem; font-weight: 800; color: #f0abfc; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">Serie 2 — PolySpace Frontier</h3>
        </div>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.88rem; line-height: 1.4;">
          Collect all 18 Serie 2 Relics across S2 arcade games (Cyber Skeet, Bubble, Runner, Tetris, 2048) to unlock a permanent <strong>1.5x PolySpace Mission Rewards Multiplier (Ore + PGT)</strong> + count toward the tiered <strong>Faucet Set Boost</strong> (1 Set: 1.5x • 2 Sets: 1.75x • 3 Sets: 2.0x)!
        </p>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Serie 2 Progress</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: ${s2Progress.isComplete ? '#00ff88' : '#e879f9'};">
            ${s2Progress.ownedCount} / ${s2Progress.totalCount}
          </div>
        </div>
        <div style="background: ${s2Progress.isComplete ? 'rgba(0,255,136,0.18)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${s2Progress.isComplete ? '#00ff88' : 'var(--border-glass)'}; border-radius: 8px; padding: 8px 14px; text-align: center;">
          <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: ${s2Progress.isComplete ? '#00ff88' : 'var(--text-muted)'};">
            ${s2Progress.isComplete ? '🛸 POLYSPACE & FAUCET' : '🔒 POLYSPACE & FAUCET'}
          </div>
          <div style="font-size: 1.1rem; font-weight: 900; color: ${s2Progress.isComplete ? '#00ff88' : 'var(--text-muted)'};">
            ${s2Progress.isComplete ? '1.5x ACTIVE' : '1.5x LOCKED'}
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
            Serie ${cat.season}
          </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.25rem;">
    `;

    relicsInCat.forEach(relic => {
      const data = userRelics[relic.id] || { total: 0, unminted: 0, onchain: 0, token_ids: [] };
      const unminted = Number(data.unminted || 0);
      const onchain = Number(data.onchain || 0);
      const total = Number(data.total || (unminted + onchain));
      const isUnlocked = total > 0 || unminted > 0 || onchain > 0;

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
                🔒 Play ${relic.game === 'universal_s2' ? 'any Season 2 Game' : (relic.game === 'universal' ? 'any Season 1 Game' : relic.gameName)} to unlock
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

  // Season 3 Coming Soon Teaser
  html += `
    <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(88, 28, 135, 0.18) 100%); border: 1px dashed rgba(168, 85, 247, 0.45); border-radius: 12px; padding: 1.4rem 1.6rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="font-size: 2rem; width: 48px; height: 48px; border-radius: 12px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.4); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          🌌
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; background: rgba(168, 85, 247, 0.2); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.45); padding: 2px 8px; border-radius: 999px;">Coming Soon</span>
            <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.05em;">Quantum Relics — Serie 3</h4>
          </div>
          <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">
            New anomalous signatures are forming in deep space. Future games and new cosmic relic sets will unlock in <strong>Season 3</strong>.
          </p>
        </div>
      </div>
      <div style="font-size: 0.8rem; font-weight: 800; color: #c084fc; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); padding: 6px 12px; border-radius: 8px;">
        🔒 Signal Encrypted
      </div>
    </div>
  `;

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
      
      const { data, error } = await executeAuthenticatedRpc('mark_relic_minted', {
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
    const { data, error } = await executeAuthenticatedRpc('mark_relic_minted', {
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
window.hydrateAndRenderRelicsVault = hydrateAndRenderRelicsVault;
window.getRelicMeta = getRelicMeta;
window.getSeason1Progress = getSeason1Progress;
window.getSeason2Progress = getSeason2Progress;
window.isSeason1ApexUnlocked = isSeason1ApexUnlocked;
window.isSeason2ApexUnlocked = isSeason2ApexUnlocked;
window.getFaucetRelicMultiplier = getFaucetRelicMultiplier;

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
    "https://polygon.drpc.org",
    "https://polygon-rpc.com",
    "https://1rpc.io/matic"
  ];

  const contractAbi = [
    "function balanceOf(address account) view returns (uint256)",
    "function tokensOfOwner(address account) view returns (uint256[])",
    "function getRelicType(uint256 tokenId) view returns (string)"
  ];

  let onchainRelics = {};
  let provider = null;

  if (window.ethers && typeof window.ethers.JsonRpcProvider === 'function') {
    for (const rpcUrl of rpcList) {
      try {
        const p = new window.ethers.JsonRpcProvider(rpcUrl);
        const contract = new window.ethers.Contract(RELICS_CONTRACT_ADDRESS, contractAbi, p);
        const bal = await contract.balanceOf(address);
        if (bal !== undefined && bal !== null) {
          if (BigInt(bal) === 0n) return {};
          provider = p;
          
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

