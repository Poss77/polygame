import { realSigner, NFT_CONTRACT_ADDRESS, supabase } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { triggerToast, openModal, closeModal } from '../core/ui.js';
import { getOwnedNftsFromChain } from './roshambo.js';

// --- Static NFT Cards Registry ---

export const NFT_REGISTRY = [
// --- FAUCET BOOST GROUP ---

  {
    id: 'nft_common_boost',
    name: 'Copper Core',
    rarity: 'common',
    group: 'faucet',
    price: 5.0,
    faucetBoost: 10,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'A vintage energy transducer. Enhances basic spatial vacuuming.',
    svg: `<svg viewBox="0 0 100 100"><rect x="30" y="30" width="40" height="40" rx="10" fill="none" stroke="#8899b8" stroke-width="4"/><circle cx="50" cy="50" r="10" fill="#cd7f32" /><path d="M50 15v15M50 70v15M15 50h15M70 50h15" stroke="#8899b8" stroke-width="3"/></svg>`
  },
  {
    id: 'nft_silver_charger',
    name: 'Silver Charger',
    rarity: 'rare',
    group: 'faucet',
    price: 15.0,
    faucetBoost: 25,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'Upgraded power cell boosting standard molecular extraction.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="25" fill="none" stroke="#c0c0c0" stroke-width="4"/><path d="M50 15 L50 85 M15 50 L85 50" stroke="#c0c0c0" stroke-width="2"/><circle cx="50" cy="50" r="8" fill="#e0e0e0"/></svg>`
  },
  {
    id: 'nft_gold_turbine',
    name: 'Gold Turbine',
    rarity: 'epic',
    group: 'faucet',
    price: 40.0,
    faucetBoost: 50,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'High-yield particle turbine for massive energy harvests.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="28" fill="none" stroke="#ffd700" stroke-width="4"/><path d="M35 35 L65 65 M35 65 L65 35" stroke="#ffd700" stroke-width="3"/><polygon points="50,20 60,35 40,35" fill="#ffd700"/><polygon points="50,80 60,65 40,65" fill="#ffd700"/></svg>`
  },

  {
    id: 'nft_rare_shield',
    name: 'Viper Shield',
    rarity: 'rare',
    group: 'game',
    price: 15.0,
    faucetBoost: 0,
    gameMultiplier: 15,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'Reinforced plating designed to deflect minor orbital dust debris.',
    svg: `<svg viewBox="0 0 100 100"><polygon points="50,15 80,35 80,65 50,85 20,65 20,35" fill="none" stroke="#00f0ff" stroke-width="4"/><polygon points="50,25 70,40 70,60 50,75 30,60 30,40" fill="#00f0ff" opacity="0.3"/><circle cx="50" cy="50" r="8" fill="#fff"/></svg>`
  },
  {
    id: 'nft_pulse_blaster',
    name: 'Pulse Blaster',
    rarity: 'epic',
    group: 'game',
    price: 40.0,
    faucetBoost: 0,
    gameMultiplier: 30,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'Holographic projectile matrix that doubles core arcade kinetics.',
    svg: `<svg viewBox="0 0 100 100"><rect x="35" y="15" width="30" height="70" rx="5" fill="none" stroke="#ff007f" stroke-width="4"/><circle cx="50" cy="30" r="10" fill="#ff007f" opacity="0.4"/><line x1="50" y1="45" x2="50" y2="75" stroke="#ff007f" stroke-width="4"/></svg>`
  },
  {
    id: 'nft_epic_yield',
    name: 'Apex Matrix',
    rarity: 'epic',
    group: 'game',
    price: 60.0,
    faucetBoost: 0,
    gameMultiplier: 50,
    stakingBoost: 5,
    referralMultiplier: 1.0,
    description: 'Neural core algorithm yielding accelerated block processing.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="#bd00ff" stroke-width="4"/><path d="M30 30 L70 70 M30 70 L70 30" stroke="#bd00ff" stroke-width="3"/><rect x="42" y="42" width="16" height="16" rx="3" fill="#bd00ff" /><circle cx="50" cy="50" r="3" fill="#fff"/></svg>`
  },

// --- REFERRAL BOOST GROUP ---

  {
    id: 'nft_referral_beacon',
    name: 'Referral Beacon',
    rarity: 'common',
    group: 'referral',
    price: 10.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.1,
    description: 'Starter relay core boosting downline commissions by +10%.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="18" fill="none" stroke="#00ff66" stroke-width="3" stroke-dasharray="2,2"/><circle cx="50" cy="50" r="8" fill="#00ff66"/><line x1="50" y1="15" x2="50" y2="30" stroke="#00ff66" stroke-width="2"/><line x1="50" y1="70" x2="50" y2="85" stroke="#00ff66" stroke-width="2"/><line x1="15" y1="50" x2="30" y2="50" stroke="#00ff66" stroke-width="2"/><line x1="70" y1="50" x2="85" y2="50" stroke="#00ff66" stroke-width="2"/></svg>`
  },
  {
    id: 'nft_affiliate_guild',
    name: 'Affiliate Guild',
    rarity: 'rare',
    group: 'referral',
    price: 100.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.5,
    description: 'A network relay core boosting all downline commissions by +50%.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="25" cy="50" r="10" fill="#00ff66"/><circle cx="75" cy="30" r="10" fill="#00ff66"/><circle cx="75" cy="70" r="10" fill="#00ff66"/><line x1="25" y1="50" x2="75" y2="30" stroke="#00ff66" stroke-width="3"/><line x1="25" y1="50" x2="75" y2="70" stroke="#00ff66" stroke-width="3"/></svg>`
  },
  {
    id: 'nft_legendary_king',
    name: 'Omni Lord',
    rarity: 'legendary',
    group: 'referral',
    price: 300.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 2.0,
    description: 'Ultimate referral beacon. Multiplies all network commission earnings by +100%.',
    svg: `<svg viewBox="0 0 100 100"><polygon points="50,10 90,40 75,85 25,85 10,40" fill="none" stroke="#ffb700" stroke-width="5"/><circle cx="50" cy="50" r="22" fill="none" stroke="#ffb700" stroke-width="2" stroke-dasharray="4,4"/><polygon points="50,30 62,55 38,55" fill="#ffb700"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`
  },
// --- STAKING BOOST GROUP ---
  {
    id: 'nft_yield_vault',
    name: 'Yield Vault Core',
    rarity: 'epic',
    group: 'staking',
    price: 50.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 15,
    referralMultiplier: 1.0,
    description: 'A staking core granting +15% APY yield.',
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="none" stroke="#c0c0c0" stroke-width="4"/><circle cx="50" cy="55" r="12" fill="none" stroke="#00f0ff" stroke-width="3"/><circle cx="50" cy="55" r="4" fill="#00f0ff"/></svg>`
  },
  {
    id: 'nft_yield_vault_rare',
    name: 'Rare Yield Vault Core',
    rarity: 'rare',
    group: 'staking',
    price: 150.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 50,
    referralMultiplier: 1.0,
    description: 'A rare staking core granting +50% APY yield.',
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="none" stroke="#00f0ff" stroke-width="4"/><circle cx="50" cy="55" r="12" fill="none" stroke="#ff00ff" stroke-width="3"/><circle cx="50" cy="55" r="4" fill="#ff00ff"/></svg>`
  },
  {
    id: 'nft_yield_vault_epic',
    name: 'Epic Yield Vault Core',
    rarity: 'epic',
    group: 'staking',
    price: 300.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 100,
    referralMultiplier: 1.0,
    description: 'An epic staking core granting +100% APY yield.',
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="none" stroke="#ff8c00" stroke-width="4"/><circle cx="50" cy="55" r="12" fill="none" stroke="#ffd700" stroke-width="3"/><circle cx="50" cy="55" r="4" fill="#ffd700"/></svg>`
  },
// --- SPECIAL PASSES ---
  {
    id: 'nft_vip_pass',
    name: 'VIP Access Pass',
    rarity: 'legendary',
    group: 'special',
    price: 100.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'A consumable pass granting 30 Days of VIP status (+100% all yields, 10% Faster Faucet Cooldown & Instant Captcha-Free Faucet Claims).',
    svg: `<svg viewBox="0 0 100 100"><rect x="15" y="35" width="70" height="40" rx="5" fill="none" stroke="#ffd700" stroke-width="3"/><text x="50" y="58" font-family="monospace" font-size="12" fill="#ffd700" text-anchor="middle" font-weight="bold">VIP</text><circle cx="25" cy="55" r="3" fill="#ff007f"/></svg>`
  },
  {
    id: 'nft_vip_pass_yearly',
    name: 'Yearly VIP Access Pass',
    rarity: 'legendary',
    group: 'special',
    price: 900.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.0,
    description: 'A consumable pass granting 365 Days of VIP status (+100% all yields, 10% Faster Faucet Cooldown & Instant Captcha-Free Faucet Claims).',
    svg: `<svg viewBox="0 0 100 100"><rect x="15" y="35" width="70" height="40" rx="5" fill="none" stroke="#ff00ff" stroke-width="3"/><text x="50" y="58" font-family="monospace" font-size="12" fill="#ff00ff" text-anchor="middle" font-weight="bold">1-YR VIP</text><circle cx="25" cy="55" r="3" fill="#00ffff"/></svg>`
  }
];

export function renderNftMarketplace() {
  const grid = document.getElementById('nft-market-grid');
  if (!grid) return;
  
  grid.innerHTML = `
    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-warning); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">🎁 Cyber Mystery Crates</h3>
    </div>
    <div id="nft-group-mystery" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 2rem;">
      <!-- PGT Mystery Box -->
      <div class="nft-card rarity-epic">
        <div class="nft-art-container">
          <div class="nft-art-bg"></div>
          <div class="nft-art-svg" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%; font-size:4.5rem;">🎁</div>
          <span class="nft-rarity-badge rarity-epic">EPIC CRATE</span>
        </div>
        <div class="nft-details">
          <h4 class="nft-name">PGT Cyber Mystery Crate</h4>
          <p style="font-size:0.8rem; color:var(--text-dim); line-height:1.3; min-height:35px;">Unbox quantum loot! ~90% PGT return + 1% chance to win a Utility NFT or VIP Pass!</p>
          <div class="nft-bonus">
            <span>🎲 ~90% PGT Return</span><br>
            <span>💎 1% NFT / VIP Drop Rate</span>
          </div>
          <div class="nft-buy-footer">
            <span class="nft-price">1,000 PGT</span>
            <button class="btn-nft-action" onclick="buyPgtMysteryBox()">Buy & Open Crate</button>
          </div>
        </div>
      </div>

      <!-- POL Mystery Box -->
      <div class="nft-card rarity-legendary">
        <div class="nft-art-container">
          <div class="nft-art-bg"></div>
          <div class="nft-art-svg" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%; font-size:4.5rem;">✨</div>
          <span class="nft-rarity-badge rarity-legendary">POL CRATE</span>
        </div>
        <div class="nft-details">
          <h4 class="nft-name">POL Quantum Crate</h4>
          <p style="font-size:0.8rem; color:var(--text-dim); line-height:1.3; min-height:35px;">Premium Polygon crate! Guaranteed 2.5k–5k PGT + 10% chance for Epic NFT Core!</p>
          <div class="nft-bonus">
            <span>⚡ 2.5k–5k PGT Loot</span><br>
            <span>💎 10% Epic NFT Drop Rate</span>
          </div>
          <div class="nft-buy-footer">
            <span class="nft-price">50.0 POL</span>
            <button class="btn-nft-action" onclick="buyPolMysteryBox()">Buy with POL</button>
          </div>
        </div>
      </div>
    </div>

    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-primary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">⚡ Faucet Boost Cores</h3>
    </div>
    <div id="nft-group-faucet" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 2rem;"></div>

    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-accent); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">🎮 Arcade PGT Payout Cores</h3>
    </div>
    <div id="nft-group-game" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 2rem;"></div>

    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-secondary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">🔗 Referral Multiplier Cores</h3>
    </div>
    <div id="nft-group-referral" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 1rem;"></div>

    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-success); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">📈 Staking Yield Cores</h3>
    </div>
    <div id="nft-group-staking" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 1rem;"></div>

    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-warning); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">🎟️ Special Access Passes</h3>
    </div>
    <div id="nft-group-special" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 1rem;"></div>
  `;

  const faucetContainer = document.getElementById('nft-group-faucet');
  const gameContainer = document.getElementById('nft-group-game');
  const referralContainer = document.getElementById('nft-group-referral');
  const stakingContainer = document.getElementById('nft-group-staking');
  const specialContainer = document.getElementById('nft-group-special');

  NFT_REGISTRY.forEach(nft => {
    const combinedIds = [...(appState.state.ownedNfts || []), ...(appState.state.crateNfts || [])];
    const isOwned = combinedIds.includes(nft.id);
    
    // Calculate boost textual representation
    let bonuses = [];
    if (nft.faucetBoost > 0) bonuses.push(`Faucet claim +${nft.faucetBoost}%`);
    if (nft.gameMultiplier > 0) bonuses.push(`Arcade PGT payout +${nft.gameMultiplier}%`);
    if (nft.stakingBoost > 0) bonuses.push(`Staking APY +${nft.stakingBoost}%`);
    if (nft.referralMultiplier > 1.0) {
      const pct = Math.round((nft.referralMultiplier - 1.0) * 100);
      bonuses.push(`Referral rewards +${pct}%`);
    }

    const card = document.createElement('div');
    card.className = `nft-card rarity-${nft.rarity}`;
    card.innerHTML = `
      <div class="nft-art-container">
        <div class="nft-art-bg"></div>
        <div class="nft-art-svg" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
          <img src="metadata/images/${nft.id}.png" alt="${nft.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px; position: relative; z-index: 10;" onerror="this.src=''; this.onerror=null; this.parentElement.innerHTML='${nft.svg}';"/>
        </div>
        <span class="nft-rarity-badge rarity-${nft.rarity}">${nft.rarity}</span>
      </div>
      <div class="nft-details">
        <h4 class="nft-name">${nft.name}</h4>
        <p style="font-size:0.8rem; color:var(--text-dim); line-height:1.3; min-height:35px;">${nft.description}</p>
        <div class="nft-bonus">
          ${bonuses.map(b => `<span>🚀 ${b}</span>`).join('<br>')}
        </div>
        <div class="nft-buy-footer">
          <span class="nft-price">${parseFloat(nft.price || 0).toFixed(2)} POL</span>
          ${isOwned 
            ? `<button class="btn-nft-action" style="cursor:not-allowed; opacity:0.6;" disabled>Owned</button>` 
            : `<button class="btn-nft-action" onclick="purchaseNft('${nft.id}')">Buy NFT</button>`}
        </div>
      </div>
    `;

    if (nft.group === 'faucet' && faucetContainer) {
      faucetContainer.appendChild(card);
    } else if (nft.group === 'game' && gameContainer) {
      gameContainer.appendChild(card);
    } else if (nft.group === 'referral' && referralContainer) {
      referralContainer.appendChild(card);
    } else if (nft.group === 'staking' && stakingContainer) {
      stakingContainer.appendChild(card);
    } else if (nft.group === 'special' && specialContainer) {
      specialContainer.appendChild(card);
    }
  });
}

export function renderNftInventory() {
  const grid = document.getElementById('nft-inventory-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  const chainIds = appState.state.ownedNfts || [];
  const crateIds = appState.state.crateNfts || [];
  const combinedIds = [...chainIds, ...crateIds];
  
  const badgeEl = document.getElementById('inventory-count-badge');
  if (badgeEl) badgeEl.innerText = combinedIds.length;

  if (combinedIds.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 0; color: var(--text-dim);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎒</div>
        Your NFT backpack is empty. Buy utility cores in the marketplace to unlock massive boosts.
      </div>
    `;
    return;
  }

  const onchainCounts = {};
  (appState.state.ownedNfts || []).forEach(id => {
    onchainCounts[id] = (onchainCounts[id] || 0) + 1;
  });

  const offchainCounts = {};
  (appState.state.crateNfts || []).forEach(id => {
    offchainCounts[id] = (offchainCounts[id] || 0) + 1;
  });

  const allUniqueIds = Array.from(new Set([...Object.keys(onchainCounts), ...Object.keys(offchainCounts)]));

  const categories = {
    'faucet': { title: '⚡ Faucet Boost Cores', color: 'var(--color-primary)' },
    'game': { title: '🎮 Arcade PGT Payout Cores', color: 'var(--color-accent)' },
    'referral': { title: '🔗 Referral Multiplier Cores', color: 'var(--color-secondary)' },
    'staking': { title: '📈 Staking Yield Cores', color: 'var(--color-success)' },
    'special': { title: '🎟️ Special Access Passes', color: 'var(--color-warning)' },
    'mystery': { title: '🎁 Mystery Crates', color: 'var(--color-warning)' }
  };

  let html = '';
  const renderedCategories = new Set();
  
  // Pre-build category sections
  Object.keys(allUniqueIds).forEach(index => {
    const nftId = allUniqueIds[index];
    const nft = NFT_REGISTRY.find(n => n.id === nftId);
    if (!nft) return;
    if (!renderedCategories.has(nft.group)) {
      renderedCategories.add(nft.group);
      const cat = categories[nft.group] || { title: 'Other Items', color: '#ffffff' };
      html += `
        <div style="grid-column: 1/-1; margin-bottom: 0.5rem; margin-top: 1rem;">
          <h3 style="color: ${cat.color}; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em;">${cat.title}</h3>
        </div>
        <div id="inv-group-${nft.group}" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 2rem;"></div>
      `;
    }
  });

  grid.innerHTML = html;

  Object.keys(allUniqueIds).forEach(index => {
    const nftId = allUniqueIds[index];
    const nft = NFT_REGISTRY.find(n => n.id === nftId);
    if (!nft) return;

    const onchainQty = onchainCounts[nftId] || 0;
    const offchainQty = offchainCounts[nftId] || 0;
    const qty = onchainQty + offchainQty;
    const isEquipped = appState.state.equippedNft === nftId;
    let bonuses = [];
    if (nft.faucetBoost > 0) bonuses.push(`Faucet claim +${nft.faucetBoost * qty}%`);
    if (nft.gameMultiplier > 0) bonuses.push(`Arcade PGT payout +${nft.gameMultiplier * qty}%`);
    if (nft.stakingBoost > 0) bonuses.push(`Staking APY +${nft.stakingBoost * qty}%`);
    if (nft.referralMultiplier > 1.0) {
      const pct = Math.round((Math.pow(nft.referralMultiplier, qty) - 1.0) * 100);
      bonuses.push(`Referral rewards +${pct}%`);
    }

    const card = document.createElement('div');
    card.className = `nft-card rarity-${nft.rarity} ${isEquipped ? 'active-equipped' : ''}`;
    card.innerHTML = `
      <div class="nft-art-container">
        <div style="position:absolute; top:8px; right:8px; display:flex; flex-direction:column; gap:4px; z-index:20;">
          ${onchainQty > 0 ? `<span style="background:rgba(130,71,229,0.9); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">Polygon x${onchainQty}</span>` : ''}
          ${offchainQty > 0 ? `<span style="background:rgba(255,0,102,0.9); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">In-Game x${offchainQty}</span>` : ''}
        </div>
        <div class="nft-art-bg" style="background-color: var(--border-color-rarity);"></div>
        <div class="nft-art-svg" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
          <img src="metadata/images/${nft.id}.png" alt="${nft.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px; position: relative; z-index: 10;" onerror="this.src=''; this.onerror=null; this.parentElement.innerHTML='${nft.svg}';"/>
        </div>
        <span class="nft-rarity-badge rarity-${nft.rarity}">${nft.rarity}</span>
      </div>
      <div class="nft-details">
        <h4 class="nft-name">${nft.name} ${qty > 1 ? `<span style="color:var(--color-primary); font-size:0.9rem;">(x${qty})</span>` : ''}</h4>
        <div class="nft-bonus">
          ${bonuses.map(b => `<span>🚀 ${b}</span>`).join('<br>')}
        </div>
        <div class="nft-buy-footer" style="border:none; padding-top:0.5rem; margin-top:0.5rem;">
          ${nft.id === 'nft_vip_pass' 
            ? `<button class="btn-nft-action" style="width: 100%; background: var(--color-warning); color: #000; border-color: var(--color-warning);" onclick="activateVipPass('nft_vip_pass')">🔥 Activate 30 Days VIP</button>`
            : nft.id === 'nft_vip_pass_yearly'
            ? `<button class="btn-nft-action" style="width: 100%; background: #ff00ff; color: #fff; border-color: #ff00ff;" onclick="activateVipPass('nft_vip_pass_yearly')">🔥 Activate 1-Year VIP</button>`
            : `<span style="font-size: 0.8rem; font-weight: 700; color: ${isEquipped ? 'var(--color-accent)' : 'var(--text-dim)'}">
                ${isEquipped ? '● Equipped Active' : '○ Locked in Bag'}
               </span>
               <button class="btn-nft-action" onclick="toggleEquipNft('${nft.id}')">
                 ${isEquipped ? 'Unequip' : 'Equip Core'}
               </button>`
          }
        </div>
      </div>
    `;
    const targetGroup = document.getElementById(`inv-group-${nft.group}`);
    if (targetGroup) {
      targetGroup.appendChild(card);
    } else {
      grid.appendChild(card);
    }
  });
}

export async function purchaseNft(nftId) {
  const nft = NFT_REGISTRY.find(n => n.id === nftId);
  if (!nft) return;

  // 1. Check if connected to real MetaMask provider
  if (!appState.state.walletConnected || appState.state.walletProvider !== 'metamask') {
    triggerToast("Please connect MetaMask on Polygon to buy real NFTs!", "error");
    return;
  }

  if (!NFT_CONTRACT_ADDRESS || NFT_CONTRACT_ADDRESS.length !== 42) {
    triggerToast("Please deploy the NFT contract and paste the address in config.js!", "error");
    return;
  }

  try {
    // 2. Validate POL balance
    if (appState.state.balanceMatic < nft.price) {
      triggerToast(`Insufficient POL balance (Requires ${nft.price} POL)`, "error");
      return;
    }

    const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, [
      "function buyUtilityNFT(string memory nftTypeId) external payable returns (uint256)"
    ], realSigner);

    triggerToast(`Buying ${nft.name}... Confirm in MetaMask`, "success");

    const priceWei = ethers.parseEther(nft.price.toString());

    const tx = await nftContract.buyUtilityNFT(nftId, {
      value: priceWei
    });

    triggerToast("Purchase pending on-chain. Please wait...", "success");
    await tx.wait();

    // Optimistically update local state
    const owned = [...appState.state.ownedNfts];
    if (!owned.includes(nftId)) {
      owned.push(nftId);
    }

    appState.update({
      ownedNfts: owned,
      balanceMatic: Math.max(0, appState.state.balanceMatic - nft.price)
    });

    sfx.playPowerUp();
    triggerToast(`Success! Purchased ${nft.name} NFT!`, 'success');
    appState.addActivity('You', `purchased ${nft.name} NFT on-chain`, `-${nft.price} POL`);
    
    renderNftMarketplace();
    renderNftInventory();

    // Refetch full list from chain in background to verify
    getOwnedNftsFromChain(appState.state.walletAddress).then(list => {
      appState.update({ ownedNfts: list });
    });

  } catch (err) {
    console.error("NFT purchase failed:", err);
    triggerToast("Purchase failed: " + (err.reason || err.message || err), "error");
  }
}

export function toggleEquipNft(nftId) {
  const isEquipped = appState.state.equippedNft === nftId;
  const nextEquip = isEquipped ? null : nftId;
  
  appState.update({
    equippedNft: nextEquip
  });

  sfx.playPowerUp();
  triggerToast(nextEquip ? `Equipped core: ${NFT_REGISTRY.find(n=>n.id===nftId).name}` : "Core unequipped", 'success');
  
  renderNftInventory();
  renderNftMarketplace();
}

export function switchNftView(viewName) {
  const marketBtn = document.querySelector('.nft-tab[data-nft-view="market"]');
  const inventoryBtn = document.querySelector('.nft-tab[data-nft-view="inventory"]');
  
  if (viewName === 'market') {
    marketBtn.classList.add('active');
    inventoryBtn.classList.remove('active');
    document.getElementById('nft-market-panel').style.display = 'block';
    document.getElementById('nft-inventory-panel').style.display = 'none';
  } else {
    marketBtn.classList.remove('active');
    inventoryBtn.classList.add('active');
    document.getElementById('nft-market-panel').style.display = 'none';
    document.getElementById('nft-inventory-panel').style.display = 'block';
    renderNftInventory();
  }
}

export async function activateVipPass(passType) {
  if (!appState.state.walletConnected || !realSigner) return;
  const address = appState.state.walletAddress;
  
  try {
    const nftContract = new window.ethers.Contract(NFT_CONTRACT_ADDRESS, [
      "function balanceOf(address owner) view returns (uint256)",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function getNFTType(uint256 tokenId) view returns (string)",
      "function burn(uint256 tokenId) external"
    ], realSigner);

    let targetTokenId = null;
    for (let i = 1; i <= 1000; i++) {
      try {
        const owner = await nftContract.ownerOf(i);
        if (owner.toLowerCase() === address.toLowerCase()) {
          const typeId = await nftContract.getNFTType(i);
          if (typeId === passType) {
            targetTokenId = i;
            break;
          }
        }
      } catch (e) {
        if (e.message && e.message.includes('nonexistent')) break;
      }
    }

    if (!targetTokenId) {
      triggerToast("No VIP Pass found in your wallet!", "error");
      return;
    }

    triggerToast("Burning VIP Pass... Confirm in MetaMask", "success");
    const tx = await nftContract.burn(targetTokenId);
    await tx.wait();

    const daysToAdd = passType === 'nft_vip_pass_yearly' ? 365 : 30;
    
    let baseTime = Date.now();
    if (appState.isVipActive() && appState.state.vipUntil) {
      baseTime = new Date(appState.state.vipUntil).getTime();
    }
    
    const newVipUntil = new Date(baseTime + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
    
    if (window.supabase) {
      await window.supabase.from('users').update({ vip_until: newVipUntil }).eq('wallet_address', address.toLowerCase());
    }
    
    appState.update({ vipUntil: newVipUntil });
    appState.addActivity('You', 'activated VIP Pass', `+${daysToAdd} Days VIP`);
    triggerToast(`VIP Pass Activated Successfully! (+${daysToAdd} Days)`, "success");
    sfx.playSuccess();
    
    getOwnedNftsFromChain(address).then(list => {
      appState.update({ ownedNfts: list });
      renderNftInventory();
    });
  } catch(err) {
    console.error(err);
    triggerToast("Failed to activate VIP pass", "error");
  }
}

// --- Mystery Box Logic ---

export async function buyPgtMysteryBox() {
  if (appState.state.balancePgt < 1000) {
    triggerToast("Insufficient PGT balance! (Requires 1,000 PGT)", "error");
    return;
  }

  const client = supabase || window.supabaseClient;
  if (!client || !appState.state.walletConnected || !appState.state.walletAddress) {
    triggerToast("Please connect your wallet to open Mystery Crates!", "error");
    return;
  }

  openModal('mystery-box');
  const animContainer = document.getElementById('mystery-box-anim-container');
  const resultContent = document.getElementById('mystery-box-result-content');
  if (animContainer) animContainer.style.display = 'block';
  if (resultContent) resultContent.style.display = 'none';

  try {
    const { data, error } = await client.rpc('open_pgt_mystery_box', {
      p_wallet: appState.state.walletAddress.toLowerCase()
    });

    if (error) throw error;

    if (data && data.success) {
      setTimeout(() => {
        showMysteryBoxResult(data);
      }, 1500);
    } else {
      closeModal('mystery-box');
      triggerToast("Opening failed: " + (data?.error || "Unknown error"), "error");
    }
  } catch (err) {
    console.error("PGT Mystery Box failed:", err);
    closeModal('mystery-box');
    triggerToast("Opening failed: " + (err.message || err), "error");
  }
}

export async function buyPolMysteryBox() {
  let signer = realSigner;

  // If state is not connected, attempt quick web3 connect directly
  if (!appState.state.walletConnected || !appState.state.walletAddress || !signer) {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          const address = accounts[0];
          const provider = new window.ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();

          const balWei = await provider.getBalance(address);
          const polBal = parseFloat(window.ethers.formatEther(balWei));

          appState.update({
            walletConnected: true,
            walletProvider: 'metamask',
            walletAddress: address,
            balanceMatic: polBal
          });
        }
      } catch (err) {
        console.error("Auto-connect failed:", err);
        openModal('wallet');
        triggerToast("Please connect your Web3 wallet to open POL Crates!", "error");
        return;
      }
    } else {
      openModal('wallet');
      triggerToast("Please connect your Web3 wallet to open POL Crates!", "error");
      return;
    }
  }

  if (!signer) {
    triggerToast("Please connect MetaMask on Polygon to send POL payments!", "error");
    return;
  }

  // Refetch live balance to ensure accuracy
  if (window.ethereum && appState.state.walletAddress) {
    try {
      const provider = new window.ethers.BrowserProvider(window.ethereum);
      const balWei = await provider.getBalance(appState.state.walletAddress);
      appState.state.balanceMatic = parseFloat(window.ethers.formatEther(balWei));
    } catch (e) {}
  }

  if (appState.state.balanceMatic < 50) {
    triggerToast(`Insufficient POL balance! (Requires 50 POL, You have ${appState.state.balanceMatic.toFixed(2)} POL)`, "error");
    return;
  }

  try {
    triggerToast("Confirming 50 POL transaction in wallet...", "success");

    const receiver = "0x14791697260E4c9A71f18484C9f997B308e59325";
    const tx = await signer.sendTransaction({
      to: receiver,
      value: window.ethers.parseEther("50.0")
    });

    triggerToast("POL Payment Pending... Opening Crate!", "success");
    openModal('mystery-box');
    const animContainer = document.getElementById('mystery-box-anim-container');
    const resultContent = document.getElementById('mystery-box-result-content');
    if (animContainer) animContainer.style.display = 'block';
    if (resultContent) resultContent.style.display = 'none';

    await tx.wait();

    const client = supabase || window.supabaseClient;
    if (client) {
      const { data, error } = await client.rpc('open_pol_mystery_box', {
        p_wallet: appState.state.walletAddress.toLowerCase(),
        p_tx_hash: tx.hash
      });

      if (data && data.success) {
        setTimeout(() => {
          showMysteryBoxResult(data);
        }, 1500);
      } else {
        closeModal('mystery-box');
        triggerToast("Crate processing error: " + (data?.error || "Success!"), "error");
      }
    }
  } catch (err) {
    console.error("POL Mystery Box failed:", err);
    closeModal('mystery-box');
    triggerToast("POL Crate failed: " + (err.reason || err.message || err), "error");
  }
}

function showMysteryBoxResult(data) {
  const animContainer = document.getElementById('mystery-box-anim-container');
  const resultContent = document.getElementById('mystery-box-result-content');
  const icon = document.getElementById('mystery-reward-icon');
  const title = document.getElementById('mystery-reward-title');
  const desc = document.getElementById('mystery-reward-desc');

  if (animContainer) animContainer.style.display = 'none';
  if (resultContent) resultContent.style.display = 'block';

  if (data.won_nft) {
    const nft = NFT_REGISTRY.find(n => n.id === data.won_nft);
    const nftName = nft ? nft.name : data.won_nft;
    if (icon) icon.innerText = "💎";
    if (title) {
      title.innerText = "LEGENDARY NFT UNLOCKED!";
      title.style.color = "var(--color-warning)";
    }
    if (desc) desc.innerHTML = `You unboxed a rare Utility Core: <strong style="color:var(--color-primary);">${nftName}</strong>!<br>It has been added to your NFT Backpack.<br><button class="btn-primary" style="margin-top:1rem; padding:0.6rem 1.2rem;" onclick="closeModal('mystery-box'); switchNftView('inventory');">Open NFT Backpack 🎒</button>`;
    sfx.playSuccess();
    appState.addActivity('You', `unboxed Legendary NFT ${nftName}`, `🎉 ${nftName}`);
    
    const crates = [...(appState.state.crateNfts || [])];
    crates.push(data.won_nft);
    appState.update({ crateNfts: crates });
    renderNftInventory();
  } else {
    const pgt = data.reward_pgt || 0;
    if (icon) icon.innerText = pgt >= 1000 ? "🎉" : "🪙";
    if (title) {
      title.innerText = pgt >= 1000 ? "MEGA PGT PROFIT!" : "PGT LOOT UNBOXED!";
      title.style.color = pgt >= 1000 ? "var(--color-accent)" : "var(--color-primary)";
    }
    if (desc) desc.innerHTML = `You received <strong style="color:var(--color-primary); font-size:1.3rem;">+${pgt} PGT</strong> directly into your account!`;
    sfx.playSuccess();
    appState.addActivity('You', `unboxed Cyber Crate`, `+${pgt} PGT`);

    if (data.new_balance) {
      appState.update({ balancePgt: data.new_balance });
    }
  }
}

window.switchNftView = switchNftView;
window.purchaseNft = purchaseNft;
window.toggleEquipNft = toggleEquipNft;
window.activateVipPass = activateVipPass;
window.buyPgtMysteryBox = buyPgtMysteryBox;
window.buyPolMysteryBox = buyPolMysteryBox;

