import { supabase } from '../core/config.js';

// --- Admin Panel Fetch and Render ---

export async function loadAdminData() {
  if (!supabase) return;
  const tableBody = document.getElementById('admin-users-table');
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-dim);">Loading global database...</td></tr>';

  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    renderAdminPanel(data || []);
  } catch (err) {
    console.error("Failed to fetch admin data:", err);
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--color-danger);">Failed to load data.</td></tr>';
  }
}

export function renderAdminPanel(users) {
  // Global Aggregates
  let totalUsers = users.length;
  let totalPgt = 0;
  let totalTvl = 0;
  let totalRefs = 0;

  const tableBody = document.getElementById('admin-users-table');
  if (tableBody) tableBody.innerHTML = '';

  users.forEach(u => {
    totalPgt += (u.balance_pgt || 0);
    totalTvl += (u.staked_balance_pgt || 0);
    totalRefs += (u.referrals_count || 0);

    // Build Row
    if (tableBody) {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      
      let nftsCount = 0;
      if (Array.isArray(u.owned_nfts)) nftsCount = u.owned_nfts.length;
      
      let stakesCount = 0;
      if (Array.isArray(u.stakes)) stakesCount = u.stakes.length;

      tr.innerHTML = `
        <td style="padding: 0.75rem 0.5rem; font-family: monospace; color: var(--color-accent);">${u.wallet_address.substring(0,6)}...${u.wallet_address.substring(38)}</td>
        <td style="padding: 0.75rem 0.5rem; color: var(--color-primary); font-weight: 700;">${(u.balance_pgt || 0).toFixed(2)}</td>
        <td style="padding: 0.75rem 0.5rem;">${u.game_highscore || 0}</td>
        <td style="padding: 0.75rem 0.5rem;">${nftsCount}</td>
        <td style="padding: 0.75rem 0.5rem;">${u.referrals_count || 0}</td>
        <td style="padding: 0.75rem 0.5rem;">${stakesCount}</td>
      `;
      tableBody.appendChild(tr);
    }
  });

  document.getElementById('admin-stat-users').innerText = totalUsers;
  document.getElementById('admin-stat-pgt').innerText = totalPgt.toFixed(2);
  document.getElementById('admin-stat-tvl').innerText = totalTvl.toFixed(2) + ' PGT';
  document.getElementById('admin-stat-refs').innerText = totalRefs;
}

