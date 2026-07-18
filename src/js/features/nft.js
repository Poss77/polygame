import { realSigner, NFT_CONTRACT_ADDRESS } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { triggerToast } from '../core/ui.js';
import { getOwnedNftsFromChain } from './roshambo.js';

// --- Static NFT Cards Registry ---

export const NFT_REGISTRY = [
  // --- NFT Marketplace & Inventory rendering ---

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
      "function buyUtilityNFT(string memory nftTypeId, string memory tokenURI_) external payable returns (uint256)"
    ], realSigner);

    triggerToast(`Buying ${nft.name}... Confirm in MetaMask`, "success");

    const tokenURI = `https://polygame.xyz/metadata/${nftId}.json`;
    const priceWei = ethers.parseEther(nft.price.toString());

    const tx = await nftContract.buyUtilityNFT(nftId, tokenURI, {
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

