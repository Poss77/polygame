// ============================================================
// POLYGAME: USER PROFILE, WALLET INTEGRATION & AMBASSADOR VIEW
// Re-exports leaderboards.js & holders.js for 100% backward compatibility
// ============================================================

export * from './leaderboards.js';
export * from './holders.js';

import { ARCADE_GAMES_REGISTRY, ARCADE_GAMES_LIST } from '../core/games-registry.js';
import { hasValidWeb3Session } from '../core/auth-web3.js';
import { supabase, ADMIN_WALLET_ADDRESS, TOKEN_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS, web3Provider } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { NFT_REGISTRY } from './nft.js';
import { appState } from '../core/state.js';
import { triggerToast, connectWeb3, escapeHtml } from '../core/ui.js';
import { renderRelicsVault, hydrateAndRenderRelicsVault, getSeason1Progress, getRelicMeta, mergeRelicsObjects } from './relics.js';
import { formatLeaderboardName, getLeaderboardStarshipBadge, loadAstroDodgeLeaderboard } from './leaderboards.js';

// --- USER PROFILE & PGT LEADERBOARD LOGIC ---


// Fetch Username mapped to connected address
export function getActiveUsername() {
  if (!appState || !appState.state) {
    return "Anonymous Player";
  }
  
  // 1. Highest priority: Verified database username in appState
  if (appState.state.username && appState.state.username.trim() !== '') {
    return appState.state.username.trim();
  }

  // 2. Second priority: Local storage lookup across all linked identifiers
  const primaryAddr = (appState.state.walletAddress || '').toLowerCase();
  const linkedAddr = (appState.state.linkedWalletAddress || '').toLowerCase();
  const pid = (appState.state.playerId || '').toLowerCase();

  const saved = (primaryAddr && localStorage.getItem(`polygame_username_${primaryAddr}`)) ||
                (linkedAddr && localStorage.getItem(`polygame_username_${linkedAddr}`)) ||
                (pid && localStorage.getItem(`polygame_username_${pid}`));
  if (saved && saved.trim() !== '') return saved.trim();

  // 3. Third priority: Google Auth name/email prefix
  if (appState.state.authUserEmail) {
    return appState.state.authUserEmail.split('@')[0];
  }

  // 4. Default short address tag
  const isInternal = (addr) => !addr || addr.startsWith('0xpgt') || addr.startsWith('0xg');
  const realWeb3 = (linkedAddr && linkedAddr.length >= 42 && !isInternal(linkedAddr)) ? linkedAddr : (!isInternal(primaryAddr) ? primaryAddr : null);
  if (realWeb3 && realWeb3.length >= 42) {
    return `Player_${realWeb3.substring(0, 6)}...${realWeb3.substring(realWeb3.length - 4)}`;
  }
  return pid ? `Player_${pid.substring(pid.length >= 6 ? pid.length - 4 : 2)}` : "Anonymous Player";
}

// --- Web3 Control & Profile Actions (v1.4.497) ---

export function copyProfileAddress() {
  const linked = appState?.state?.linkedWalletAddress;
  const primary = appState?.state?.walletAddress;
  const pid = appState?.state?.playerId;
  const isInternal = (addr) => !addr || addr.startsWith('0xpgt') || addr.startsWith('0xg');
  const targetAddr = (linked && !isInternal(linked)) ? linked : (!isInternal(primary) ? primary : (linked || primary || pid || ''));
  
  if (!targetAddr) {
    triggerToast("No linked wallet address to copy", "warning");
    return;
  }

  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(targetAddr).then(() => {
      triggerToast(`📋 Address copied: ${targetAddr.substring(0, 6)}...${targetAddr.substring(targetAddr.length - 4)}`, "success");
      if (sfx) sfx.play('click');
    }).catch(() => {
      triggerToast("Clipboard copy failed", "error");
    });
  } else {
    // Fallback for non-https / mobile webviews
    const tempInput = document.createElement('input');
    tempInput.value = targetAddr;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    triggerToast(`📋 Address copied: ${targetAddr.substring(0, 6)}...${targetAddr.substring(targetAddr.length - 4)}`, "success");
    if (sfx) sfx.play('click');
  }
}
window.copyProfileAddress = copyProfileAddress;

export function openPolygonScan() {
  const linked = appState?.state?.linkedWalletAddress;
  const primary = appState?.state?.walletAddress;
  const isInternal = (addr) => !addr || addr.startsWith('0xpgt') || addr.startsWith('0xg');
  const realWeb3 = (linked && !isInternal(linked)) ? linked : (!isInternal(primary) ? primary : null);

  if (!realWeb3 || realWeb3.length < 42) {
    triggerToast("Connect or link a Web3 wallet first to inspect on PolygonScan!", "warning");
    return;
  }
  window.open(`https://polygonscan.com/address/${realWeb3}`, '_blank');
}
window.openPolygonScan = openPolygonScan;

export async function addNftToMetaMask() {
  const nftAddr = NFT_CONTRACT_ADDRESS || "0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8";
  try {
    triggerToast("Opening PolygonScan NFT Contract Explorer...", "info");
    window.open(`https://polygonscan.com/token/${nftAddr}`, '_blank');
  } catch (e) {
    console.error("NFT Explorer error:", e);
  }
}
window.addNftToMetaMask = addNftToMetaMask;

// Sync values inside Profile view
export function syncProfileView() {
  if (!appState || !appState.state) return;

  // Toggle Master Admin Control Panel Card & Nav
  const adminCard = document.getElementById('profile-admin-card');
  const adminNav = document.getElementById('nav-item-admin');
  const adminPanel = document.getElementById('view-admin');
  const expectedAdmin = (ADMIN_WALLET_ADDRESS || "0x10b9993990c9ef8a212c9557cb02ad94da9a654d").toLowerCase();
  const injected = (typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.selectedAddress === 'string' ? window.ethereum.selectedAddress : '').toLowerCase();
  const isAdmin = (injected && injected === expectedAdmin);

  if (adminCard) {
    if (isAdmin) {
      adminCard.style.display = 'block';
    } else {
      adminCard.style.setProperty('display', 'none', 'important');
    }
  }
  if (adminNav) {
    if (isAdmin) {
      adminNav.classList.add('admin-unlocked');
      adminNav.style.display = '';
    } else {
      adminNav.classList.remove('admin-unlocked');
      adminNav.style.setProperty('display', 'none', 'important');
    }
  }
  if (adminPanel) {
    if (isAdmin) {
      adminPanel.classList.add('admin-authorized');
      adminPanel.style.display = '';
    } else {
      adminPanel.classList.remove('admin-authorized');
      adminPanel.classList.remove('active');
      adminPanel.style.setProperty('display', 'none', 'important');
    }
  }

  // Toggle Banned / Suspended Account Banner (PLAN-014)
  const bannedBanner = document.getElementById('profile-banned-banner');
  if (bannedBanner) {
    const isBanned = Boolean(appState.state.isBanned || appState.state.is_banned);
    bannedBanner.style.display = isBanned ? 'block' : 'none';
  }

  const profileNameInput = document.getElementById('profile-name-input');
  if (profileNameInput && document.activeElement !== profileNameInput) {
    profileNameInput.value = getActiveUsername();
  }

  // --- 1. Financial Wealth Breakdown (Item 4) ---
  const availableBal = parseFloat(appState.state.balancePgt || 0);
  let totalStaked = 0;
  (appState.state.stakes || []).forEach(s => {
    totalStaked += parseFloat(s.amount || 0);
  });
  if (totalStaked === 0 && appState.state.stakedBalancePgt) {
    totalStaked = parseFloat(appState.state.stakedBalancePgt || 0);
  }
  const unclaimedPgt = parseFloat(appState.state.unclaimedReferralPgt || 0);
  const unclaimedPol = parseFloat(appState.state.totalReferralPol || appState.state.unclaimedReferralPol || 0);
  const totalNetWorth = availableBal + totalStaked + unclaimedPgt;

  const wealthAvailEl = document.getElementById('profile-wealth-available');
  const wealthStakedEl = document.getElementById('profile-wealth-staked');
  const wealthUnclaimedEl = document.getElementById('profile-wealth-unclaimed');
  const wealthUnclaimedSubEl = document.getElementById('profile-wealth-unclaimed-sub');
  const wealthNetWorthEl = document.getElementById('profile-wealth-networth');

  if (wealthAvailEl) wealthAvailEl.innerText = `${availableBal.toLocaleString([], {minimumFractionDigits: 2, maximumFractionDigits: 2})} PGT`;
  if (wealthStakedEl) wealthStakedEl.innerText = `${totalStaked.toLocaleString([], {minimumFractionDigits: 2, maximumFractionDigits: 2})} PGT`;
  if (wealthUnclaimedEl) wealthUnclaimedEl.innerText = `${unclaimedPgt.toLocaleString([], {minimumFractionDigits: 2, maximumFractionDigits: 2})} PGT`;
  if (wealthUnclaimedSubEl) wealthUnclaimedSubEl.innerText = `${unclaimedPol.toFixed(4)} POL available`;
  if (wealthNetWorthEl) wealthNetWorthEl.innerText = `${totalNetWorth.toLocaleString([], {minimumFractionDigits: 2, maximumFractionDigits: 2})} PGT`;

  // --- 2. Comprehensive Career Arcade Scorecards (via ARCADE_GAMES_LIST) ---
  for (const g of ARCADE_GAMES_LIST) {
    const weekly = (g.key === 'stacker')
      ? (appState.state.stackerHighScore || appState.state.catcherHighScore || 0)
      : (appState.state[g.stateScoreKey] || 0);
    const career = (g.key === 'stacker')
      ? Math.max(appState.state.alltimeStackerHighScore || 0, appState.state.stackerHighScore || 0, appState.state.alltimeCatcherHighScore || 0, appState.state.catcherHighScore || 0)
      : Math.max(appState.state[g.careerKey] || 0, weekly);
    const scoreEl = document.getElementById(g.profileScoreElId);
    const weeklyEl = document.getElementById(g.profileWeeklyElId);
    if (scoreEl) scoreEl.innerText = career.toLocaleString();
    if (weeklyEl) weeklyEl.innerText = weekly.toLocaleString();
  }

  // PolySpace Fleet Operations
  const spacePowerEl = document.getElementById('profile-space-power');
  const spaceUpgradesEl = document.getElementById('profile-space-upgrades');
  const spaceMinedEl = document.getElementById('profile-space-mined');
  const spaceState = appState.state.spaceState || {};

  if (spacePowerEl) spacePowerEl.innerText = (spaceState.fleetPower || 100).toLocaleString();
  if (spaceUpgradesEl) {
    const maxMod = Math.max(spaceState.warpLevel || 1, spaceState.laserLevel || 1, spaceState.cargoLevel || 1, spaceState.shieldLevel || 1, spaceState.turretLevel || 1);
    spaceUpgradesEl.innerText = `Lv. ${maxMod}`;
  }
  if (spaceMinedEl) {
    const totalMined = spaceState.mineralsMinedTotal || ((spaceState.iron || 0) + (spaceState.titanium || 0) + (spaceState.quantum || 0) + (spaceState.pgtOre || 0));
    spaceMinedEl.innerText = totalMined.toLocaleString();
  }

  // Daily Operations
  const faucetTotalEl = document.getElementById('profile-faucet-total');
  const faucetStreakEl = document.getElementById('profile-faucet-streak');
  const questsCompletedEl = document.getElementById('profile-quests-completed');

  if (faucetTotalEl) faucetTotalEl.innerText = (appState.state.totalClaims || 0).toLocaleString();
  if (faucetStreakEl) faucetStreakEl.innerText = `${appState.state.claimStreak || 0} Days`;
  const arcadeTotalEl = document.getElementById('profile-total-arcade-plays');
  if (arcadeTotalEl) arcadeTotalEl.innerText = (appState.state.totalArcadePlays || 0).toLocaleString();
  if (questsCompletedEl) {
    let q = (typeof window.getUserQuests === 'function')
      ? window.getUserQuests()
      : (appState.state.dailyQuests || {});

    let done = 0;
    if (typeof window.getCompletedQuestsCount === 'function') {
      done = window.getCompletedQuestsCount(q);
    } else {
      const gamesDone = (q.games || 0) >= 3 || !!q.games_claimed || !!q.arcade_claimed || (q.arcade_wins || 0) >= 3;
      const miningDone = (q.mining || 0) >= 3 || !!q.mining_claimed || (q.mining_ops || 0) >= 3;
      const winsDone = (q.wins || 0) >= 3 || !!q.wins_claimed || !!q.wager_claimed || (q.wager_count || 0) >= 3;
      done = (gamesDone ? 1 : 0) + (miningDone ? 1 : 0) + (winsDone ? 1 : 0);
    }

    questsCompletedEl.innerText = `${done} / 3`;
    questsCompletedEl.style.color = (done >= 3) ? 'var(--color-success)' : 'var(--color-primary)';
  }

  // --- 3. Equipped Utility NFT Core & Combined Multipliers (Item 5) ---
  const nftAvatarFrame = document.getElementById('profile-nft-avatar-frame');
  const nftNameEl = document.getElementById('profile-nft-name');
  const nftRarityBadge = document.getElementById('profile-nft-rarity-badge');
  const nftDescEl = document.getElementById('profile-nft-desc');

  const multFaucetEl = document.getElementById('profile-mult-faucet');
  const multArcadeEl = document.getElementById('profile-mult-arcade');
  const multReferralEl = document.getElementById('profile-mult-referral');
  const multStakingEl = document.getElementById('profile-mult-staking');
  const multLeaderboardEl = document.getElementById('profile-mult-leaderboard');

  const chipFaucet = document.getElementById('chip-mult-faucet');
  const chipArcade = document.getElementById('chip-mult-arcade');
  const chipReferral = document.getElementById('chip-mult-referral');
  const chipStaking = document.getElementById('chip-mult-staking');
  const chipLeaderboard = document.getElementById('chip-mult-leaderboard');

  const isVip = !!(window.appState && window.appState.isVipActive ? window.appState.isVipActive() : (appState.state.vipUntil && new Date(appState.state.vipUntil).getTime() > Date.now()));
  const isAmbassador = !!appState.state.isAmbassador;

  let equippedNftObj = null;
  if (appState.state.equippedNft) {
    equippedNftObj = NFT_REGISTRY.find(n => n.id === appState.state.equippedNft) || null;
  }

  if (equippedNftObj) {
    if (nftAvatarFrame) {
      nftAvatarFrame.innerHTML = `
        <img src="metadata/images/${equippedNftObj.id}.png" alt="${equippedNftObj.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="window.handleNftImageError(this, '${equippedNftObj.id}')" />
      `;
    }
    if (nftNameEl) nftNameEl.innerText = equippedNftObj.name;
    if (nftRarityBadge) {
      const rarity = (equippedNftObj.rarity || 'common').toUpperCase();
      nftRarityBadge.innerText = rarity;
      nftRarityBadge.style.background = (rarity === 'EPIC' || rarity === 'LEGENDARY') ? 'rgba(255, 0, 255, 0.2)' : 'rgba(0, 240, 255, 0.2)';
      nftRarityBadge.style.color = (rarity === 'EPIC' || rarity === 'LEGENDARY') ? '#ff00ff' : 'var(--color-primary)';
    }
    if (nftDescEl) nftDescEl.innerText = equippedNftObj.description || 'Active utility core amplifier.';
  } else {
    if (nftAvatarFrame) nftAvatarFrame.innerHTML = '<span style="font-size: 2rem;">🎨</span>';
    if (nftNameEl) nftNameEl.innerText = 'No NFT Core Equipped';
    if (nftRarityBadge) {
      nftRarityBadge.innerText = 'INACTIVE';
      nftRarityBadge.style.background = 'rgba(255, 255, 255, 0.1)';
      nftRarityBadge.style.color = 'var(--text-muted)';
    }
    if (nftDescEl) nftDescEl.innerText = 'Equip a booster NFT from your backpack to amplify your faucet rewards, arcade payouts, and referral yields.';
  }

  // Calculate Combined Multipliers across Active Utility NFTs, VIP status, Ambassador status, and Whale tiers
  const multis = window.appState ? window.appState.getMultipliers() : {};

  // 1. FAUCET MULTIPLIER:
  // Base x (1 + Total Boost% [NFT + Streak + Referral]) x (1FLR Whale 1.15) x (1Y PGT Staker 1.10-1.30) x (Onchain PGT Whale 1.10) x (VIP 2.0) x (Ambassador 2.0)
  const is1FlrWhale = ((appState.state.onchainBalance1flr || 0) >= 5000000);
  const pgtStakerMult = typeof appState.getStakedPgtMultiplier === 'function' ? appState.getStakedPgtMultiplier() : 1.0;
  const isPgtOnchainWhale = (appState.state.onchainBalancePgt || 0) >= 1000000;

  const faucetBoostPct = multis.totalFaucetBoostPercent !== undefined ? multis.totalFaucetBoostPercent : (multis.nftFaucetBoost || (equippedNftObj ? (equippedNftObj.faucetBoost || 0) : 0));
  let totalFaucetMult = (1 + faucetBoostPct / 100);
  const isApex = !!multis.isApexUnlocked;
  const apexMult = multis.apexMultiplier || 1.0;

  const vipLevel = (typeof appState.getVipLevel === 'function') ? appState.getVipLevel() : 2;
  const vipFaucetFactor = isVip ? (vipLevel >= 2 ? 2.5 : 1.5) : 1.0;
  const vipArcadeFactor = isVip ? (vipLevel >= 2 ? 2.0 : 1.5) : 1.0;
  const vipReferralFactor = isVip ? (vipLevel >= 2 ? 2.0 : 1.2) : 1.0;
  const vipStakingFactor = isVip ? (vipLevel >= 2 ? 2.0 : 1.25) : 1.0;

  if (is1FlrWhale) totalFaucetMult *= 1.15;
  if (pgtStakerMult > 1.0) totalFaucetMult *= pgtStakerMult;
  if (isPgtOnchainWhale) totalFaucetMult *= 1.10;
  totalFaucetMult *= vipFaucetFactor;
  if (isAmbassador) totalFaucetMult *= 2.0;
  if (isApex) totalFaucetMult *= apexMult;

  // 2. ARCADE MULTIPLIER:
  // (1 + NFT Game Boost%) x (VIP factor) x (Ambassador 2.0) x (Apex 1.5)
  const nftArcadePct = multis.nftGameMultiplier !== undefined ? multis.nftGameMultiplier : (equippedNftObj ? (equippedNftObj.gameMultiplier || 0) : 0);
  let totalArcadeMult = (1 + nftArcadePct / 100);
  totalArcadeMult *= vipArcadeFactor;
  if (isAmbassador) totalArcadeMult *= 2.0;
  if (isApex) totalArcadeMult *= apexMult;

  // 3. REFERRAL COMMISSION MULTIPLIER:
  // (NFT Referral Multiplier) x (Ambassador 1.5) x (VIP factor)
  const nftRefMult = (multis.rawNftReferralMultiplier || multis.nftReferralMultiplier) !== undefined ? (multis.rawNftReferralMultiplier || multis.nftReferralMultiplier) : (equippedNftObj ? (equippedNftObj.referralMultiplier || 1.0) : 1.0);
  let totalReferralMult = nftRefMult * (isAmbassador ? 1.5 : 1.0) * vipReferralFactor;

  // 4. STAKING APY BOOST MULTIPLIER:
  // (NFT Staking Boost) x (Ambassador 1.10) x (VIP factor)
  const nftStakingBoost = multis.nftStakingBoost !== undefined ? multis.nftStakingBoost : (equippedNftObj ? (1 + (equippedNftObj.stakingBoost || 0) / 100) : 1.0);
  let totalStakingMult = nftStakingBoost * (isAmbassador ? 1.10 : 1.0) * vipStakingFactor;

  // 5. LEADERBOARD MULTIPLIER:
  // (NFT Leaderboard Multiplier) x (VIP factor: Gold 2.0x / Silver 1.25x)
  const nftLbMult = multis.nftLeaderboardMultiplier !== undefined ? multis.nftLeaderboardMultiplier : (equippedNftObj ? (equippedNftObj.leaderboardMultiplier || 1.0) : 1.0);
  const vipLbFactor = isVip ? (vipLevel >= 2 ? 2.0 : 1.25) : 1.0;
  let totalLeaderboardMult = multis.totalLeaderboardMultiplier !== undefined ? multis.totalLeaderboardMultiplier : parseFloat((nftLbMult * vipLbFactor).toFixed(2));

  if (multFaucetEl) multFaucetEl.innerText = `${totalFaucetMult.toFixed(totalFaucetMult % 1 === 0 ? 1 : 2)}x`;
  if (multArcadeEl) multArcadeEl.innerText = `${totalArcadeMult.toFixed(totalArcadeMult % 1 === 0 ? 1 : 2)}x`;
  if (multReferralEl) multReferralEl.innerText = `${totalReferralMult.toFixed(totalReferralMult % 1 === 0 ? 1 : 2)}x`;
  if (multStakingEl) multStakingEl.innerText = `${totalStakingMult.toFixed(totalStakingMult % 1 === 0 ? 1 : 2)}x`;
  if (multLeaderboardEl) multLeaderboardEl.innerText = `${totalLeaderboardMult.toFixed(totalLeaderboardMult % 1 === 0 ? 1 : 2)}x`;

  if (chipFaucet) chipFaucet.classList.toggle('active', totalFaucetMult > 1.0);
  if (chipArcade) chipArcade.classList.toggle('active', totalArcadeMult > 1.0);
  if (chipReferral) chipReferral.classList.toggle('active', totalReferralMult > 1.0);
  if (chipStaking) chipStaking.classList.toggle('active', totalStakingMult > 1.0);
  if (chipLeaderboard) chipLeaderboard.classList.toggle('active', totalLeaderboardMult > 1.0);

  // Sync Relics Progress Badge & Vault Content
  const relicProgressBadge = document.getElementById('relics-progress-badge');
  if (relicProgressBadge) {
    const s1Prog = getSeason1Progress(appState.state.relics || {});
    relicProgressBadge.innerText = `${s1Prog.ownedCount}/${s1Prog.totalCount}`;
  }
  if (typeof hydrateAndRenderRelicsVault === 'function') {
    hydrateAndRenderRelicsVault();
  } else if (typeof renderRelicsVault === 'function') {
    renderRelicsVault();
  }

  // --- 4. Web3 Wallet & Authentication Details (Item 4) ---
  const googleStatusEl = document.getElementById('profile-auth-google');
  const web3StatusEl = document.getElementById('profile-auth-web3');
  const linkedAddrEl = document.getElementById('profile-linked-address');
  const linkGoogleBtn = document.getElementById('btn-profile-link-google');

  const isGoogleConnected = !!(appState.state.authUserEmail || (appState.state.authProvider === 'google'));

  if (googleStatusEl) {
    if (appState.state.authUserEmail) {
      googleStatusEl.innerText = `Connected (${appState.state.authUserEmail})`;
      googleStatusEl.style.color = "var(--color-accent)";
      if (linkGoogleBtn) linkGoogleBtn.style.display = "none";
    } else if (isGoogleConnected) {
      googleStatusEl.innerText = "Connected (Google Account)";
      googleStatusEl.style.color = "var(--color-accent)";
      if (linkGoogleBtn) linkGoogleBtn.style.display = "none";
    } else {
      googleStatusEl.innerText = "Not Connected";
      googleStatusEl.style.color = "var(--text-muted)";
      if (linkGoogleBtn) linkGoogleBtn.style.display = "inline-block";
    }
  }

  const linked = appState.state.linkedWalletAddress;
  const primary = appState.state.walletAddress;
  const isInternal = (addr) => !addr || addr.startsWith('0xpgt') || addr.startsWith('0xg');
  const realWeb3 = (linked && !isInternal(linked)) ? linked : (!isInternal(primary) ? primary : null);

  const linkWeb3Btn = document.getElementById('btn-profile-connect-web3');

  if (web3StatusEl) {
    const hasActiveSigner = !!(window.realSigner && window.web3Provider && appState.state.walletConnected);
    if (realWeb3 && realWeb3.length >= 42 && hasActiveSigner) {
      let provStr = appState.state.walletProvider || 'metamask';
      provStr = provStr.replace('google_linked', 'MetaMask').replace('google', 'MetaMask').toUpperCase();
      web3StatusEl.innerText = `Connected (${provStr})`;
      web3StatusEl.style.color = "var(--color-primary)";
      if (linkWeb3Btn) linkWeb3Btn.style.display = "none";
    } else if (realWeb3 && realWeb3.length >= 42) {
      web3StatusEl.innerText = "Linked (Not Connected this session)";
      web3StatusEl.style.color = "var(--text-muted)";
      if (linkWeb3Btn) {
        linkWeb3Btn.style.display = "inline-block";
        linkWeb3Btn.innerText = "🔗 Connect Wallet";
      }
    } else {
      web3StatusEl.innerText = "Not Connected";
      web3StatusEl.style.color = "var(--text-muted)";
      if (linkWeb3Btn) {
        linkWeb3Btn.style.display = "inline-block";
        linkWeb3Btn.innerText = "🔗 Connect / Link Wallet";
      }
    }
  }

  if (linkedAddrEl) {
    if (realWeb3 && realWeb3.length >= 42) {
      linkedAddrEl.innerText = realWeb3;
      linkedAddrEl.style.color = "var(--color-accent)";
    } else {
      linkedAddrEl.innerText = "No Web3 Wallet Linked (Connect Wallet to link)";
      linkedAddrEl.style.color = "var(--text-muted)";
    }
  }

  // --- 5. Weekly Activity & Tier Progression Hub ---
  try {
    const lastWeekTier = parseInt(appState.state.lastWeeklyActiveTier || 0, 10);
    const activeTierInfo = typeof appState.getActiveTierInfo === 'function' ? appState.getActiveTierInfo(lastWeekTier) : { level: 0, title: 'Dormant', badge: '⚪', color: '#94a3b8', reqText: '0 Faucets, 0 Games', desc: 'No activity recorded last week' };
    
    const iconEl = document.getElementById('profile-active-tier-icon');
    const titleEl = document.getElementById('profile-active-tier-title');
    const reqEl = document.getElementById('profile-active-tier-req');
    const descEl = document.getElementById('profile-active-tier-desc');
    const boxEl = document.getElementById('profile-last-week-tier-box');

    if (iconEl) iconEl.innerText = activeTierInfo.badge || '⚪';
    if (titleEl) {
      titleEl.innerText = `Level ${activeTierInfo.level}: ${activeTierInfo.title}`;
      titleEl.style.color = activeTierInfo.color || '#fff';
    }
    if (reqEl) reqEl.innerText = `Requirement: ${activeTierInfo.reqText}`;
    if (descEl) descEl.innerText = activeTierInfo.desc;
    if (boxEl && activeTierInfo.borderColor) {
      boxEl.style.borderColor = activeTierInfo.borderColor;
      boxEl.style.background = activeTierInfo.bgGradient || 'rgba(255,255,255,0.02)';
    }

    // Current Week Progression
    if (typeof appState.getCurrentWeekProgression === 'function') {
      const prog = appState.getCurrentWeekProgression();
      const tagEl = document.getElementById('profile-projected-tier-tag');
      const liveFaucetsEl = document.getElementById('profile-live-faucets-val');
      const liveGamesEl = document.getElementById('profile-live-games-val');
      const progLabelEl = document.getElementById('profile-progress-label');
      const progPercentEl = document.getElementById('profile-progress-percent');
      const progBarEl = document.getElementById('profile-tier-progress-bar');
      const nextHintEl = document.getElementById('profile-next-tier-hint');

      if (tagEl) {
        tagEl.innerText = `On track for ${prog.currentTierInfo.badge} Level ${prog.currentTier}: ${prog.currentTierInfo.title}`;
        tagEl.style.color = prog.currentTierInfo.color || 'var(--color-primary)';
        tagEl.style.borderColor = prog.currentTierInfo.borderColor || 'var(--border-cyan)';
      }
      if (liveFaucetsEl) {
        liveFaucetsEl.innerHTML = `${prog.faucets} <span style="font-size: 0.78rem; color: var(--text-dim); font-weight: normal;">/ ${prog.targetFaucets}</span>`;
      }
      if (liveGamesEl) {
        liveGamesEl.innerHTML = `${prog.games} <span style="font-size: 0.78rem; color: var(--text-dim); font-weight: normal;">/ ${prog.targetGames}</span>`;
      }
      if (progLabelEl) {
        progLabelEl.innerText = prog.isMaxTier ? 'Apex Mastery Achieved:' : `Progress to Level ${prog.nextTier} (${prog.nextTierInfo.title}):`;
      }
      if (progPercentEl) {
        progPercentEl.innerText = `${prog.overallProgress}%`;
        progPercentEl.style.color = prog.nextTierInfo.color || 'var(--color-primary)';
      }
      if (progBarEl) {
        progBarEl.style.width = `${prog.overallProgress}%`;
        if (prog.nextTierInfo.color) {
          progBarEl.style.background = `linear-gradient(90deg, ${prog.currentTierInfo.color || '#38bdf8'}, ${prog.nextTierInfo.color || '#ffd700'})`;
        }
      }
      if (nextHintEl) {
        if (prog.isMaxTier) {
          nextHintEl.innerHTML = `👑 <strong>Max Weekly Tier Achieved!</strong> You have secured <strong>Level 5: Apex Legend</strong> for next week.`;
        } else {
          const faucetPart = prog.neededFaucets > 0 ? `<strong>${prog.neededFaucets}</strong> more Faucet ${prog.neededFaucets === 1 ? 'claim' : 'claims'}` : ``;
          const gamesPart = prog.neededGames > 0 ? `<strong>${prog.neededGames}</strong> more ${prog.neededGames === 1 ? 'game' : 'games'} played` : ``;
          const joiner = (faucetPart && gamesPart) ? ' and ' : '';
          nextHintEl.innerHTML = `Need ${faucetPart}${joiner}${gamesPart} before Sunday reset to lock in ${prog.nextTierInfo.badge} <strong>Level ${prog.nextTier} (${prog.nextTierInfo.title})</strong>!`;
        }
      }
    }
  } catch (tierErr) {
    console.warn("[syncProfileView] Weekly active tier render warning:", tierErr);
  }

  // Delete Account Danger Zone Shield (Only show for Google Auth users; strictly hide for Web3 and Master Admin)
  const deleteBtn = document.getElementById('btn-delete-account');
  if (deleteBtn) {
    const isMasterAdmin = ((appState?.state?.linkedWalletAddress || appState?.state?.walletAddress || '').toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase());
    const isGoogleAuth = !!(appState?.state?.authUserEmail || (appState?.state?.authProvider === 'google'));
    if (isMasterAdmin || !isGoogleAuth) {
      deleteBtn.style.display = 'none';
    } else {
      deleteBtn.style.display = '';
    }
  }

  syncAmbassadorProfileBadge();
}

// Profile Save button listener
export const btnSaveProfile = document.getElementById('btn-save-profile');
if (btnSaveProfile) {
  btnSaveProfile.addEventListener('click', async () => {
    const input = document.getElementById('profile-name-input');
    if (!input) return;
    
    const nameStr = input.value.trim();
    if (!nameStr) {
      triggerToast("Username cannot be empty!", "error");
      return;
    }

    const primary = (appState.state.walletAddress || '').toLowerCase();
    const linked = (appState.state.linkedWalletAddress || '').toLowerCase();
    const pid = (appState.state.playerId || '').toLowerCase();

    if (primary) localStorage.setItem(`polygame_username_${primary}`, nameStr);
    if (linked) localStorage.setItem(`polygame_username_${linked}`, nameStr);
    if (pid) localStorage.setItem(`polygame_username_${pid}`, nameStr);
    
    appState.update({ username: nameStr });
    appState.saveToDB(); // Persist directly to DB

    // Direct DB update if authenticated via Supabase Auth (zero anon writes on users table)
    if (supabase && supabase.auth && typeof supabase.auth.getSession === 'function') {
      try {
        const { data: sData } = await supabase.auth.getSession();
        const activeAuthUid = sData?.session?.user?.id || null;
        if (activeAuthUid) {
          const canonical = pid || primary;
          if (canonical) {
            await supabase.from('users').update({ username: nameStr }).eq('player_id', canonical);
          } else {
            await supabase.from('users').update({ username: nameStr }).eq('user_id', activeAuthUid);
          }
        }
      } catch (dbErr) {
        console.warn("[btnSaveProfile] DB username sync notice:", dbErr);
      }
    }
    
    triggerToast("Username saved!", "success");
    sfx.playSuccess();

    appState.syncUI();
    
    // Refresh active leaderboard displays
    loadAstroDodgeLeaderboard();
    loadInvadersLeaderboard();
    loadReferralLeaderboard();
    loadHoldersLeaderboard();
    if (window.polySpace && typeof window.polySpace.loadFleetPowerLeaderboard === 'function') {
      window.polySpace.loadFleetPowerLeaderboard();
    }
  });
}
window.setupLeaderboardUI = loadAstroDodgeLeaderboard;

export async function autoConnectWeb3() {
  if (localStorage.getItem('polygame_user_logged_out') === 'true') {
    if (window.POLY_DEBUG) console.log("[autoConnectWeb3] User explicitly logged out. Skipping auto-connect.");
    return;
  }

  // Never trigger asynchronous wallet extension handshakes during real-time gameplay
  if (typeof window !== 'undefined' && typeof window.isAnyArcadeGamePlaying === 'function' && window.isAnyArcadeGamePlaying()) {
    return;
  }

  // If visitor is an unauthenticated guest with no prior session/wallet, skip probing injected extensions
  // This completely eliminates MetaMask 'background-liveness' stream leaks and content-script reflow lag
  const hasPriorSession = Boolean(
    localStorage.getItem('polygame_auth_token') ||
    localStorage.getItem('polygame_web3_session') ||
    (localStorage.getItem('polygame_wallet_address') && !localStorage.getItem('polygame_wallet_address').startsWith('0xguest'))
  );
  if (!hasPriorSession) {
    if (window.POLY_DEBUG) console.log("[autoConnectWeb3] Unauthenticated guest visitor with no prior session. Skipping auto-probe.");
    return;
  }

  // Startup silent check for injected window.ethereum (e.g. inside MetaMask Browser or Desktop extension)
  if (typeof window.ethereum !== 'undefined') {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        const detected = accounts[0].toLowerCase();
        if (hasValidWeb3Session(detected)) {
          if (window.POLY_DEBUG) console.log("[autoConnectWeb3] Injected account with active 7-day session detected on boot:", detected);
          await connectWeb3(true);
          return;
        } else {
          if (window.POLY_DEBUG) console.log("[autoConnectWeb3] Injected account detected but no active 7-day session exists:", detected);
        }
      }
    } catch (e) {
      console.warn("Silent eth_accounts startup check warning:", e);
    }
  }

  const activeAddr = appState && typeof appState.getActiveWeb3Address === 'function' ? appState.getActiveWeb3Address() : (appState && appState.state ? (appState.state.linkedWalletAddress || appState.state.walletAddress) : null);
  const isConnected = appState && typeof appState.isPlayerConnected === 'function' && appState.isPlayerConnected();

  if (isConnected && activeAddr && !activeAddr.startsWith('0xguest') && !activeAddr.startsWith('0xpgt')) {
    const addr = activeAddr.toLowerCase();

    // Refresh live on-chain POL and PGT balances via direct RPC
    if (typeof window.getDirectPolygonPOLBalance === 'function') {
      try {
        const livePol = await window.getDirectPolygonPOLBalance(addr);
        const livePgt = typeof window.getDirectPolygonPGTBalance === 'function' ? await window.getDirectPolygonPGTBalance(addr) : 0;
        if (livePol > 0) appState.state.balanceMatic = livePol;
        if (livePgt >= 0) {
          appState.state.onchainBalancePgt = livePgt;
          appState.state.onchainPgtBalance = livePgt;
        }
        appState.syncUI();
      } catch (e) {
        console.warn("Direct RPC startup balance fetch warning:", e);
      }
    }

    if (!hasValidWeb3Session(addr) && !appState.state.authUserId) {
      if (window.POLY_DEBUG) console.log("[autoConnectWeb3] Stored state address has no active 7-day session. Skipping auto-sync.");
      return;
    }

    // Instantly pull fresh DB profile & PolySpace data on every page refresh (F5) silently
    try {
      await syncProfileWithDb(
        addr,
        appState.state.onchainBalancePgt || 0,
        appState.state.onchainBalance1flr || 0,
        appState.state.balanceMatic || 0,
        null,
        true
      );
      if (typeof window.loadPlayerMessages === 'function') {
        window.loadPlayerMessages();
      }
    } catch (e) {
      console.error("DB refresh on startup failed:", e);
    }
  }
}

// --- VIP Subscription ---
const btnBuyVip = document.getElementById('btn-buy-vip');
if (btnBuyVip) {
  btnBuyVip.addEventListener('click', () => {
    // Redirect to NFT Marketplace to buy the Consumable VIP Pass
    if (typeof window.unlockVipPass === 'function') {
      window.unlockVipPass();
    } else if (typeof window.switchTab === 'function') {
      window.switchTab('nft');
      if (typeof window.switchNftView === 'function') {
        window.switchNftView('market');
      }
    }
  });
}


export function syncAmbassadorProfileBadge() {
  const badgeEl = document.getElementById('ambassador-profile-status-badge');
  if (!badgeEl) return;

  const isAmb = !!appState.state.isAmbassador;
  if (isAmb) {
    badgeEl.innerText = '🎖️ OFFICIAL AMBASSADOR';
    badgeEl.style.background = 'rgba(255, 170, 0, 0.2)';
    badgeEl.style.color = 'var(--color-warning)';
    badgeEl.style.border = '1px solid var(--color-warning)';
  } else {
    badgeEl.innerText = 'REGULAR PLAYER';
    badgeEl.style.background = 'rgba(255, 255, 255, 0.1)';
    badgeEl.style.color = 'var(--text-muted)';
    badgeEl.style.border = '1px solid var(--border-glass)';
  }
}
window.syncAmbassadorProfileBadge = syncAmbassadorProfileBadge;


// Open Public Player Profile Modal
export async function openPublicProfile(walletAddress) {
  if (!walletAddress || typeof window.openModal !== 'function') return;
  walletAddress = walletAddress.toLowerCase().trim();

  window.openModal('public-profile');

  const usernameEl = document.getElementById('pub-profile-username');
  const walletEl = document.getElementById('pub-profile-wallet');
  const avatarEl = document.getElementById('pub-profile-avatar');
  const badgesEl = document.getElementById('pub-profile-badges');

  const scoreStackerEl = document.getElementById('pub-profile-score-stacker');
  const scoreDriftEl = document.getElementById('pub-profile-score-drift');
  const scoreInvadersEl = document.getElementById('pub-profile-score-invaders');
  const scoreDodgeEl = document.getElementById('pub-profile-score-dodge');

  const pgtEl = document.getElementById('pub-profile-pgt');
  const stakedEl = document.getElementById('pub-profile-staked');
  const spacePowerEl = document.getElementById('pub-profile-space-power');
  const referralsEl = document.getElementById('pub-profile-referrals');
  const activeRefEl = document.getElementById('pub-profile-active-referrals');
  const nftsGridEl = document.getElementById('pub-profile-nfts-grid');
  const tierBadgeEl = document.getElementById('pub-profile-tier-badge');
  const s1CountEl = document.getElementById('pub-profile-s1-count');

  if (usernameEl) usernameEl.innerText = "Loading Player...";
  if (tierBadgeEl) tierBadgeEl.style.display = 'none';
  if (s1CountEl) s1CountEl.innerText = "0 / 17 Relics";
  if (activeRefEl) activeRefEl.innerText = "0 Active";
  if (walletEl) walletEl.innerText = `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`;
  if (nftsGridEl) nftsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">Loading NFTs...</div>';

  try {
    const normAddr = walletAddress.toLowerCase().trim();
    const { data: rows, error } = await supabase
      .from('users')
      .select('*')
      .or(`player_id.ilike.${normAddr},linked_wallet_address.ilike.${normAddr}`)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) throw error;
    const user = (Array.isArray(rows) && rows.length > 0) ? rows[0] : null;

    if (!user) {
      if (usernameEl) usernameEl.innerText = "Anonymous Player";
      if (tierBadgeEl) tierBadgeEl.style.display = 'none';
      if (nftsGridEl) nftsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">No public profile data available.</div>';
      return;
    }

    const isInternal = (addr) => !addr || addr.toLowerCase().startsWith('0xpgt') || addr.toLowerCase().startsWith('0xg');
    const displayAddr = (user.linked_wallet_address && !isInternal(user.linked_wallet_address)) ? user.linked_wallet_address : (!isInternal(user.player_id) ? user.player_id : normAddr);
    const shortAddr = (!isInternal(displayAddr) && displayAddr.length >= 42) 
      ? `Player_${displayAddr.substring(0, 6)}...${displayAddr.substring(displayAddr.length - 4)}` 
      : ('Player_' + (displayAddr.length >= 4 ? displayAddr.substring(displayAddr.length - 4) : 'User'));
    const name = user.username || shortAddr;

    if (usernameEl) usernameEl.innerText = name;
    if (avatarEl) avatarEl.innerText = (name.charAt(0) || '🎮').toUpperCase();
    if (walletEl) walletEl.innerText = isInternal(displayAddr) ? 'Google Account (No Web3 Wallet Linked)' : displayAddr;

    // Best Active Tier Badge across last 2 weeks beside Name
    const lastTierLvl = Math.max(parseInt(user.weekly_active_tier || 0, 10), parseInt(user.last_weekly_active_tier || 0, 10));
    const tierBadgeInfo = {
      5: { label: '👑 L5 Apex Legend', color: '#ffd700', bg: 'rgba(255,215,0,0.15)', border: '#ffd700' },
      4: { label: '💎 L4 Elite Champion', color: '#00ff88', bg: 'rgba(0,255,136,0.15)', border: '#00ff88' },
      3: { label: '🥇 L3 Veteran', color: '#ffaa00', bg: 'rgba(255,170,0,0.15)', border: '#ffaa00' },
      2: { label: '🥈 L2 Contender', color: '#c084fc', bg: 'rgba(192,132,252,0.15)', border: '#c084fc' },
      1: { label: '🥉 L1 Scout', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: '#38bdf8' },
      0: { label: '⚪ L0 Dormant', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: '#94a3b8' }
    }[lastTierLvl] || { label: '⚪ L0 Dormant', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: '#94a3b8' };

    if (tierBadgeEl) {
      tierBadgeEl.innerText = tierBadgeInfo.label;
      tierBadgeEl.style.display = 'inline-block';
      tierBadgeEl.style.color = tierBadgeInfo.color;
      tierBadgeEl.style.backgroundColor = tierBadgeInfo.bg;
      tierBadgeEl.style.border = `1px solid ${tierBadgeInfo.border}`;
      tierBadgeEl.title = `Official Active Tier from previous week: Level ${lastTierLvl}`;
    }

    // Badges & Showcase NFT
    let badgesHtml = '';
    const equippedId = user.equipped_nft || user.equippedNft || null;
    let showcaseNftObj = equippedId ? NFT_REGISTRY.find(n => n.id === equippedId) : null;
    if (showcaseNftObj) {
      badgesHtml += `<span style="background:rgba(0,240,255,0.15); color:var(--color-primary); border:1px solid var(--color-primary); padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:800;">⭐ Showcase: ${showcaseNftObj.name}</span> `;
    }
    if (user.is_ambassador) badgesHtml += '<span style="background:rgba(255,170,0,0.15); color:var(--color-warning); border:1px solid var(--color-warning); padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:800;">🎖️ AMBASSADOR</span> ';
    if (user.vip_until && new Date(user.vip_until).getTime() > Date.now()) {
      const isSilver = Number(user.vip_level) === 1;
      if (isSilver) {
        badgesHtml += '<span style="background:rgba(192,192,192,0.15); color:#c0c0c0; border:1px solid #c0c0c0; padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:800;">🥈 SILVER VIP</span> ';
      } else {
        badgesHtml += '<span style="background:rgba(255,215,0,0.15); color:var(--color-warning); border:1px solid var(--color-warning); padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:800;">👑 GOLD VIP</span> ';
      }
    }
    if (badgesEl) badgesHtml ? (badgesEl.innerHTML = badgesHtml) : (badgesEl.innerHTML = '<span style="color:var(--text-dim); font-size:0.75rem;">Regular Player</span>');

    // Arcade High Scores (All-Time Career & Active Weekly)
    const alltimeStack = Math.max(user.alltime_stacker_highscore || 0, user.stacker_highscore || 0);
    const alltimeDri = Math.max(user.alltime_drift_highscore || 0, user.drift_highscore || 0);
    const alltimeInv = Math.max(user.alltime_invaders_highscore || 0, user.invaders_highscore || 0);
    // Update public profile scorecards via ARCADE_GAMES_LIST
    for (const g of ARCADE_GAMES_LIST) {
      const weekly = (g.key === 'stacker')
        ? (user.stacker_highscore || user.catcher_highscore || 0)
        : Number(user[g.scoreField] || (g.key === 'drift' ? user.drift_score : g.key === 'astrododge' ? user.game_score : g.key === 'invaders' ? user.invaders_score : 0) || 0);
      const career = (g.key === 'stacker')
        ? Math.max(Number(user.alltime_stacker_highscore || user.alltime_catcher_highscore || 0), weekly)
        : Math.max(Number(user[g.alltimeField] || 0), weekly);
      const sEl = document.getElementById(g.pubScoreElId);
      const wEl = document.getElementById(g.pubWeeklyElId);
      if (sEl) sEl.innerText = career.toLocaleString();
      if (wEl) wEl.innerText = weekly.toLocaleString();
    }

    // Stats & Referral Earnings
    if (pgtEl) pgtEl.innerText = `${(user.balance_pgt || 0).toLocaleString([], {maximumFractionDigits:0})} PGT`;
    if (stakedEl) stakedEl.innerText = `${(user.staked_balance_pgt || 0).toLocaleString([], {maximumFractionDigits:0})} PGT`;
    if (spacePowerEl) {
      const fleetPwr = user.polyspace_power || user.space_fleet_power || (user.space_state ? user.space_state.fleetPower : 100) || 100;
      spacePowerEl.innerText = `${Number(fleetPwr).toLocaleString()} Power`;
    }
    if (referralsEl) referralsEl.innerText = `${user.referrals_count || 0} Players`;

    // Query Direct (L1) Active Referrals (Tier L1 to L5 - Not Dormant)
    let activeL1Count = 0;
    let totalL1Count = 0;
    const candidateIds = [
      (user.player_id || '').toLowerCase(),
      (user.linked_wallet_address || '').toLowerCase()
    ].filter(id => id && !id.startsWith('0xguest'));

    if (candidateIds.length > 0 && ((user.referrals_count || 0) > 0 || (user.referrals_l1 || 0) > 0)) {
      try {
        const refFilterClauses = candidateIds.map(id => `referred_by_l1.ilike.${id}`);
        const { data: refRows, error: refErr } = await supabase
          .from('users')
          .select('last_weekly_active_tier, weekly_active_tier')
          .or(refFilterClauses.join(','));

        if (!refErr && Array.isArray(refRows)) {
          totalL1Count = refRows.length;
          activeL1Count = refRows.filter(r => {
            const tier = Math.max(parseInt(r.weekly_active_tier || 0, 10), parseInt(r.last_weekly_active_tier || 0, 10));
            return tier >= 1 && tier <= 5;
          }).length;
        }
      } catch (refErr) {
        console.warn("[openPublicProfile] Failed to fetch active L1 referrals:", refErr);
      }
    }

    if (activeRefEl) {
      activeRefEl.innerText = `${activeL1Count} Active`;
      activeRefEl.title = `${activeL1Count} active direct referrals (Tier L1-L5, not dormant) out of ${totalL1Count || (user.referrals_l1 || 0)} direct L1 referrals`;
    }

    const refPgtEl = document.getElementById('pub-profile-ref-pgt');
    const refPolEl = document.getElementById('pub-profile-ref-pol');

    if (refPgtEl) refPgtEl.innerText = `${parseFloat(user.total_referral_commission || 0).toFixed(2)} PGT`;
    if (refPolEl) refPolEl.innerText = `${parseFloat(user.total_referral_pol || 0).toFixed(4)} POL`;

    // Utility NFTs
    const ownedIds = user.owned_nfts || [];
    const nftsCountEl = document.getElementById('pub-profile-nfts-count');
    if (nftsCountEl) nftsCountEl.innerText = ownedIds.length;

    if (!ownedIds || ownedIds.length === 0) {
      if (nftsGridEl) nftsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">No NFTs in collection yet.</div>';
    } else {
      let nftsHtml = '';
      ownedIds.forEach(nftId => {
        const activeNft = NFT_REGISTRY.find(n => n.id === nftId);
        const nftName = activeNft ? activeNft.name : `NFT #${nftId}`;
        const nftIcon = activeNft ? (activeNft.icon || '🎨') : '🎨';
        const isShowcase = (nftId === equippedId);
        nftsHtml += `
          <div style="background: ${isShowcase ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0,0,0,0.4)'}; border: 1px solid ${isShowcase ? 'var(--color-primary)' : 'var(--border-glass)'}; padding: 0.4rem 0.65rem; border-radius: 6px; display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem;">
            <span>${nftIcon}</span>
            <strong style="color: #fff;">${nftName}</strong>
            ${isShowcase ? '<span style="color:var(--color-primary); font-size:0.7rem; font-weight:800; margin-left:2px;">⭐ Displayed</span>' : ''}
          </div>
        `;
      });
      if (nftsGridEl) nftsGridEl.innerHTML = nftsHtml;
    }

    // Quantum Relics Stash
    const relicsData = user.relics || {};
    const relicsCountEl = document.getElementById('pub-profile-relics-count');
    const relicsBreakdownEl = document.getElementById('pub-profile-relics-breakdown');
    const relicsGridEl = document.getElementById('pub-profile-relics-grid');

    let totalRelics = 0;
    let onchainRelics = 0;
    let inGameRelics = 0;
    const unlockedRelicsList = [];

    Object.keys(relicsData).forEach(relicId => {
      const r = relicsData[relicId];
      if (r && (r.total > 0 || r.unminted > 0 || r.onchain > 0)) {
        const count = r.total || ((r.unminted || 0) + (r.onchain || 0));
        const onchainCount = r.onchain || 0;
        const unmintedCount = r.unminted || (count - onchainCount);
        
        totalRelics += count;
        onchainRelics += onchainCount;
        inGameRelics += unmintedCount;

        const meta = getRelicMeta(relicId) || { name: relicId, rarity: 'rare' };
        unlockedRelicsList.push({
          id: relicId,
          name: meta.name,
          rarity: meta.rarity,
          total: count,
          onchain: onchainCount,
          unminted: unmintedCount
        });
      }
    });

    if (relicsCountEl) relicsCountEl.innerText = totalRelics;
    if (relicsBreakdownEl) relicsBreakdownEl.innerText = `${onchainRelics} Polygon • ${inGameRelics} In-Game`;

    // Serie 1 Set Progress (out of 17)
    const s1Progress = getSeason1Progress(relicsData);
    const s1BannerEl = document.getElementById('pub-profile-s1-banner');

    if (s1CountEl) {
      if (s1Progress.isComplete) {
        s1CountEl.innerHTML = `<span style="color: #ffd700; font-weight: 800;">🏆 17 / 17 Complete (1.5x Apex Active)</span>`;
        if (s1BannerEl) {
          s1BannerEl.style.borderColor = '#ffd700';
          s1BannerEl.style.background = 'rgba(255, 215, 0, 0.12)';
        }
      } else {
        const pct = Math.round((s1Progress.ownedCount / 17) * 100);
        s1CountEl.innerHTML = `<span style="color: var(--color-accent); font-weight: 800;">${s1Progress.ownedCount} / 17 Relics</span> <span style="color: var(--text-dim); font-size: 0.7rem; font-weight: 600;">(${pct}%)</span>`;
        if (s1BannerEl) {
          s1BannerEl.style.borderColor = 'rgba(0, 240, 255, 0.2)';
          s1BannerEl.style.background = 'rgba(0, 240, 255, 0.06)';
        }
      }
    }

    if (relicsGridEl) {
      if (unlockedRelicsList.length === 0) {
        relicsGridEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; width: 100%; text-align: center;">No Quantum Relics unlocked yet.</div>';
      } else {
        const rarityStyles = {
          rare: { border: '#00f0ff', color: '#00f0ff', bg: 'rgba(0,240,255,0.1)' },
          epic: { border: '#bd00ff', color: '#bd00ff', bg: 'rgba(189,0,255,0.1)' },
          legendary: { border: '#ffd700', color: '#ffd700', bg: 'rgba(255,215,0,0.1)' },
          mythic: { border: '#ff0055', color: '#ff0055', bg: 'rgba(255,0,85,0.1)' }
        };

        let relicsHtml = '';
        unlockedRelicsList.forEach(r => {
          const style = rarityStyles[r.rarity] || rarityStyles.rare;
          relicsHtml += `
            <div style="background: rgba(0,0,0,0.4); border: 1px solid ${style.border}; padding: 0.4rem 0.65rem; border-radius: 6px; display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem;">
              <span style="font-size: 0.95rem;">🏺</span>
              <div style="display: flex; flex-direction: column;">
                <span style="color: #fff; font-weight: 700;">${r.name} <span style="color: ${style.color}; font-size: 0.7rem; text-transform: uppercase;">(${r.rarity})</span></span>
                <span style="color: var(--text-muted); font-size: 0.68rem;">
                  x${r.total} total ${r.onchain > 0 ? `• <span style="color:#b388ff; font-weight:600;">${r.onchain} Polygon</span>` : ''} ${r.unminted > 0 ? `• <span style="color:#00f0ff; font-weight:600;">${r.unminted} In-Game</span>` : ''}
                </span>
              </div>
            </div>
          `;
        });
        relicsGridEl.innerHTML = relicsHtml;
      }
    }

    // If the viewed public profile matches the active player, sync relics into appState immediately
    const activePId = (appState?.state?.playerId || '').toLowerCase();
    const activeLinked = (appState?.state?.linkedWalletAddress || '').toLowerCase();
    const activeWallet = (appState?.state?.walletAddress || '').toLowerCase();
    const activeUser = (appState?.state?.username || '').toLowerCase();
    const userPId = (user.player_id || '').toLowerCase();
    const userLinked = (user.linked_wallet_address || '').toLowerCase();
    const userName = (user.username || '').toLowerCase();

    const isCurrentPlayer = (
      (activePId && userPId && activePId === userPId) ||
      (activeLinked && userLinked && activeLinked === userLinked) ||
      (activeWallet && (activeWallet === userPId || activeWallet === userLinked)) ||
      (activeUser && activeUser !== 'anonymous player' && activeUser === userName) ||
      (typeof window !== 'undefined' && window.ethereum && window.ethereum.selectedAddress && (
        window.ethereum.selectedAddress.toLowerCase() === userLinked ||
        window.ethereum.selectedAddress.toLowerCase() === userPId
      ))
    );

    if (isCurrentPlayer && relicsData && Object.keys(relicsData).length > 0) {
      appState.state.relics = mergeRelicsObjects(relicsData, appState.state.relics);
      if (typeof appState.save === 'function') appState.save();
      const relicProgressBadge = document.getElementById('relics-progress-badge');
      if (relicProgressBadge) {
        const s1ProgLocal = getSeason1Progress(appState.state.relics);
        relicProgressBadge.innerText = `${s1ProgLocal.ownedCount}/${s1ProgLocal.totalCount}`;
      }
      if (typeof renderRelicsVault === 'function') {
        renderRelicsVault();
      }
      if (typeof appState.syncUI === 'function') {
        appState.syncUI();
      }
    }
  } catch (err) {
    console.error("Public Profile fetch error:", err);
    if (usernameEl) usernameEl.innerText = "Error Loading Player";
  }
}
window.openPublicProfile = openPublicProfile;

// Switch Sub-Tabs in My Profile (Career & Account vs Quantum Relics Vault)
export function switchProfileSubTab(subTab) {
  const careerSection = document.getElementById('profile-career-section');
  const relicsSection = document.getElementById('profile-relics-section');
  const messagesSection = document.getElementById('profile-messages-section');
  const tabCareerBtn = document.getElementById('tab-btn-profile-career');
  const tabRelicsBtn = document.getElementById('tab-btn-profile-relics');
  const tabMessagesBtn = document.getElementById('tab-btn-profile-messages');

  if (subTab === 'relics') {
    if (careerSection) careerSection.style.display = 'none';
    if (messagesSection) messagesSection.style.display = 'none';
    if (relicsSection) relicsSection.style.display = 'block';
    
    if (tabCareerBtn) {
      tabCareerBtn.classList.remove('active');
      tabCareerBtn.style.background = 'rgba(255,255,255,0.05)';
      tabCareerBtn.style.color = 'var(--text-muted)';
      tabCareerBtn.style.borderColor = 'var(--border-glass)';
    }
    if (tabMessagesBtn) {
      tabMessagesBtn.classList.remove('active');
      tabMessagesBtn.style.background = 'rgba(255,255,255,0.05)';
      tabMessagesBtn.style.color = 'var(--text-muted)';
      tabMessagesBtn.style.borderColor = 'var(--border-glass)';
    }
    if (tabRelicsBtn) {
      tabRelicsBtn.classList.add('active');
      tabRelicsBtn.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(0,240,255,0.15) 100%)';
      tabRelicsBtn.style.color = '#fff';
      tabRelicsBtn.style.borderColor = 'var(--border-cyan)';
    }
    if (typeof hydrateAndRenderRelicsVault === 'function') {
      hydrateAndRenderRelicsVault();
    } else if (typeof renderRelicsVault === 'function') {
      renderRelicsVault();
    }
  } else if (subTab === 'messages') {
    if (careerSection) careerSection.style.display = 'none';
    if (relicsSection) relicsSection.style.display = 'none';
    if (messagesSection) messagesSection.style.display = 'block';

    if (tabCareerBtn) {
      tabCareerBtn.classList.remove('active');
      tabCareerBtn.style.background = 'rgba(255,255,255,0.05)';
      tabCareerBtn.style.color = 'var(--text-muted)';
      tabCareerBtn.style.borderColor = 'var(--border-glass)';
    }
    if (tabRelicsBtn) {
      tabRelicsBtn.classList.remove('active');
      tabRelicsBtn.style.background = 'rgba(255,255,255,0.05)';
      tabRelicsBtn.style.color = 'var(--text-muted)';
      tabRelicsBtn.style.borderColor = 'var(--border-glass)';
    }
    if (tabMessagesBtn) {
      tabMessagesBtn.classList.add('active');
      tabMessagesBtn.style.background = 'linear-gradient(135deg, rgba(255,0,85,0.2) 0%, rgba(0,240,255,0.15) 100%)';
      tabMessagesBtn.style.color = '#fff';
      tabMessagesBtn.style.borderColor = 'var(--border-cyan)';
    }

    if (typeof window.loadPlayerMessages === 'function') {
      window.loadPlayerMessages().then(() => {
        if (typeof window.renderPlayerMessageCenter === 'function') {
          window.renderPlayerMessageCenter();
        }
      });
    } else if (typeof window.renderPlayerMessageCenter === 'function') {
      window.renderPlayerMessageCenter();
    }
  } else {
    // Default: career
    if (careerSection) careerSection.style.display = 'block';
    if (relicsSection) relicsSection.style.display = 'none';
    if (messagesSection) messagesSection.style.display = 'none';

    if (tabCareerBtn) {
      tabCareerBtn.classList.add('active');
      tabCareerBtn.style.background = 'rgba(0,240,255,0.15)';
      tabCareerBtn.style.color = 'var(--color-primary)';
      tabCareerBtn.style.borderColor = 'var(--border-cyan)';
    }
    if (tabRelicsBtn) {
      tabRelicsBtn.classList.remove('active');
      tabRelicsBtn.style.background = 'rgba(255,255,255,0.05)';
      tabRelicsBtn.style.color = 'var(--text-muted)';
      tabRelicsBtn.style.borderColor = 'var(--border-glass)';
    }
    if (tabMessagesBtn) {
      tabMessagesBtn.classList.remove('active');
      tabMessagesBtn.style.background = 'rgba(255,255,255,0.05)';
      tabMessagesBtn.style.color = 'var(--text-muted)';
      tabMessagesBtn.style.borderColor = 'var(--border-glass)';
    }
  }
}
window.switchProfileSubTab = switchProfileSubTab;
window.formatLeaderboardName = formatLeaderboardName;
window.getLeaderboardStarshipBadge = getLeaderboardStarshipBadge;
