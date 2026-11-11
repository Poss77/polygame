import { APP_VERSION, supabase } from './config.js';
import { appState } from './state.js';
import { triggerToast } from './ui.js';

const MAX_NETWORK_LOGS = 50;
const MAX_ERROR_LOGS = 30;

const diagState = {
  bootTime: new Date().toISOString(),
  networkLogs: [],
  errorLogs: [],
  hookedSupabase: false
};

function pushBounded(arr, item, maxLen) {
  arr.unshift(item);
  if (arr.length > maxLen) arr.length = maxLen;
}

function sanitizeParams(params) {
  if (!params || typeof params !== 'object') return params;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (/secret|token|password|signature|key/i.test(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'string' && v.length > 120) {
      out[k] = v.slice(0, 120) + '...';
    } else {
      out[k] = v;
    }
  }
  return out;
}

function hookSupabaseTelemetry() {
  if (diagState.hookedSupabase || !supabase) return;
  diagState.hookedSupabase = true;

  // 1. Wrap supabase.rpc
  if (typeof supabase.rpc === 'function') {
    const origRpc = supabase.rpc.bind(supabase);
    supabase.rpc = function wrappedRpc(fnName, params = {}, options = undefined) {
      const start = performance.now();
      const result = origRpc(fnName, params, options);
      if (result && typeof result.then === 'function') {
        result.then(
          (res) => {
            const durationMs = Math.round(performance.now() - start);
            const hasErr = Boolean(res && res.error);
            const entry = {
              ts: new Date().toISOString(),
              type: 'rpc',
              name: fnName,
              params: sanitizeParams(params),
              durationMs,
              ok: !hasErr,
              error: hasErr ? (res.error.message || res.error.details || JSON.stringify(res.error)) : null,
              code: hasErr ? res.error.code : null
            };
            pushBounded(diagState.networkLogs, entry, MAX_NETWORK_LOGS);
            if (hasErr) {
              pushBounded(diagState.errorLogs, {
                ts: entry.ts,
                source: `RPC:${fnName}`,
                message: entry.error,
                code: entry.code
              }, MAX_ERROR_LOGS);
            }
          },
          (err) => {
            const durationMs = Math.round(performance.now() - start);
            const msg = err?.message || String(err);
            pushBounded(diagState.networkLogs, {
              ts: new Date().toISOString(),
              type: 'rpc',
              name: fnName,
              params: sanitizeParams(params),
              durationMs,
              ok: false,
              error: msg
            }, MAX_NETWORK_LOGS);
            pushBounded(diagState.errorLogs, {
              ts: new Date().toISOString(),
              source: `RPC_REJECT:${fnName}`,
              message: msg
            }, MAX_ERROR_LOGS);
          }
        );
      }
      return result;
    };
  }

  // 2. Wrap supabase.functions.invoke
  if (supabase.functions && typeof supabase.functions.invoke === 'function') {
    const origInvoke = supabase.functions.invoke.bind(supabase.functions);
    supabase.functions.invoke = async function wrappedInvoke(fnName, options = {}) {
      const start = performance.now();
      try {
        const res = await origInvoke(fnName, options);
        const durationMs = Math.round(performance.now() - start);
        const hasErr = Boolean(res && res.error);
        const entry = {
          ts: new Date().toISOString(),
          type: 'edge_fn',
          name: fnName,
          durationMs,
          ok: !hasErr,
          error: hasErr ? (res.error.message || String(res.error)) : null
        };
        pushBounded(diagState.networkLogs, entry, MAX_NETWORK_LOGS);
        if (hasErr) {
          pushBounded(diagState.errorLogs, {
            ts: entry.ts,
            source: `EDGE:${fnName}`,
            message: entry.error
          }, MAX_ERROR_LOGS);
        }
        return res;
      } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        const msg = err?.message || String(err);
        pushBounded(diagState.networkLogs, {
          ts: new Date().toISOString(),
          type: 'edge_fn',
          name: fnName,
          durationMs,
          ok: false,
          error: msg
        }, MAX_NETWORK_LOGS);
        pushBounded(diagState.errorLogs, {
          ts: new Date().toISOString(),
          source: `EDGE_THROW:${fnName}`,
          message: msg
        }, MAX_ERROR_LOGS);
        throw err;
      }
    };
  }
}

function hookGlobalErrors() {
  window.addEventListener('error', (event) => {
    pushBounded(diagState.errorLogs, {
      ts: new Date().toISOString(),
      source: 'window.onerror',
      message: event.message || 'Unknown error',
      file: event.filename ? event.filename.split('/').pop() : null,
      line: event.lineno || null
    }, MAX_ERROR_LOGS);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : JSON.stringify(reason));
    pushBounded(diagState.errorLogs, {
      ts: new Date().toISOString(),
      source: 'unhandledrejection',
      message: msg
    }, MAX_ERROR_LOGS);
  });
}

export function getDiagnosticReport() {
  const activePanel = document.querySelector('.view-panel.active');
  const spaceState = window.spaceState || appState?.spaceState || {};
  const ship = spaceState?.ship || {};

  return {
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    bootTime: diagState.bootTime,
    url: window.location.href,
    activeView: activePanel ? activePanel.id : 'unknown',
    player: {
      walletAddress: appState?.walletAddress || null,
      linkedWalletAddress: appState?.linkedWalletAddress || null,
      username: appState?.username || null,
      isLoggedIn: Boolean(appState?.isLoggedIn),
      isVip: Boolean(appState?.isVip),
      balancePgt: Number(appState?.balance || 0),
      stakedPgt: Number(appState?.stakedBalance || 0),
      nftCount: Array.isArray(appState?.ownedNfts) ? appState.ownedNfts.length : 0,
      relicCount: Array.isArray(appState?.ownedRelics) ? appState.ownedRelics.length : 0,
      equippedStarshipId: appState?.equippedStarshipId || null,
      starshipBonusPct: Number(appState?.starshipBonusPct || 0)
    },
    polySpace: {
      warpDrive: ship.warpDrive || 1,
      miningLaser: ship.miningLaser || 1,
      cargoHold: ship.cargoHold || 1,
      totalPgtEarned: Number(spaceState?.totalPgtEarned || 0),
      activeExpedition: Boolean(spaceState?.expedition?.active)
    },
    recentErrors: diagState.errorLogs.slice(0, 15),
    recentNetwork: diagState.networkLogs.slice(0, 20)
  };
}

export async function copyDiagnosticReport() {
  const report = getDiagnosticReport();
  const formatted = JSON.stringify(report, null, 2);
  try {
    await navigator.clipboard.writeText(formatted);
    triggerToast('🩺 AI Debug Snapshot copied to clipboard! Paste it into chat.');
  } catch (_) {
    console.log('=== POLYGAME AI DIAGNOSTIC REPORT ===\n', formatted);
    triggerToast('🩺 Diagnostic Report logged to browser console (F12).');
  }
  return report;
}

export function toggleAdminTelemetryPanel() {
  const panel = document.getElementById('admin-telemetry-live-panel');
  if (!panel) return;
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
    renderAdminTelemetryPanel();
  } else {
    panel.style.display = 'none';
  }
}

export function renderAdminTelemetryPanel() {
  const panel = document.getElementById('admin-telemetry-live-panel');
  if (!panel) return;
  const report = getDiagnosticReport();
  const errCount = report.recentErrors.length;
  const netCount = report.recentNetwork.length;

  const errHtml = errCount === 0
    ? `<div style="color:#00ff88; font-size:0.8rem;">✅ Zero runtime or RPC errors recorded since boot.</div>`
    : report.recentErrors.slice(0, 6).map(e => `
        <div style="font-family:monospace; font-size:0.75rem; color:#ff6b8b; background:rgba(255,51,102,0.08); padding:4px 8px; border-radius:4px; border-left:2px solid #ff3366;">
          <strong>[${e.source}]</strong> ${String(e.message).replace(/</g, '&lt;')} <span style="color:#888;">(${e.ts.slice(11, 19)})</span>
        </div>
      `).join('');

  const netHtml = netCount === 0
    ? `<div style="color:#888; font-size:0.8rem;">No RPC or Edge Function calls recorded yet.</div>`
    : report.recentNetwork.slice(0, 8).map(n => `
        <div style="font-family:monospace; font-size:0.74rem; display:flex; justify-content:space-between; gap:0.5rem; padding:3px 6px; background:rgba(255,255,255,0.03); border-radius:4px;">
          <span>${n.ok ? '🟢' : '🔴'} <strong>${n.type.toUpperCase()}</strong> <code>${n.name}</code></span>
          <span style="color:${n.durationMs > 1200 ? '#ffaa00' : '#00f0ff'};">${n.durationMs}ms · ${n.ts.slice(11, 19)}</span>
        </div>
      `).join('');

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.5rem;">
      <strong style="color:#00f0ff; font-size:0.85rem;">🩺 Live Telemetry (v${report.version} · View: ${report.activeView})</strong>
      <div style="display:flex; gap:0.4rem;">
        <button class="btn-secondary" onclick="window.PolyDebug.refreshPanel()" style="font-size:0.72rem; padding:2px 8px;">🔄 Refresh</button>
        <button class="btn-secondary" onclick="window.PolyDebug.clearLogs()" style="font-size:0.72rem; padding:2px 8px;">🧹 Clear</button>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:0.75rem;">
      <div>
        <div style="font-size:0.75rem; color:#aaa; margin-bottom:4px; font-weight:700;">RECENT ERRORS (${errCount})</div>
        <div style="display:flex; flex-direction:column; gap:4px;">${errHtml}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:#aaa; margin-bottom:4px; font-weight:700;">RECENT RPC / EDGE CALLS (${netCount})</div>
        <div style="display:flex; flex-direction:column; gap:3px;">${netHtml}</div>
      </div>
    </div>
  `;
}

export function initDiagnostics() {
  hookSupabaseTelemetry();
  hookGlobalErrors();

  window.PolyDebug = {
    getReport: getDiagnosticReport,
    copyReport: copyDiagnosticReport,
    togglePanel: toggleAdminTelemetryPanel,
    refreshPanel: renderAdminTelemetryPanel,
    clearLogs: () => {
      diagState.errorLogs.length = 0;
      diagState.networkLogs.length = 0;
      renderAdminTelemetryPanel();
      triggerToast('🧹 Diagnostic logs cleared.');
    },
    state: diagState
  };
}
