import { realSigner, NFT_CONTRACT_ADDRESS } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { triggerToast } from '../core/ui.js';
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
  }
];

export function renderNftMarketplace() {
  const grid = document.getElementById('nft-market-grid');
  if (!grid) return;
  
  grid.innerHTML = `
    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-primary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">⚡ Faucet Boost Cores</h3>
    </div>
    <div id="nft-group-faucet" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 2rem;"></div>

    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-accent); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">🎮 Game Multiplier Cores</h3>
    </div>
    <div id="nft-group-game" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 2rem;"></div>

    <div style="grid-column: 1/-1; margin-bottom: 1rem;">
      <h3 style="color: var(--color-secondary); border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">🔗 Referral Multiplier Cores</h3>
    </div>
    <div id="nft-group-referral" class="nft-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; grid-column: 1/-1; margin-bottom: 1rem;"></div>
  `;

  const faucetContainer = document.getElementById('nft-group-faucet');
  const gameContainer = document.getElementById('nft-group-game');
  const referralContainer = document.getElementById('nft-group-referral');

  NFT_REGISTRY.forEach(nft => {
    const isOwned = appState.state.ownedNfts.includes(nft.id);
    
    // Calculate boost textual representation
    let bonuses = [];
    if (nft.faucetBoost > 0) bonuses.push(`Faucet claim +${nft.faucetBoost}%`);
    if (nft.gameMultiplier > 0) bonuses.push(`Arcade score +${nft.gameMultiplier}%`);
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
        <div class="nft-art-svg">${nft.svg}</div>
        <span class="nft-rarity-badge rarity-${nft.rarity}">${nft.rarity}</span>
      </div>
      <div class="nft-details">
        <h4 class="nft-name">${nft.name}</h4>
        <p style="font-size:0.8rem; color:var(--text-dim); line-height:1.3; min-height:35px;">${nft.description}</p>
        <div class="nft-bonus">
          ${bonuses.map(b => `<span>🚀 ${b}</span>`).join('<br>')}
        </div>
        <div class="nft-buy-footer">
          <span class="nft-price">${nft.price.toFixed(2)} POL</span>
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
    }
  });
}

export function renderNftInventory() {
  const grid = document.getElementById('nft-inventory-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  const ownedIds = appState.state.ownedNfts;

  if (ownedIds.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 0; color: var(--text-dim);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎒</div>
        Your NFT backpack is empty. Buy utility cores in the marketplace to unlock massive boosts.
      </div>
    `;
    return;
  }

  ownedIds.forEach(nftId => {
    const nft = NFT_REGISTRY.find(n => n.id === nftId);
    if (!nft) return;

    const isEquipped = appState.state.equippedNft === nftId;
    let bonuses = [];
    if (nft.faucetBoost > 0) bonuses.push(`Faucet claim +${nft.faucetBoost}%`);
    if (nft.gameMultiplier > 0) bonuses.push(`Arcade score +${nft.gameMultiplier}%`);
    if (nft.stakingBoost > 0) bonuses.push(`Staking APY +${nft.stakingBoost}%`);
    if (nft.referralMultiplier > 1.0) {
      const pct = Math.round((nft.referralMultiplier - 1.0) * 100);
      bonuses.push(`Referral rewards +${pct}%`);
    }

    const card = document.createElement('div');
    card.className = `nft-card rarity-${nft.rarity} ${isEquipped ? 'active-equipped' : ''}`;
    card.innerHTML = `
      <div class="nft-art-container">
        <div class="nft-art-bg" style="background-color: var(--border-color-rarity);"></div>
        <div class="nft-art-svg">${nft.svg}</div>
        <span class="nft-rarity-badge rarity-${nft.rarity}">${nft.rarity}</span>
      </div>
      <div class="nft-details">
        <h4 class="nft-name">${nft.name}</h4>
        <div class="nft-bonus">
          ${bonuses.map(b => `<span>🚀 ${b}</span>`).join('<br>')}
        </div>
        <div class="nft-buy-footer" style="border:none; padding-top:0.5rem; margin-top:0.5rem;">
          <span style="font-size: 0.8rem; font-weight: 700; color: ${isEquipped ? 'var(--color-accent)' : 'var(--text-dim)'}">
            ${isEquipped ? '● Equipped Active' : '○ Locked in Bag'}
          </span>
          <button class="btn-nft-action" onclick="toggleEquipNft('${nft.id}')">
            ${isEquipped ? 'Unequip' : 'Equip Core'}
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
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
    triggerToast("Please deploy the NFT contract and paste the address in app.js!", "error");
    return;
  }

  try {
    // 2. Validate MATIC balance
    if (appState.state.balanceMatic < nft.price) {
      triggerToast(`Insufficient MATIC balance (Requires ${nft.price} MATIC)`, "error");
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
    appState.addActivity('You', `purchased ${nft.name} NFT on-chain`, `-${nft.price} MATIC`);
    
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
window.switchNftView = switchNftView;
window.purchaseNft = purchaseNft;
window.toggleEquipNft = toggleEquipNft;

