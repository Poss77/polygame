import { supabase, TOKEN_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS, ADMIN_WALLET_ADDRESS } from '../core/config.js';

// --- Admin Panel Fetch and Render ---

export async function loadAdminData() {
  if (!supabase) return;
  const tableBody = document.getElementById('admin-users-table');
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-dim);">Loading global database...</td></tr>';

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('balance_pgt', { ascending: false });

    if (error) {
      console.warn("Error querying pol_payout_requests table:", error);
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--color-warning);">⚠️ Payout table not found or empty in Supabase. Please ensure scratch/add_10pct_pol_nft_referrals.sql was executed in Supabase SQL Editor.</td></tr>';
      return;
    }
    
    renderAdminPanel(users || []);
    updateTreasuryBalances();
    renderPolRevenueChart('day');
    loadPolPayoutRequests();

    // Fetch and render game metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from('game_metrics')
      .select('*');
    
    const casinoTable = document.getElementById('admin-casino-metrics-table');
    const arcadeTable = document.getElementById('admin-arcade-metrics-table');
    const faucetTable = document.getElementById('admin-faucet-metrics-table');
    
    // Aggregate user-level faucet stats
    let totalUserClaims = 0;
    let activeClaimersCount = 0;
    (users || []).forEach(u => {
      const claims = u.total_claims || 0;
      totalUserClaims += claims;
      if (claims > 0) activeClaimersCount++;
    });

    let faucetMetric = (metricsData || []).filter(m => m.game_name === 'Faucet')[0];
    let totalFaucetPayout = faucetMetric ? (faucetMetric.total_payout || 0) : (totalUserClaims * 50.0);
    let totalClaimsCount = faucetMetric ? Math.max(totalUserClaims, faucetMetric.total_wagered || 0) : totalUserClaims;

    const totalUsersCount = (users || []).length;
    const avgClaims = totalUsersCount > 0 ? (totalUserClaims / totalUsersCount).toFixed(1) : "0";

    if (faucetTable) {
      faucetTable.innerHTML = `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 0.75rem; font-weight: 700;">24-Hour PGT Faucet</td>
          <td style="padding: 0.75rem;">${totalClaimsCount} claims</td>
          <td style="padding: 0.75rem;">${activeClaimersCount} / ${totalUsersCount} players</td>
          <td style="padding: 0.75rem; color: var(--color-primary); font-weight: 700;">${totalFaucetPayout.toFixed(2)} PGT</td>
          <td style="padding: 0.75rem; font-weight: 700; color: var(--color-warning);">${avgClaims} claims/player</td>
        </tr>
      `;
    }
    
    // Sum arcade payouts directly from player activities as a robust fallback/cross-check
    const userArcadePayouts = {};
    (users || []).forEach(u => {
      if (Array.isArray(u.activities)) {
        u.activities.forEach(act => {
          const action = (act.action || '').toLowerCase();
          const reward = (act.reward || '').toLowerCase();
          const match = reward.match(/\+([0-9.]+)\s*pgt/);
          if (match) {
            const amt = parseFloat(match[1]);
            if (action.includes('drift')) {
              userArcadePayouts['Cyber Drift'] = (userArcadePayouts['Cyber Drift'] || 0) + amt;
            } else if (action.includes('astrododge') || action.includes('astro-dodge')) {
              userArcadePayouts['AstroDodge'] = (userArcadePayouts['AstroDodge'] || 0) + amt;
            } else if (action.includes('invaders')) {
              userArcadePayouts['Cyber Invaders'] = (userArcadePayouts['Cyber Invaders'] || 0) + amt;
            }
          }
        });
      }
    });

    if (casinoTable && arcadeTable) {
      if (metricsError || !metricsData || metricsData.length === 0) {
        casinoTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-dim);">No game metrics recorded yet.</td></tr>';
        arcadeTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-dim);">No game metrics recorded yet.</td></tr>';
      } else {
        casinoTable.innerHTML = '';
        arcadeTable.innerHTML = '';
        
        metricsData.forEach(metric => {
          const profit = (metric.total_wagered || 0) - (metric.total_payout || 0);
          const profitColor = profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)';
          
          let winPctStr = "";
          if (metric.total_wagered > 0) {
            const winPct = ((metric.total_payout || 0) / metric.total_wagered) * 100;
            winPctStr = ` (${winPct.toFixed(1)}%)`;
          }
          
          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
          
          // Check if it's an Arcade (Earn) game, Faucet, or Crate
          if (metric.game_name === 'Faucet' || metric.game_name.includes('Crate') || metric.game_name.includes('Mystery')) {
            // Handled separately in faucetTable and cratesTable
            return;
          } else if (metric.game_name === 'AstroDodge' || metric.game_name === 'Cyber Invaders' || metric.game_name === 'Cyber Drift') {
            let earnRate = "0.00 PGT/min";
            let playtimeStr = "0m 0s";
            const totalPayout = metric.total_payout != null ? parseFloat(metric.total_payout) : (userArcadePayouts[metric.game_name] || 0);
            const totalPlaytime = metric.total_playtime_seconds != null ? parseFloat(metric.total_playtime_seconds) : 0;

            if (totalPlaytime > 0) {
              const minutes = totalPlaytime / 60;
              playtimeStr = `${Math.floor(minutes)}m ${Math.floor(totalPlaytime % 60)}s`;
              earnRate = (totalPayout / minutes).toFixed(2) + " PGT/min";
            }
            
            tr.innerHTML = `
              <td style="padding: 0.75rem; font-weight: 700;">${metric.game_name}</td>
              <td style="padding: 0.75rem;">${playtimeStr}</td>
              <td style="padding: 0.75rem; color: var(--color-primary); font-weight: 700;">${totalPayout.toFixed(2)} PGT</td>
              <td style="padding: 0.75rem; font-weight: 700; color: var(--color-warning);">${earnRate}</td>
            `;
            arcadeTable.appendChild(tr);
          } else {
            // Casino (Bet) game
            const totalWagered = metric.total_wagered != null ? parseFloat(metric.total_wagered) : 0;
            const totalPayout = metric.total_payout != null ? parseFloat(metric.total_payout) : 0;
            const profit = totalWagered - totalPayout;
            const profitColor = profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)';
            
            let winPctStr = "";
            if (totalWagered > 0) {
              const winPct = (totalPayout / totalWagered) * 100;
              winPctStr = ` (${winPct.toFixed(1)}%)`;
            }

            tr.innerHTML = `
              <td style="padding: 0.75rem; font-weight: 700;">${metric.game_name}</td>
              <td style="padding: 0.75rem;">${totalWagered.toFixed(2)} PGT</td>
              <td style="padding: 0.75rem;">${totalPayout.toFixed(2)} PGT</td>
              <td style="padding: 0.75rem; font-weight: 700; color: ${profitColor};">${profit >= 0 ? '+' : ''}${profit.toFixed(2)} PGT${winPctStr}</td>
            `;
            casinoTable.appendChild(tr);
          }
        });
      }
    }

    // Render Arcade Last Reset Timestamp
    const lastResetEl = document.getElementById('arcade-metrics-last-reset');
    if (lastResetEl) {
      let resetTimestamp = localStorage.getItem('polygame_arcade_last_reset');
      try {
        const { data: gs } = await supabase.from('global_settings').select('arcade_last_reset').eq('id', 1).maybeSingle();
        if (gs && gs.arcade_last_reset) {
          resetTimestamp = gs.arcade_last_reset;
          localStorage.setItem('polygame_arcade_last_reset', resetTimestamp);
        }
      } catch (e) {}

      if (resetTimestamp) {
        const dateObj = new Date(resetTimestamp);
        lastResetEl.innerHTML = `Last Reset: <span style="color: var(--color-accent); font-weight: 600;">${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
      } else {
        lastResetEl.innerText = "Last Reset: Never";
      }
    }

    // Aggregate PolySpace metrics across all users
    let activePilots = 0;
    let totalFleetPower = 0;
    let totalIron = 0;
    let totalTit = 0;
    let totalQuant = 0;
    let totalRaids = 0;
    let sumWarpLvl = 0;

    (users || []).forEach(u => {
      if (u.space_state && typeof u.space_state === 'object') {
        const sp = u.space_state;
        activePilots++;
        totalFleetPower += (sp.fleetPower || 100);
        totalIron += (sp.iron || 0);
        totalTit += (sp.titanium || 0);
        totalQuant += (sp.quantum || 0);
        totalRaids += (sp.raidsWon || 0);
        sumWarpLvl += (sp.warpLevel || 1);
      }
    });

    const avgWarpLvl = activePilots > 0 ? (sumWarpLvl / activePilots).toFixed(1) : "1.0";
    const polyspaceTable = document.getElementById('admin-polyspace-metrics-table');
    if (polyspaceTable) {
      polyspaceTable.innerHTML = `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 0.75rem; font-weight: 700; color: var(--color-accent);">🚀 ${activePilots} Starships</td>
          <td style="padding: 0.75rem; font-weight: 800; color: var(--color-warning);">⚡ ${totalFleetPower.toLocaleString()} Power</td>
          <td style="padding: 0.75rem;">🪨 ${Math.floor(totalIron).toLocaleString()} Iron | 💎 ${Math.floor(totalTit).toLocaleString()} Tit | ✨ ${Math.floor(totalQuant).toLocaleString()} Quant</td>
          <td style="padding: 0.75rem; color: var(--color-danger); font-weight: 700;">⚔️ ${totalRaids} Raids Won</td>
          <td style="padding: 0.75rem; font-weight: 700;">Lvl ${avgWarpLvl} Warp Avg</td>
        </tr>
      `;
    }

    // Aggregate Cyber Mystery Crates Metrics
    let pgtCrateMetric = (metricsData || []).find(m => m.game_name === 'PGT Cyber Mystery Crate');
    let polCrateMetric = (metricsData || []).find(m => m.game_name === 'POL Quantum Crate');

    let pgtPurchased = pgtCrateMetric ? (pgtCrateMetric.total_playtime_seconds || 0) : 0;
    let pgtTotalSpent = pgtCrateMetric ? (pgtCrateMetric.total_wagered || 0) : 0;
    let pgtTotalWon = pgtCrateMetric ? (pgtCrateMetric.total_payout || 0) : 0;
    let pgtNftsWon = 0;

    let polPurchased = polCrateMetric ? (polCrateMetric.total_playtime_seconds || 0) : 0;
    let polTotalSpent = polCrateMetric ? (polCrateMetric.total_wagered || 0) : 0;
    let polTotalWon = polCrateMetric ? (polCrateMetric.total_payout || 0) : 0;
    let polNftsWon = 0;

    // Scan user activities & crate_nfts to augment / fallback stats
    (users || []).forEach(u => {
      // Check crate_nfts
      if (Array.isArray(u.crate_nfts)) {
        u.crate_nfts.forEach(c => {
          if (typeof c === 'object' && c !== null) {
            if (c.crate_type && c.crate_type.includes('POL')) polNftsWon++;
            else pgtNftsWon++;
          } else {
            pgtNftsWon++;
          }
        });
      }

      // Check activities
      if (Array.isArray(u.activities)) {
        u.activities.forEach(act => {
          const actionStr = (act.action || '').toLowerCase();
          const rewardStr = (act.reward || '').toLowerCase();
          
          if (actionStr.includes('pgt cyber mystery crate') || actionStr.includes('cyber crate') || actionStr.includes('open_pgt_mystery_box')) {
            if (!pgtCrateMetric) {
              pgtPurchased++;
              pgtTotalSpent += 1000;
              const pgtMatch = rewardStr.match(/\+([0-9.]+)\s*pgt/);
              if (pgtMatch) pgtTotalWon += parseFloat(pgtMatch[1]);
            }
          } else if (actionStr.includes('pol quantum crate') || actionStr.includes('open_pol_mystery_box')) {
            if (!polCrateMetric) {
              polPurchased++;
              polTotalSpent += 50;
              const pgtMatch = rewardStr.match(/\+([0-9.]+)\s*pgt/);
              if (pgtMatch) polTotalWon += parseFloat(pgtMatch[1]);
            }
          }
        });
      }
    });

    if (pgtCrateMetric && pgtCrateMetric.total_wagered > 0 && pgtPurchased === 0) {
      pgtPurchased = Math.round(pgtCrateMetric.total_wagered / 1000);
    }
    if (polCrateMetric && polCrateMetric.total_wagered > 0 && polPurchased === 0) {
      polPurchased = Math.round(polCrateMetric.total_wagered / 50);
    }

    if (pgtPurchased > 0 && pgtTotalSpent === 0) pgtTotalSpent = pgtPurchased * 1000;
    if (polPurchased > 0 && polTotalSpent === 0) polTotalSpent = polPurchased * 50;

    const pgtAvgWon = pgtPurchased > 0 ? (pgtTotalWon / pgtPurchased) : 0;
    const polAvgWon = polPurchased > 0 ? (polTotalWon / polPurchased) : 0;

    const cratesTable = document.getElementById('admin-crates-metrics-table');
    if (cratesTable) {
      cratesTable.innerHTML = `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 0.75rem; font-weight: 700; color: var(--color-warning);">🎁 PGT Cyber Mystery Crate</td>
          <td style="padding: 0.75rem; font-weight: 700;">${pgtPurchased} crates</td>
          <td style="padding: 0.75rem; color: var(--color-primary); font-weight: 700;">${pgtTotalSpent.toLocaleString()} PGT</td>
          <td style="padding: 0.75rem; color: var(--color-accent); font-weight: 700;">${pgtAvgWon.toFixed(2)} PGT <span style="font-size: 0.75rem; color: var(--text-dim);">(Total: ${pgtTotalWon.toFixed(2)} PGT)</span></td>
          <td style="padding: 0.75rem; font-weight: 700; color: #ffd700;">💎 ${pgtNftsWon} NFTs</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 0.75rem; font-weight: 700; color: var(--color-accent);">✨ POL Quantum Crate</td>
          <td style="padding: 0.75rem; font-weight: 700;">${polPurchased} crates</td>
          <td style="padding: 0.75rem; color: var(--color-warning); font-weight: 700;">${polTotalSpent.toFixed(2)} POL</td>
          <td style="padding: 0.75rem; color: var(--color-accent); font-weight: 700;">${polAvgWon.toFixed(2)} PGT <span style="font-size: 0.75rem; color: var(--text-dim);">(Total: ${polTotalWon.toFixed(2)} PGT)</span></td>
          <td style="padding: 0.75rem; font-weight: 700; color: #ffd700;">💎 ${polNftsWon} NFTs</td>
        </tr>
      `;
    }

    // Fetch and render daily metrics chart
    const { data: dailyMetrics, error: dailyError } = await supabase
      .from('game_metrics_daily')
      .select('*')
      .order('metric_date', { ascending: true });
      
    if (!dailyError && dailyMetrics && dailyMetrics.length > 0) {
      renderMetricsChart(dailyMetrics);
    }

    // Fetch and render global settings & guest analytics
    const { data: settingsData } = await supabase
      .from('global_settings')
      .select('earn_multiplier, site_message, guest_visitors, min_withdraw_pgt, max_withdraw_pgt')
      .eq('id', 1)
      .single();
    
    if (settingsData) {
      if (settingsData.earn_multiplier !== undefined) {
        const inputEl = document.getElementById('admin-earn-multiplier');
        if (inputEl) inputEl.value = parseFloat(settingsData.earn_multiplier);
      }
      if (settingsData.min_withdraw_pgt !== undefined) {
        const minEl = document.getElementById('admin-min-withdraw');
        if (minEl) minEl.value = parseFloat(settingsData.min_withdraw_pgt || 10);
      }
      if (settingsData.max_withdraw_pgt !== undefined) {
        const maxEl = document.getElementById('admin-max-withdraw');
        if (maxEl) maxEl.value = parseFloat(settingsData.max_withdraw_pgt || 20000);
      }
      if (settingsData.site_message !== undefined) {
        const msgEl = document.getElementById('admin-site-message');
        if (msgEl) msgEl.value = settingsData.site_message;
      }
      const guestValEl = document.getElementById('admin-stat-guest-visitors');
      if (guestValEl) {
        guestValEl.innerText = (settingsData.guest_visitors || 0).toLocaleString();
      }
    }

  } catch (err) {
    console.error("Failed to fetch admin data:", err);
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--color-danger);">Failed to load data.</td></tr>';
  }
}

// State for Player Database Ledger table
let cachedAdminUsers = [];
let currentSortColumn = 'balance_pgt';
export let adminSearchQuery = '';
let currentSortOrder = 'desc';
let currentAdminPage = 1;
const ADMIN_PAGE_SIZE = 10;
let tableListenersAttached = false;

function getUserStakedPgt(u) {
  let val = parseFloat(u.staked_balance_pgt || 0);
  if ((!val || val === 0) && Array.isArray(u.stakes) && u.stakes.length > 0) {
    val = u.stakes.reduce((sum, s) => {
      if (!s.pool || s.pool.toLowerCase() === 'pgt') {
        const amt = parseFloat(s.amount || 0);
        return sum + (isNaN(amt) ? 0 : amt);
      }
      return sum;
    }, 0);
  }
  return isNaN(val) ? 0 : val;
}

export function renderAdminPanel(users) {
  if (users) {
    cachedAdminUsers = users;
  }

  const allUsers = cachedAdminUsers || [];
  
  // Calculate Global Aggregate Stats across ALL users
  let totalUsers = allUsers.length;
  let totalPgt = 0;
  let totalTvl = 0;
  let totalRefs = 0;
  let totalVips = 0;
  let totalGoogleOnly = 0;
  let totalWeb3Only = 0;
  let totalDualLinked = 0;
  let totalActiveStakesCount = 0;
  let totalStakingYieldHarvested = 0;
  let totalRefRewardsHarvested = 0;

  allUsers.forEach(u => {
    totalPgt += (u.balance_pgt || 0);
    totalTvl += getUserStakedPgt(u);
    totalRefs += (u.referrals_l1 || 0);

    const userStakes = Array.isArray(u.stakes) ? u.stakes : [];
    totalActiveStakesCount += userStakes.length;
    totalStakingYieldHarvested += (u.total_staking_yield || 0);
    totalRefRewardsHarvested += (u.total_referral_commission || u.unclaimed_referral_pgt || 0);

    const isGoogle = !!(u.user_id || u.email || (u.auth_provider === 'google') || (u.player_id && u.player_id.startsWith('0xg')));
    const linked = u.linked_wallet_address;
    const primary = u.player_id;
    const hasWeb3 = !!((linked && linked.length >= 42 && !linked.startsWith('0xg')) || (primary && primary.length >= 42 && !primary.startsWith('0xg')));

    if (isGoogle && hasWeb3) {
      totalDualLinked++;
    } else if (isGoogle && !hasWeb3) {
      totalGoogleOnly++;
    } else if (!isGoogle && hasWeb3) {
      totalWeb3Only++;
    }

    if (u.vip_until && new Date(u.vip_until).getTime() > Date.now()) {
      totalVips++;
    }
  });

  const usersEl = document.getElementById('admin-stat-users');
  const googleOnlyEl = document.getElementById('admin-stat-google-only');
  const web3OnlyEl = document.getElementById('admin-stat-web3-only');
  const dualLinkedEl = document.getElementById('admin-stat-dual-linked');
  const pgtEl = document.getElementById('admin-stat-pgt');
  const tvlEl = document.getElementById('admin-stat-tvl');
  const refsEl = document.getElementById('admin-stat-refs');
  const stakesCountEl = document.getElementById('admin-stat-stakes-count');
  const totalYieldEl = document.getElementById('admin-stat-total-yield');
  const refRewardsEl = document.getElementById('admin-stat-ref-rewards');

  if (usersEl) usersEl.innerText = totalUsers;
  if (googleOnlyEl) googleOnlyEl.innerText = totalGoogleOnly;
  if (web3OnlyEl) web3OnlyEl.innerText = totalWeb3Only;
  if (dualLinkedEl) dualLinkedEl.innerText = totalDualLinked;
  if (pgtEl) pgtEl.innerText = totalPgt.toFixed(2);
  if (tvlEl) tvlEl.innerText = totalTvl.toFixed(2) + ' PGT';
  if (refsEl) refsEl.innerText = totalRefs;
  if (stakesCountEl) stakesCountEl.innerText = totalActiveStakesCount;
  if (totalYieldEl) totalYieldEl.innerText = totalStakingYieldHarvested.toFixed(2) + ' PGT';
  if (refRewardsEl) refRewardsEl.innerText = totalRefRewardsHarvested.toFixed(2) + ' PGT';

  // Attach header sort click handlers if not yet attached
  attachAdminTableListeners();

  // Update header sort icons
  // Filter Users by Search Query
  let filteredUsers = [...allUsers];
  if (adminSearchQuery && adminSearchQuery.trim() !== '') {
    const q = adminSearchQuery.toLowerCase().trim();
    filteredUsers = allUsers.filter(u => {
      const name = (u.username || '').toLowerCase();
      const primary = (u.player_id || '').toLowerCase();
      const linked = (u.linked_wallet_address || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || primary.includes(q) || linked.includes(q) || email.includes(q);
    });
  }

  // Sort Users Array
  const sortedUsers = filteredUsers.sort((a, b) => {
    let valA, valB;

    switch (currentSortColumn) {
      case 'player':
        valA = (a.username || a.player_id || '').toLowerCase();
        valB = (b.username || b.player_id || '').toLowerCase();
        break;
      case 'balance_pgt':
        valA = a.balance_pgt || 0;
        valB = b.balance_pgt || 0;
        break;
      case 'staked_balance_pgt':
        valA = getUserStakedPgt(a);
        valB = getUserStakedPgt(b);
        break;
      case 'vip':
        valA = (a.vip_until && new Date(a.vip_until).getTime() > Date.now()) ? new Date(a.vip_until).getTime() : 0;
        valB = (b.vip_until && new Date(b.vip_until).getTime() > Date.now()) ? new Date(b.vip_until).getTime() : 0;
        break;
      case 'owned_nfts':
        valA = Array.isArray(a.owned_nfts) ? a.owned_nfts.length : 0;
        valB = Array.isArray(b.owned_nfts) ? b.owned_nfts.length : 0;
        break;
      case 'referrals_count':
        valA = a.referrals_count || 0;
        valB = b.referrals_count || 0;
        break;
      case 'stakes':
        valA = Array.isArray(a.stakes) ? a.stakes.length : 0;
        valB = Array.isArray(b.stakes) ? b.stakes.length : 0;
        break;
      case 'arcade':
        valA = Math.max(a.game_highscore || 0, a.invaders_highscore || 0, a.drift_highscore || 0);
        valB = Math.max(b.game_highscore || 0, b.invaders_highscore || 0, b.drift_highscore || 0);
        break;
      default:
        valA = a.balance_pgt || 0;
        valB = b.balance_pgt || 0;
    }

    if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate Pagination
  const totalPages = Math.ceil(sortedUsers.length / ADMIN_PAGE_SIZE) || 1;
  if (currentAdminPage > totalPages) currentAdminPage = totalPages;
  if (currentAdminPage < 1) currentAdminPage = 1;

  const startIndex = (currentAdminPage - 1) * ADMIN_PAGE_SIZE;
  const pageUsers = sortedUsers.slice(startIndex, startIndex + ADMIN_PAGE_SIZE);

  // Render Table Body
  const tableBody = document.getElementById('admin-users-table');
  if (tableBody) {
    tableBody.innerHTML = '';
    if (pageUsers.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-dim);">No player records found.</td></tr>';
    } else {
      pageUsers.forEach(u => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

        let nftsCount = Array.isArray(u.owned_nfts) ? u.owned_nfts.length : 0;
        let stakesCount = Array.isArray(u.stakes) ? u.stakes.length : 0;
        let stakedPgtVal = getUserStakedPgt(u);

        const primaryAddr = u.player_id || '';
        const linkedAddr = u.linked_wallet_address || '';
        const shortPrimary = primaryAddr ? `${primaryAddr.substring(0,6)}...${primaryAddr.substring(primaryAddr.length - 4)}` : 'N/A';
        const shortLinked = (linkedAddr && linkedAddr.toLowerCase() !== primaryAddr.toLowerCase()) 
          ? `${linkedAddr.substring(0,6)}...${linkedAddr.substring(linkedAddr.length - 4)}` 
          : '';

        const isGoogle = primaryAddr.startsWith('0xg') || !!u.email;
        const authBadge = isGoogle 
          ? (u.email ? `<br><span style="font-size:0.72rem; color:var(--color-accent);">🌐 ${u.email}</span>` : `<br><span style="font-size:0.72rem; color:var(--color-accent);">🌐 Google Account</span>`)
          : `<br><span style="font-size:0.72rem; color:var(--color-warning);">🦊 Web3 Wallet</span>`;

        const linkedWeb3Str = shortLinked 
          ? `<br><span style="font-size:0.72rem; color:var(--color-warning);">🔗 Linked: 🦊 ${shortLinked}</span>` 
          : '';

        const nameCol = u.username 
          ? `<strong style="color:var(--color-primary);">${u.username}</strong><br><span style="font-size:0.75rem; color:var(--text-dim); font-family:monospace;">${shortPrimary}</span>${authBadge}${linkedWeb3Str}`
          : `<span style="font-family: monospace; color: var(--color-accent);">${shortPrimary}</span>${authBadge}${linkedWeb3Str}`;

        const isVip = u.vip_until && new Date(u.vip_until).getTime() > Date.now();
        const vipCol = isVip
          ? `<span style="background: rgba(255,215,0,0.15); color: #ffd700; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem; border: 1px solid rgba(255,215,0,0.3);">👑 VIP</span>`
          : `<span style="color: var(--text-dim); font-size: 0.8rem;">Standard</span>`;

        const dodgeScore = u.game_highscore || 0;
        const invScore = u.invaders_highscore || 0;
        const driftScore = u.drift_highscore || 0;
        const arcadeSummary = `<span style="font-size: 0.75rem; color: var(--text-muted);" title="Dodge: ${dodgeScore} | Invaders: ${invScore} | Drift: ${driftScore}">⚡ ${dodgeScore} | 👾 ${invScore} | 🏎️ ${driftScore}</span>`;

        const isAmb = !!u.is_ambassador;
        const targetUserKey = u.player_id;
        const ambBtn = `<button onclick="toggleAmbassadorStatus('${targetUserKey}', ${!isAmb})" style="font-size:0.72rem; padding:0.25rem 0.55rem; background:${isAmb?'rgba(255,68,68,0.2)':'rgba(255,170,0,0.2)'}; color:${isAmb?'#ff4444':'var(--color-warning)'}; border:1px solid ${isAmb?'rgba(255,68,68,0.4)':'var(--color-warning)'}; border-radius:4px; font-weight:800; cursor:pointer;">${isAmb ? '🚫 Demote' : '⭐ Promote'}</button>`;
        const ambStatusStr = isAmb ? `<br><span style="font-size:0.65rem; color:var(--color-warning); font-weight:800;">🎖️ AMBASSADOR</span>` : '';

        tr.innerHTML = `
          <td style="padding: 0.75rem 0.5rem;">${nameCol}${ambStatusStr}</td>
          <td style="padding: 0.75rem 0.5rem; color: var(--color-primary); font-weight: 700;">${(u.balance_pgt || 0).toFixed(2)}</td>
          <td style="padding: 0.75rem 0.5rem; color: var(--color-accent); font-weight: 700;">${stakedPgtVal.toFixed(2)}</td>
          <td style="padding: 0.75rem 0.5rem;">${vipCol}</td>
          <td style="padding: 0.75rem 0.5rem;">${nftsCount}</td>
          <td style="padding: 0.75rem 0.5rem;">${u.referrals_count || 0}</td>
          <td style="padding: 0.75rem 0.5rem;">${stakesCount}</td>
          <td style="padding: 0.75rem 0.5rem;">${arcadeSummary}</td>
          <td style="padding: 0.75rem 0.5rem; text-align: right;">${ambBtn}</td>
        `;
        tableBody.appendChild(tr);
      });
    }
  }

  // Render Pagination Controls
  renderPaginationControls(sortedUsers.length, totalPages);
}

function updateSortIcons() {
  const columns = ['player', 'balance_pgt', 'staked_balance_pgt', 'vip', 'owned_nfts', 'referrals_count', 'stakes', 'arcade'];
  columns.forEach(col => {
    const iconEl = document.getElementById(`sort-icon-${col}`);
    if (iconEl) {
      if (col === currentSortColumn) {
        iconEl.innerText = currentSortOrder === 'asc' ? '▲' : '▼';
        iconEl.style.color = 'var(--color-primary)';
      } else {
        iconEl.innerText = '↕';
        iconEl.style.color = 'var(--text-dim)';
      }
    }
  });
}

function attachAdminTableListeners() {
  if (tableListenersAttached) return;
  tableListenersAttached = true;

  const headers = document.querySelectorAll('.admin-sort-header');
  headers.forEach(h => {
    h.addEventListener('click', () => {
      const col = h.getAttribute('data-sort');
      if (!col) return;
      if (currentSortColumn === col) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortColumn = col;
        currentSortOrder = (col === 'player') ? 'asc' : 'desc';
      }
      currentAdminPage = 1; // Reset to page 1 on sort change
      renderAdminPanel();
    });
  });
}

function renderPaginationControls(totalRecords, totalPages) {
  const infoEl = document.getElementById('admin-users-pagination-info');
  const btnsEl = document.getElementById('admin-users-pagination-btns');
  if (!infoEl || !btnsEl) return;

  if (totalRecords === 0) {
    infoEl.innerText = 'Showing 0 of 0 players';
    btnsEl.innerHTML = '';
    return;
  }

  const startRecord = (currentAdminPage - 1) * ADMIN_PAGE_SIZE + 1;
  const endRecord = Math.min(currentAdminPage * ADMIN_PAGE_SIZE, totalRecords);
  infoEl.innerText = `Showing ${startRecord}-${endRecord} of ${totalRecords} players`;

  btnsEl.innerHTML = '';

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-secondary';
  prevBtn.style.cssText = 'padding: 0.25rem 0.6rem; font-size: 0.8rem; line-height: 1; margin-right: 0.3rem;';
  prevBtn.innerText = '◀ Prev';
  prevBtn.disabled = currentAdminPage === 1;
  prevBtn.onclick = () => {
    if (currentAdminPage > 1) {
      currentAdminPage--;
      renderAdminPanel();
    }
  };
  btnsEl.appendChild(prevBtn);

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && Math.abs(i - currentAdminPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === 2 || i === totalPages - 1) {
        const dots = document.createElement('span');
        dots.innerText = '...';
        dots.style.cssText = 'padding: 0 0.2rem; color: var(--text-dim); font-size: 0.8rem;';
        btnsEl.appendChild(dots);
      }
      continue;
    }

    const pageBtn = document.createElement('button');
    pageBtn.className = i === currentAdminPage ? 'btn btn-primary' : 'btn btn-secondary';
    pageBtn.style.cssText = 'padding: 0.25rem 0.5rem; font-size: 0.8rem; line-height: 1; min-width: 28px; margin: 0 0.1rem;';
    pageBtn.innerText = i.toString();
    pageBtn.onclick = () => {
      currentAdminPage = i;
      renderAdminPanel();
    };
    btnsEl.appendChild(pageBtn);
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-secondary';
  nextBtn.style.cssText = 'padding: 0.25rem 0.6rem; font-size: 0.8rem; line-height: 1; margin-left: 0.3rem;';
  nextBtn.innerText = 'Next ▶';
  nextBtn.disabled = currentAdminPage === totalPages;
  nextBtn.onclick = () => {
    if (currentAdminPage < totalPages) {
      currentAdminPage++;
      renderAdminPanel();
    }
  };
  btnsEl.appendChild(nextBtn);
}

// Update Global Settings
export async function updateGlobalSettings() {
  const { triggerToast } = await import('../core/ui.js');
  if (!supabase) return;
  const inputEl = document.getElementById('admin-earn-multiplier');
  if (!inputEl) return;
  
  const newVal = parseFloat(inputEl.value);
  if (isNaN(newVal) || newVal < 0) {
    triggerToast('Invalid multiplier value', 'error');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({ id: 1, earn_multiplier: newVal });
      
    if (error) {
      console.warn("Error querying pol_payout_requests table:", error);
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--color-warning);">⚠️ Payout table not found or empty in Supabase. Please ensure scratch/add_10pct_pol_nft_referrals.sql was executed in Supabase SQL Editor.</td></tr>';
      return;
    }
    
    triggerToast(`Global Earn Multiplier updated to ${newVal}x`, 'success');
    
    // Also update locally so admin doesn't need to refresh to feel effects
    if (window.appState) {
      window.appState.update({ globalEarnMultiplier: newVal });
    }
  } catch (err) {
    console.error("Failed to update global settings:", err);
    triggerToast('Failed to save settings', 'error');
  }
}
window.updateGlobalSettings = updateGlobalSettings;

// Update Site Message
export async function updateSiteMessage() {
  const { triggerToast } = await import('../core/ui.js');
  if (!supabase) return;
  const inputEl = document.getElementById('admin-site-message');
  if (!inputEl) return;
  
  const msg = inputEl.value;
  
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({ id: 1, site_message: msg });
      
    if (error) {
      console.warn("Error querying pol_payout_requests table:", error);
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--color-warning);">⚠️ Payout table not found or empty in Supabase. Please ensure scratch/add_10pct_pol_nft_referrals.sql was executed in Supabase SQL Editor.</td></tr>';
      return;
    }
    
    triggerToast('Site announcement updated successfully!', 'success');
    
    // Also update locally
    if (window.appState) {
      window.appState.update({ siteMessage: msg });
      
      // Update UI immediately
      const banner = document.getElementById('site-announcement-banner');
      const bannerText = document.getElementById('site-announcement-text');
      if (banner && bannerText) {
        if (msg.trim().length > 0) {
          bannerText.innerText = msg;
          banner.style.display = 'flex';
        } else {
          banner.style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.error("Failed to update site message:", err);
    triggerToast('Failed to update message', 'error');
  }
}
window.updateSiteMessage = updateSiteMessage;

// Update Withdrawal Limits
export async function updateWithdrawalLimits() {
  const { triggerToast } = await import('../core/ui.js');
  if (!supabase) return;
  const minEl = document.getElementById('admin-min-withdraw');
  const maxEl = document.getElementById('admin-max-withdraw');
  if (!minEl || !maxEl) return;
  
  const minVal = parseFloat(minEl.value) || 10;
  const maxVal = parseFloat(maxEl.value) || 20000;
  
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({ id: 1, min_withdraw_pgt: minVal, max_withdraw_pgt: maxVal });
      
    if (error) {
      triggerToast('Failed to update withdrawal limits in DB: ' + error.message, 'error');
      return;
    }
    
    triggerToast(`Withdrawal limits updated! Min: ${minVal} PGT, Max: ${maxVal.toLocaleString()} PGT`, 'success');
    
    if (window.appState) {
      window.appState.update({ minWithdrawPgt: minVal, maxWithdrawPgt: maxVal });
    }
  } catch (err) {
    console.error("Failed to update withdrawal limits:", err);
    triggerToast('Failed to save withdrawal limits', 'error');
  }
}
window.updateWithdrawalLimits = updateWithdrawalLimits;

export async function updateTreasuryBalances() {
  const { web3Provider, NFT_CONTRACT_ADDRESS, TOKEN_CONTRACT_ADDRESS } = await import('../core/config.js');
  
  if (!web3Provider) return;
  
  try {
    if (NFT_CONTRACT_ADDRESS && NFT_CONTRACT_ADDRESS.length === 42) {
      const balance = await web3Provider.getBalance(NFT_CONTRACT_ADDRESS);
      document.getElementById('admin-nft-balance').innerText = window.ethers.formatEther(balance) + " POL";
    }
    if (TOKEN_CONTRACT_ADDRESS && TOKEN_CONTRACT_ADDRESS.length === 42) {
      const balance = await web3Provider.getBalance(TOKEN_CONTRACT_ADDRESS);
      document.getElementById('admin-token-balance').innerText = window.ethers.formatEther(balance) + " POL";
    }
  } catch (e) {
    console.error("Failed to fetch treasury balances:", e);
  }
}

export async function withdrawNFTTreasury() {
  const { realSigner, NFT_CONTRACT_ADDRESS } = await import('../core/config.js');
  const { triggerToast } = await import('../core/ui.js');

  if (!realSigner) { triggerToast("Admin wallet not connected.", "error"); return; }
  if (!NFT_CONTRACT_ADDRESS || NFT_CONTRACT_ADDRESS.length !== 42) return;

  try {
    triggerToast("Initiating NFT Treasury Withdrawal...", "success");
    const nftContract = new window.ethers.Contract(NFT_CONTRACT_ADDRESS, ["function withdrawFunds() external"], realSigner);
    const tx = await nftContract.withdrawFunds();
    triggerToast("Withdrawal pending on-chain...", "success");
    await tx.wait();
    triggerToast("Successfully swept NFT revenue to Admin Wallet!", "success");
    updateTreasuryBalances();
  } catch (err) {
    console.error("Treasury withdrawal failed:", err);
    triggerToast("Withdrawal failed: " + (err.reason || err.message), "error");
  }
}

export async function withdrawTokenTreasury() {
  const { realSigner, TOKEN_CONTRACT_ADDRESS } = await import('../core/config.js');
  const { triggerToast } = await import('../core/ui.js');

  if (!realSigner) { triggerToast("Admin wallet not connected.", "error"); return; }
  if (!TOKEN_CONTRACT_ADDRESS || TOKEN_CONTRACT_ADDRESS.length !== 42) return;

  try {
    triggerToast("Initiating Token Fee Withdrawal...", "success");
    const tokenContract = new window.ethers.Contract(TOKEN_CONTRACT_ADDRESS, ["function withdrawFunds() external"], realSigner);
    const tx = await tokenContract.withdrawFunds();
    triggerToast("Withdrawal pending on-chain...", "success");
    await tx.wait();
    triggerToast("Successfully swept Token fees to Admin Wallet!", "success");
    updateTreasuryBalances();
  } catch (err) {
    console.error("Treasury withdrawal failed:", err);
    triggerToast("Withdrawal failed: " + (err.reason || err.message), "error");
  }
}

window.withdrawNFTTreasury = withdrawNFTTreasury;
window.withdrawTokenTreasury = withdrawTokenTreasury;

// --- Chart Rendering ---
let adminMetricsChartInstance = null;

function renderMetricsChart(dailyData) {
  const ctx = document.getElementById('admin-metrics-chart');
  if (!ctx || !window.Chart) return;
  
  // Group by date, then by game
  const datesSet = new Set();
  const gameData = {};
  
  dailyData.forEach(d => {
    datesSet.add(d.metric_date);
    if (!gameData[d.game_name]) gameData[d.game_name] = {};
    const profit = (d.total_wagered || 0) - (d.total_payout || 0);
    gameData[d.game_name][d.metric_date] = profit;
  });
  
  const dates = Array.from(datesSet).sort(); // Sort chronologically
  
  // Generate datasets
  const colors = [
    '#00ffaa', // primary
    '#ff3366', // danger
    '#ffd700', // warning
    '#00d4ff', // accent
    '#ff66ff'
  ];
  
  const datasets = Object.keys(gameData).map((gameName, index) => {
    const color = colors[index % colors.length];
    return {
      label: gameName,
      data: dates.map(date => gameData[gameName][date] || 0),
      borderColor: color,
      backgroundColor: color + '33', // 20% opacity
      tension: 0.3,
      fill: true
    };
  });
  
  if (adminMetricsChartInstance) {
    adminMetricsChartInstance.destroy();
  }
  
  window.Chart.defaults.color = '#8e96a3'; // text-muted
  window.Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  
  adminMetricsChartInstance = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'House Net Profit (Daily)',
          color: '#00ffaa'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

let polChartInstance = null;

export async function renderPolRevenueChart(timeframe = 'day') {
  const canvas = document.getElementById('admin-pol-chart');
  if (!canvas || !window.Chart) return;

  ['day', 'week', 'month', 'year'].forEach(tf => {
    const btn = document.getElementById(`btn-pol-tf-${tf}`);
    if (btn) {
      if (tf === timeframe) {
        btn.style.background = 'var(--color-warning)';
        btn.style.color = '#000';
        btn.style.fontWeight = '700';
      } else {
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.color = 'var(--text-muted)';
        btn.style.fontWeight = 'normal';
      }
    }
  });

  const labels = [];
  const chartData = [];
  const now = new Date();

  if (timeframe === 'day') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      labels.push(`${d.getHours()}:00`);
      chartData.push(0);
    }
  } else if (timeframe === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
      chartData.push(0);
    }
  } else if (timeframe === 'month') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      chartData.push(0);
    }
  } else if (timeframe === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString('default', { month: 'short' }));
      chartData.push(0);
    }
  }

  if (supabase) {
    try {
      const { data: users } = await supabase.from('users').select('activities');
      if (users) {
        users.forEach(u => {
          if (Array.isArray(u.activities)) {
            u.activities.forEach(act => {
              if (act.val && act.val.includes('POL')) {
                const polVal = Math.abs(parseFloat(act.val.replace(/[^0-9.]/g, '')));
                if (!isNaN(polVal) && polVal > 0 && chartData.length > 0) {
                  chartData[chartData.length - 1] += polVal;
                }
              }
            });
          }
        });
      }
    } catch(e) {}
  }

  if (polChartInstance) {
    polChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 180);
  gradient.addColorStop(0, 'rgba(255, 170, 0, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 170, 0, 0.0)');

  polChartInstance = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'POL Revenue',
        data: chartData,
        backgroundColor: gradient,
        borderColor: '#ffaa00',
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` POL Revenue: ${context.parsed.y.toFixed(2)} POL`
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
            callback: (val) => val.toFixed(1) + ' POL'
          }
        }
      }
    }
  });
}

window.switchPolTimeframe = (tf) => renderPolRevenueChart(tf);

// --- Helper to ensure MetaMask is connected to Polygon Mainnet (Chain ID 137 / 0x89) ---
async function ensurePolygonNetwork() {
  if (!window.ethereum) return;
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== '0x89' && chainId !== '137' && chainId !== '0x89') {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x89',
              chainName: 'Polygon Mainnet',
              nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
              rpcUrls: ['https://polygon-bor-rpc.publicnode.com'],
              blockExplorerUrls: ['https://polygonscan.com/']
            }],
          });
        }
      }
    }
  } catch (err) {
    console.warn("Chain switch check:", err);
  }
}

// --- Master Admin Liquidity Pool Minting ---
export async function mintLiquidityPoolPGT() {
  const amountInput = document.getElementById('admin-mint-amount');
  const amount = amountInput ? parseFloat(amountInput.value) : 10000000;

  if (isNaN(amount) || amount <= 0) {
    if (window.triggerToast) window.triggerToast("Please enter a valid PGT amount to mint!", "error");
    return;
  }

  if (!window.ethereum) {
    if (window.triggerToast) window.triggerToast("MetaMask / Web3 Wallet not found! Please install MetaMask extension.", "error");
    return;
  }

  if (typeof window.ethers === 'undefined') {
    if (window.triggerToast) window.triggerToast("Ethers.js library not loaded!", "error");
    return;
  }

  try {
    // 1. Switch to Polygon Mainnet if needed
    await ensurePolygonNetwork();

    // 2. Request accounts from MetaMask
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

    if (userAddress.toLowerCase() !== "0x10b9993990c9ef8a212c9557cb02ad94da9a654d") {
      if (window.triggerToast) window.triggerToast(`Unauthorized: MetaMask connected to ${userAddress.substring(0,6)}... Master Admin Wallet (0x10B9...654d) required!`, "error");
      return;
    }

    if (window.triggerToast) window.triggerToast("Opening MetaMask to confirm On-Chain PGT Token Minting...", "info");

    const tokenAddress = TOKEN_CONTRACT_ADDRESS || "0x701100D19b1a93672cfe7291EA455b4220631209";
    const pgtAbi = [
      "function mint(address to, uint256 amount) external",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address account) view returns (uint256)"
    ];

    const tokenContract = new window.ethers.Contract(tokenAddress, pgtAbi, signer);
    const amountWei = window.ethers.parseUnits(amount.toString(), 18);

    // Trigger MetaMask transaction popup with explicit gas limit
    const tx = await tokenContract.mint(userAddress, amountWei, { gasLimit: 250000 });
    if (window.triggerToast) window.triggerToast(`Transaction Submitted! Tx Hash: ${tx.hash.substring(0,14)}... Confirming...`, "info");

    await tx.wait();

    if (window.appState && window.appState.state) {
      const currentBal = window.appState.state.balancePgt || 0;
      window.appState.update({ balancePgt: currentBal + amount });
    }

    if (window.triggerToast) {
      window.triggerToast(`🎉 ON-CHAIN SUCCESS! Minted ${amount.toLocaleString()} PGT directly to your MetaMask Wallet!`, "success");
    }

    if (typeof window.sendAdminAlert === 'function') {
      window.sendAdminAlert({
        category: 'ON-CHAIN PGT MINT',
        title: '👑 PGT Tokens Minted on Polygon',
        description: `Master Admin minted **${parseFloat(amount).toLocaleString()} PGT** to Master Admin Wallet.`,
        color: 0xFFAA00,
        fields: [
          { name: "Amount", value: `${parseFloat(amount).toLocaleString()} PGT`, inline: true },
          { name: "Tx Hash", value: tx.hash ? `[PolygonScan](https://polygonscan.com/tx/${tx.hash})` : 'Confirmed', inline: false }
        ]
      });
    }

    if (typeof loadAdminData === 'function') {
      loadAdminData();
    }
  } catch (err) {
    console.error("Minting Error:", err);
    if (err && (err.code === 4001 || (err.message && err.message.includes('rejected')))) {
      if (window.triggerToast) window.triggerToast("Transaction cancelled in MetaMask.", "warning");
      return;
    }
    const msg = (err && err.reason) ? err.reason : (err && err.message ? err.message : "Transaction failed");
    if (window.triggerToast) window.triggerToast(`Minting Failed: ${msg}`, "error");
  }
}
window.mintLiquidityPoolPGT = mintLiquidityPoolPGT;

// --- Master Admin NFT Minting Studio (OpenSea Ready) ---
export async function mintAdminNFT() {
  const typeSelect = document.getElementById('admin-nft-type');
  const recipientInput = document.getElementById('admin-nft-recipient');
  
  const nftTypeId = typeSelect ? typeSelect.value : 'nft_legendary_king';
  let recipient = recipientInput ? recipientInput.value.trim() : '';

  if (!window.ethereum) {
    if (window.triggerToast) window.triggerToast("MetaMask / Web3 Wallet not found! Please install MetaMask extension.", "error");
    return;
  }

  if (typeof window.ethers === 'undefined') {
    if (window.triggerToast) window.triggerToast("Ethers.js library not loaded!", "error");
    return;
  }

  try {
    // 1. Ensure connected to Polygon Mainnet (0x89 / 137)
    await ensurePolygonNetwork();

    // 2. Request accounts from MetaMask
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const adminAddress = await signer.getAddress();

    if (adminAddress.toLowerCase() !== "0x10b9993990c9ef8a212c9557cb02ad94da9a654d") {
      if (window.triggerToast) window.triggerToast(`Unauthorized: MetaMask connected to ${adminAddress.substring(0,6)}... Master Admin Wallet (0x10B9...654d) required!`, "error");
      return;
    }

    if (!recipient) {
      recipient = adminAddress;
    }

    if (!window.ethers.isAddress(recipient)) {
      if (window.triggerToast) window.triggerToast("Invalid recipient Polygon wallet address!", "error");
      return;
    }

    if (window.triggerToast) window.triggerToast(`Opening MetaMask to mint Utility NFT (${nftTypeId})...`, "info");

    const nftContractAddress = NFT_CONTRACT_ADDRESS || "0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8";
    const nftAbi = [
      "function mintUtilityNFT(address to, string memory nftTypeId) external returns (uint256)",
      "function ownerOf(uint256 tokenId) view returns (address)"
    ];

    const nftContract = new window.ethers.Contract(nftContractAddress, nftAbi, signer);

    // Call mintUtilityNFT with explicit gas limit to bypass gas estimation delay and open MetaMask immediately
    const tx = await nftContract.mintUtilityNFT(recipient, nftTypeId, { gasLimit: 350000 });
    if (window.triggerToast) window.triggerToast(`NFT Mint Submitted! Hash: ${tx.hash.substring(0,14)}... Confirming on Polygon...`, "info");

    await tx.wait();

    if (window.triggerToast) {
      window.triggerToast(`🎉 NFT MINTED ON-CHAIN! Viewable in MetaMask & ready to list/sell on OpenSea!`, "success");
    }

    if (typeof window.sendAdminAlert === 'function') {
      window.sendAdminAlert({
        category: 'ON-CHAIN NFT MINT',
        title: '👑 Admin Utility NFT Minted on Polygon',
        description: `Master Admin minted Utility NFT (\`${nftTypeId}\`) to wallet \`${recipient}\`. Ready for OpenSea listing!`,
        color: 0x00F0FF,
        fields: [
          { name: "NFT Type", value: nftTypeId, inline: true },
          { name: "Recipient", value: `${recipient.substring(0,6)}...${recipient.substring(38)}`, inline: true },
          { name: "Tx Hash", value: `[PolygonScan](https://polygonscan.com/tx/${tx.hash})`, inline: false }
        ]
      });
    }

    if (typeof loadAdminData === 'function') {
      loadAdminData();
    }
  } catch (err) {
    console.error("NFT Minting Error:", err);
    if (err && (err.code === 4001 || (err.message && err.message.includes('rejected')))) {
      if (window.triggerToast) window.triggerToast("Transaction cancelled in MetaMask.", "warning");
      return;
    }
    const msg = (err && err.reason) ? err.reason : (err && err.message ? err.message : "Transaction failed");
    if (window.triggerToast) window.triggerToast(`NFT Minting Failed: ${msg}`, "error");
  }
}
window.mintAdminNFT = mintAdminNFT;

// Helper for 50,000 PGT weekly pool allocation
function getWeeklyPrizeForRank(rank) {
  if (rank === 1) return 15000;
  if (rank === 2) return 8000;
  if (rank === 3) return 4000;
  if (rank <= 10) return 1000;
  if (rank <= 25) return 400;
  if (rank <= 50) return 200;
  if (rank <= 100) return 100;
  return 0;
}

// --- Automated & Manual Weekly 150,000 PGT Prize Distribution System ---
export async function distributeWeeklyPrizes() {
  if (!supabase) {
    if (window.triggerToast) window.triggerToast("Database connection missing!", "error");
    return;
  }

  if (!confirm("🏆 Confirm Weekly Payout: Distribute 150,000 PGT across Astro-Dodge, Cyber Invaders, and Cyber Drift leaderboards and reset weekly scores?")) {
    return;
  }

  const btn = document.getElementById('btn-distribute-weekly-prizes');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳ Processing 150,000 PGT Weekly Distribution...";
  }

  try {
    // 1. Try atomic PostgreSQL RPC distribution first (3 x 50k pools: AstroDodge, Invaders, Drift)
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('execute_weekly_payout_and_reset');

    if (!rpcErr && rpcRes && rpcRes.success) {
      const distributedTotal = rpcRes.total_distributed || 150000;
      const winnerCount = rpcRes.winner_count || 0;

      if (window.triggerToast) {
        window.triggerToast(`🏆 150,000 PGT WEEKLY POOLS DISTRIBUTED across 3 Games (${winnerCount} Winners)!`, "success");
      }

      // Trigger Discord Announcements
      if (typeof window.sendDiscordAlert === 'function') {
        window.sendDiscordAlert({
          title: `🏆 150,000 PGT WEEKLY LEADERBOARD PRIZES DISTRIBUTED!`,
          description: `The 150,000 PGT weekly gaming pool (3 x 50k PGT Pools) has been awarded across the **Top Players**!`,
          color: 0xFFAA00,
          fields: [
            { name: "🚀 Astro-Dodge Pool", value: `50,000 PGT`, inline: true },
            { name: "👾 Cyber Invaders Pool", value: `50,000 PGT`, inline: true },
            { name: "🏎️ Cyber Drift Pool", value: `50,000 PGT`, inline: true },
            { name: "🎁 Winners", value: `${winnerCount} Total Winner Entries`, inline: false }
          ]
        });
      }

      if (typeof window.sendAdminAlert === 'function') {
        window.sendAdminAlert({
          category: 'WEEKLY PAYOUT AUDIT',
          title: '👑 150,000 PGT Weekly Distribution Executed',
          description: `Master Admin triggered the 3 weekly prize pools. **${distributedTotal.toLocaleString()} PGT** awarded to ${winnerCount} players across 3 games.`,
          color: 0x00F0FF
        });
      }

      if (typeof loadAdminData === 'function') loadAdminData();
      return;
    }

    // Fallback: Client-Side distribution across 3 games if RPC is missing
    console.warn("Primary execute_weekly_payout_and_reset RPC failed or missing, executing client-side distribution...", rpcErr);
    const games = [
      { key: 'game_highscore', name: 'astrododge' },
      { key: 'invaders_highscore', name: 'invaders' },
      { key: 'drift_highscore', name: 'drift' }
    ];

    let distributedTotal = 0;
    let totalWinners = 0;
    const weekLabel = new Date().toISOString().split('T')[0];

    for (const g of games) {
      const { data: rawPlayers } = await supabase.from('users')
        .select('player_id, linked_wallet_address, ' + g.key)
        .gt(g.key, 0)
        .order(g.key, { ascending: false })
        .limit(100);

      if (!rawPlayers || rawPlayers.length === 0) continue;

      const archiveRows = [];
      for (let i = 0; i < rawPlayers.length; i++) {
        const rank = i + 1;
        const prizeAmt = getWeeklyPrizeForRank(rank);
        if (prizeAmt <= 0) break;

        const pId = rawPlayers[i].player_id;
        let payErr = null;
        const res1 = await supabase.rpc('credit_arcade_payout', { p_player_id: pId, p_amount: prizeAmt, p_game_name: 'Weekly Leaderboard' });
        if (res1.error) {
          const res2 = await supabase.rpc('credit_arcade_payout', { p_player_id: pId, p_amount: prizeAmt });
          if (res2.error) payErr = res2.error;
        }
        if (payErr) console.warn(`Prize credit failed for ${pId}:`, payErr.message || payErr);

        distributedTotal += prizeAmt;
        totalWinners++;

        archiveRows.push({
          week_label: weekLabel,
          game_type: g.name,
          rank: rank,
          player_id: pId,
          wallet_address: (rawPlayers[i].linked_wallet_address || pId).toLowerCase(),
          best_score: rawPlayers[i][g.key] || 0,
          prize_pgt: prizeAmt
        });
      }

      if (archiveRows.length > 0) {
        try { await supabase.from('weekly_leaderboard_history').insert(archiveRows); } catch (e) {}
      }
    }

    // Zero out active weekly high scores
    await supabase.from('users').update({ game_highscore: 0, invaders_highscore: 0, drift_highscore: 0 }).or('game_highscore.gt.0,invaders_highscore.gt.0,drift_highscore.gt.0');

    if (typeof window.sendDiscordAlert === 'function') {
      window.sendDiscordAlert({
        title: `🏆 150,000 PGT WEEKLY LEADERBOARD PRIZES DISTRIBUTED!`,
        description: `The 150,000 PGT weekly gaming pool (3 x 50k PGT Pools) has been awarded across the **Top Players**!`,
        color: 0xFFAA00,
        fields: [
          { name: "🚀 Astro-Dodge Pool", value: `50,000 PGT`, inline: true },
          { name: "👾 Cyber Invaders Pool", value: `50,000 PGT`, inline: true },
          { name: "🏎️ Cyber Drift Pool", value: `50,000 PGT`, inline: true },
          { name: "🎁 Winners", value: `${totalWinners} Total Winner Entries`, inline: false }
        ]
      });
    }

    if (typeof window.sendAdminAlert === 'function') {
      window.sendAdminAlert({
        category: 'WEEKLY PAYOUT AUDIT',
        title: '👑 150,000 PGT Weekly Distribution Executed (Fallback)',
        description: `Master Admin triggered weekly prize pools. **${distributedTotal.toLocaleString()} PGT** awarded to ${totalWinners} players across 3 games.`,
        color: 0x00F0FF
      });
    }

    if (window.triggerToast) {
      window.triggerToast(`🏆 150,000 PGT WEEKLY POOLS DISTRIBUTED to ${totalWinners} Winners!`, "success");
    }

    if (typeof loadAdminData === 'function') loadAdminData();
  } catch (err) {
    console.error("Weekly Distribution Error:", err);
    if (window.triggerToast) window.triggerToast(`Weekly Payout Error: ${err.message || err}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "🏆 Distribute 150,000 PGT Weekly Prizes Now";
    }
  }
}
window.distributeWeeklyPrizes = distributeWeeklyPrizes;

export async function resetCrateMetrics(crateName = 'PGT Cyber Mystery Crate') {
  if (!supabase) return;
  try {
    const { data: current } = await supabase
      .from('game_metrics')
      .select('*')
      .eq('game_name', crateName)
      .maybeSingle();

    if (current) {
      const w = current.total_wagered || 0;
      const p = current.total_payout || 0;
      const t = current.total_playtime_seconds || 0;
      if (w !== 0 || p !== 0 || t !== 0) {
        await supabase.rpc('log_game_metric', {
          p_game: crateName,
          p_wager: -w,
          p_payout: -p,
          p_playtime_seconds: -t
        });
      }
    }
    if (window.triggerToast) window.triggerToast(`Reset ${crateName} stats to 0!`, 'success');
    if (typeof loadAdminData === 'function') loadAdminData();
  loadPolPayoutRequests();
  } catch (err) {
    console.error("Reset crate metrics error:", err);
    if (window.triggerToast) window.triggerToast("Failed to reset crate metrics: " + (err.message || err), "error");
  }
}
window.resetCrateMetrics = resetCrateMetrics;

export async function recalibrateGameMetrics(gameName = 'Cyber Drift') {
  if (!supabase) return;
  try {
    const { data: current } = await supabase
      .from('game_metrics')
      .select('*')
      .eq('game_name', gameName)
      .maybeSingle();

    if (current) {
      const payout = parseFloat(current.total_payout || 0);
      // Target balanced earn rate: 2.0 PGT / minute
      const correctedSeconds = Math.max(60, Math.round((payout / 2.0) * 60));
      await supabase
        .from('game_metrics')
        .update({ 
          total_playtime_seconds: correctedSeconds,
          updated_at: new Date().toISOString()
        })
        .eq('game_name', gameName);

      if (window.triggerToast) window.triggerToast(`Recalibrated ${gameName} metrics! Earn rate normalized to ~2.00 PGT/min.`, 'success');
      if (typeof loadAdminData === 'function') loadAdminData();
    } else {
      if (window.triggerToast) window.triggerToast(`No metrics row found for ${gameName}.`, 'error');
    }
  } catch (err) {
    console.error("Recalibrate game metrics error:", err);
    if (window.triggerToast) window.triggerToast("Failed to recalibrate metrics: " + (err.message || err), "error");
  }
}

export async function resetArcadeMetrics() {
  if (!confirm("⚠️ Confirm Arcade Metrics Reset: This will reset Total Playtime, Total Payout, and Earn Rates to 0 for AstroDodge, Cyber Invaders, and Cyber Drift. Continue?")) {
    return;
  }
  if (!supabase) return;

  try {
    const arcadeGames = ['AstroDodge', 'Cyber Invaders', 'Cyber Drift'];
    const nowIso = new Date().toISOString();

    for (const game of arcadeGames) {
      await supabase
        .from('game_metrics')
        .update({
          total_wagered: 0,
          total_payout: 0,
          total_playtime_seconds: 0,
          updated_at: nowIso
        })
        .eq('game_name', game);
    }

    // Save last reset timestamp in global_settings and localStorage
    try {
      await supabase
        .from('global_settings')
        .update({ arcade_last_reset: nowIso })
        .eq('id', 1);
    } catch (e) {
      console.warn("Could not persist arcade_last_reset to global_settings:", e);
    }
    localStorage.setItem('polygame_arcade_last_reset', nowIso);

    if (window.triggerToast) window.triggerToast("Arcade game metrics reset successfully!", "success");
    if (typeof loadAdminData === 'function') loadAdminData();
  } catch (err) {
    console.error("Reset arcade metrics error:", err);
    if (window.triggerToast) window.triggerToast("Failed to reset arcade metrics: " + (err.message || err), "error");
  }
}
window.resetArcadeMetrics = resetArcadeMetrics;
window.recalibrateGameMetrics = recalibrateGameMetrics;



// Load & Render Admin POL Referral Payout Requests Queue
export async function loadPolPayoutRequests() {
  if (!supabase) return;
  const tableBody = document.getElementById('admin-pol-payouts-table');
  if (!tableBody) return;

  try {
    const { data: requests, error } = await supabase
      .from('pol_payout_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error) {
      console.warn("Error querying pol_payout_requests table:", error);
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--color-warning);">⚠️ Payout table not found or empty in Supabase. Please ensure scratch/add_10pct_pol_nft_referrals.sql was executed in Supabase SQL Editor.</td></tr>';
      return;
    }

    if (!requests || requests.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-dim);">No POL payout requests submitted yet.</td></tr>';
      return;
    }

    let html = '';
    requests.forEach(req => {
      const isPending = req.status === 'pending';
      const statusBadge = isPending 
        ? '<span style="color:var(--color-warning); font-weight:700;">⏳ Pending</span>'
        : req.status === 'paid'
        ? '<span style="color:var(--color-success); font-weight:700;">✅ Paid On-Chain</span>'
        : '<span style="color:var(--color-danger); font-weight:700;">❌ Rejected</span>';

      const dateStr = req.requested_at ? new Date(req.requested_at).toLocaleString() : '--';
      const userDisplay = req.username ? `${req.username} (${req.wallet_address.substring(0,6)}...)` : req.wallet_address;

      const actionBtn = isPending
        ? `<button class="btn-primary" onclick="approveAndPayPolReferral('${req.id}', '${req.wallet_address}', ${req.amount_pol})" style="background:var(--color-primary); color:#000; font-weight:800; font-size:0.75rem; padding:0.35rem 0.75rem;">💎 Approve & Pay POL</button>`
        : req.tx_hash
        ? `<a href="https://polygonscan.com/tx/${req.tx_hash}" target="_blank" style="color:var(--color-accent); font-size:0.75rem; text-decoration:underline;">Tx Receipt ↗</a>`
        : '--';

      html += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem;">
          <td style="padding:0.75rem; font-weight:700;">${userDisplay}</td>
          <td style="padding:0.75rem; font-weight:800; color:var(--color-primary);">${parseFloat(req.amount_pol).toFixed(4)} POL</td>
          <td style="padding:0.75rem;">${statusBadge}</td>
          <td style="padding:0.75rem; color:var(--text-dim);">${dateStr}</td>
          <td style="padding:0.75rem; text-align:right;">${actionBtn}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  } catch (err) {
    console.error("Failed to load POL payout requests:", err);
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--color-danger);">Failed to load payout queue.</td></tr>';
  }
}
window.loadPolPayoutRequests = loadPolPayoutRequests;

// Master Admin Approve & Pay POL On-Chain
export async function approveAndPayPolReferral(requestId, walletAddress, amountPol) {
  if (typeof window.triggerToast !== 'function') return;

  if (typeof window.ethereum === 'undefined' || typeof window.ethers === 'undefined') {
    window.triggerToast("MetaMask or Web3 wallet extension not detected in browser!", "error");
    return;
  }

  try {
    // Request accounts from MetaMask
    const provider = new window.ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const currentAdminAddr = (await signer.getAddress()).toLowerCase();

    const expectedAdmin = (ADMIN_WALLET_ADDRESS || "0x10B9993990c9EF8a212c9557cB02aD94da9a654d").toLowerCase();
    
    // Verify connected account is Master Admin
    if (currentAdminAddr !== expectedAdmin) {
      window.triggerToast(`Connected wallet (${currentAdminAddr.substring(0,6)}...) is not Master Admin (${expectedAdmin.substring(0,6)}...). Please switch accounts in MetaMask!`, "error");
      return;
    }

    let targetEvmAddress = walletAddress ? walletAddress.trim().toLowerCase() : '';

    // Verify target is a valid 42-char 0x Ethereum address (prevents Ethers ENS resolution error)
    if (!window.ethers.isAddress(targetEvmAddress)) {
      const { data: targetUser } = await supabase
        .from('users')
        .select('linked_wallet_address, player_id')
        .or(`player_id.ilike.${targetEvmAddress},linked_wallet_address.ilike.${targetEvmAddress}`)
        .maybeSingle();

      if (targetUser && targetUser.linked_wallet_address && window.ethers.isAddress(targetUser.linked_wallet_address)) {
        targetEvmAddress = targetUser.linked_wallet_address.toLowerCase();
      }
    }

    if (!window.ethers.isAddress(targetEvmAddress)) {
      window.triggerToast(`Cannot send POL: Player profile (${walletAddress.substring(0, 10)}...) does not have a valid linked Web3 wallet address!`, "error");
      return;
    }

    window.triggerToast(`Initiating ${amountPol} POL payout to ${targetEvmAddress.substring(0,6)}... Confirm in MetaMask`, "info");

    const tx = await signer.sendTransaction({
      to: targetEvmAddress,
      value: window.ethers.parseEther(amountPol.toString())
    });

    window.triggerToast("On-chain transaction sent! Waiting for Polygon confirmation...", "info");
    await tx.wait();

    // Mark as paid in DB
    await supabase.rpc('complete_pol_payout_request', {
      p_request_id: requestId,
      p_tx_hash: tx.hash
    });

    if (window.sfx && window.sfx.playSuccess) window.sfx.playSuccess();
    window.triggerToast(`🎉 POL Payout of ${amountPol} POL sent on-chain! Tx: ${tx.hash.substring(0,10)}...`, "success");
    loadPolPayoutRequests();
    if (typeof loadAdminData === 'function') loadAdminData();
  } catch (err) {
    console.error("POL Admin Payout Exception:", err);
    window.triggerToast("Payment failed: " + (err.reason || err.message || err), "error");
  }
}
window.approveAndPayPolReferral = approveAndPayPolReferral;


// Promote / Demote Ambassador Status
export async function toggleAmbassadorStatus(targetWallet, isAmbassador) {
  if (!supabase || !targetWallet) return;
  const cleanAddr = targetWallet.toLowerCase().trim();

  try {
    let success = false;
    let errorMsg = null;

    // Try RPC first
    const { data: res, error } = await supabase.rpc('toggle_ambassador_status', {
      p_target_wallet: cleanAddr,
      p_is_ambassador: isAmbassador
    });

    if (!error && res && res.success) {
      success = true;
    } else {
      if (error) console.warn("[toggleAmbassadorStatus] RPC notice:", error.message || error);
      
      // Direct REST fallback if RPC table/column migration is pending in SQL Editor
      const { data: updateRes, error: updateErr } = await supabase
        .from('users')
        .update({ is_ambassador: isAmbassador, updated_at: new Date().toISOString() })
        .or(`player_id.ilike.${cleanAddr},linked_wallet_address.ilike.${cleanAddr}`)
        .select('player_id');

      if (!updateErr && updateRes && updateRes.length > 0) {
        success = true;
      } else {
        errorMsg = updateErr ? updateErr.message : (res?.error || "User record not found");
      }
    }

    if (success) {
      const actionStr = isAmbassador ? "⭐ Promoted to Official Ambassador!" : "🚫 Demoted from Ambassador";
      const shortLabel = (cleanAddr.length >= 10) ? `${cleanAddr.substring(0, 6)}...${cleanAddr.substring(cleanAddr.length - 4)}` : cleanAddr;
      if (window.triggerToast) window.triggerToast(`User ${shortLabel} ${actionStr}`, "success");
      if (window.sfx && window.sfx.playSuccess) window.sfx.playSuccess();
      if (typeof loadAdminData === 'function') loadAdminData();
    } else {
      if (window.triggerToast) window.triggerToast(`Failed to update ambassador status: ${errorMsg}`, "error");
    }
  } catch (err) {
    console.error("Ambassador toggle exception:", err);
    if (window.triggerToast) window.triggerToast("Error updating status: " + (err.message || err), "error");
  }
}
window.toggleAmbassadorStatus = toggleAmbassadorStatus;


export function handleAdminUserSearch(query) {
  adminSearchQuery = query || '';
  currentAdminPage = 1;
  renderAdminPanel(cachedAdminUsers || []);
}
window.handleAdminUserSearch = handleAdminUserSearch;
