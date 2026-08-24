import { supabase, TOKEN_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS, RELICS_CONTRACT_ADDRESS, ADMIN_WALLET_ADDRESS, APP_VERSION } from '../core/config.js';

// --- Admin Panel Fetch and Render ---

export async function loadAdminData() {
  if (!supabase) return;
  const tableBody = document.getElementById('admin-users-table');
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-dim);">Loading global database...</td></tr>';

  try {
    const [{ data: users, error }, { data: activeStakes, error: stakesErr }] = await Promise.all([
      supabase.from('users').select('*').order('balance_pgt', { ascending: false }),
      supabase.from('user_stakes').select('wallet_address, amount, pool').eq('active', true)
    ]);

    if (error) {
      console.warn("Error querying users table:", error);
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--color-warning);">⚠️ Failed to load users data from Supabase.</td></tr>';
      return;
    }

    if (stakesErr) console.warn("[loadAdminData] user_stakes query warning:", stakesErr);

    // Map active stakes from user_stakes table by lowercase wallet_address / player_id
    const stakesMap = {};
    const stakesCountMap = {};
    (activeStakes || []).forEach(s => {
      if (s.pool === 'pgt' || !s.pool) {
        const key = (s.wallet_address || '').toLowerCase().trim();
        const amt = parseFloat(s.amount) || 0;
        if (key) {
          stakesMap[key] = (stakesMap[key] || 0) + amt;
          stakesCountMap[key] = (stakesCountMap[key] || 0) + 1;
        }
      }
    });

    (users || []).forEach(u => {
      const pidKey = (u.player_id || '').toLowerCase().trim();
      const walletKey = (u.linked_wallet_address || '').toLowerCase().trim();
      let liveStaked = 0;
      let liveCount = 0;

      if (stakesMap[pidKey] !== undefined || (walletKey && stakesMap[walletKey] !== undefined)) {
        liveStaked = (stakesMap[pidKey] || 0) + (walletKey && walletKey !== pidKey ? (stakesMap[walletKey] || 0) : 0);
        liveCount = (stakesCountMap[pidKey] || 0) + (walletKey && walletKey !== pidKey ? (stakesCountMap[walletKey] || 0) : 0);
      } else if (Array.isArray(u.stakes) && u.stakes.length > 0) {
        liveStaked = u.stakes.reduce((sum, s) => (!s.pool || s.pool.toLowerCase() === 'pgt' ? sum + (parseFloat(s.amount) || 0) : sum), 0);
        liveCount = u.stakes.length;
      }
      u._liveStakedPgt = liveStaked;
      u._liveStakesCount = liveCount;
    });
    
    renderAdminPanel(users || []);
    updateTreasuryBalances();
    renderPolRevenueChart('month');
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
            } else if (action.includes('astrododge') || action.includes('astro-dodge') || action.includes('dodge')) {
              userArcadePayouts['AstroDodge'] = (userArcadePayouts['AstroDodge'] || 0) + amt;
            } else if (action.includes('invaders')) {
              userArcadePayouts['Cyber Invaders'] = (userArcadePayouts['Cyber Invaders'] || 0) + amt;
            } else if (action.includes('stacker') || action.includes('catcher')) {
              userArcadePayouts['Cyber Stacker'] = (userArcadePayouts['Cyber Stacker'] || 0) + amt;
            }
          }
        });
      }
    });

    if (arcadeTable) {
      arcadeTable.innerHTML = '';
      const ARCADE_GAMES = ['Cyber Invaders', 'Cyber Drift', 'AstroDodge', 'Cyber Stacker'];
      const metricsMap = {};
      (metricsData || []).forEach(m => {
        if (m && m.game_name) metricsMap[m.game_name] = m;
      });

      ARCADE_GAMES.forEach(gameName => {
        const metric = metricsMap[gameName] || (gameName === 'Cyber Stacker' ? metricsMap['Cyber Catcher'] : null) || {};
        const fallbackPayout = userArcadePayouts[gameName] || (gameName === 'Cyber Stacker' ? userArcadePayouts['Cyber Catcher'] : 0) || 0;
        const totalPayout = (metric.total_payout != null && parseFloat(metric.total_payout) > 0) ? parseFloat(metric.total_payout) : fallbackPayout;
        const totalPlaytime = metric.total_playtime_seconds != null ? parseFloat(metric.total_playtime_seconds) : 0;

        let earnRate = "0.00 PGT/min";
        let playtimeStr = "0m 0s";

        if (totalPlaytime > 0) {
          const minutes = totalPlaytime / 60;
          playtimeStr = `${Math.floor(minutes)}m ${Math.floor(totalPlaytime % 60)}s`;
          earnRate = (totalPayout / minutes).toFixed(2) + " PGT/min";
        }

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        tr.innerHTML = `
          <td style="padding: 0.75rem; font-weight: 700;">${gameName}</td>
          <td style="padding: 0.75rem;">${playtimeStr}</td>
          <td style="padding: 0.75rem; color: var(--color-primary); font-weight: 700;">${totalPayout.toFixed(2)} PGT</td>
          <td style="padding: 0.75rem; font-weight: 700; color: var(--color-warning);">${earnRate}</td>
        `;
        arcadeTable.appendChild(tr);
      });
    }

    if (casinoTable) {
      casinoTable.innerHTML = '';
      const CASINO_GAMES = ['Roshambo', 'Lucky Spinner', 'Neon Plinko', 'Cyber-Crash'];
      const casinoMetrics = (metricsData || []).filter(m => CASINO_GAMES.includes(m.game_name));

      if (casinoMetrics.length === 0) {
        casinoTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-dim);">No casino metrics recorded yet.</td></tr>';
      } else {
        casinoMetrics.forEach(metric => {
          const totalWagered = metric.total_wagered != null ? parseFloat(metric.total_wagered) : 0;
          const totalPayout = metric.total_payout != null ? parseFloat(metric.total_payout) : 0;
          const profit = totalWagered - totalPayout;
          const profitColor = profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)';
          
          let winPctStr = "";
          if (totalWagered > 0) {
            const winPct = (totalPayout / totalWagered) * 100;
            winPctStr = ` (${winPct.toFixed(1)}%)`;
          }

          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
          tr.innerHTML = `
            <td style="padding: 0.75rem; font-weight: 700;">${metric.game_name}</td>
            <td style="padding: 0.75rem;">${totalWagered.toFixed(2)} PGT</td>
            <td style="padding: 0.75rem;">${totalPayout.toFixed(2)} PGT</td>
            <td style="padding: 0.75rem; font-weight: 700; color: ${profitColor};">${profit >= 0 ? '+' : ''}${profit.toFixed(2)} PGT${winPctStr}</td>
          `;
          casinoTable.appendChild(tr);
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
      .select('earn_multiplier, site_message, guest_visitors, min_withdraw_pgt, max_withdraw_pgt, max_weekly_withdrawals, max_daily_plays_per_game, game_payout_settings, discord_webhook_url, discord_admin_webhook_url, discord_announcements_webhook_url')
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
        if (maxEl) maxEl.value = parseFloat(settingsData.max_withdraw_pgt || 100000);
      }
      if (settingsData.max_weekly_withdrawals !== undefined) {
        const weeklyEl = document.getElementById('admin-weekly-quota-withdraw');
        if (weeklyEl) weeklyEl.value = parseInt(settingsData.max_weekly_withdrawals || 5);
      }
      if (settingsData.max_daily_plays_per_game !== undefined) {
        const dailyPlaysEl = document.getElementById('admin-max-daily-plays');
        if (dailyPlaysEl) dailyPlaysEl.value = parseInt(settingsData.max_daily_plays_per_game || 25);
      }
      if (settingsData.site_message !== undefined) {
        const msgEl = document.getElementById('admin-site-message');
        if (msgEl) msgEl.value = settingsData.site_message;
      }
      // Populate Discord Webhook inputs
      const mainHookEl = document.getElementById('admin-discord-main-webhook');
      if (mainHookEl && settingsData.discord_webhook_url) mainHookEl.value = settingsData.discord_webhook_url;
      const adminHookEl = document.getElementById('admin-discord-admin-webhook');
      if (adminHookEl && settingsData.discord_admin_webhook_url) adminHookEl.value = settingsData.discord_admin_webhook_url;
      const annHookEl = document.getElementById('admin-discord-announcements-webhook');
      if (annHookEl && settingsData.discord_announcements_webhook_url) annHookEl.value = settingsData.discord_announcements_webhook_url;

      const guestValEl = document.getElementById('admin-stat-guest-visitors');
      if (guestValEl) {
        guestValEl.innerText = (settingsData.guest_visitors || 0).toLocaleString();
      }

      if (settingsData.game_payout_settings && window.appState) {
        window.appState.update({ gamePayoutSettings: settingsData.game_payout_settings });
      }
      renderGamePayoutSettings(settingsData.game_payout_settings);
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
  if (u && u._liveStakedPgt !== undefined) return u._liveStakedPgt;
  let val = parseFloat((u && u.staked_balance_pgt) || 0);
  if ((!val || val === 0) && u && Array.isArray(u.stakes) && u.stakes.length > 0) {
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

    const userStakesCount = u._liveStakesCount !== undefined ? u._liveStakesCount : (Array.isArray(u.stakes) ? u.stakes.length : 0);
    totalActiveStakesCount += userStakesCount;
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
        valA = a._liveStakesCount !== undefined ? a._liveStakesCount : (Array.isArray(a.stakes) ? a.stakes.length : 0);
        valB = b._liveStakesCount !== undefined ? b._liveStakesCount : (Array.isArray(b.stakes) ? b.stakes.length : 0);
        break;
      case 'arcade':
        valA = Math.max(a.game_highscore || 0, a.invaders_highscore || 0, a.drift_highscore || 0);
        valB = Math.max(b.game_highscore || 0, b.invaders_highscore || 0, b.drift_highscore || 0);
        break;
      case 'app_version':
        valA = (a.app_version || '').toLowerCase();
        valB = (b.app_version || '').toLowerCase();
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
      tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:1.5rem; color:var(--text-dim);">No player records found.</td></tr>';
    } else {
      pageUsers.forEach(u => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

        let nftsCount = Array.isArray(u.owned_nfts) ? u.owned_nfts.length : 0;
        let stakesCount = u._liveStakesCount !== undefined ? u._liveStakesCount : (Array.isArray(u.stakes) ? u.stakes.length : 0);
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

        const rawVer = u.app_version || '';
        const cleanVer = rawVer.startsWith('v') ? rawVer.substring(1) : rawVer;
        const isLatest = cleanVer === APP_VERSION || rawVer === `v${APP_VERSION}`;
        const verBadge = rawVer 
          ? `<span style="background:${isLatest ? 'rgba(0,255,136,0.12)' : 'rgba(255,170,0,0.12)'}; color:${isLatest ? 'var(--color-success)' : 'var(--color-warning)'}; border:1px solid ${isLatest ? 'rgba(0,255,136,0.3)' : 'rgba(255,170,0,0.3)'}; padding:0.2rem 0.45rem; border-radius:4px; font-weight:700; font-size:0.72rem; font-family:monospace;">${rawVer}</span>`
          : `<span style="color:var(--text-dim); font-size:0.72rem; font-family:monospace;">Legacy</span>`;

        const isAmb = !!u.is_ambassador;
        const targetUserKey = u.player_id;
        const ambBtn = `<button onclick="toggleAmbassadorStatus('${targetUserKey}', ${!isAmb})" style="font-size:0.72rem; padding:0.25rem 0.55rem; background:${isAmb?'rgba(255,68,68,0.2)':'rgba(255,170,0,0.2)'}; color:${isAmb?'#ff4444':'var(--color-warning)'}; border:1px solid ${isAmb?'rgba(255,68,68,0.4)':'var(--color-warning)'}; border-radius:4px; font-weight:800; cursor:pointer;">${isAmb ? '🚫 Demote' : '⭐ Promote'}</button>`;
        const ambStatusStr = isAmb ? `<br><span style="font-size:0.65rem; color:var(--color-warning); font-weight:800;">🎖️ AMBASSADOR</span>` : '';

        const syncTarget = u.linked_wallet_address || u.player_id || '';
        const syncBtn = syncTarget && (syncTarget.startsWith('0x') && syncTarget.length === 42 && !syncTarget.startsWith('0xpgt') && !syncTarget.startsWith('0xg'))
          ? `<button onclick="resyncPlayerNftsFromAdmin('${syncTarget}')" title="Scan & Resync On-Chain NFTs/Relics" style="font-size:0.72rem; padding:0.25rem 0.55rem; background:rgba(189,0,255,0.15); color:#d946ef; border:1px solid #bd00ff; border-radius:4px; font-weight:800; cursor:pointer; margin-left:4px;">🔄 Sync</button>`
          : '';

        tr.innerHTML = `
          <td style="padding: 0.75rem 0.5rem;">${nameCol}${ambStatusStr}</td>
          <td style="padding: 0.75rem 0.5rem; color: var(--color-primary); font-weight: 700;">${(u.balance_pgt || 0).toFixed(2)}</td>
          <td style="padding: 0.75rem 0.5rem; color: var(--color-accent); font-weight: 700;">${stakedPgtVal.toFixed(2)}</td>
          <td style="padding: 0.75rem 0.5rem;">${vipCol}</td>
          <td style="padding: 0.75rem 0.5rem;">${nftsCount}</td>
          <td style="padding: 0.75rem 0.5rem;">${u.referrals_count || 0}</td>
          <td style="padding: 0.75rem 0.5rem;">${stakesCount}</td>
          <td style="padding: 0.75rem 0.5rem;">${arcadeSummary}</td>
          <td style="padding: 0.75rem 0.5rem;">${verBadge}</td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; white-space: nowrap;">${ambBtn}${syncBtn}</td>
        `;
        tableBody.appendChild(tr);
      });
    }
  }

  // Render Pagination Controls
  renderPaginationControls(sortedUsers.length, totalPages);
}

function updateSortIcons() {
  const columns = ['player', 'balance_pgt', 'staked_balance_pgt', 'vip', 'owned_nfts', 'referrals_count', 'stakes', 'arcade', 'app_version'];
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
  const weeklyEl = document.getElementById('admin-weekly-quota-withdraw');
  if (!minEl || !maxEl) return;
  
  const minVal = parseFloat(minEl.value) || 10;
  const maxVal = parseFloat(maxEl.value) || 100000;
  const weeklyVal = parseInt(weeklyEl ? weeklyEl.value : 5) || 5;
  
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({ 
        id: 1, 
        min_withdraw_pgt: minVal, 
        max_withdraw_pgt: maxVal,
        max_weekly_withdrawals: weeklyVal
      });
      
    if (error) {
      triggerToast('Failed to update withdrawal limits in DB: ' + error.message, 'error');
      return;
    }
    
    triggerToast(`Withdrawal limits updated! Min: ${minVal} PGT, Max: ${maxVal.toLocaleString()} PGT, Weekly Quota: ${weeklyVal}`, 'success');
    
    if (window.appState) {
      window.appState.update({ 
        minWithdrawPgt: minVal, 
        maxWithdrawPgt: maxVal,
        maxWeeklyWithdrawals: weeklyVal
      });
    }
  } catch (err) {
    console.error("Failed to update withdrawal limits:", err);
    triggerToast('Failed to save withdrawal limits', 'error');
  }
}
window.updateWithdrawalLimits = updateWithdrawalLimits;

// Update Daily Play Limits
export async function updateDailyPlayLimits() {
  const { triggerToast } = await import('../core/ui.js');
  if (!supabase) return;
  const inputEl = document.getElementById('admin-max-daily-plays');
  if (!inputEl) return;

  const maxPlays = parseInt(inputEl.value) || 25;

  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        id: 1,
        max_daily_plays_per_game: maxPlays
      });

    if (error) {
      triggerToast('Failed to update daily play limit: ' + error.message, 'error');
      return;
    }

    triggerToast(`Daily play limits updated to ${maxPlays} plays per game!`, 'success');

    if (window.appState) {
      window.appState.update({
        maxDailyPlaysPerGame: maxPlays
      });
    }
  } catch (err) {
    console.error("Failed to update daily play limits:", err);
    triggerToast('Failed to save daily play limits', 'error');
  }
}
window.updateDailyPlayLimits = updateDailyPlayLimits;

// Update Discord Webhooks in global_settings
export async function updateDiscordWebhooks() {
  const { triggerToast } = await import('../core/ui.js');
  if (!supabase) return;
  const mainEl = document.getElementById('admin-discord-main-webhook');
  const adminEl = document.getElementById('admin-discord-admin-webhook');
  const annEl = document.getElementById('admin-discord-announcements-webhook');

  const mainUrl = mainEl ? mainEl.value.trim() : '';
  const adminUrl = adminEl ? adminEl.value.trim() : '';
  const annUrl = annEl ? annEl.value.trim() : '';

  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        id: 1,
        discord_webhook_url: mainUrl,
        discord_admin_webhook_url: adminUrl,
        discord_announcements_webhook_url: annUrl
      });

    if (error) {
      triggerToast('Failed to save Discord Webhooks: ' + error.message, 'error');
      return;
    }

    const hooks = {
      main: mainUrl,
      admin: adminUrl,
      announcements: annUrl
    };
    try { localStorage.setItem('polygame_discord_webhooks', JSON.stringify(hooks)); } catch (e) {}
    if (window.appState && window.appState.state) {
      window.appState.state.discordWebhooks = hooks;
    }

    triggerToast('Discord Webhooks saved successfully!', 'success');
  } catch (err) {
    console.error("Failed to update discord webhooks:", err);
    triggerToast('Failed to save Discord Webhooks', 'error');
  }
}
window.updateDiscordWebhooks = updateDiscordWebhooks;

export async function updateTreasuryBalances() {
  const { web3Provider, NFT_CONTRACT_ADDRESS, TOKEN_CONTRACT_ADDRESS } = await import('../core/config.js');
  
  if (!web3Provider) return;
  
  try {
    if (NFT_CONTRACT_ADDRESS && NFT_CONTRACT_ADDRESS.length === 42) {
      const balance = await web3Provider.getBalance(NFT_CONTRACT_ADDRESS);
      const el = document.getElementById('admin-nft-balance');
      if (el) el.innerText = window.ethers.formatEther(balance) + " POL";
    }
    if (TOKEN_CONTRACT_ADDRESS && TOKEN_CONTRACT_ADDRESS.length === 42) {
      const balance = await web3Provider.getBalance(TOKEN_CONTRACT_ADDRESS);
      const el = document.getElementById('admin-token-balance');
      if (el) el.innerText = window.ethers.formatEther(balance) + " POL";
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

export async function renderPolRevenueChart(timeframe = 'month') {
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
  const bucketKeys = [];
  const now = new Date();

  if (timeframe === 'day') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourStr = d.getHours().toString().padStart(2, '0');
      labels.push(`${hourStr}:00`);
      const ymd = d.toISOString().split('T')[0];
      bucketKeys.push(`${ymd}_${hourStr}`);
      chartData.push(0);
    }
  } else if (timeframe === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const ymd = d.toISOString().split('T')[0];
      labels.push(`${d.getMonth() + 1}/${d.getDate()} (${d.toLocaleDateString(undefined, { weekday: 'short' })})`);
      bucketKeys.push(ymd);
      chartData.push(0);
    }
  } else if (timeframe === 'month') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const ymd = d.toISOString().split('T')[0];
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      bucketKeys.push(ymd);
      chartData.push(0);
    }
  } else if (timeframe === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      labels.push(d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear().toString().substring(2));
      bucketKeys.push(ym);
      chartData.push(0);
    }
  }

  if (supabase) {
    try {
      // 1. Primary: Fetch from dedicated nft_sales table
      let hasNftSalesData = false;
      const { data: sales, error: salesErr } = await supabase
        .from('nft_sales')
        .select('price_pol, created_at');

      if (!salesErr && Array.isArray(sales) && sales.length > 0) {
        hasNftSalesData = true;
        sales.forEach(s => {
          const polAmt = parseFloat(s.price_pol || 0);
          if (polAmt <= 0) return;
          const sDate = (s.created_at || now.toISOString()).substring(0, 10);
          if (timeframe === 'day') {
            const todayStr = now.toISOString().split('T')[0];
            if (sDate === todayStr) {
              chartData[chartData.length - 1] += polAmt;
            }
          } else if (timeframe === 'week' || timeframe === 'month') {
            const idx = bucketKeys.indexOf(sDate);
            if (idx !== -1) chartData[idx] += polAmt;
            else chartData[chartData.length - 1] += polAmt;
          } else if (timeframe === 'year') {
            const ym = sDate.substring(0, 7);
            const idx = bucketKeys.indexOf(ym);
            if (idx !== -1) chartData[idx] += polAmt;
            else chartData[chartData.length - 1] += polAmt;
          }
        });
      }

      // 2. Fallback / Historical: Query game_metrics_daily for past POL crate records
      if (!hasNftSalesData) {
        const { data: metrics } = await supabase
          .from('game_metrics_daily')
          .select('game_name, metric_date, total_wagered');

        if (Array.isArray(metrics)) {
          metrics.forEach(m => {
            const gName = (m.game_name || '').toLowerCase();
            const isPol = gName.includes('pol') || gName.includes('marketplace') || gName.includes('relic');
            if (!isPol) return;

            const polAmt = parseFloat(m.total_wagered || 0);
            if (polAmt <= 0) return;

            const mDate = (m.metric_date || '').substring(0, 10);
            if (timeframe === 'day') {
              const todayStr = now.toISOString().split('T')[0];
              if (mDate === todayStr) {
                chartData[chartData.length - 1] += polAmt;
              }
            } else if (timeframe === 'week' || timeframe === 'month') {
              const idx = bucketKeys.indexOf(mDate);
              if (idx !== -1) {
                chartData[idx] += polAmt;
              }
            } else if (timeframe === 'year') {
              const ym = mDate.substring(0, 7);
              const idx = bucketKeys.indexOf(ym);
              if (idx !== -1) {
                chartData[idx] += polAmt;
              }
            }
          });
        }
      }

      // 2. Fetch from users.activities for any direct on-chain purchases
      const { data: users } = await supabase.from('users').select('activities, updated_at');
      if (Array.isArray(users)) {
        users.forEach(u => {
          if (Array.isArray(u.activities)) {
            const userDate = (u.updated_at || now.toISOString()).substring(0, 10);
            u.activities.forEach(act => {
              const rStr = (act.reward || act.val || '').toUpperCase();
              const aStr = (act.action || '').toUpperCase();
              if (rStr.includes('POL') || aStr.includes('POL')) {
                const match = (act.reward || act.val || '').match(/([0-9.]+)\s*POL/i);
                if (match) {
                  const amt = parseFloat(match[1]);
                  if (!isNaN(amt) && amt > 0 && !aStr.includes('CRATE')) {
                    if (timeframe === 'day') {
                      chartData[chartData.length - 1] += amt;
                    } else if (timeframe === 'week' || timeframe === 'month') {
                      const idx = bucketKeys.indexOf(userDate);
                      if (idx !== -1) chartData[idx] += amt;
                      else chartData[chartData.length - 1] += amt;
                    } else if (timeframe === 'year') {
                      const ym = userDate.substring(0, 7);
                      const idx = bucketKeys.indexOf(ym);
                      if (idx !== -1) chartData[idx] += amt;
                      else chartData[chartData.length - 1] += amt;
                    }
                  }
                }
              }
            });
          }
        });
      }
    } catch (e) {
      console.error("POL Revenue Chart query failed:", e);
    }
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
          beginAtZero: true,
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

// --- Quantum Relics Admin Minting (0 POL Fee) ---

export async function mintAdminRelic() {
  const typeSelect = document.getElementById('admin-relic-type');
  const recipientInput = document.getElementById('admin-relic-recipient');

  const relicId = typeSelect ? typeSelect.value : 'relic_astrododge_prism';
  let recipient = recipientInput ? recipientInput.value.trim() : '';

  if (!window.ethereum) {
    if (window.triggerToast) window.triggerToast("MetaMask / Web3 Wallet not found! Please install MetaMask.", "error");
    return;
  }

  if (typeof window.ethers === 'undefined') {
    if (window.triggerToast) window.triggerToast("Ethers.js library not ready. Please refresh.", "error");
    return;
  }

  try {
    await ensurePolygonNetwork();
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const adminAddress = await signer.getAddress();

    if (adminAddress.toLowerCase() !== ADMIN_WALLET_ADDRESS.toLowerCase()) {
      if (window.triggerToast) window.triggerToast(`Unauthorized: MetaMask connected to ${adminAddress.substring(0,6)}... Master Admin Wallet required!`, "error");
      return;
    }

    if (!recipient) {
      recipient = adminAddress;
    }

    if (!window.ethers.isAddress(recipient)) {
      if (window.triggerToast) window.triggerToast("Invalid recipient Polygon wallet address!", "error");
      return;
    }

    if (window.triggerToast) window.triggerToast(`Opening MetaMask to mint Quantum Relic (${relicId})...`, "info");

    const relicsContractAddress = RELICS_CONTRACT_ADDRESS || "0xdc7B10e6b765c28A276Cc3E95836217BdF7Da69e";
    const relicsAbi = [
      "function adminMintRelic(address recipient, string calldata relicId) external returns (uint256)",
      "function ownerOf(uint256 tokenId) view returns (address)"
    ];

    const contract = new window.ethers.Contract(relicsContractAddress, relicsAbi, signer);

    const tx = await contract.adminMintRelic(recipient, relicId, { gasLimit: 350000 });
    if (window.triggerToast) window.triggerToast(`Relic Mint Submitted! Hash: ${tx.hash.substring(0,14)}... Confirming on Polygon...`, "info");

    await tx.wait();

    if (window.triggerToast) {
      window.triggerToast(`🎉 QUANTUM RELIC MINTED ON POLYGON! 0 POL Fee Admin Mint Confirmed!`, "success");
    }

    if (typeof window.sendAdminAlert === 'function') {
      window.sendAdminAlert({
        category: 'ON-CHAIN RELIC MINT',
        title: '🏺 Admin Quantum Relic Minted on Polygon',
        description: `Master Admin minted Quantum Relic (\`${relicId}\`) to wallet \`${recipient}\` with 0 POL fee.`,
        color: 0xFFD700,
        fields: [
          { name: "Relic ID", value: relicId, inline: true },
          { name: "Recipient", value: `${recipient.substring(0,6)}...${recipient.substring(38)}`, inline: true },
          { name: "Tx Hash", value: `[PolygonScan](https://polygonscan.com/tx/${tx.hash})`, inline: false }
        ]
      });
    }

    if (typeof window.renderRelicsVault === 'function') {
      window.renderRelicsVault();
    }
  } catch (err) {
    console.error("Relic Minting Error:", err);
    if (err && (err.code === 4001 || (err.message && err.message.includes('rejected')))) {
      if (window.triggerToast) window.triggerToast("Transaction cancelled in MetaMask.", "warning");
      return;
    }
    const msg = (err && err.reason) ? err.reason : (err && err.message ? err.message : "Transaction failed");
    if (window.triggerToast) window.triggerToast(`Relic Minting Failed: ${msg}`, "error");
  }
}
window.mintAdminRelic = mintAdminRelic;

export async function mintAdminSeason1Set() {
  const recipientInput = document.getElementById('admin-relic-recipient');
  let recipient = recipientInput ? recipientInput.value.trim() : '';

  if (!window.ethereum) {
    if (window.triggerToast) window.triggerToast("MetaMask / Web3 Wallet not found! Please install MetaMask.", "error");
    return;
  }

  if (typeof window.ethers === 'undefined') {
    if (window.triggerToast) window.triggerToast("Ethers.js library not ready. Please refresh.", "error");
    return;
  }

  const s1Relics = [
    "relic_astrododge_prism", "relic_astrododge_deflector", "relic_astrododge_compass",
    "relic_invaders_core", "relic_invaders_dynamo", "relic_invaders_transmitter",
    "relic_drift_chronometer", "relic_drift_capacitor", "relic_drift_overdrive",
    "relic_stacker_foundation", "relic_stacker_keystone", "relic_stacker_monolith",
    "relic_space_darkmatter", "relic_space_warpcoil", "relic_space_plasma",
    "relic_apex_singularity", "relic_apex_genesis"
  ];

  try {
    await ensurePolygonNetwork();
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const adminAddress = await signer.getAddress();

    if (adminAddress.toLowerCase() !== ADMIN_WALLET_ADDRESS.toLowerCase()) {
      if (window.triggerToast) window.triggerToast(`Unauthorized: MetaMask connected to ${adminAddress.substring(0,6)}... Master Admin Wallet required!`, "error");
      return;
    }

    if (!recipient) {
      recipient = adminAddress;
    }

    if (!window.ethers.isAddress(recipient)) {
      if (window.triggerToast) window.triggerToast("Invalid recipient Polygon wallet address!", "error");
      return;
    }

    if (window.triggerToast) window.triggerToast(`Opening MetaMask to Batch Mint ALL 17 Season 1 Relics...`, "info");

    const relicsContractAddress = RELICS_CONTRACT_ADDRESS || "0xdc7B10e6b765c28A276Cc3E95836217BdF7Da69e";
    const relicsAbi = [
      "function adminBatchMintRelics(address recipient, string[] calldata relicIds) external returns (uint256[])"
    ];

    const contract = new window.ethers.Contract(relicsContractAddress, relicsAbi, signer);

    const tx = await contract.adminBatchMintRelics(recipient, s1Relics, { gasLimit: 2500000 });
    if (window.triggerToast) window.triggerToast(`Batch Mint Submitted! Hash: ${tx.hash.substring(0,14)}... Confirming 17 Relics on Polygon...`, "info");

    await tx.wait();

    if (window.triggerToast) {
      window.triggerToast(`👑 COMPLETE 17-PIECE SEASON 1 APEX SET MINTED! 1.5x Multiplier Unlocked!`, "success");
    }

    if (typeof window.sendAdminAlert === 'function') {
      window.sendAdminAlert({
        category: 'ON-CHAIN RELIC BATCH MINT',
        title: '👑 Complete Season 1 Apex Relics Set Minted',
        description: `Master Admin minted all 17 Season 1 Relics to wallet \`${recipient}\` in a single transaction.`,
        color: 0x00F0FF,
        fields: [
          { name: "Total Relics Minted", value: "17 Relics", inline: true },
          { name: "Recipient", value: `${recipient.substring(0,6)}...${recipient.substring(38)}`, inline: true },
          { name: "Tx Hash", value: `[PolygonScan](https://polygonscan.com/tx/${tx.hash})`, inline: false }
        ]
      });
    }

    if (typeof window.renderRelicsVault === 'function') {
      window.renderRelicsVault();
    }
  } catch (err) {
    console.error("Batch Relic Minting Error:", err);
    if (err && (err.code === 4001 || (err.message && err.message.includes('rejected')))) {
      if (window.triggerToast) window.triggerToast("Transaction cancelled in MetaMask.", "warning");
      return;
    }
    const msg = (err && err.reason) ? err.reason : (err && err.message ? err.message : "Transaction failed");
    if (window.triggerToast) window.triggerToast(`Batch Relic Minting Failed: ${msg}`, "error");
  }
}
window.mintAdminSeason1Set = mintAdminSeason1Set;

// 🎁 Grant In-Game Unminted Relic (Test Mode / Reward)
export async function grantAdminTestRelic() {
  const typeSelect = document.getElementById('admin-relic-type');
  const recipientInput = document.getElementById('admin-relic-recipient');

  const relicId = typeSelect ? typeSelect.value : 'relic_astrododge_prism';
  let recipient = recipientInput ? recipientInput.value.trim() : (window.appState && window.appState.state ? (window.appState.state.playerId || window.appState.state.walletAddress) : ADMIN_WALLET_ADDRESS);

  if (!supabase) {
    if (window.triggerToast) window.triggerToast("Database not connected", "error");
    return;
  }

  try {
    const { data, error } = await supabase.rpc('grant_relic_drop', {
      p_player_id: recipient,
      p_relic_id: relicId,
      p_amount: 1
    });

    if (error) throw error;

    if (window.appState && window.appState.state && (recipient === window.appState.state.playerId || recipient.toLowerCase() === (window.appState.state.walletAddress || '').toLowerCase())) {
      window.appState.update({ relics: data });
      if (typeof window.renderRelicsVault === 'function') {
        window.renderRelicsVault();
      }
    }

    if (window.triggerToast) {
      window.triggerToast(`🎁 In-Game Test Relic (${relicId}) granted! Check Quantum Relics Vault!`, "success");
    }
  } catch (e) {
    console.error("Grant test relic error:", e);
    if (window.triggerToast) {
      window.triggerToast(`Failed to grant in-game relic: ${e.message || e}`, "error");
    }
  }
}
window.grantAdminTestRelic = grantAdminTestRelic;

// 🌐 Update Relic Smart Contract BaseURI to GitHub Pages (For OpenSea Metadata Discovery)
export async function updateRelicsBaseURI() {
  if (typeof window.ethereum === 'undefined') {
    if (window.triggerToast) window.triggerToast("MetaMask / Web3 Wallet required.", "error");
    return;
  }

  const newBaseURI = "https://polygongaming.io/metadata/relics/";

  try {
    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();

    if (network.chainId !== 137n && network.chainId !== 137) {
      if (window.triggerToast) window.triggerToast("Please switch network to Polygon Mainnet (Chain ID 137).", "warning");
      return;
    }

    const abi = ["function setBaseURI(string calldata newBaseURI) external"];
    const contract = new window.ethers.Contract(RELICS_CONTRACT_ADDRESS, abi, signer);

    if (window.triggerToast) window.triggerToast("Submitting BaseURI update to Polygon...", "info");

    const tx = await contract.setBaseURI(newBaseURI);
    if (window.triggerToast) window.triggerToast("BaseURI update transaction broadcast! Waiting for confirmation...", "info");

    await tx.wait();

    if (window.triggerToast) {
      window.triggerToast(`✅ Contract BaseURI updated to ${newBaseURI}! OpenSea will now load all metadata!`, "success");
    }
  } catch (err) {
    console.error("BaseURI Update Error:", err);
    if (err && (err.code === 4001 || (err.message && err.message.includes('rejected')))) {
      if (window.triggerToast) window.triggerToast("Transaction cancelled in MetaMask.", "warning");
      return;
    }
    const msg = (err && err.reason) ? err.reason : (err && err.message ? err.message : "Update failed");
    if (window.triggerToast) window.triggerToast(`BaseURI Update Failed: ${msg}`, "error");
  }
}
window.updateRelicsBaseURI = updateRelicsBaseURI;




// Helper for dynamic weekly pool allocation
function getWeeklyPrizeForRank(rank, pool = 50000) {
  if (!pool || pool <= 0) return 0;
  if (rank === 1) return Math.round(pool * 0.30);
  if (rank === 2) return Math.round(pool * 0.16);
  if (rank === 3) return Math.round(pool * 0.08);
  if (rank <= 10) return Math.round(pool * 0.02);
  if (rank <= 25) return Math.round(pool * 0.008);
  if (rank <= 50) return Math.round(pool * 0.004);
  if (rank <= 100) return Math.round(pool * 0.002);
  return 0;
}

// --- Automated & Manual Weekly Prize Distribution System ---
export async function distributeWeeklyPrizes() {
  if (!supabase) {
    if (window.triggerToast) window.triggerToast("Database connection missing!", "error");
    return;
  }

  // Calculate dynamic configured pools
  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const poolAstrododge = (settings.astrododge?.weekly_pool_pgt !== undefined) ? Number(settings.astrododge.weekly_pool_pgt) : 50000;
  const poolInvaders = (settings.invaders?.weekly_pool_pgt !== undefined) ? Number(settings.invaders.weekly_pool_pgt) : 50000;
  const poolDrift = (settings.drift?.weekly_pool_pgt !== undefined) ? Number(settings.drift.weekly_pool_pgt) : 50000;
  const poolStacker = (settings.stacker?.weekly_pool_pgt !== undefined) ? Number(settings.stacker.weekly_pool_pgt) : ((settings.catcher?.weekly_pool_pgt !== undefined) ? Number(settings.catcher.weekly_pool_pgt) : 50000);

  const totalConfiguredPool = poolAstrododge + poolInvaders + poolDrift + poolStacker;

  if (!confirm(`🏆 Confirm Weekly Payout: Distribute ${totalConfiguredPool.toLocaleString()} PGT across active arcade leaderboards (Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker) and reset weekly scores?`)) {
    return;
  }

  const btn = document.getElementById('btn-distribute-weekly-prizes');
  if (btn) {
    btn.disabled = true;
    btn.innerText = `⏳ Processing ${totalConfiguredPool.toLocaleString()} PGT Weekly Distribution...`;
  }

  try {
    // 1. Try atomic PostgreSQL RPC distribution first
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('execute_weekly_payout_and_reset');

    if (!rpcErr && rpcRes && rpcRes.success) {
      const distributedTotal = rpcRes.total_distributed || totalConfiguredPool;
      const winnerCount = rpcRes.winner_count || 0;
      const gamesProcessed = rpcRes.games_processed || [];

      if (window.triggerToast) {
        window.triggerToast(`🏆 ${distributedTotal.toLocaleString()} PGT WEEKLY POOLS DISTRIBUTED (${winnerCount} Winners)!`, "success");
      }

      // Trigger Official Discord Announcements Channel Notification
      const discordFields = [
        { name: "🚀 Astro-Dodge Pool", value: `${poolAstrododge.toLocaleString()} PGT`, inline: true },
        { name: "👾 Cyber Invaders Pool", value: `${poolInvaders.toLocaleString()} PGT`, inline: true },
        { name: "🏎️ Cyber Drift Pool", value: `${poolDrift.toLocaleString()} PGT`, inline: true },
        { name: "👑 Cyber Stacker Pool", value: `${poolStacker.toLocaleString()} PGT`, inline: true },
        { name: "🎁 Winners", value: `${winnerCount} Total Winner Entries`, inline: false }
      ];

      const announcementPayload = {
        title: `🏆 ${distributedTotal.toLocaleString()} PGT WEEKLY LEADERBOARD PRIZES DISTRIBUTED!`,
        description: `The **${distributedTotal.toLocaleString()} PGT** weekly tournament pools have just been distributed to all top-ranking arcade champions! Leaderboards have reset for the new week. Jump in and claim your rank! 🚀`,
        color: 0xFFAA00,
        fields: discordFields
      };

      if (typeof window.sendDiscordAnnouncement === 'function') {
        window.sendDiscordAnnouncement(announcementPayload);
      } else if (typeof window.sendDiscordAlert === 'function') {
        window.sendDiscordAlert(announcementPayload);
      }

      if (typeof window.sendAdminAlert === 'function') {
        window.sendAdminAlert({
          category: 'WEEKLY PAYOUT AUDIT',
          title: `👑 ${distributedTotal.toLocaleString()} PGT Weekly Distribution Executed`,
          description: `Master Admin triggered the weekly prize pools. **${distributedTotal.toLocaleString()} PGT** awarded to ${winnerCount} players across arcade games.`,
          color: 0x00F0FF
        });
      }

      // Explicitly zero out database weekly scores and reset connected admin local state
      await finalizeLeaderboardReset();

      if (typeof loadAdminData === 'function') loadAdminData();
      return;
    }

    // Fallback: Client-Side distribution across games if RPC fails
    console.warn("Primary execute_weekly_payout_and_reset RPC failed or missing, executing client-side distribution...", rpcErr);
    const games = [
      { key: 'game_highscore', name: 'astrododge', pool: poolAstrododge, enabled: settings.astrododge?.leaderboard_enabled !== false },
      { key: 'invaders_highscore', name: 'invaders', pool: poolInvaders, enabled: settings.invaders?.leaderboard_enabled !== false },
      { key: 'drift_highscore', name: 'drift', pool: poolDrift, enabled: settings.drift?.leaderboard_enabled !== false },
      { key: 'stacker_highscore', name: 'stacker', pool: poolStacker, enabled: (settings.stacker?.leaderboard_enabled !== false && settings.catcher?.leaderboard_enabled !== false) }
    ];

    let distributedTotal = 0;
    let totalWinners = 0;
    const weekLabel = new Date().toISOString().split('T')[0];

    for (const g of games) {
      if (!g.enabled || g.pool <= 0) continue;

      const { data: rawPlayers } = await supabase.from('users')
        .select('player_id, linked_wallet_address, ' + g.key)
        .gt(g.key, 0)
        .order(g.key, { ascending: false })
        .limit(100);

      if (!rawPlayers || rawPlayers.length === 0) continue;

      const archiveRows = [];
      for (let i = 0; i < rawPlayers.length; i++) {
        const rank = i + 1;
        const prizeAmt = getWeeklyPrizeForRank(rank, g.pool);
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

    // Explicitly zero out database weekly scores and reset connected admin local state
    await finalizeLeaderboardReset();

    const fallbackFields = [
      { name: "🚀 Astro-Dodge Pool", value: `${poolAstrododge.toLocaleString()} PGT`, inline: true },
      { name: "👾 Cyber Invaders Pool", value: `${poolInvaders.toLocaleString()} PGT`, inline: true },
      { name: "🏎️ Cyber Drift Pool", value: `${poolDrift.toLocaleString()} PGT`, inline: true },
      { name: "👑 Cyber Stacker Pool", value: `${poolStacker.toLocaleString()} PGT`, inline: true },
      { name: "🎁 Winners", value: `${totalWinners} Total Winner Entries`, inline: false }
    ];

    const fallbackPayload = {
      title: `🏆 ${distributedTotal.toLocaleString()} PGT WEEKLY LEADERBOARD PRIZES DISTRIBUTED!`,
      description: `The **${distributedTotal.toLocaleString()} PGT** weekly gaming tournament pools have just been distributed across all active arcade leaderboards!`,
      color: 0xFFAA00,
      fields: fallbackFields
    };

    if (typeof window.sendDiscordAnnouncement === 'function') {
      window.sendDiscordAnnouncement(fallbackPayload);
    } else if (typeof window.sendDiscordAlert === 'function') {
      window.sendDiscordAlert(fallbackPayload);
    }

    if (typeof window.sendAdminAlert === 'function') {
      window.sendAdminAlert({
        category: 'WEEKLY PAYOUT AUDIT',
        title: `👑 ${distributedTotal.toLocaleString()} PGT Weekly Distribution Executed (Fallback)`,
        description: `Master Admin triggered weekly prize pools. **${distributedTotal.toLocaleString()} PGT** awarded to ${totalWinners} players across 3 games.`,
        color: 0x00F0FF
      });
    }

    if (window.triggerToast) {
      window.triggerToast(`🏆 ${distributedTotal.toLocaleString()} PGT WEEKLY POOLS DISTRIBUTED to ${totalWinners} Winners!`, "success");
    }

    if (typeof loadAdminData === 'function') loadAdminData();
  } catch (err) {
    console.error("Weekly Distribution Error:", err);
    if (window.triggerToast) window.triggerToast(`Weekly Payout Error: ${err.message || err}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "🏆 Distribute Weekly Leaderboard Prizes Now";
    }
  }
}
window.distributeWeeklyPrizes = distributeWeeklyPrizes;

// --- Helper & Standalone Leaderboard Reset Procedure ---
export async function finalizeLeaderboardReset() {
  if (!supabase) return;

  // 1. Clear pending debounce save timers and preserve career bests in memory and local cache
  if (window.appState) {
    if (window.appState._dbSaveTimer) {
      clearTimeout(window.appState._dbSaveTimer);
      window.appState._dbSaveTimer = null;
    }

    const curGame = window.appState.state.gameHighScore || 0;
    const curInv = window.appState.state.invadersHighScore || 0;
    const curDrift = window.appState.state.driftHighScore || 0;
    const curStack = Math.max(window.appState.state.stackerHighScore || 0, window.appState.state.catcherHighScore || 0);

    const newAllGame = Math.max(window.appState.state.alltimeGameHighScore || 0, curGame);
    const newAllInv = Math.max(window.appState.state.alltimeInvadersHighScore || 0, curInv);
    const newAllDrift = Math.max(window.appState.state.alltimeDriftHighScore || 0, curDrift);
    const newAllStack = Math.max(window.appState.state.alltimeStackerHighScore || 0, window.appState.state.alltimeCatcherHighScore || 0, curStack);

    window.appState.update({
      gameHighScore: 0,
      invadersHighScore: 0,
      driftHighScore: 0,
      stackerHighScore: 0,
      catcherHighScore: 0,
      alltimeGameHighScore: newAllGame,
      alltimeInvadersHighScore: newAllInv,
      alltimeDriftHighScore: newAllDrift,
      alltimeStackerHighScore: newAllStack,
      alltimeCatcherHighScore: newAllStack
    });

    const targetKey = (window.appState.state.playerId || window.appState.state.walletAddress || '').toLowerCase();
    if (targetKey) {
      try {
        localStorage.setItem(`polygame_alltime_scores_${targetKey}`, JSON.stringify({
          game: newAllGame,
          invaders: newAllInv,
          drift: newAllDrift,
          stacker: newAllStack,
          catcher: newAllStack
        }));
      } catch (e) {}
    }
  }

  // 2. Zero out database weekly high score columns for all users
  try {
    const { error: resetErr } = await supabase.from('users').update({ 
      game_highscore: 0, 
      invaders_highscore: 0, 
      drift_highscore: 0,
      stacker_highscore: 0
    }).gt('id', '00000000-0000-0000-0000-000000000000');

    if (resetErr) {
      // Fallback update without ID constraint
      await supabase.from('users').update({ 
        game_highscore: 0, 
        invaders_highscore: 0, 
        drift_highscore: 0,
        stacker_highscore: 0
      }).or('game_highscore.gt.0,invaders_highscore.gt.0,drift_highscore.gt.0,stacker_highscore.gt.0');
    }
  } catch (e) {
    console.error("Database leaderboard reset error:", e);
  }

  // 3. Save active user's preserved career all-time high scores to Supabase DB row
  if (window.appState && typeof window.appState._executeSaveToDB === 'function') {
    await window.appState._executeSaveToDB();
  }

  // 4. Immediately refresh profile scorecard stats and all 4 arcade leaderboards
  if (typeof window.renderProfileStats === 'function') window.renderProfileStats();

  // 4. Automatically prune old arcade session logs older than 7 days
  try {
    await supabase.rpc('prune_old_arcade_sessions', { p_days: 7 });
  } catch (e) {
    console.warn("Auto-prune arcade sessions notice:", e);
  }

  // 5. Distribute Weekly World Boss Prizes & Reset Boss HP
  try {
    const { data: bossRes } = await supabase.rpc('distribute_weekly_boss_prizes');
    if (bossRes && typeof window.sendDiscordAnnouncement === 'function') {
      if (bossRes.victory && bossRes.distributed) {
        const topStr = (bossRes.top_hunters && bossRes.top_hunters.length > 0)
          ? bossRes.top_hunters.map((h, i) => `#${i+1} ${h.name} (${Number(h.damage).toLocaleString()} DMG - +${h.payout_pgt} PGT)`).join('\n')
          : 'All valiant commanders';
        await window.sendDiscordAnnouncement({
          title: `👾 Cosmic World Boss Slain! (Level ${bossRes.defeated_level || 1} Defeated)`,
          description: `The **Quantum Leviathan (Level ${bossRes.defeated_level || 1})** was destroyed!\n\n💰 **${Number(bossRes.pool_pgt).toLocaleString()} PGT** distributed proportionally to **${bossRes.winner_count} commanders**.\n\n🏆 **Top Boss Hunters:**\n${topStr}\n\n⚡ **Leviathan Level Up:** Ascended to **Level ${bossRes.next_level}**! Next week's Boss has **${Number(bossRes.next_max_hp).toLocaleString()} HP** (+50%) and a **${Number(bossRes.next_pool_pgt).toLocaleString()} PGT** (+20%) Pool!`,
          color: 0x00ff66
        });
      } else if (!bossRes.victory && bossRes.total_damage_dealt > 0) {
        await window.sendDiscordAnnouncement({
          title: "⚠️ Quantum Leviathan Escaped! (Reset to Level 1)",
          description: `The **Quantum Leviathan** survived the weekly raid with **${Number(bossRes.survived_hp || 0).toLocaleString()} HP** remaining.\n\n🔒 **Prize Pool Withheld**: The ${Number(bossRes.pool_pgt).toLocaleString()} PGT pool was not paid.\n\n🔄 **Level Reset**: The Leviathan has escaped and reset to **Level 1 (5,000,000 HP • 10,000 PGT Pool)** for the new week. Ready your fleets, commanders!`,
          color: 0xff0055
        });
      }
    }
  } catch (bossErr) {
    console.warn("distribute_weekly_boss_prizes notice:", bossErr);
  }

  // 6. Immediately refresh all leaderboards including World Boss
  if (typeof window.loadAstroDodgeLeaderboard === 'function') window.loadAstroDodgeLeaderboard();
  if (typeof window.loadInvadersLeaderboard === 'function') window.loadInvadersLeaderboard();
  if (typeof window.loadDriftLeaderboard === 'function') window.loadDriftLeaderboard();
  if (typeof window.loadStackerLeaderboard === 'function') window.loadStackerLeaderboard();
  if (typeof window.loadWorldBossLeaderboard === 'function') window.loadWorldBossLeaderboard();
}

export async function pruneOldArcadeSessions() {
  const { triggerToast } = await import('../core/ui.js');
  if (!supabase) return;

  const daysSelect = document.getElementById('admin-prune-days');
  const days = parseInt(daysSelect ? daysSelect.value : 7) || 7;

  const btn = document.getElementById('btn-prune-arcade-sessions');
  const originalText = btn ? btn.innerHTML : '';

  if (!confirm(`🧹 Confirm Database Cleanup: Purge all completed arcade sessions older than ${days} days? (Player high scores and game metrics will remain 100% intact).`)) {
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Purging Sessions...';
  }

  try {
    const { data, error } = await supabase.rpc('prune_old_arcade_sessions', { p_days: days });

    if (error) {
      // Fallback direct delete if RPC not installed yet
      const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
      const { count, error: delErr } = await supabase
        .from('arcade_sessions')
        .delete({ count: 'exact' })
        .lt('started_at', cutoff);

      if (delErr) {
        triggerToast(`Failed to purge sessions: ${delErr.message}`, 'error');
        return;
      }
      triggerToast(`🧹 Database cleanup complete! Purged ${count || 0} old sessions (> ${days} days).`, 'success');
      return;
    }

    const purged = (data && data.purged_count !== undefined) ? data.purged_count : 0;
    triggerToast(`🧹 Database cleanup complete! Purged ${purged.toLocaleString()} old arcade sessions (> ${days} days).`, 'success');
  } catch (err) {
    console.error("Prune sessions error:", err);
    triggerToast(`Failed to purge sessions: ${err.message || err}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}
window.pruneOldArcadeSessions = pruneOldArcadeSessions;

export async function resetArcadeLeaderboardsNow() {
  if (!supabase) return;
  const confirmed = confirm("⚠️ Are you sure you want to reset all active arcade leaderboards (Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker) to 0 for the new week?");
  if (!confirmed) return;

  const { triggerToast } = await import('../core/ui.js');
  triggerToast("🔄 Resetting arcade leaderboards...", "info");

  try {
    await finalizeLeaderboardReset();
    triggerToast("✅ All weekly arcade leaderboards have been reset to 0!", "success");
    if (typeof loadAdminData === 'function') loadAdminData();
  } catch (err) {
    console.error("Failed to reset leaderboards:", err);
    triggerToast("Failed to reset leaderboards: " + (err.message || err), "error");
  }
}
window.resetArcadeLeaderboardsNow = resetArcadeLeaderboardsNow;

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
          total_playtime_seconds: correctedSeconds
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
    const nowIso = new Date().toISOString();

    // 1. Try atomic server-side RPC if available
    let rpcSucceeded = false;
    try {
      const { error: rpcErr } = await supabase.rpc('reset_arcade_game_metrics');
      if (!rpcErr) rpcSucceeded = true;
    } catch (e) {
      rpcSucceeded = false;
    }

    // 2. Fallback to direct client queries if RPC is not yet created
    if (!rpcSucceeded) {
      const arcadeGames = ['AstroDodge', 'Cyber Invaders', 'Cyber Drift', 'Cyber Stacker', 'Cyber Catcher'];
      for (const game of arcadeGames) {
        await supabase
          .from('game_metrics')
          .update({
            total_wagered: 0,
            total_payout: 0,
            total_playtime_seconds: 0
          })
          .eq('game_name', game);
      }

      try {
        await supabase
          .from('global_settings')
          .update({ arcade_last_reset: nowIso })
          .eq('id', 1);
      } catch (e) {}
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

export function renderGamePayoutSettings(settings) {
  const tbody = document.getElementById('admin-game-rules-tbody');
  if (!tbody) return;

  const defaultSettings = {
    "astrododge": { "name": "AstroDodge", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
    "invaders": { "name": "Cyber Invaders", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
    "drift": { "name": "Cyber Drift", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
    "stacker": { "name": "Cyber Stacker", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": true },
    "boss": { "name": "👾 Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "weekly_pool_pgt": 10000, "harvest_enabled": true, "vip_only": false },
    "roshambo": { "name": "Roshambo", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "spinner": { "name": "Lucky Spinner", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "plinko": { "name": "Neon Plinko", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "crash": { "name": "Cyber-Crash", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "space": { "name": "PolySpace Mining", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false }
  };

  const finalSettings = Object.assign({}, defaultSettings, settings || {});
  delete finalSettings.catcher; // Explicitly remove legacy Cyber Catcher

  const ARCADE_GAMES = ["astrododge", "invaders", "drift", "stacker", "boss"];
  const CASINO_GAMES = ["roshambo", "spinner", "plinko", "crash", "space"];

  let html = '';

  // 1. Arcade Mini-Games Section
  html += `
    <tr style="background: rgba(0, 240, 255, 0.05); border-top: 1px solid var(--border-glass); border-bottom: 1px solid var(--border-glass);">
      <td colspan="5" style="padding: 0.5rem 0.75rem; font-size: 0.75rem; font-weight: 800; color: var(--color-primary); letter-spacing: 0.5px;">
        🕹️ ARCADE MINI-GAMES (LEADERBOARDS & TOURNAMENT POOLS)
      </td>
    </tr>
  `;

  ARCADE_GAMES.forEach(key => {
    const g = finalSettings[key] || defaultSettings[key];
    html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" data-game-key="${key}" data-is-arcade="true">
        <td style="padding: 0.75rem; font-weight: 700; color: #fff;">${g.name || key}</td>
        <td style="padding: 0.75rem; text-align: center;">
          <input type="checkbox" class="chk-vip-only" ${g.vip_only ? 'checked' : ''} style="accent-color: var(--color-warning); width: 18px; height: 18px; cursor: pointer;">
        </td>
        <td style="padding: 0.75rem; text-align: center;">
          <input type="checkbox" class="chk-lb-enabled" ${g.leaderboard_enabled ? 'checked' : ''} style="accent-color: var(--color-primary); width: 18px; height: 18px; cursor: pointer;">
        </td>
        <td style="padding: 0.75rem;">
          <input type="number" class="input-weekly-pool" value="${g.weekly_pool_pgt || 0}" step="5000" min="0" style="background: var(--bg-dark); border: 1px solid var(--border-light); color: #fff; padding: 0.4rem 0.6rem; border-radius: 4px; width: 120px; font-weight: 700;">
        </td>
        <td style="padding: 0.75rem; text-align: center;">
          <input type="checkbox" class="chk-harvest-enabled" ${g.harvest_enabled !== false ? 'checked' : ''} style="accent-color: var(--color-success); width: 18px; height: 18px; cursor: pointer;">
        </td>
      </tr>
    `;
  });

  // 2. Casino & Idle Operations Section
  html += `
    <tr style="background: rgba(255, 170, 0, 0.05); border-top: 1px solid var(--border-glass); border-bottom: 1px solid var(--border-glass);">
      <td colspan="5" style="padding: 0.5rem 0.75rem; font-size: 0.75rem; font-weight: 800; color: var(--color-warning); letter-spacing: 0.5px;">
        🎲 CASINO & IDLE OPERATIONS (VIP ACCESS LOCKS)
      </td>
    </tr>
  `;

  CASINO_GAMES.forEach(key => {
    const g = finalSettings[key] || defaultSettings[key];
    html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" data-game-key="${key}" data-is-arcade="false">
        <td style="padding: 0.75rem; font-weight: 700; color: #fff;">${g.name || key}</td>
        <td style="padding: 0.75rem; text-align: center;">
          <input type="checkbox" class="chk-vip-only" ${g.vip_only ? 'checked' : ''} style="accent-color: var(--color-warning); width: 18px; height: 18px; cursor: pointer;">
        </td>
        <td style="padding: 0.75rem; text-align: center; color: var(--text-dim); font-size: 1.1rem;">
          —
        </td>
        <td style="padding: 0.75rem; color: var(--text-dim); font-size: 1.1rem;">
          —
        </td>
        <td style="padding: 0.75rem; text-align: center; color: var(--text-dim); font-size: 1.1rem;">
          —
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}
window.renderGamePayoutSettings = renderGamePayoutSettings;

export async function saveGamePayoutSettings() {
  const { triggerToast } = await import('../core/ui.js');
  if (!supabase) return;

  const tbody = document.getElementById('admin-game-rules-tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[data-game-key]');
  const updatedSettings = {};

  rows.forEach(r => {
    const key = r.getAttribute('data-game-key');
    const isArcade = r.getAttribute('data-is-arcade') === 'true';
    const name = r.cells[0].innerText.trim();
    const vipOnly = r.querySelector('.chk-vip-only')?.checked || false;

    if (isArcade) {
      const lbEnabled = r.querySelector('.chk-lb-enabled')?.checked || false;
      const pool = parseFloat(r.querySelector('.input-weekly-pool')?.value || 0);
      const harvestEnabled = r.querySelector('.chk-harvest-enabled')?.checked || false;

      updatedSettings[key] = {
        name,
        vip_only: vipOnly,
        leaderboard_enabled: lbEnabled,
        weekly_pool_pgt: pool,
        harvest_enabled: harvestEnabled
      };
    } else {
      updatedSettings[key] = {
        name,
        vip_only: vipOnly,
        leaderboard_enabled: false,
        weekly_pool_pgt: 0,
        harvest_enabled: true
      };
    }
  });

  try {
    const adminWallet = window.appState ? (window.appState.state.walletAddress || window.appState.state.linkedWalletAddress || window.appState.getPlayerId() || '') : '';
    
    // 1. First try secure SECURITY DEFINER RPC
    const { data, error } = await supabase.rpc('update_game_payout_settings', {
      p_admin_wallet: adminWallet,
      p_settings: updatedSettings
    });

    if (!error && data && data.success) {
      if (window.appState) {
        window.appState.update({ gamePayoutSettings: updatedSettings });
      }
      const { updateLeaderboardPoolHeaders } = await import('../core/db-sync.js');
      if (updateLeaderboardPoolHeaders) updateLeaderboardPoolHeaders(updatedSettings);

      triggerToast('🎮 Game Rules & VIP Settings Saved Successfully!', 'success');
      return;
    }

    // 2. Direct UPDATE on global_settings table
    const { error: directErr } = await supabase
      .from('global_settings')
      .update({ game_payout_settings: updatedSettings })
      .eq('id', 1);

    if (directErr) {
      const errMsg = (error && error.message) ? error.message : (data && data.error ? data.error : directErr.message);
      throw new Error(errMsg);
    }

    if (window.appState) {
      window.appState.update({ gamePayoutSettings: updatedSettings });
    }
    const { updateLeaderboardPoolHeaders } = await import('../core/db-sync.js');
    if (updateLeaderboardPoolHeaders) updateLeaderboardPoolHeaders(updatedSettings);

    triggerToast('🎮 Game Rules & VIP Settings Saved Successfully!', 'success');
  } catch (err) {
    console.error("Failed to save game payout settings:", err);
    triggerToast('Error saving settings: ' + (err.message || err), 'error');
  }
}
window.saveGamePayoutSettings = saveGamePayoutSettings;

// --- Self-Healing Referral Tree Reconciliation (v1.4.498) ---
export async function runReferralReconciliation() {
  const { triggerToast } = await import('../core/ui.js');
  if (!supabase) {
    triggerToast("Database not connected.", "error");
    return;
  }

  const confirmed = confirm("🌲 Run 4-Tier Referral Tree Self-Healing & Reconciliation?\n\nThis procedure will:\n1. Audit all accounts with an active Level-1 referrer.\n2. Re-derive and heal broken L2, L3, and L4 upstream chains.\n3. Recalculate and synchronize exact downline counters (L1–L4) for every player.\n\nProceed?");
  if (!confirmed) return;

  const btn = document.getElementById('btn-reconcile-referrals');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳ Auditing & Healing Trees...";
  }

  triggerToast("🔄 Auditing referral trees & synchronizing counters...", "info");

  try {
    // 1. Try server-side atomic RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('reconcile_referral_trees');

    if (!rpcError && rpcData && rpcData.success) {
      triggerToast(`✅ ${rpcData.message}`, "success");
      alert(`🌲 Referral Reconciliation Complete!\n\n• Accounts Scanned: ${rpcData.scanned_accounts}\n• Tree Chains Repaired: ${rpcData.repaired_chains}\n• Downline Counters Synchronized: ${rpcData.synchronized_users}`);
      if (typeof window.loadAdminData === 'function') window.loadAdminData();
      return;
    }

    // 2. Client-side fallback reconciliation if RPC not yet created in Supabase
    console.warn("RPC reconcile_referral_trees not available or returned error, executing client-side batch reconciliation:", rpcError);

    const { data: allUsers, error: fetchErr } = await supabase
      .from('users')
      .select('player_id, linked_wallet_address, referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4');

    if (fetchErr) throw fetchErr;
    if (!allUsers || allUsers.length === 0) {
      triggerToast("No user records found to reconcile.", "warning");
      return;
    }

    // Build user map by player_id and linked_wallet_address
    const userMap = {};
    allUsers.forEach(u => {
      if (u.player_id) userMap[u.player_id.toLowerCase()] = u;
      if (u.linked_wallet_address) userMap[u.linked_wallet_address.toLowerCase()] = u;
    });

    let scannedCount = 0;
    let repairedChains = 0;

    for (const u of allUsers) {
      const l1 = (u.referred_by_l1 || '').trim().toLowerCase();
      if (l1 && l1 !== 'empty') {
        scannedCount++;
        const parent = userMap[l1];
        if (parent) {
          let expL2 = parent.referred_by_l1 || null;
          let expL3 = parent.referred_by_l2 || null;
          let expL4 = parent.referred_by_l3 || null;

          if (expL2 === u.player_id || expL2 === u.linked_wallet_address) expL2 = null;
          if (expL3 === u.player_id || expL3 === u.linked_wallet_address) expL3 = null;
          if (expL4 === u.player_id || expL4 === u.linked_wallet_address) expL4 = null;

          const curL2 = u.referred_by_l2 || null;
          const curL3 = u.referred_by_l3 || null;
          const curL4 = u.referred_by_l4 || null;

          if (curL2 !== expL2 || curL3 !== expL3 || curL4 !== expL4) {
            await supabase.from('users').update({
              referred_by_l2: expL2,
              referred_by_l3: expL3,
              referred_by_l4: expL4
            }).eq('player_id', u.player_id);
            repairedChains++;
          }
        }
      }
    }

    // Recount downlines
    let syncedCounters = 0;
    for (const u of allUsers) {
      const pid = (u.player_id || '').toLowerCase();
      const waddr = (u.linked_wallet_address || '').toLowerCase();

      const l1Count = allUsers.filter(x => (x.referred_by_l1 && (x.referred_by_l1.toLowerCase() === pid || (waddr && x.referred_by_l1.toLowerCase() === waddr)))).length;
      const l2Count = allUsers.filter(x => (x.referred_by_l2 && (x.referred_by_l2.toLowerCase() === pid || (waddr && x.referred_by_l2.toLowerCase() === waddr)))).length;
      const l3Count = allUsers.filter(x => (x.referred_by_l3 && (x.referred_by_l3.toLowerCase() === pid || (waddr && x.referred_by_l3.toLowerCase() === waddr)))).length;
      const l4Count = allUsers.filter(x => (x.referred_by_l4 && (x.referred_by_l4.toLowerCase() === pid || (waddr && x.referred_by_l4.toLowerCase() === waddr)))).length;
      const totalCount = l1Count + l2Count + l3Count + l4Count;

      await supabase.from('users').update({
        referrals_l1: l1Count,
        referrals_l2: l2Count,
        referrals_l3: l3Count,
        referrals_l4: l4Count,
        referrals_count: totalCount
      }).eq('player_id', u.player_id);
      syncedCounters++;
    }

    triggerToast(`✅ Reconciliation Complete! ${scannedCount} accounts audited, ${repairedChains} chains repaired, ${syncedCounters} downline counters synchronized.`, "success");
    alert(`🌲 Referral Reconciliation Complete!\n\n• Accounts Audited: ${scannedCount}\n• Tree Chains Repaired: ${repairedChains}\n• Downline Counters Synchronized: ${syncedCounters}`);
    if (typeof window.loadAdminData === 'function') window.loadAdminData();

  } catch (err) {
    console.error("Referral reconciliation failed:", err);
    triggerToast("Reconciliation failed: " + (err.message || err), "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText || "🔄 Reconcile Referral Trees & Counters";
    }
  }
}
window.runReferralReconciliation = runReferralReconciliation;

// --- On-Chain NFT & Quantum Relic Database Resync Tool (v1.5.104) ---
export async function resyncPlayerNftsFromAdmin(customAddr = null) {
  const { triggerToast } = await import('../core/ui.js');
  const { getOwnedNftsFromChain } = await import('./nft.js');
  const { getOwnedRelicsFromChain } = await import('./relics.js');

  const inputEl = document.getElementById('admin-resync-wallet-input');
  const targetRaw = (customAddr || (inputEl ? inputEl.value : '')).trim();

  if (!targetRaw) {
    triggerToast("Please enter a valid wallet address or player ID.", "warning");
    if (inputEl) inputEl.focus();
    return;
  }

  const resultsBox = document.getElementById('admin-resync-results-box');
  const btn = document.getElementById('btn-admin-resync-single');
  const originalText = btn ? btn.innerText : '';

  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳ Scanning Chain...";
  }

  triggerToast(`🔍 Scanning Polygon for ${targetRaw.substring(0, 10)}...`, "info");

  try {
    // 1. Resolve user row from Supabase
    const { data: matchedUsers, error: userErr } = await supabase
      .from('users')
      .select('player_id, linked_wallet_address, username, email, owned_nfts, relics')
      .or(`player_id.ilike.${targetRaw},linked_wallet_address.ilike.${targetRaw}`);

    if (userErr) throw userErr;

    const userRow = matchedUsers && matchedUsers.length > 0 ? matchedUsers[0] : null;
    const resolvedPid = userRow ? userRow.player_id : targetRaw.toLowerCase();
    const onchainTarget = (userRow && userRow.linked_wallet_address) 
      ? userRow.linked_wallet_address 
      : targetRaw;

    if (!onchainTarget.startsWith('0x') || onchainTarget.length !== 42 || onchainTarget.startsWith('0xpgt')) {
      throw new Error(`Invalid EVM target address: ${onchainTarget}. (Account may be an unlinked Google/Guest profile)`);
    }

    // 2. Perform on-chain scans in parallel
    const [chainNfts, chainRelics] = await Promise.all([
      getOwnedNftsFromChain(onchainTarget).catch(e => { console.warn("NFT scan error:", e); return []; }),
      getOwnedRelicsFromChain(onchainTarget).catch(e => { console.warn("Relic scan error:", e); return {}; })
    ]);

    // 3. Merge relics and NFTs if user had unminted in-game items
    const prevRelics = (userRow && userRow.relics && typeof userRow.relics === 'object') ? userRow.relics : {};
    const mergedRelics = { ...prevRelics };

    Object.keys(chainRelics).forEach(rId => {
      const prev = mergedRelics[rId] || { unminted: 0, onchain: 0, token_ids: [] };
      mergedRelics[rId] = {
        unminted: prev.unminted || 0,
        onchain: chainRelics[rId].onchain || 0,
        total: (prev.unminted || 0) + (chainRelics[rId].onchain || 0),
        token_ids: chainRelics[rId].token_ids || []
      };
    });

    const prevNfts = (userRow && Array.isArray(userRow.owned_nfts)) ? userRow.owned_nfts : [];
    const mergedNfts = Array.from(new Set([...prevNfts, ...chainNfts]));

    // 4. Update Supabase
    const updatePayload = {
      owned_nfts: mergedNfts,
      relics: mergedRelics,
      updated_at: new Date().toISOString()
    };

    const { error: updateErr } = await supabase
      .from('users')
      .update(updatePayload)
      .or(`player_id.ilike.${resolvedPid},linked_wallet_address.ilike.${onchainTarget}`);

    if (updateErr) throw updateErr;

    // 5. Render results in Admin Panel
    const relicsCount = Object.keys(chainRelics).reduce((sum, k) => sum + (chainRelics[k].onchain || 0), 0);
    const nftsListStr = chainNfts.length > 0 ? chainNfts.join(', ') : 'None';
    const relicsListStr = Object.keys(chainRelics).length > 0 ? Object.keys(chainRelics).join(', ') : 'None';

    if (resultsBox) {
      resultsBox.style.display = 'block';
      resultsBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.4rem;">
          <strong style="color:var(--color-success); font-size:0.95rem;">✅ On-Chain Sync Succeeded!</strong>
          <span style="font-size:0.75rem; color:var(--text-dim);">${new Date().toLocaleTimeString()}</span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:0.75rem; margin-bottom:0.75rem;">
          <div><span style="color:var(--text-muted);">Player Account:</span> <strong style="color:#fff;">${userRow?.username || 'Player'}</strong> (<code style="color:var(--color-accent); font-size:0.75rem;">${resolvedPid}</code>)</div>
          <div><span style="color:var(--text-muted);">On-Chain Wallet:</span> <code style="color:var(--color-warning); font-size:0.75rem;">${onchainTarget}</code></div>
          <div><span style="color:var(--text-muted);">Utility NFTs Found:</span> <strong style="color:var(--color-primary);">${chainNfts.length}</strong> (Total In-Game: ${mergedNfts.length})</div>
          <div><span style="color:var(--text-muted);">Quantum Relics Found:</span> <strong style="color:#ffd700;">${relicsCount} (${Object.keys(chainRelics).length} Unique)</strong></div>
        </div>
        <div style="font-size:0.78rem; color:var(--text-dim); line-height:1.4;">
          <strong>Utility NFTs (On-Chain):</strong> <code style="color:var(--color-primary);">${nftsListStr}</code><br>
          <strong>Relics Set:</strong> <code style="color:#ffd700;">${relicsListStr}</code>
        </div>
      `;
    }

    triggerToast(`✅ Resynced ${chainNfts.length} On-Chain NFTs & ${relicsCount} Relics for ${onchainTarget.substring(0, 8)}...`, "success");
    if (typeof window.loadAdminData === 'function') window.loadAdminData();

  } catch (err) {
    console.error("Admin NFT resync failed:", err);
    triggerToast("Resync failed: " + (err.message || err), "error");
    if (resultsBox) {
      resultsBox.style.display = 'block';
      resultsBox.innerHTML = `<span style="color:var(--color-danger);">❌ Error: ${(err.message || err)}</span>`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText || "🔍 Scan & Resync Player NFTs";
    }
  }
}
window.resyncPlayerNftsFromAdmin = resyncPlayerNftsFromAdmin;

export async function bulkResyncAllPlayersNfts() {
  const { triggerToast } = await import('../core/ui.js');
  const { getOwnedNftsFromChain } = await import('./nft.js');
  const { getOwnedRelicsFromChain } = await import('./relics.js');

  const confirmed = confirm("⚡ Run Bulk On-Chain NFT & Relic Resync for ALL registered players?\n\nThis will query the Polygon blockchain for every registered EVM wallet and synchronize their utility NFTs and relics into Supabase.\n\nProceed?");
  if (!confirmed) return;

  const btn = document.getElementById('btn-admin-resync-bulk');
  const resultsBox = document.getElementById('admin-resync-results-box');
  const originalText = btn ? btn.innerText : '';

  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳ Bulk Resyncing...";
  }

  if (resultsBox) {
    resultsBox.style.display = 'block';
    resultsBox.innerHTML = `<div>⏳ Fetching registered players from database...</div>`;
  }

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('player_id, linked_wallet_address, username, owned_nfts, relics');

    if (error) throw error;

    const validTargets = (users || []).filter(u => {
      const w = u.linked_wallet_address || u.player_id || '';
      return w.startsWith('0x') && w.length === 42 && !w.startsWith('0xpgt') && !w.startsWith('0xg');
    });

    if (validTargets.length === 0) {
      triggerToast("No eligible Web3 player wallets found to sync.", "warning");
      return;
    }

    let syncedCount = 0;
    let totalNftsFound = 0;
    let totalRelicsFound = 0;

    for (let i = 0; i < validTargets.length; i++) {
      const u = validTargets[i];
      const targetW = u.linked_wallet_address || u.player_id;
      
      if (resultsBox) {
        resultsBox.innerHTML = `
          <div>⏳ Bulk Syncing: <strong>${i + 1} / ${validTargets.length}</strong> (<code style="color:var(--color-warning);">${targetW.substring(0, 10)}...</code>)</div>
          <div style="font-size:0.75rem; color:var(--text-dim); margin-top:4px;">NFTs Found: ${totalNftsFound} | Relics Found: ${totalRelicsFound}</div>
        `;
      }

      try {
        const [chainNfts, chainRelics] = await Promise.all([
          getOwnedNftsFromChain(targetW).catch(() => []),
          getOwnedRelicsFromChain(targetW).catch(() => ({}))
        ]);

        const prevRelics = (u.relics && typeof u.relics === 'object') ? u.relics : {};
        const mergedRelics = { ...prevRelics };
        Object.keys(chainRelics).forEach(rId => {
          const prev = mergedRelics[rId] || { unminted: 0, onchain: 0, token_ids: [] };
          mergedRelics[rId] = {
            unminted: prev.unminted || 0,
            onchain: chainRelics[rId].onchain || 0,
            total: (prev.unminted || 0) + (chainRelics[rId].onchain || 0),
            token_ids: chainRelics[rId].token_ids || []
          };
        });

        const prevNfts = (u.owned_nfts && Array.isArray(u.owned_nfts)) ? u.owned_nfts : [];
        const mergedNfts = Array.from(new Set([...prevNfts, ...chainNfts]));

        await supabase.from('users').update({
          owned_nfts: mergedNfts,
          relics: mergedRelics,
          updated_at: new Date().toISOString()
        }).eq('player_id', u.player_id);

        syncedCount++;
        totalNftsFound += chainNfts.length;
        totalRelicsFound += Object.keys(chainRelics).reduce((sum, k) => sum + (chainRelics[k].onchain || 0), 0);
      } catch (perUserErr) {
        console.warn(`Bulk sync error for ${targetW}:`, perUserErr);
      }
    }

    if (resultsBox) {
      resultsBox.innerHTML = `
        <div style="color:var(--color-success); font-weight:800; font-size:1rem; margin-bottom:0.4rem;">🎉 Bulk NFT Resync Completed!</div>
        <div style="font-size:0.85rem; line-height:1.5;">
          • Total Wallets Scanned: <strong>${validTargets.length}</strong><br>
          • Database Rows Synchronized: <strong>${syncedCount}</strong><br>
          • Total On-Chain Utility NFTs: <strong>${totalNftsFound}</strong><br>
          • Total On-Chain Quantum Relics: <strong>${totalRelicsFound}</strong>
        </div>
      `;
    }

    triggerToast(`🎉 Bulk resync completed for ${syncedCount} player records!`, "success");
    if (typeof window.loadAdminData === 'function') window.loadAdminData();

  } catch (err) {
    console.error("Bulk NFT resync failed:", err);
    triggerToast("Bulk resync failed: " + (err.message || err), "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText || "⚡ Resync All Players (Bulk)";
    }
  }
}
window.bulkResyncAllPlayersNfts = bulkResyncAllPlayersNfts;





