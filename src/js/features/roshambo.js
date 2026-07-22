import { TOKEN_CONTRACT_ADDRESS, web3Provider, realSigner, NFT_CONTRACT_ADDRESS, SUPABASE_URL, supabase } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { closeModal, triggerToast } from '../core/ui.js';
import { recordGameMetrics, logBetWin } from '../core/db-sync.js';

// --- Roshambo Betting Logic ---


export function switchGameCategory(category) {
  const tabEarn = document.getElementById('tab-category-earn');
  const tabBet = document.getElementById('tab-category-bet');
  const tabAdventure = document.getElementById('tab-category-adventure');

  const gridEarn = document.getElementById('grid-category-earn');
  const gridBet = document.getElementById('grid-category-bet');
  const gridAdventure = document.getElementById('grid-category-adventure');

  // Ensure game view is closed when switching category
  closeGameView();

  if (tabEarn) tabEarn.classList.remove('active');
  if (tabBet) tabBet.classList.remove('active');
  if (tabAdventure) tabAdventure.classList.remove('active');

  if (gridEarn) { gridEarn.style.display = 'none'; gridEarn.classList.remove('grid-category-hidden'); }
  if (gridBet) { gridBet.style.display = 'none'; gridBet.classList.remove('grid-category-hidden'); }
  if (gridAdventure) { gridAdventure.style.display = 'none'; gridAdventure.classList.remove('grid-category-hidden'); }

  if (category === 'earn' && tabEarn && gridEarn) {
    tabEarn.classList.add('active');
    gridEarn.style.display = 'grid';
  } else if (category === 'bet' && tabBet && gridBet) {
    tabBet.classList.add('active');
    gridBet.style.display = 'block';
  } else if (category === 'adventure' && tabAdventure && gridAdventure) {
    tabAdventure.classList.add('active');
    gridAdventure.style.display = 'block';
  }
}
window.switchGameCategory = switchGameCategory;

export function closeGameView() {
  if (typeof window.exitGameFullscreen === 'function') {
    window.exitGameFullscreen();
  }

  // Stop active game loops
  if (window.dodgeGame) window.dodgeGame.isPlaying = false;
  if (window.invadersGame) window.invadersGame.isPlaying = false;
  if (window.cyberDrift) window.cyberDrift.isRunning = false;

  // Restore start screen UI overlays so game is ready when player returns
  const overlayArcade = document.getElementById('game-ui-overlay');
  const overlayInvaders = document.getElementById('invaders-ui-overlay');
  const overlayDrift = document.getElementById('drift-ui-overlay');

  if (overlayArcade) overlayArcade.classList.remove('hidden');
  if (overlayInvaders) overlayInvaders.style.display = 'flex';
  if (overlayDrift) overlayDrift.style.display = 'flex';

  const gameWindowContainer = document.getElementById('game-window-container');
  if (gameWindowContainer) gameWindowContainer.classList.remove('fullscreen-active');

  const activeContainer = document.getElementById('active-game-container');
  const tabsContainer = document.getElementById('games-category-tabs');
  
  if (activeContainer) activeContainer.style.display = 'none';
  if (tabsContainer) tabsContainer.style.display = 'flex';

  const gridEarn = document.getElementById('grid-category-earn');
  const gridBet = document.getElementById('grid-category-bet');
  const gridAdventure = document.getElementById('grid-category-adventure');

  if (gridEarn) gridEarn.classList.remove('grid-category-hidden');
  if (gridBet) gridBet.classList.remove('grid-category-hidden');
  if (gridAdventure) gridAdventure.classList.remove('grid-category-hidden');

  // Reactivate the correct grid based on active tab
  const activeTab = document.querySelector('#games-category-tabs .nft-tab.active');
  if (activeTab) {
    const id = activeTab.id;
    if (id === 'tab-category-earn' && gridEarn) gridEarn.style.display = 'grid';
    if (id === 'tab-category-bet' && gridBet) gridBet.style.display = 'block';
    if (id === 'tab-category-adventure' && gridAdventure) gridAdventure.style.display = 'block';
  }
}
window.closeGameView = closeGameView;

export function switchGameModeView(mode) {
  const activeContainer = document.getElementById('active-game-container');
  const tabsContainer = document.getElementById('games-category-tabs');
  
  const gridEarn = document.getElementById('grid-category-earn');
  const gridBet = document.getElementById('grid-category-bet');
  const gridAdventure = document.getElementById('grid-category-adventure');

  if (activeContainer) activeContainer.style.display = 'grid';
  if (tabsContainer) tabsContainer.style.display = 'flex';
  
  if (gridEarn) { gridEarn.style.display = 'none'; gridEarn.classList.add('grid-category-hidden'); }
  if (gridBet) { gridBet.style.display = 'none'; gridBet.classList.add('grid-category-hidden'); }
  if (gridAdventure) { gridAdventure.style.display = 'none'; gridAdventure.classList.add('grid-category-hidden'); }

  const panelArcade = document.getElementById('panel-game-arcade');
  const panelInvaders = document.getElementById('panel-game-invaders');
  const panelDrift = document.getElementById('panel-game-drift');
  const panelRoshambo = document.getElementById('panel-game-roshambo');
  const panelSpinner = document.getElementById('panel-game-spinner');
  const panelCrash = document.getElementById('panel-game-crash');
  const panelPlinko = document.getElementById('panel-game-plinko');

  const lbArcade = document.getElementById('leaderboard-col-arcade');
  const lbInvaders = document.getElementById('leaderboard-col-invaders');
  const lbDrift = document.getElementById('leaderboard-col-drift');

  if (panelArcade) panelArcade.style.display = 'none';
  if (panelInvaders) panelInvaders.style.display = 'none';
  if (panelDrift) panelDrift.style.display = 'none';
  if (panelRoshambo) panelRoshambo.style.display = 'none';
  if (panelSpinner) panelSpinner.style.display = 'none';
  if (panelCrash) panelCrash.style.display = 'none';
  if (panelPlinko) panelPlinko.style.display = 'none';

  if (lbArcade) lbArcade.style.display = 'none';
  if (lbInvaders) lbInvaders.style.display = 'none';
  if (lbDrift) lbDrift.style.display = 'none';

  if (mode === 'arcade') {
    if (panelArcade) panelArcade.style.display = 'flex';
    if (lbArcade) lbArcade.style.display = 'block';
    const overlay = document.getElementById('game-ui-overlay');
    if (overlay) overlay.classList.remove('hidden');
  } else if (mode === 'invaders') {
    if (panelInvaders) panelInvaders.style.display = 'flex';
    if (lbInvaders) lbInvaders.style.display = 'block';
    const overlay = document.getElementById('invaders-ui-overlay');
    if (overlay) overlay.style.display = 'flex';
  } else if (mode === 'drift') {
    if (panelDrift) panelDrift.style.display = 'flex';
    if (lbDrift) lbDrift.style.display = 'block';
    const overlay = document.getElementById('drift-ui-overlay');
    if (overlay) overlay.style.display = 'flex';
    if (typeof window.loadDriftLeaderboard === 'function') window.loadDriftLeaderboard();
  } else if (mode === 'roshambo') {
    if (panelRoshambo) panelRoshambo.style.display = 'flex';
    updateRoshamboWagerLabels();
  } else if (mode === 'spinner') {
    if (panelSpinner) panelSpinner.style.display = 'flex';
    updateSpinnerWagerLabels();
  } else if (mode === 'crash') {
    if (panelCrash) panelCrash.style.display = 'flex';
    if (window.updateCrashWagerLabels) window.updateCrashWagerLabels();
  } else if (mode === 'plinko') {
    if (panelPlinko) panelPlinko.style.display = 'flex';
    if (window.updatePlinkoWagerLabels) window.updatePlinkoWagerLabels();
  }
}
window.switchGameModeView = switchGameModeView;

export function setRoshamboWager(type) {
  const input = document.getElementById('roshambo-bet-input');
  if (!input) return;
  
  const maxBal = appState.state.balancePgt;
  if (type === 'min') {
    input.value = 10;
  } else if (type === 'half') {
    input.value = Math.max(10, Math.floor(maxBal / 2));
  } else if (type === 'double') {
    const val = parseFloat(input.value) || 0;
    input.value = Math.max(10, Math.floor(val * 2));
  } else if (type === 'max') {
    input.value = Math.max(10, Math.floor(maxBal));
  }
}
window.setRoshamboWager = setRoshamboWager;

export function updateRoshamboWagerLabels() {
  const label = document.getElementById('roshambo-wallet-balance-label');
  if (label) {
    label.innerText = `${parseFloat(appState.state.balancePgt || 0).toFixed(2)} PGT`;
  }
}

// Lucky Neon Spinner Controls
export function setSpinnerWager(type) {
  const input = document.getElementById('spinner-bet-input');
  if (!input) return;
  
  const maxBal = appState.state.balancePgt;
  if (type === 'min') {
    input.value = 10;
  } else if (type === 'half') {
    input.value = Math.max(10, Math.floor(maxBal / 2));
  } else if (type === 'double') {
    const val = parseFloat(input.value) || 0;
    input.value = Math.max(10, Math.floor(val * 2));
  } else if (type === 'max') {
    input.value = Math.max(10, Math.floor(maxBal));
  }
}
window.setSpinnerWager = setSpinnerWager;

export function updateSpinnerWagerLabels() {
  const label = document.getElementById('spinner-wallet-balance-label');
  if (label) {
    label.innerText = `${parseFloat(appState.state.balancePgt || 0).toFixed(2)} PGT`;
  }
}

export let spinnerIsSpinning = false;
export let currentSpinnerRotation = 0;

export async function spinLuckyWheel() {
  if (spinnerIsSpinning) return;

  const input = document.getElementById('spinner-bet-input');
  const wheel = document.getElementById('wheel-svg');
  const ann = document.getElementById('spinner-announcement');
  if (!input || !wheel || !ann) return;

  const bet = Math.floor(parseFloat(input.value)) || 0;
  const balance = appState.state.balancePgt;

  if (bet < 10) {
    triggerToast("Minimum wager is 10 PGT!", "error");
    return;
  }
  if (bet > balance) {
    triggerToast("Insufficient PGT token balance!", "error");
    return;
  }

  spinnerIsSpinning = true;
  sfx.init();

  // Deduct bet from balance immediately
  appState.update({
    balancePgt: balance - bet
  });
  updateSpinnerWagerLabels();

  // Increment global jackpot (1% of bet)
  if (supabase) {
    supabase.rpc('increment_jackpot', { p_amount: bet * 0.01 }).then(res => {
      if (res.error) console.error("Jackpot increment failed:", res.error);
    });
  }

  // 1 in 10,000 chance to hit the jackpot
  const isJackpot = Math.random() < 0.0001;
  
  if (isJackpot && supabase) {
    ann.innerText = "🔥 PROGRESSIVE JACKPOT HIT!!! 🔥 Claiming...";
    ann.style.color = "var(--color-warning)";
    
    try {
      const { data: jackpotAmount, error } = await supabase.rpc('claim_jackpot', { p_wallet: appState.state.walletAddress });
      
      if (!error && jackpotAmount) {
        appState.update({
          balancePgt: appState.state.balancePgt + jackpotAmount
        });
        updateSpinnerWagerLabels();
        
        sfx.playSuccess(); // Maybe we need a bigger sound?
        ann.innerText = `🏆 MEGA WIN! You won the ${parseFloat(jackpotAmount).toFixed(2)} PGT Jackpot!`;
        ann.style.color = "var(--color-accent)";
        appState.addActivity('You', `won the global jackpot`, `+${parseFloat(jackpotAmount).toFixed(2)} PGT`);
        
        spinnerIsSpinning = false;
        return; // End early, no wheel spin needed
      }
    } catch (e) {
      console.error(e);
    }
  }

  ann.innerText = "🌀 Spinning... Best of luck!";
  ann.style.color = "var(--color-primary)";

  let serverResult = null;
  let rpcFailed = false;

  if (supabase) {
    const res = await supabase.rpc('play_spinner', {
      p_wallet: appState.state.walletAddress.toLowerCase(),
      p_bet: bet
    });
    if (res.error) {
      console.error("RPC Error:", res.error);
      rpcFailed = true;
    } else {
      serverResult = Array.isArray(res.data) ? res.data[0] : res.data;
    }
  } else {
    rpcFailed = true;
  }

  if (rpcFailed || !serverResult || serverResult.error) {
    triggerToast(serverResult?.error || "Server validation failed!", "error");
    ann.innerText = "ERROR - TRY AGAIN";
    ann.style.color = 'var(--color-danger)';
    spinnerIsSpinning = false;
    appState.update({ balancePgt: appState.state.balancePgt + bet });
    updateSpinnerWagerLabels();
    return;
  }

  const winIdx = serverResult.segment;
  const multiplier = serverResult.multiplier;
  const payout = serverResult.payout;

  const spins = 6;
  const targetAngle = 360 - (winIdx * 60 + 30);
  const currentOffset = currentSpinnerRotation % 360;
  currentSpinnerRotation = currentSpinnerRotation + (spins * 360) - currentOffset + targetAngle;

  wheel.style.transform = `rotate(${currentSpinnerRotation}deg)`;

  let tickCount = 0;
  const tickInterval = setInterval(() => {
    if (tickCount < 18) {
      sfx.playRoshamboDrum();
      tickCount++;
    } else {
      clearInterval(tickInterval);
    }
  }, 200);

  setTimeout(() => {
    spinnerIsSpinning = false;
    
    appState.update({
      balancePgt: appState.state.balancePgt + payout
    });
    
    recordGameMetrics('Lucky Spinner', bet, payout);
    if (payout > 0) {
      logBetWin('Lucky Spinner', bet, payout, multiplier);
    }
    
    updateSpinnerWagerLabels();

    if (multiplier > 1.0) {
      sfx.playSuccess();
      ann.innerText = `🎉 WON! Segments aligned at ${multiplier}x multiplier. Payout +${payout} PGT!`;
      ann.style.color = "var(--color-accent)";
      appState.addActivity('You', `won spinner bet (${multiplier}x)`, `+${payout} PGT`);
    } else if (multiplier === 0.5) {
      sfx.playCoin();
      ann.innerText = `⚠️ Partial return! Returned 0.5x wager (+${payout} PGT).`;
      ann.style.color = "var(--color-warning)";
      appState.addActivity('You', `partially hit spinner bet (0.5x)`, `-${bet - payout} PGT`);
    } else {
      sfx.playError();
      ann.innerText = `❌ Segment missed! Landed on 0x. Better luck next time!`;
      ann.style.color = "var(--color-danger)";
      appState.addActivity('You', `lost spinner bet (0x)`, `-${bet} PGT`);
    }
  }, 4100);
}
window.spinLuckyWheel = spinLuckyWheel;
window.setSpinnerWager = setSpinnerWager;

export const btnSpinWheel = document.getElementById('btn-spin-wheel');
if (btnSpinWheel) {
  btnSpinWheel.addEventListener('click', spinLuckyWheel);
}

export let roshamboIsPlaying = false;

export async function playRoshamboRound(playerChoice) {
  if (roshamboIsPlaying) return;

  const input = document.getElementById('roshambo-bet-input');
  if (!input) return;
  
  const betAmount = Math.floor(parseFloat(input.value)) || 0;
  const userBalance = appState.state.balancePgt;

  if (betAmount < 10) {
    triggerToast("Minimum wager is 10 PGT!", "error");
    return;
  }
  if (betAmount > userBalance) {
    triggerToast("Insufficient PGT token balance!", "error");
    return;
  }

  roshamboIsPlaying = true;
  
  // Deduct wager immediately
  appState.update({
    balancePgt: userBalance - betAmount
  });
  updateRoshamboWagerLabels();

  // Process progressive jackpot (1% pool increment + 1:10000 win chance)
  if (window.processBetJackpot) {
    window.processBetJackpot(betAmount, 'Roshambo');
  }
  // Disable buttons visually
  document.getElementById('btn-roshambo-rock').disabled = true;
  document.getElementById('btn-roshambo-paper').disabled = true;
  document.getElementById('btn-roshambo-scissors').disabled = true;

  const handPlayer = document.getElementById('roshambo-hand-player');
  const handCpu = document.getElementById('roshambo-hand-cpu');
  const announcement = document.getElementById('roshambo-announcement');

  if (handPlayer && handCpu && announcement) {
    handPlayer.innerText = '✊';
    handCpu.innerText = '✊';
    handPlayer.classList.add('roshambo-shaking');
    handCpu.classList.add('roshambo-shaking');
    announcement.innerText = "ROCK...";
    announcement.style.color = "var(--text-white)";
    sfx.playRoshamboDrum();

    let serverResult = null;
    let rpcFailed = false;

    // Make RPC call simultaneously with visual animation start
    if (supabase) {
      supabase.rpc('play_roshambo', {
        p_wallet: appState.state.walletAddress.toLowerCase(),
        p_bet: betAmount,
        p_choice: playerChoice
      }).then(res => {
        if (res.error) {
          console.error("RPC Error:", res.error);
          rpcFailed = true;
        } else {
          serverResult = Array.isArray(res.data) ? res.data[0] : res.data;
        }
      });
    } else {
      rpcFailed = true;
    }

    setTimeout(() => {
      announcement.innerText = "PAPER...";
      sfx.playRoshamboDrum();
    }, 400);

    setTimeout(() => {
      announcement.innerText = "SCISSORS...";
      sfx.playRoshamboDrum();
    }, 800);

    setTimeout(() => {
      handPlayer.classList.remove('roshambo-shaking');
      handCpu.classList.remove('roshambo-shaking');

      if (rpcFailed || !serverResult || serverResult.error) {
        triggerToast(serverResult?.error || "Server validation failed!", "error");
        announcement.innerText = "ERROR - TRY AGAIN";
        announcement.style.color = 'var(--color-danger)';
        roshamboIsPlaying = false;
        // Refund wager locally
        appState.update({ balancePgt: appState.state.balancePgt + betAmount });
        updateRoshamboWagerLabels();
        document.getElementById('btn-roshambo-rock').disabled = false;
        document.getElementById('btn-roshambo-paper').disabled = false;
        document.getElementById('btn-roshambo-scissors').disabled = false;
        return;
      }

      // Postgres SQL returns lower case or snake_case column names by default
      const cpuChoice = serverResult.cpuChoice || serverResult.cpu_choice || serverResult.cpuchoice;
      
      if (!cpuChoice) {
        alert("DEBUG: serverResult is " + JSON.stringify(serverResult));
      }
      
      const result = serverResult.result || serverResult.outcome;
      const pgtPayout = serverResult.payout || serverResult.pgt_payout || 0;

      const emojis = {
        rock: '✊',
        paper: '🖐️',
        scissors: '✌️'
      };

      handPlayer.innerText = emojis[playerChoice];
      handCpu.innerText = emojis[cpuChoice];

      if (result === 'win') {
        announcement.innerText = `YOU WON! +${pgtPayout} PGT 🎉`;
        announcement.style.color = 'var(--color-accent)';
        sfx.playSuccess();
        
        appState.update({ balancePgt: appState.state.balancePgt + pgtPayout });
        
        recordGameMetrics('Roshambo', betAmount, pgtPayout);
        logBetWin('Roshambo', betAmount, pgtPayout, pgtPayout / betAmount);
        
        triggerToast(`Winner! Gained +${pgtPayout} PGT!`, "success");
        addRoshamboLog(result, playerChoice, cpuChoice, betAmount, pgtPayout);
      } else if (result === 'draw') {
        announcement.innerText = `DRAW! Refunded ${pgtPayout} PGT 🔄`;
        announcement.style.color = 'var(--color-warning)';
        sfx.playCoin();

        appState.update({ balancePgt: appState.state.balancePgt + pgtPayout });
        addRoshamboLog(result, playerChoice, cpuChoice, betAmount, pgtPayout);
        recordGameMetrics('Roshambo', betAmount, pgtPayout);
      } else {
        announcement.innerText = `YOU LOST! Lost -${betAmount} PGT 💥`;
        announcement.style.color = 'var(--color-danger)';
        sfx.playError();

        addRoshamboLog(result, playerChoice, cpuChoice, betAmount, 0);
        recordGameMetrics('Roshambo', betAmount, 0);
      }

      roshamboIsPlaying = false;
      document.getElementById('btn-roshambo-rock').disabled = false;
      document.getElementById('btn-roshambo-paper').disabled = false;
      document.getElementById('btn-roshambo-scissors').disabled = false;

      updateRoshamboWagerLabels();
      appState.syncUI();
      
    }, 1200);
  } else {
    roshamboIsPlaying = false;
  }
}
window.playRoshamboRound = playRoshamboRound;

export function addRoshamboLog(result, player, cpu, bet, payout) {
  const feed = document.getElementById('roshambo-history-feed');
  if (!feed) return;

  if (feed.innerHTML.includes("No rounds played yet")) {
    feed.innerHTML = '';
  }

  const row = document.createElement('div');
  row.className = `roshambo-log-row ${result}`;
  
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const emojis = { rock: '✊', paper: '🖐️', scissors: '✌️' };
  const outcomeTexts = {
    win: `WON +${payout} PGT`,
    lose: `LOST -${bet} PGT`,
    draw: `DRAW (Refund)`
  };

  row.innerHTML = `
    <span style="font-weight: 700; text-transform: uppercase;">${outcomeTexts[result]}</span>
    <span>You ${emojis[player]} vs ${emojis[cpu]} CPU</span>
    <span style="font-size: 0.75rem; color: var(--text-dim);">${timeStr}</span>
  `;

  feed.insertBefore(row, feed.firstChild);

  if (feed.children.length > 10) {
    feed.lastChild.remove();
  }
}

// Fetch owned NFT IDs directly from the blockchain
export async function getOwnedNftsFromChain(address) {
  if (!web3Provider || !NFT_CONTRACT_ADDRESS || NFT_CONTRACT_ADDRESS.length !== 42) {
    return [];
  }
  try {
    const nftContract = new window.ethers.Contract(NFT_CONTRACT_ADDRESS, [
      "function balanceOf(address owner) view returns (uint256)",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function getNFTType(uint256 tokenId) view returns (string)"
    ], web3Provider);

    const balance = await nftContract.balanceOf(address);
    if (balance === 0n || balance === 0) return [];

    const ownedIds = new Set();
    let found = 0;
    
    // Brute force search the first 100 tokens (since it's a new contract without Enumerable)
    for (let i = 1; i <= 100; i++) {
      try {
        const owner = await nftContract.ownerOf(i);
        if (owner.toLowerCase() === address.toLowerCase()) {
          const nftTypeId = await nftContract.getNFTType(i);
          ownedIds.add(nftTypeId);
          found++;
          if (found >= Number(balance)) break; // Found them all
        }
      } catch (e) {
        // Token doesn't exist or other error, continue searching
        if (e.message && e.message.includes('nonexistent token')) {
            break; // Stop searching if we hit the end of minted tokens
        }
      }
    }
    return Array.from(ownedIds);
  } catch (err) {
    console.error("Error reading NFTs from chain:", err);
    return [];
  }
}

// Quick set withdrawal amount input helper
export function setWithdrawAmount(type) {
  const input = document.getElementById('withdraw-input-amount');
  if (!input) return;

  const maxBal = appState.state.balancePgt;
  if (type === 'half') {
    input.value = Math.max(10, Math.floor(maxBal / 2));
  } else if (type === 'max') {
    input.value = Math.max(10, Math.floor(maxBal));
  }
}
window.setWithdrawAmount = setWithdrawAmount;

export async function executeWithdrawPGT() {
  const amountInput = document.getElementById('withdraw-input-amount');
  if (!amountInput) return;

  const amount = Math.floor(parseFloat(amountInput.value)) || 0;
  const offChainBalance = appState.state.balancePgt;

  if (amount < 10) {
    triggerToast("Minimum withdrawal is 10 PGT!", "error");
    return;
  }
  if (amount > offChainBalance) {
    triggerToast("Insufficient off-chain balance!", "error");
    return;
  }

  if (!appState.state.walletConnected || appState.state.walletProvider !== 'metamask') {
    triggerToast("Please connect your MetaMask wallet first!", "error");
    return;
  }

  if (!TOKEN_CONTRACT_ADDRESS || TOKEN_CONTRACT_ADDRESS.length !== 42) {
    triggerToast("Please enter your PGT contract address at the top of app.js", "error");
    return;
  }

  try {
    const recipient = appState.state.walletAddress;
    const nonceRequest = Math.floor(Math.random() * 100000000);
    const messageToSign = `Withdraw PGT: ${nonceRequest}`;

    triggerToast("Please sign the MetaMask message to verify identity...", "success");
    const playerSignature = await realSigner.signMessage(messageToSign);

    triggerToast("Generating authorization voucher securely...", "success");

    // Use the imported SUPABASE_URL to point to the edge function
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/withdraw-pgt`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: recipient,
        amount: amount,
        signature: playerSignature,
        nonceRequest: nonceRequest
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      triggerToast(`Server rejected claim: ${result.error}`, "error");
      return;
    }

    const { signature, nonce, amountWei } = result;

    // Call claimTokens on deployed ERC-20 PGT Contract
    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, [
      "function claimTokens(uint256 amount, uint256 nonce, bytes memory signature) payable",
      "function withdrawalFee() view returns (uint256)"
    ], realSigner);

    let feeWei = ethers.parseEther("0.5"); // Default fallback
    try {
      feeWei = await tokenContract.withdrawalFee();
    } catch (e) {
      console.warn("Could not query withdrawalFee from contract, using default 0.5 POL:", e);
    }

    triggerToast("Confirm transaction in MetaMask...", "success");

    const tx = await tokenContract.claimTokens(amountWei, nonce, signature, {
      value: feeWei
    });
    triggerToast("Withdrawal pending on-chain...", "success");

    await tx.wait();

    // Deduct off-chain balance locally (Edge function already updated DB)
    appState.update({
      balancePgt: offChainBalance - amount
    });

    sfx.playSuccess();
    triggerToast(`Withdrawal Success! Claimed ${amount} real PGT in your wallet!`, "success");
    appState.addActivity('You', `withdrew PGT on-chain`, `-${amount} PGT`);

    closeModal('withdraw');
    appState.syncUI();

  } catch (err) {
    console.error("Withdrawal claim failed:", err);
    triggerToast("Claim failed: " + (err.reason || err.message), "error");
  }
}

// End of file
