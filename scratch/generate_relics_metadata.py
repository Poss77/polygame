import os
import json

relics_meta_dir = os.path.join(os.path.dirname(__file__), '..', 'metadata', 'relics')
os.makedirs(relics_meta_dir, exist_ok=True)

relics = [
    {
        'id': 'relic_astrododge_prism',
        'name': 'Quantum Prism',
        'game': 'AstroDodge',
        'rarity': 'Rare',
        'season': 'Season 1',
        'boost': '+15% Faucet Boost',
        'desc': 'A hyper-refractive crystal that bends cosmic radiation and temporal flow in AstroDodge.'
    },
    {
        'id': 'relic_astrododge_deflector',
        'name': 'Kinetic Deflector',
        'game': 'AstroDodge',
        'rarity': 'Epic',
        'season': 'Season 1',
        'boost': '+15% Staking APY Boost',
        'desc': 'A high-frequency forcefield emitter that deflects hyper-velocity debris in AstroDodge.'
    },
    {
        'id': 'relic_astrododge_compass',
        'name': 'Chrono Compass',
        'game': 'AstroDodge',
        'rarity': 'Legendary',
        'season': 'Season 1',
        'boost': '+25% High Score Yield Boost',
        'desc': 'An ancient temporal gyroscope that guides pilots through deep dimensional voids in AstroDodge.'
    },
    {
        'id': 'relic_invaders_core',
        'name': 'Pulsar Core',
        'game': 'Cyber Invaders',
        'rarity': 'Rare',
        'season': 'Season 1',
        'boost': '+15% Faucet Boost',
        'desc': 'An overcharged plasma cell harvested from alien flagship command nodes in Cyber Invaders.'
    },
    {
        'id': 'relic_invaders_dynamo',
        'name': 'Warp Dynamo',
        'game': 'Cyber Invaders',
        'rarity': 'Epic',
        'season': 'Season 1',
        'boost': '+15% Staking APY Boost',
        'desc': 'A continuous rotary ion dynamo generating sub-space warp shielding in Cyber Invaders.'
    },
    {
        'id': 'relic_invaders_transmitter',
        'name': 'Quantum Transmitter',
        'game': 'Cyber Invaders',
        'rarity': 'Legendary',
        'season': 'Season 1',
        'boost': '+25% High Score Yield Boost',
        'desc': 'A deep-band tachyon beacon capable of transmitting across planetary galaxies in Cyber Invaders.'
    },
    {
        'id': 'relic_drift_chronometer',
        'name': 'Neon Tachometer',
        'game': 'Cyber Drift',
        'rarity': 'Rare',
        'season': 'Season 1',
        'boost': '+15% Faucet Boost',
        'desc': 'A precision holographic chronometer recording extreme velocity milestones in Cyber Drift.'
    },
    {
        'id': 'relic_drift_capacitor',
        'name': 'Flux Capacitor',
        'game': 'Cyber Drift',
        'rarity': 'Epic',
        'season': 'Season 1',
        'boost': '+15% Staking APY Boost',
        'desc': 'Stores kinetic drift friction and discharges continuous fiery turbo bursts in Cyber Drift.'
    },
    {
        'id': 'relic_drift_overdrive',
        'name': 'Apex Supercharger',
        'game': 'Cyber Drift',
        'rarity': 'Legendary',
        'season': 'Season 1',
        'boost': '+25% High Score Yield Boost',
        'desc': 'An advanced quantum turbine boosting vehicular horsepower beyond light speed in Cyber Drift.'
    },
    {
        'id': 'relic_stacker_foundation',
        'name': 'Titanium Bedrock',
        'game': 'Cyber Stacker',
        'rarity': 'Rare',
        'season': 'Season 1',
        'boost': '+15% Faucet Boost',
        'desc': 'An ultra-dense foundation platform capable of anchoring towering cyber structures in Cyber Stacker.'
    },
    {
        'id': 'relic_stacker_keystone',
        'name': 'Harmonic Keystone',
        'game': 'Cyber Stacker',
        'rarity': 'Epic',
        'season': 'Season 1',
        'boost': '+15% Staking APY Boost',
        'desc': 'A floating anti-gravity block that dampens harmonic tilt wobble during construction in Cyber Stacker.'
    },
    {
        'id': 'relic_stacker_monolith',
        'name': 'Quantum Monolith',
        'game': 'Cyber Stacker',
        'rarity': 'Legendary',
        'season': 'Season 1',
        'boost': '+25% High Score Yield Boost',
        'desc': 'A towering obsidian spire pulsating with infinite structural stabilization energy in Cyber Stacker.'
    },
    {
        'id': 'relic_space_darkmatter',
        'name': 'Dark Matter Capsule',
        'game': 'PolySpace',
        'rarity': 'Rare',
        'season': 'Season 1',
        'boost': '+15% Mining Yield Boost',
        'desc': 'High-density gravitational matter harvesting deep space void anomalies in PolySpace Fleet Operations.'
    },
    {
        'id': 'relic_space_warpcoil',
        'name': 'Tachyon Warp Coil',
        'game': 'PolySpace',
        'rarity': 'Epic',
        'season': 'Season 1',
        'boost': '+20% Fleet Speed Boost',
        'desc': 'An electromagnetic subspace hyper-coil pulsating with neon cyan and magenta energy arcs in PolySpace.'
    },
    {
        'id': 'relic_space_plasma',
        'name': 'Solar Plasma Harvester',
        'game': 'PolySpace',
        'rarity': 'Legendary',
        'season': 'Season 1',
        'boost': '+30% Fleet Power Boost',
        'desc': 'A radiant Dyson sphere siphoning raw thermonuclear plasma flares from stellar cores in PolySpace.'
    },
    {
        'id': 'relic_apex_singularity',
        'name': 'Quantum Singularity Core',
        'game': 'Universal Apex',
        'rarity': 'Mythic',
        'season': 'Season 1',
        'boost': '+25% Global Multiplier Boost',
        'desc': 'A stabilized cosmic black hole artifact enclosed in an obsidian and neon violet containment sphere.'
    },
    {
        'id': 'relic_apex_genesis',
        'name': 'Genesis Matrix',
        'game': 'Universal Apex',
        'rarity': 'Mythic',
        'season': 'Season 1',
        'boost': '+30% Global Multiplier Boost',
        'desc': 'The primordial hyper-dimensional source code of the entire PolyGame Metaverse. Grants ultimate mastery.'
    },
    # Expansion & Legacy Aliases
    {
        'id': 'relic_space_transceiver',
        'name': 'Sub-Space Transceiver',
        'game': 'PolySpace',
        'rarity': 'Rare',
        'season': 'Season 1',
        'boost': '+15% Fleet Speed Boost',
        'desc': 'Sub-space communication matrix for deep space operations.'
    },
    {
        'id': 'relic_space_starforge',
        'name': 'Starforge Catalyst',
        'game': 'PolySpace',
        'rarity': 'Epic',
        'season': 'Season 1',
        'boost': '+20% Mining Boost',
        'desc': 'Stellar fusion catalyst generating infinite celestial minerals.'
    },
    {
        'id': 'relic_universal_pulsar',
        'name': 'Celestial Pulsar Matrix',
        'game': 'Universal Apex',
        'rarity': 'Mythic',
        'season': 'Season 1',
        'boost': '+25% Global Multiplier Boost',
        'desc': 'A rotating neutron star core providing infinite energy.'
    },
    {
        'id': 'relic_universal_genesis',
        'name': 'Omega Genesis Seed',
        'game': 'Universal Apex',
        'rarity': 'Mythic',
        'season': 'Season 1',
        'boost': '+30% Global Multiplier Boost',
        'desc': 'The primordial seed that created the PolyGame universe.'
    }
]

for r in relics:
    meta = {
        'name': r['name'],
        'description': f"{r['desc']} Discovered in PolyGame and verified on Polygon Blockchain as an authentic Utility Quantum Relic NFT.",
        'image': f"https://polygongaming.io/metadata/images/relics/{r['id']}.jpg",
        'external_url': 'https://polygongaming.io/',
        'attributes': [
            { 'trait_type': 'Game', 'value': r['game'] },
            { 'trait_type': 'Rarity', 'value': r['rarity'] },
            { 'trait_type': 'Season', 'value': r['season'] },
            { 'trait_type': 'Special Boost', 'value': r['boost'] },
            { 'trait_type': 'Apex Multiplier Eligible', 'value': 'Yes' }
        ]
    }
    filepath = os.path.join(relics_meta_dir, f"{r['id']}.json")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    print(f"Generated: {r['id']}.json")

print('All metadata JSON files successfully created!')
