import { supabase } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { NFT_REGISTRY } from './nft.js';
import { appState } from '../core/state.js';
import { triggerToast, connectWeb3 } from '../core/ui.js';

// --- Leaderboard Fetching (Supabase) ---

export async function loadArcadeLeaderboard() {
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

export async function loadHoldersLeaderboard() {
  const scoreboard = document.getElementById('leaderboard-pgt-container');
  if (!scoreboard) return;

  if (!supabase) {
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Database not connected.</div>';
    return;
  }

  try {
    const { data, error } = await supabase.from('users')
      .select('wallet_address, balance_pgt')
      .order('balance_pgt', { ascending: false })
      .limit(10);
      
    if (error) throw error;
    
    scoreboard.innerHTML = '';
    if (!data || data.length === 0) {
      scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No token holders found.</div>';
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
        <span class="leaderboard-score" style="color: var(--color-accent); font-weight:700;">${(row.balance_pgt || 0).toLocaleString([], {minimumFractionDigits:0, maximumFractionDigits:0})} PGT</span>
        <span class="leaderboard-prize" style="font-size:0.75rem; color:var(--text-dim);">Player</span>
      `;
      scoreboard.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to load holders leaderboard:", err);
    scoreboard.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error loading leaderboard.</div>';
  }
}

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
      totalStaked += s.amount;
    });
    achieveStaked.innerText = `${totalStaked.toFixed(2)} Tokens`;
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
    
    triggerToast("Username saved!", "success");
    sfx.playSuccess();

    appState.syncUI();
    
    // Refresh active leaderboard displays
    loadArcadeLeaderboard();
    loadReferralLeaderboard();
    loadHoldersLeaderboard();
  });
}
window.setupLeaderboardUI = loadArcadeLeaderboard;

export async function autoConnectWeb3() {
  if (typeof window.ethereum !== 'undefined' && appState.state.walletConnected) {
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

