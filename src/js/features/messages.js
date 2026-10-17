/**
 * ==============================================================================
 * POLYGON GAMING: PLAN-014 PLAYER MESSAGE CENTER & NOTIFICATION HUB
 * File: src/js/features/messages.js
 * ==============================================================================
 */

import { supabase } from '../core/config.js';
import { appState } from '../core/state.js';
import { executeAuthenticatedRpc } from '../core/auth-web3.js';

let currentFilter = 'all';
let isFetchingMessages = false;

/**
 * Formats ISO timestamp to human-friendly relative time
 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Recently';
  const now = new Date();
  const past = new Date(dateStr);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Escapes HTML strings to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Updates UI badges for unread messages across Profile sub-tabs and header navigation
 */
export function updateUnreadMessageBadge(unreadCount = 0) {
  const count = parseInt(unreadCount || 0, 10);
  
  // Profile Sub-Tab Badge
  const subTabBadge = document.getElementById('profile-messages-badge');
  if (subTabBadge) {
    subTabBadge.innerText = count > 99 ? '99+' : count;
    subTabBadge.style.display = count > 0 ? 'inline-block' : 'none';
  }

  // Header Nav Dot
  const navDot = document.getElementById('nav-profile-unread-dot');
  if (navDot) {
    navDot.style.display = count > 0 ? 'block' : 'none';
  }
}

/**
 * Fetches player messages and unread count from Supabase
 */
export async function loadPlayerMessages(forceRefresh = false) {
  if (!supabase) return { success: false, messages: [], unread_count: 0 };

  // Only query player messages if player is authenticated/connected and not a transient 0xguest address
  if (!appState?.isPlayerConnected()) {
    updateUnreadMessageBadge(0);
    return { success: false, messages: [], unread_count: 0 };
  }

  const playerId = appState?.getPlayerId?.() || appState?.state?.playerId || appState?.state?.walletAddress;
  if (!playerId || playerId.startsWith('0xguest')) {
    updateUnreadMessageBadge(0);
    return { success: false, messages: [], unread_count: 0 };
  }

  if (isFetchingMessages && !forceRefresh) {
    return { success: true, messages: appState.state.playerMessages || [], unread_count: appState.state.unreadMessageCount || 0 };
  }

  isFetchingMessages = true;
  try {
    const { data, error } = await executeAuthenticatedRpc('get_player_messages', {
      p_player_id: playerId
    });

    if (error) {
      console.warn("[loadPlayerMessages] RPC notice:", error.message || error);
      return { success: false, messages: [], unread_count: 0 };
    }

    if (data && data.success) {
      const messages = Array.isArray(data.messages) ? data.messages : [];
      const unreadCount = parseInt(data.unread_count || 0, 10);

      appState.update({
        playerMessages: messages,
        unreadMessageCount: unreadCount
      });

      updateUnreadMessageBadge(unreadCount);
      return { success: true, messages, unread_count: unreadCount };
    }

    return { success: false, messages: [], unread_count: 0 };
  } catch (err) {
    console.warn("[loadPlayerMessages] Error:", err);
    return { success: false, error: err.message || err };
  } finally {
    isFetchingMessages = false;
  }
}

/**
 * Renders the Message Center view inside #player-messages-container
 */
export function renderPlayerMessageCenter(filter = currentFilter) {
  currentFilter = filter;
  const container = document.getElementById('player-messages-container');
  if (!container) return;

  const messages = appState?.state?.playerMessages || [];
  const unreadCount = appState?.state?.unreadMessageCount || 0;

  // Filter messages
  let filtered = messages;
  if (filter === 'withdrawals') {
    filtered = messages.filter(m => m.message_type === 'withdrawal_approved' || m.message_type === 'withdrawal_rejected' || m.message_type === 'withdrawal_pending');
  } else if (filter === 'security') {
    filtered = messages.filter(m => m.message_type === 'turnstile_missed' || m.message_type === 'bot_warning' || m.message_type === 'account_banned');
  } else if (filter === 'admin') {
    filtered = messages.filter(m => m.message_type === 'admin_direct' || m.message_type === 'admin_test' || m.message_type === 'system_announcement');
  }

  // Build filter pills
  const filtersHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem;">
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button onclick="renderPlayerMessageCenter('all')" class="btn-filter ${filter === 'all' ? 'active' : ''}" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; border-radius: 6px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: ${filter === 'all' ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${filter === 'all' ? 'var(--border-cyan)' : 'var(--border-glass)'}; color: ${filter === 'all' ? 'var(--color-primary)' : 'var(--text-muted)'};">
          All (${messages.length})
        </button>
        <button onclick="renderPlayerMessageCenter('withdrawals')" class="btn-filter ${filter === 'withdrawals' ? 'active' : ''}" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; border-radius: 6px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: ${filter === 'withdrawals' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${filter === 'withdrawals' ? '#22c55e' : 'var(--border-glass)'}; color: ${filter === 'withdrawals' ? '#22c55e' : 'var(--text-muted)'};">
          💰 Withdrawals
        </button>
        <button onclick="renderPlayerMessageCenter('security')" class="btn-filter ${filter === 'security' ? 'active' : ''}" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; border-radius: 6px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: ${filter === 'security' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${filter === 'security' ? '#f59e0b' : 'var(--border-glass)'}; color: ${filter === 'security' ? '#f59e0b' : 'var(--text-muted)'};">
          🛡️ Security &amp; Alerts
        </button>
        <button onclick="renderPlayerMessageCenter('admin')" class="btn-filter ${filter === 'admin' ? 'active' : ''}" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; border-radius: 6px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: ${filter === 'admin' ? 'rgba(255,0,255,0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${filter === 'admin' ? '#ff00ff' : 'var(--border-glass)'}; color: ${filter === 'admin' ? '#ff00ff' : 'var(--text-muted)'};">
          👑 Admin Messages
        </button>
      </div>

      <div style="display: flex; gap: 0.5rem; align-items: center;">
        ${unreadCount > 0 ? `
          <button onclick="markAllPlayerMessagesReadAction()" class="btn-secondary" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; background: rgba(0,240,255,0.1); border: 1px solid var(--border-cyan); color: var(--color-primary); border-radius: 6px;">
            ✓ Mark All Read (${unreadCount})
          </button>
        ` : ''}
        <button onclick="loadPlayerMessages(true).then(() => renderPlayerMessageCenter())" class="btn-secondary" title="Refresh Inbox" style="padding: 0.35rem 0.65rem; font-size: 0.85rem; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass); color: var(--text-muted); border-radius: 6px;">
          🔄
        </button>
      </div>
    </div>
  `;

  if (filtered.length === 0) {
    container.innerHTML = `
      ${filtersHtml}
      <div class="card" style="text-align: center; padding: 3rem 1.5rem; background: rgba(0,0,0,0.25); border: 1px dashed var(--border-glass);">
        <div style="font-size: 3rem; margin-bottom: 0.75rem; opacity: 0.8;">📬</div>
        <h4 style="color: var(--text-white); margin-bottom: 0.35rem;">Inbox is Empty</h4>
        <p style="color: var(--text-dim); font-size: 0.88rem; max-width: 480px; margin: 0 auto;">
          ${filter === 'all' 
            ? 'No notifications or messages in your inbox. All clear, Pilot!' 
            : 'No messages found under this filter.'}
        </p>
      </div>
    `;
    return;
  }

  // Render message cards
  const cardsHtml = filtered.map(m => {
    const isUnread = !m.is_read;
    const type = m.message_type || 'system_announcement';

    // Type badge config
    let badgeLabel = '📢 NOTICE';
    let badgeColor = 'var(--color-primary)';
    let badgeBg = 'rgba(0, 240, 255, 0.12)';
    let borderTint = isUnread ? 'var(--border-cyan)' : 'var(--border-glass)';
    let cardGlow = isUnread ? 'box-shadow: 0 0 14px rgba(0, 240, 255, 0.15);' : '';

    if (type === 'withdrawal_approved') {
      badgeLabel = '✅ WITHDRAWAL COMPLETE';
      badgeColor = '#22c55e';
      badgeBg = 'rgba(34, 197, 94, 0.15)';
      borderTint = isUnread ? '#22c55e' : 'rgba(34, 197, 94, 0.3)';
      cardGlow = isUnread ? 'box-shadow: 0 0 14px rgba(34, 197, 94, 0.2);' : '';
    } else if (type === 'withdrawal_pending') {
      badgeLabel = '⏳ WITHDRAWAL QUEUED';
      badgeColor = '#00f0ff';
      badgeBg = 'rgba(0, 240, 255, 0.15)';
      borderTint = isUnread ? '#00f0ff' : 'rgba(0, 240, 255, 0.3)';
      cardGlow = isUnread ? 'box-shadow: 0 0 14px rgba(0, 240, 255, 0.2);' : '';
    } else if (type === 'withdrawal_rejected') {
      badgeLabel = '❌ WITHDRAWAL REFUNDED';
      badgeColor = '#ef4444';
      badgeBg = 'rgba(239, 68, 68, 0.15)';
      borderTint = isUnread ? '#ef4444' : 'rgba(239, 68, 68, 0.3)';
      cardGlow = isUnread ? 'box-shadow: 0 0 14px rgba(239, 68, 68, 0.2);' : '';
    } else if (type === 'turnstile_missed') {
      badgeLabel = '🛡️ TURNSTILE MISSED';
      badgeColor = '#f59e0b';
      badgeBg = 'rgba(245, 158, 11, 0.15)';
      borderTint = isUnread ? '#f59e0b' : 'rgba(245, 158, 11, 0.3)';
      cardGlow = isUnread ? 'box-shadow: 0 0 14px rgba(245, 158, 11, 0.2);' : '';
    } else if (type === 'bot_warning') {
      badgeLabel = '⚠️ BOT ADVISORY';
      badgeColor = '#f97316';
      badgeBg = 'rgba(249, 115, 22, 0.15)';
      borderTint = isUnread ? '#f97316' : 'rgba(249, 115, 22, 0.3)';
    } else if (type === 'account_banned') {
      badgeLabel = '🚫 SUSPENDED';
      badgeColor = '#ff0055';
      badgeBg = 'rgba(255, 0, 85, 0.18)';
      borderTint = '#ff0055';
      cardGlow = 'box-shadow: 0 0 16px rgba(255, 0, 85, 0.3);';
    } else if (type === 'admin_direct') {
      badgeLabel = '👑 ADMIN DIRECT';
      badgeColor = '#ff00ff';
      badgeBg = 'rgba(255, 0, 255, 0.15)';
      borderTint = isUnread ? '#ff00ff' : 'rgba(255, 0, 255, 0.3)';
      cardGlow = isUnread ? 'box-shadow: 0 0 14px rgba(255, 0, 255, 0.25);' : '';
    } else if (type === 'admin_test') {
      badgeLabel = '🧪 TEST PING';
      badgeColor = '#a855f7';
      badgeBg = 'rgba(168, 85, 247, 0.15)';
      borderTint = isUnread ? '#a855f7' : 'var(--border-glass)';
    }

    return `
      <div class="card message-card" id="msg-card-${m.id}" style="margin-bottom: 0.9rem; background: linear-gradient(135deg, rgba(20, 20, 30, 0.85), rgba(10, 10, 20, 0.95)); border: 1px solid ${borderTint}; border-radius: 8px; padding: 1.15rem; ${cardGlow} transition: all 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.6rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <span style="font-size: 0.7rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; letter-spacing: 0.5px;">
              ${badgeLabel}
            </span>
            <span style="font-size: 0.78rem; color: var(--text-dim);">From: <strong style="color: var(--text-white);">${escapeHtml(m.sender_name || 'Master Admin')}</strong></span>
            ${isUnread ? '<span style="width: 8px; height: 8px; background: #ff0055; border-radius: 50%; box-shadow: 0 0 6px #ff0055;" title="Unread"></span>' : ''}
          </div>
          <span style="font-size: 0.75rem; color: var(--text-dim); white-space: nowrap;">
            ${formatRelativeTime(m.created_at)}
          </span>
        </div>

        <h4 style="color: var(--text-white); margin: 0 0 0.45rem 0; font-size: 0.98rem; font-weight: 700;">
          ${escapeHtml(m.title)}
        </h4>

        <div style="color: var(--text-muted); font-size: 0.86rem; line-height: 1.45; margin-bottom: 0.75rem; white-space: pre-wrap;">
          ${escapeHtml(m.body)}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; padding-top: 0.6rem; border-top: 1px dashed rgba(255,255,255,0.06);">
          <div>
            ${m.action_url ? `
              <a href="${escapeHtml(m.action_url)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(0,240,255,0.15); border: 1px solid var(--border-cyan); color: var(--color-primary); border-radius: 4px;">
                🔍 View Transaction Receipt ↗
              </a>
            ` : ''}
          </div>

          <div style="display: flex; gap: 0.4rem; align-items: center;">
            ${isUnread ? `
              <button onclick="markPlayerMessageReadAction('${m.id}', false)" class="btn-icon-action" style="font-size: 0.75rem; padding: 0.25rem 0.55rem; color: var(--color-primary); border: 1px solid var(--border-cyan); background: rgba(0,240,255,0.08); border-radius: 4px; cursor: pointer;">
                ✓ Mark Read
              </button>
            ` : ''}
            <button onclick="markPlayerMessageReadAction('${m.id}', true)" class="btn-icon-action" title="Dismiss / Archive" style="font-size: 0.75rem; padding: 0.25rem 0.55rem; color: var(--text-dim); border: 1px solid var(--border-glass); background: rgba(255,255,255,0.04); border-radius: 4px; cursor: pointer;">
              🗑️ Dismiss
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    ${filtersHtml}
    <div class="message-feed">
      ${cardsHtml}
    </div>
  `;
}

/**
 * Marks an individual message as read or dismissed
 */
export async function markPlayerMessageReadAction(messageId, dismiss = false) {
  if (!supabase || !messageId) return;

  if (!appState?.isPlayerConnected()) return;
  const playerId = appState?.getPlayerId?.() || appState?.state?.playerId || appState?.state?.walletAddress;
  if (!playerId || playerId.startsWith('0xguest')) return;

  // Optimistic UI update
  const messages = appState?.state?.playerMessages || [];
  const target = messages.find(m => m.id === messageId);
  if (target) {
    if (dismiss) {
      appState.update({
        playerMessages: messages.filter(m => m.id !== messageId)
      });
    } else {
      target.is_read = true;
    }

    const newUnread = (appState.state.playerMessages || []).filter(m => !m.is_read).length;
    appState.update({ unreadMessageCount: newUnread });
    updateUnreadMessageBadge(newUnread);
    renderPlayerMessageCenter();
  }

  try {
    await executeAuthenticatedRpc('mark_player_message_read', {
      p_message_id: messageId,
      p_player_id: playerId,
      p_dismiss: dismiss
    });
  } catch (e) {
    console.warn("[markPlayerMessageReadAction] Notice:", e);
  }
}

/**
 * Marks all player messages as read
 */
export async function markAllPlayerMessagesReadAction() {
  if (!supabase) return;

  if (!appState?.isPlayerConnected()) return;
  const playerId = appState?.getPlayerId?.() || appState?.state?.playerId || appState?.state?.walletAddress;
  if (!playerId || playerId.startsWith('0xguest')) return;

  // Optimistic UI update
  const messages = appState?.state?.playerMessages || [];
  messages.forEach(m => m.is_read = true);
  appState.update({
    playerMessages: messages,
    unreadMessageCount: 0
  });
  updateUnreadMessageBadge(0);
  renderPlayerMessageCenter();

  try {
    await executeAuthenticatedRpc('mark_all_player_messages_read', {
      p_player_id: playerId
    });
  } catch (e) {
    console.warn("[markAllPlayerMessagesReadAction] Notice:", e);
  }
}

// Global window bindings for HTML onclick handlers
if (typeof window !== 'undefined') {
  window.loadPlayerMessages = loadPlayerMessages;
  window.renderPlayerMessageCenter = renderPlayerMessageCenter;
  window.markPlayerMessageReadAction = markPlayerMessageReadAction;
  window.markAllPlayerMessagesReadAction = markAllPlayerMessagesReadAction;
  window.updateUnreadMessageBadge = updateUnreadMessageBadge;
}
