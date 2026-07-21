import { supabase, ADMIN_WALLET_ADDRESS, web3Provider } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { NFT_REGISTRY } from './nft.js';
import { appState } from '../core/state.js';
import { triggerToast, connectWeb3 } from '../core/ui.js?v=8';
import { syncProfileWithDb } from '../core/db-sync.js';

// --- Leaderboard Fetching (Supabase) ---

export async function loadAstroDodgeLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-arcade-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('wallet_address, game_highscore')
      .order('game_highscore', { ascending: false })
      .limit(10);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No scores recorded yet.</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      let prize = 'N/A';
      if (rank === 1) prize = '2500 PGT';
      else if (rank === 2) prize = '1000 PGT';
      else if (rank === 3) prize = '500 PGT';
      else if (rank <= 10) prize = '100 PGT';

      const shortAddr = `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}`;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name" style="font-family: monospace;">${shortAddr} ${isUser ? '(You)' : ''}</span>
        <span class="leaderboard-score">${(row.game_highscore || 0).toLocaleString()}</span>
        <span class="leaderboard-prize">${prize}</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load arcade leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

export async function loadInvadersLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-invaders-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('wallet_address, invaders_highscore')
      .order('invaders_highscore', { ascending: false })
      .limit(10);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No scores recorded yet.</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      let prize = 'N/A';
      if (rank === 1) prize = '2500 PGT';
      else if (rank === 2) prize = '1000 PGT';
      else if (rank === 3) prize = '500 PGT';
      else if (rank <= 10) prize = '100 PGT';

      const shortAddr = `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}`;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name" style="font-family: monospace;">${shortAddr} ${isUser ? '(You)' : ''}</span>
        <span class="leaderboard-score">${(row.invaders_highscore || 0).toLocaleString()}</span>
        <span class="leaderboard-prize">${prize}</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load invaders leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

export async function loadReferralLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-ref-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('wallet_address, referrals_count, total_referral_commission')
      .order('referrals_count', { ascending: false })
      .limit(10);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No referrers yet.</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const shortAddr = `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}`;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name" style="font-family: monospace;">${shortAddr} ${isUser ? '(You)' : ''}</span>
        <span class="leaderboard-score" style="color: var(--color-primary); font-weight:700;">${row.referrals_count || 0} Ref(s)</span>
        <span class="leaderboard-prize" style="font-size:0.75rem; color:var(--color-accent); font-weight:700;">+${(row.total_referral_commission || 0).toFixed(0)} PGT</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load referral leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

export async function loadWeeklyWinsLeaderboard() {
  const scoreboard = document.getElementById('weekly-wins-leaderboard');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    // 7 days ago
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase.from('bet_wins')
      .select('wallet_address, game, payout, multiplier, created_at')
      .gte('created_at', lastWeek)
      .order('payout', { ascending: false })
      .limit(10);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-dim);">No big wins yet this week!</div>';
      return;
    }

    data.forEach((row, idx) => {
      const rank = idx + 1;
      const item = document.createElement('div');
      
      let isUser = false;
      if (appState.state.walletConnected && appState.state.walletAddress) {
        if (row.wallet_address.toLowerCase() === appState.state.walletAddress.toLowerCase()) {
           isUser = true;
        }
      }
      
      let addr = row.wallet_address;
      let shortAddr = addr;
      if (addr.length === 42) {
          shortAddr = `${addr.substring(0,6)}...${addr.substring(38)}`;
      }
      
      item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); ${isUser ? 'background: rgba(0, 240, 255, 0.1); border-radius: 4px;' : ''}`;
      
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-weight: bold; color: ${rank <= 3 ? 'var(--color-warning)' : 'var(--text-muted)'}; min-width: 1.5rem;">#${rank}</span>
          <span style="font-family: monospace; font-size: 0.8rem; color: ${isUser ? '#fff' : 'var(--text-dim)'};">${shortAddr}</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end;">
          <span style="font-weight: 800; color: var(--color-success); font-size: 0.95rem;">+${Number(row.payout).toLocaleString()} PGT</span>
          <span style="font-size: 0.7rem; color: var(--color-accent);">${row.game} (${row.multiplier}x)</span>
        </div>
      `;
      scoreboard.appendChild(item);
    });

  } catch(e) {
    console.error("Failed to fetch weekly wins leaderboard:", e);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--color-danger);">Failed to load wins</div>';
  }
}

let holdersCurrentPage = 1;
const holdersPerPage = 20;
let cachedHoldersData = [];
let holdersChartInstance = null;
let currentHoldersTotalSupply = 0;

export async function loadHoldersLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-pgt-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data: allData, error } = await supabase.from('users')
      .select('wallet_address, balance_pgt, stakes, username');
      
    if (error) throw error;
    
    const totalPgtValue = document.getElementById('total-onsite-pgt-value');
    let globalTotal = 0;
    
    cachedHoldersData = (allData || []).map(u => {
      const bal = u.balance_pgt || 0;
      let staked = 0;
      if (u.stakes && Array.isArray(u.stakes)) {
        staked = u.stakes.reduce((sum, s) => (s.pool === 'pgt' ? sum + s.amount : sum), 0);
      }
      const total = bal + staked;
      globalTotal += total;
      return { ...u, totalWealth: total, bal, staked };
    });
    
    if (totalPgtValue) {
      totalPgtValue.innerText = globalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' PGT';
    }
    
    cachedHoldersData.sort((a, b) => b.totalWealth - a.totalWealth);
    holdersCurrentPage = 1;

    renderHoldersPage(holdersCurrentPage);
    renderHoldersSupplyChart('day', globalTotal);

  } catch (err) {
    console.error("Failed to load holders leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

export function renderHoldersPage(page) {
  const scoreboard = document.getElementById('leaderboard-pgt-container');
  if (!scoreboard) return;

  const totalPages = Math.ceil(cachedHoldersData.length / holdersPerPage) || 1;
  holdersCurrentPage = Math.max(1, Math.min(page, totalPages));

  const startIdx = (holdersCurrentPage - 1) * holdersPerPage;
  const pageData = cachedHoldersData.slice(startIdx, startIdx + holdersPerPage);

  scoreboard.innerHTML = '';
  if (pageData.length === 0) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No token holders found.</div>';
  } else {
    pageData.forEach((row, idx) => {
      const rank = startIdx + idx + 1;
      const item = document.createElement('div');
      const isUser = appState.state.walletConnected && appState.state.walletAddress.toLowerCase() === row.wallet_address.toLowerCase();
      item.className = `leaderboard-row ${isUser ? 'user-row' : ''}`;
      
      const shortAddr = `${row.wallet_address.substring(0,6)}...${row.wallet_address.substring(38)}`;
      let displayName = row.username || shortAddr;
      if (isUser && appState.state.username) displayName = appState.state.username;
      
      const nameHtml = row.username || (isUser && appState.state.username) 
        ? `<strong style="color:var(--color-primary);">${displayName}</strong> <span style="font-size:0.75rem; color:var(--text-dim);">(${shortAddr})</span>` 
        : shortAddr;
      
      item.innerHTML = `
        <span class="leaderboard-rank rank-${rank}">${rank}</span>
        <span class="leaderboard-name">${nameHtml} ${isUser ? '<span style="color:var(--color-accent); font-size:0.8rem;">(You)</span>' : ''}</span>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
          <span class="leaderboard-score" style="color: var(--color-accent); font-weight:700; font-size:1.1rem;">${row.totalWealth.toLocaleString([], {minimumFractionDigits:0, maximumFractionDigits:0})} PGT</span>
          <span style="font-size:0.75rem; color:var(--text-dim);">Wallet: ${row.bal.toLocaleString([], {maximumFractionDigits:0})} | Staked: ${row.staked.toLocaleString([], {maximumFractionDigits:0})}</span>
        </div>
      `;
      scoreboard.appendChild(item);
    });
  }

  const pageIndicator = document.getElementById('holders-page-indicator');
  const btnPrev = document.getElementById('btn-holders-prev');
  const btnNext = document.getElementById('btn-holders-next');

  if (pageIndicator) pageIndicator.innerText = `Page ${holdersCurrentPage} of ${totalPages}`;
  if (btnPrev) btnPrev.disabled = holdersCurrentPage <= 1;
  if (btnNext) btnNext.disabled = holdersCurrentPage >= totalPages;
}

export function changeHoldersPage(delta) {
  renderHoldersPage(holdersCurrentPage + delta);
}

export function renderHoldersSupplyChart(timeframe = 'day', currentTotal = 0) {
  if (currentTotal > 0) currentHoldersTotalSupply = currentTotal;
  const canvas = document.getElementById('holders-supply-chart');
  if (!canvas || !window.Chart) return;

  const labels = [];
  const chartData = [];
  const now = new Date();

  if (timeframe === 'day') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      labels.push(`${d.getHours()}:00`);
      const variation = (1 - (i / 24) * 0.12) + (Math.sin(i * 0.5) * 0.015);
      chartData.push(Math.round(currentHoldersTotalSupply * variation));
    }
  } else if (timeframe === 'month') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      const variation = (1 - (i / 30) * 0.35) + (Math.cos(i * 0.3) * 0.02);
      chartData.push(Math.round(currentHoldersTotalSupply * Math.max(0.2, variation)));
    }
  } else if (timeframe === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString('default', { month: 'short' }));
      const variation = (1 - (i / 12) * 0.55) + (Math.sin(i * 0.4) * 0.03);
      chartData.push(Math.round(currentHoldersTotalSupply * Math.max(0.1, variation)));
    }
  }

  ['day', 'month', 'year'].forEach(tf => {
    const btn = document.getElementById(`btn-holders-tf-${tf}`);
    if (btn) {
      if (tf === timeframe) {
        btn.style.background = 'var(--color-primary)';
        btn.style.color = '#000';
        btn.style.fontWeight = '700';
      } else {
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.color = 'var(--text-muted)';
        btn.style.fontWeight = 'normal';
      }
    }
  });

  if (holdersChartInstance) {
    holdersChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 250);
  gradient.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

  holdersChartInstance = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Onsite PGT Supply',
        data: chartData,
        borderColor: '#00f0ff',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#ff00ff',
        pointRadius: timeframe === 'year' ? 4 : 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` Supply: ${context.parsed.y.toLocaleString()} PGT`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#8a99ad', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#8a99ad',
            font: { size: 10 },
            callback: (val) => val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val
          }
        }
      }
    }
  });
}

window.changeHoldersPage = changeHoldersPage;
window.switchHoldersTimeframe = (tf) => renderHoldersSupplyChart(tf, currentHoldersTotalSupply);

// --- USER PROFILE & PGT LEADERBOARD LOGIC ---


// Fetch Username mapped to connected address
export function getActiveUsername() {
  if (!appState.state.walletConnected || !appState.state.walletAddress) {
    return "Anonymous Player";
  }
  const addr = appState.state.walletAddress.toLowerCase();
  const saved = localStorage.getItem(`polygame_username_${addr}`);
  return saved || `Player_${addr.substring(2, 8)}`;
}

// Sync values inside Profile view
export function syncProfileView() {
  const profileNameInput = document.getElementById('profile-name-input');
  if (profileNameInput && document.activeElement !== profileNameInput) {
    profileNameInput.value = getActiveUsername();
  }

  const statusLabel = document.getElementById('profile-wallet-status');
  const addressLabel = document.getElementById('profile-wallet-address');
  const networkLabel = document.getElementById('profile-wallet-network');

  if (statusLabel && addressLabel && networkLabel) {
    if (appState.state.walletConnected) {
      statusLabel.innerText = "Connected";
      statusLabel.style.color = "var(--color-accent)";
      addressLabel.innerText = appState.state.walletAddress;
      
      const providerStr = appState.state.walletProvider.toUpperCase();
      networkLabel.innerText = `${providerStr} (Polygon Ledger)`;
    } else {
      statusLabel.innerText = "Disconnected";
      statusLabel.style.color = "var(--color-danger)";
      addressLabel.innerText = "None";
      networkLabel.innerText = "None";
    }
  }

  // Summary achievements
  const achieveScore = document.getElementById('profile-achieve-score');
  const achieveNft = document.getElementById('profile-achieve-nft');
  const achieveStaked = document.getElementById('profile-achieve-staked');

  if (achieveScore) achieveScore.innerText = appState.state.gameHighScore;
  
  if (achieveNft) {
    let nftName = "None";
    if (appState.state.equippedNft) {
      const nft = NFT_REGISTRY.find(n => n.id === appState.state.equippedNft);
      if (nft) nftName = nft.name;
    }
    achieveNft.innerText = nftName;
  }

  if (achieveStaked) {
    let totalStaked = 0;
    (appState.state.stakes || []).forEach(s => {
      totalStaked += parseFloat(s.amount || 0);
    });
    achieveStaked.innerText = `${parseFloat(totalStaked || 0).toFixed(2)} Tokens`;
  }
}

// Profile Save button listener
export const btnSaveProfile = document.getElementById('btn-save-profile');
if (btnSaveProfile) {
  btnSaveProfile.addEventListener('click', () => {
    const input = document.getElementById('profile-name-input');
    if (!input) return;
    
    const nameStr = input.value.trim();
    if (!nameStr) {
      triggerToast("Username cannot be empty!", "error");
      return;
    }

    const address = appState.state.walletAddress || "anonymous";
    localStorage.setItem(`polygame_username_${address.toLowerCase()}`, nameStr);
    
    appState.update({ username: nameStr });
    
    triggerToast("Username saved!", "success");
    sfx.playSuccess();

    appState.syncUI();
    
    // Refresh active leaderboard displays
    loadAstroDodgeLeaderboard();
    loadInvadersLeaderboard();
    loadReferralLeaderboard();
    loadHoldersLeaderboard();
  });
}
window.setupLeaderboardUI = loadAstroDodgeLeaderboard;

export async function autoConnectWeb3() {
  if (appState.state.walletConnected && appState.state.walletAddress) {
    // 1. Instantly pull fresh DB data on every page refresh (F5) across desktop & mobile
    try {
      await syncProfileWithDb(
        appState.state.walletAddress,
        appState.state.onchainBalancePgt || 0,
        appState.state.onchainBalance1flr || 0,
        appState.state.balanceMatic || 0
      );
    } catch (e) {
      console.error("DB refresh on startup failed:", e);
    }

    // 2. Re-verify Web3 provider if desktop extension is present
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWeb3();
        }
      } catch (e) {
        console.error("Auto connection check failed:", e);
      }
    }
  }
}

// --- VIP Subscription ---
const btnBuyVip = document.getElementById('btn-buy-vip');
if (btnBuyVip) {
  btnBuyVip.addEventListener('click', () => {
    // Redirect to NFT Marketplace to buy the Consumable VIP Pass
    if (typeof window.switchTab === 'function') {
      window.switchTab('nft');
      if (typeof window.switchNftView === 'function') {
        window.switchNftView('market');
      }
    }
  });
}
