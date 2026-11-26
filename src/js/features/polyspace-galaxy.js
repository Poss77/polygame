// ============================================================================
// PolySpace Milky Way Galaxy & 3D Missions (PLAN-023 Live Beta — Poss & Origin)
// ============================================================================
(function() {
  const BETA_PLAYER_IDS = new Set([
    '0xpgt8312e02d37185b5983e6922d1dae1cce', // Poss
    '0xpgt85c8416473bd6a8c45ada81ac85aeabb'  // Origin
  ]);
  const BETA_USERNAMES = new Set(['poss', 'origin']);
  const BETA_WALLETS = new Set([
    '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5',
    '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
  ]);

  window.isPolySpaceGalaxyBetaTester = function() {
    const st = (window.appState && window.appState.state) || window.PolyState || {};
    const pid = String(st.player_id || st.playerId || st.wallet || '').toLowerCase();
    const uname = String(st.username || '').toLowerCase();
    const lwal = String(st.linked_wallet_address || st.linkedWalletAddress || '').toLowerCase();
    return BETA_PLAYER_IDS.has(pid) || BETA_USERNAMES.has(uname) || BETA_WALLETS.has(lwal);
  };

  const PSG_CSS = "\n    :root {\n      --bg-dark: #030712;\n      --bg-panel: rgba(8, 15, 32, 0.88);\n      --cyan: #00f0ff;\n      --pink: #ff0055;\n      --purple: #a855f7;\n      --gold: #ffd700;\n      --green: #00ff88;\n      --text: #f8fafc;\n      --muted: #94a3b8;\n    }\n    \n    \n\n    /* Top Control Bar (Sandbox Upgrade Sliders & Mode Switcher) */\n    \n    .brand {\n      display: flex;\n      align-items: center;\n      gap: 10px;\n    }\n    .brand-badge {\n      background: rgba(0, 240, 255, 0.15);\n      border: 1px solid var(--cyan);\n      color: var(--cyan);\n      font-weight: 900;\n      font-size: 0.72rem;\n      padding: 3px 8px;\n      border-radius: 6px;\n      letter-spacing: 0.8px;\n    }\n    .brand-title {\n      font-size: 1rem;\n      font-weight: 900;\n      color: #fff;\n      letter-spacing: 0.5px;\n    }\n\n    /* Sandbox Sliders */\n    .sandbox-controls {\n      display: flex;\n      align-items: center;\n      gap: 14px;\n      background: rgba(0, 0, 0, 0.45);\n      padding: 6px 14px;\n      border-radius: 10px;\n      border: 1px solid rgba(255, 255, 255, 0.1);\n    }\n    .slider-group {\n      display: flex;\n      align-items: center;\n      gap: 6px;\n      font-size: 0.76rem;\n    }\n    .slider-group label {\n      font-weight: 800;\n      white-space: nowrap;\n    }\n    .slider-group input[type=\"range\"] {\n      width: 78px;\n      accent-color: var(--cyan);\n      cursor: pointer;\n    }\n    .lvl-pill {\n      font-family: monospace;\n      font-weight: 900;\n      padding: 2px 6px;\n      border-radius: 4px;\n      background: rgba(255, 255, 255, 0.08);\n      min-width: 44px;\n      text-align: center;\n    }\n\n    .mode-buttons {\n      display: flex;\n      align-items: center;\n      gap: 8px;\n    }\n    #psg-root .btn {\n      background: rgba(0, 240, 255, 0.15);\n      border: 1px solid var(--cyan);\n      color: #fff;\n      font-weight: 800;\n      font-size: 0.78rem;\n      padding: 7px 14px;\n      border-radius: 8px;\n      cursor: pointer;\n      transition: all 0.18s ease;\n      display: inline-flex;\n      align-items: center;\n      gap: 6px;\n    }\n    #psg-root .btn:hover {\n      background: rgba(0, 240, 255, 0.3);\n      box-shadow: 0 0 12px rgba(0, 240, 255, 0.45);\n      transform: translateY(-1px);\n    }\n    .btn.active {\n      background: linear-gradient(135deg, #00f0ff, #0284c7);\n      color: #000;\n      box-shadow: 0 0 15px rgba(0, 240, 255, 0.6);\n    }\n    #psg-root .btn-danger {\n      background: rgba(255, 0, 85, 0.2);\n      border-color: var(--pink);\n      color: #ff94b4;\n    }\n    #psg-root .btn-danger:hover {\n      background: rgba(255, 0, 85, 0.4);\n      box-shadow: 0 0 12px rgba(255, 0, 85, 0.5);\n    }\n    #psg-root .btn-gold {\n      background: linear-gradient(135deg, #ffd700, #f59e0b);\n      border-color: #ffd700;\n      color: #000;\n    }\n\n    /* Main Viewport */\n    #psg-viewport {\n      position: relative;\n      flex: 1;\n      width: 100%;\n      height: 100%;\n      overflow: hidden;\n      background: #02040a;\n    }\n    #psg-viewport canvas {\n      display: block;\n      width: 100%;\n      height: 100%;\n      touch-action: none;\n      -webkit-user-select: none;\n      -webkit-touch-callout: none;\n    }\n\n    /* 2D Galaxy Radar Overlays */\n    #hud-2d {\n      position: absolute;\n      inset: 0;\n      pointer-events: none;\n    }\n    #psg-root .hud-panel {\n      pointer-events: auto;\n      background: var(--bg-panel);\n      border: 1px solid rgba(0, 240, 255, 0.35);\n      border-radius: 10px;\n      padding: 12px 14px;\n      backdrop-filter: blur(8px);\n      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.65);\n    }\n    #nav-telemetry-card {\n      position: absolute;\n      top: 14px;\n      left: 14px;\n      width: 310px;\n    }\n    #system-briefing-card {\n      position: absolute;\n      bottom: 18px;\n      left: 50%;\n      transform: translateX(-50%);\n      min-width: 440px;\n      max-width: 92vw;\n      display: none;\n      border-color: var(--gold);\n      box-shadow: 0 0 25px rgba(255, 215, 0, 0.25);\n    }\n    #galaxy-Quick-Jump {\n      position: absolute;\n      top: 14px;\n      right: 14px;\n      width: 265px;\n    }\n\n    /* 3D Combat Overlays */\n    #hud-3d {\n      position: absolute;\n      inset: 0;\n      pointer-events: none;\n      display: none;\n    }\n    #combat-top-hud {\n      position: absolute;\n      top: 14px;\n      left: 50%;\n      transform: translateX(-50%);\n      display: flex;\n      align-items: center;\n      gap: 18px;\n      background: rgba(4, 10, 24, 0.85);\n      border: 1px solid rgba(0, 240, 255, 0.4);\n      border-radius: 12px;\n      padding: 8px 20px;\n      pointer-events: auto;\n    }\n    #combat-left-hud {\n      position: absolute;\n      bottom: 18px;\n      left: 18px;\n      width: 260px;\n      pointer-events: auto;\n    }\n    #combat-right-hud {\n      position: absolute;\n      bottom: 18px;\n      right: 18px;\n      width: 260px;\n      pointer-events: auto;\n    }\n    #psg-root .bar-wrap {\n      width: 100%;\n      height: 11px;\n      background: rgba(0, 0, 0, 0.65);\n      border-radius: 6px;\n      overflow: hidden;\n      border: 1px solid rgba(255, 255, 255, 0.15);\n      margin-top: 4px;\n      margin-bottom: 10px;\n    }\n    #psg-root .bar-fill {\n      height: 100%;\n      transition: width 0.12s linear;\n    }\n\n    /* Toast Banner */\n    #psg-toast-banner {\n      position: fixed;\n      top: 76px;\n      left: 50%;\n      transform: translateX(-50%);\n      background: rgba(6, 18, 38, 0.95);\n      border: 1px solid var(--cyan);\n      color: #fff;\n      font-weight: 800;\n      font-size: 0.86rem;\n      padding: 10px 20px;\n      border-radius: 8px;\n      z-index: 100;\n      box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);\n      display: none;\n      pointer-events: none;\n    }\n\n    /* End of Mission Modal */\n    #mission-modal {\n      position: absolute;\n      inset: 0;\n      background: rgba(2, 6, 18, 0.84);\n      backdrop-filter: blur(6px);\n      display: none;\n      align-items: center;\n      justify-content: center;\n      z-index: 60;\n      pointer-events: auto;\n    }\n    #psg-root .modal-box {\n      background: linear-gradient(145deg, #091326, #040814);\n      border: 2px solid var(--cyan);\n      border-radius: 14px;\n      padding: 24px 30px;\n      max-width: 460px;\n      width: 90%;\n      text-align: center;\n      box-shadow: 0 0 40px rgba(0, 240, 255, 0.3);\n    }\n\n    /* Pilot Hail Card (2D Map) */\n    #pilot-hail-card {\n      position: absolute;\n      bottom: 16px;\n      left: 50%;\n      transform: translateX(-50%);\n      min-width: 440px;\n      max-width: 600px;\n      display: none;\n      border-color: var(--purple);\n      box-shadow: 0 0 28px rgba(168, 85, 247, 0.35);\n      pointer-events: auto;\n      z-index: 35;\n    }\n\n    /* Tactical Duel & Space Trade Modals */\n    #psg-root .overlay-modal {\n      position: absolute;\n      inset: 0;\n      background: rgba(2, 6, 18, 0.86);\n      backdrop-filter: blur(6px);\n      display: none;\n      align-items: center;\n      justify-content: center;\n      z-index: 70;\n      pointer-events: auto;\n    }\n    #psg-root .duel-box {\n      background: linear-gradient(145deg, #091326, #040814);\n      border: 2px solid var(--pink);\n      border-radius: 14px;\n      padding: 20px 24px;\n      width: 94%;\n      max-width: 620px;\n      box-shadow: 0 0 42px rgba(255, 0, 85, 0.28);\n    }\n    #psg-root .trade-box {\n      background: linear-gradient(145deg, #091326, #040814);\n      border: 2px solid var(--green);\n      border-radius: 14px;\n      padding: 20px 24px;\n      width: 94%;\n      max-width: 540px;\n      box-shadow: 0 0 42px rgba(0, 255, 136, 0.25);\n    }\n    #psg-root .vec-group {\n      display: flex;\n      gap: 5px;\n    }\n    #psg-root .vec-btn {\n      background: rgba(15, 23, 42, 0.9);\n      border: 1px solid rgba(148, 163, 184, 0.35);\n      color: var(--muted);\n      font-size: 0.72rem;\n      font-weight: 800;\n      padding: 5px 9px;\n      border-radius: 6px;\n      cursor: pointer;\n      transition: all 0.12s;\n    }\n    #psg-root .vec-btn.atk-active {\n      background: rgba(255, 0, 85, 0.28);\n      border-color: var(--pink);\n      color: #fff;\n      box-shadow: 0 0 10px rgba(255, 0, 85, 0.45);\n    }\n    #psg-root .vec-btn.def-active {\n      background: rgba(0, 240, 255, 0.25);\n      border-color: var(--cyan);\n      color: #fff;\n      box-shadow: 0 0 10px rgba(0, 240, 255, 0.45);\n    }\n    #duel-#psg-viewport canvas {\n      width: 100%;\n      height: 250px;\n      border-radius: 10px;\n      border: 1px solid rgba(0, 240, 255, 0.35);\n      background: #02050d;\n      display: block;\n    }\n\n    /* Mobile Touch Controls & Responsive HUD */\n    #mobile-3d-controls {\n      display: none;\n      position: absolute;\n      bottom: 16px;\n      right: 14px;\n      gap: 10px;\n      align-items: flex-end;\n      pointer-events: auto;\n      z-index: 30;\n    }\n    .touch-action-btn {\n      width: 68px;\n      height: 68px;\n      border-radius: 50%;\n      border: 2px solid var(--cyan);\n      background: rgba(6, 18, 38, 0.84);\n      color: #fff;\n      font-weight: 900;\n      font-size: 0.72rem;\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n      justify-content: center;\n      gap: 2px;\n      box-shadow: 0 0 18px rgba(0, 240, 255, 0.35);\n      touch-action: none;\n      -webkit-tap-highlight-color: transparent;\n      user-select: none;\n    }\n    .touch-action-btn:active, .touch-action-btn.pressed {\n      transform: scale(0.92);\n      background: rgba(0, 240, 255, 0.35);\n    }\n    .touch-action-btn.fire-btn {\n      width: 78px;\n      height: 78px;\n      border-color: var(--pink);\n      box-shadow: 0 0 20px rgba(255, 0, 85, 0.45);\n    }\n    .touch-action-btn.fire-btn:active, .touch-action-btn.fire-btn.pressed {\n      background: rgba(255, 0, 85, 0.4);\n    }\n    .touch-action-btn.missile-btn {\n      border-color: var(--gold);\n      box-shadow: 0 0 18px rgba(255, 215, 0, 0.38);\n    }\n    .touch-autofire-pill {\n      padding: 5px 10px;\n      border-radius: 999px;\n      border: 1px solid var(--green);\n      background: rgba(0, 255, 136, 0.2);\n      color: #a7f3d0;\n      font-size: 0.68rem;\n      font-weight: 900;\n      touch-action: none;\n    }\n    .touch-autofire-pill.off {\n      border-color: rgba(148, 163, 184, 0.4);\n      background: rgba(15, 23, 42, 0.8);\n      color: var(--muted);\n    }\n    #mobile-zoom-btns {\n      display: none;\n      position: absolute;\n      bottom: 16px;\n      right: 12px;\n      flex-direction: column;\n      gap: 6px;\n      pointer-events: auto;\n      z-index: 25;\n    }\n    #mobile-trade-btn {\n      display: flex;\n      position: absolute;\n      top: 12px;\n      right: 14px;\n      pointer-events: auto;\n      z-index: 25;\n    }\n\n    @media (max-width: 900px), (pointer: coarse) {\n      \n      .brand-title { display: none; }\n      .sandbox-controls {\n        width: 100%;\n        justify-content: space-between;\n        gap: 6px;\n        overflow-x: auto;\n        padding-bottom: 2px;\n      }\n      .slider-group { font-size: 0.68rem; gap: 4px; }\n      .slider-group input[type=\"range\"] { width: 54px; }\n      #psg-viewport { height: auto; flex: 1; }\n      #nav-telemetry-card {\n        top: 8px;\n        left: 8px;\n        width: 195px;\n        padding: 7px 9px;\n        font-size: 0.7rem;\n      }\n      .nav-help-text { display: none !important; }\n      #galaxy-Quick-Jump { display: none !important; }\n      #mobile-trade-btn { display: flex; }\n      #system-briefing-card, #pilot-hail-card {\n        min-width: 0;\n        width: calc(100% - 16px);\n        max-width: calc(100% - 16px);\n        bottom: 10px;\n        padding: 10px 12px;\n      }\n      #mobile-zoom-btns { display: flex; }\n      #combat-top-hud {\n        top: 6px;\n        width: calc(100% - 16px);\n        padding: 6px 10px;\n        gap: 8px;\n        justify-content: space-between;\n        flex-wrap: nowrap;\n        overflow-x: auto;\n      }\n      #combat-top-hud > div { white-space: nowrap; }\n      #combat-left-hud {\n        bottom: auto;\n        top: 64px;\n        left: 8px;\n        width: 170px;\n        padding: 7px 9px;\n      }\n      #combat-left-hud #psg-root .bar-wrap { height: 8px; margin-bottom: 6px; }\n      #combat-right-hud { display: none; }\n      #mobile-3d-controls { display: flex; }\n      #psg-root .duel-box, #psg-root .trade-box, #psg-root .modal-box {\n        max-height: 92vh;\n        overflow-y: auto;\n        padding: 14px 14px;\n      }\n      #duel-#psg-viewport canvas { height: 195px; }\n    }\n  \n#psg-root { position: relative; width: 100%; height: 100%; font-family: inherit; color: #f8fafc; overflow: hidden; }\n#psg-root.psg-fullscreen { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 9600 !important; background: #02040a !important; border-radius: 0 !important; }\n#psg-root:not(.psg-fullscreen) #nav-telemetry-card { top: 6px; left: 6px; width: 185px; padding: 6px 8px; }\n#psg-root:not(.psg-fullscreen) #nav-telemetry-card input { width: 48px !important; }\n#psg-root:not(.psg-fullscreen) #mobile-trade-btn { top: 6px; right: 6px; }\n#psg-root:not(.psg-fullscreen) #system-briefing-card,\n#psg-root:not(.psg-fullscreen) #pilot-hail-card { min-width: 0; width: calc(100% - 16px); bottom: 6px; padding: 8px 10px; }\n#psg-toast-banner { position: absolute !important; top: 10px !important; left: 50% !important; transform: translateX(-50%) !important; }\n";
  const PSG_HTML = "<div id=\"psg-toast-banner\"></div>\n<div id=\"psg-viewport\">\n    <canvas id=\"demo-canvas\"></canvas>\n\n    <!-- ==================== 2D MILKY WAY OVERLAY HUD ==================== -->\n    <div id=\"hud-2d\">\n      <!-- Top-Left: Ultra-Compact Coordinate Pill -->\n      <div class=\"hud-panel\" id=\"nav-telemetry-card\" style=\"padding:4px 7px; width:auto;\">\n        <div style=\"display:flex; align-items:center; gap:6px;\">\n          <span style=\"font-family:monospace; font-size:0.72rem; color:#00ff88; font-weight:800; white-space:nowrap;\" id=\"coord-readout\">X: +0 | Y: +0</span>\n          <button class=\"btn\" style=\"padding:2px 5px; font-size:0.68rem;\" onclick=\"window.PolySpaceGalaxy.instance.centerOnShip()\" title=\"Center on Ship\">\ud83c\udfaf</button>\n          <button class=\"btn\" style=\"padding:2px 5px; font-size:0.68rem;\" onclick=\"window.PolySpaceGalaxy.instance.shareLocation()\" title=\"Share Coordinates\">\ud83d\udce4</button>\n        </div>\n      </div>\n\n      <!-- Bottom-Center: Pilot Hail Card (Click any Player Ship on 2D Map) -->\n      <div class=\"hud-panel\" id=\"pilot-hail-card\">\n        <div style=\"display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap;\">\n          <div>\n            <div style=\"display:flex; align-items:center; gap:8px;\">\n              <span id=\"hail-pilot-name\" style=\"font-size:1.02rem; font-weight:900; color:#e9d5ff;\">\ud83d\udef8 PILOT</span>\n              <span id=\"hail-pilot-rarity\" style=\"font-size:0.7rem; font-weight:800; padding:2px 7px; border-radius:4px; background:rgba(168,85,247,0.22); border:1px solid var(--purple); color:#e9d5ff;\">LEGENDARY</span>\n            </div>\n            <div id=\"hail-pilot-stats\" style=\"font-size:0.75rem; color:var(--muted); margin-top:3px;\">\n              \ud83d\udee1\ufe0f Shield Lvl 18 \u2022 \u2604\ufe0f Turret Lvl 20 \u2022 Status: Cruising Sector\n            </div>\n          </div>\n          <div style=\"display:flex; gap:8px; align-items:center;\">\n            <button class=\"btn btn-danger\" style=\"padding:8px 14px;\" onclick=\"window.PolySpaceGalaxy.instance.openTacticalDuel()\">\n              \u2694\ufe0f TACTICAL DUEL\n            </button>\n            <button class=\"btn\" style=\"padding:6px 9px; font-size:0.72rem;\" onclick=\"document.getElementById('pilot-hail-card').style.display='none'\">\u2715</button>\n          </div>\n        </div>\n      </div>\n\n      <!-- Bottom-Center: Solar System Arrival Briefing Popup -->\n      <div class=\"hud-panel\" id=\"system-briefing-card\">\n        <div style=\"display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap;\">\n          <div>\n            <div style=\"display:flex; align-items:center; gap:8px;\">\n              <span id=\"brief-sys-title\" style=\"font-size:1.05rem; font-weight:900; color:var(--gold);\">\u2600\ufe0f SYSTEM #1: ALPHA CENTAURI</span>\n              <span id=\"brief-sys-lvl\" style=\"font-size:0.72rem; font-weight:800; padding:2px 7px; border-radius:4px; background:rgba(255,215,0,0.2); border:1px solid var(--gold); color:var(--gold);\">Recommended Lvl 1</span>\n            </div>\n            <div id=\"brief-sys-desc\" style=\"font-size:0.76rem; color:var(--muted); margin-top:3px;\">\n              3D Combat Mission (2\u20135 min) \u2022 2 Fighter Squadron Waves + Solar System Command Boss \u2022 Reward: +25 PGT\n            </div>\n          </div>\n          <button class=\"btn btn-gold\" id=\"btn-engage-system\" style=\"padding:9px 18px; font-size:0.86rem;\" onclick=\"window.PolySpaceGalaxy.instance.launch3DMission(window.PolySpaceGalaxy.instance.selectedSystemId)\">\n            \u2694\ufe0f LAUNCH 3D MISSION\n          </button>\n        </div>\n      </div>\n      <!-- Top-Right Compact Buttons: Rank Leaderboard + Drop Trade Beacon -->\n      <div id=\"mobile-trade-btn\" style=\"gap:6px;\">\n        <button class=\"btn\" style=\"border-color:var(--gold); color:#fde047; padding:6px 10px; font-size:0.72rem;\" onclick=\"window.PolySpaceGalaxy.instance.openRankLeaderboard()\">\ud83c\udfc6 <span id=\"hud-rank-badge\">Cadet \u2022 0 XP</span></button>\n        <button class=\"btn\" style=\"border-color:var(--green); color:#a7f3d0; padding:6px 10px; font-size:0.72rem;\" onclick=\"window.PolySpaceGalaxy.instance.openPostTradeBeacon()\">\ud83e\udd1d Trade</button>\n        <button id=\"psg-btn-fullscreen\" class=\"btn\" style=\"border-color:#00f0ff; color:#00f0ff; padding:6px 10px; font-size:0.72rem;\" onclick=\"window.PolySpaceGalaxy.instance.toggleFullscreen()\">\u26f6 Expand</button>\n      </div>\n\n      <!-- Mobile 2D Map Zoom Buttons -->\n      <div id=\"mobile-zoom-btns\">\n        <button class=\"btn\" style=\"width:40px; height:40px; padding:0; justify-content:center; font-size:1.1rem;\" onclick=\"window.PolySpaceGalaxy.instance.adjustZoom(1.3)\">+</button>\n        <button class=\"btn\" style=\"width:40px; height:40px; padding:0; justify-content:center; font-size:1.1rem;\" onclick=\"window.PolySpaceGalaxy.instance.adjustZoom(0.75)\">\u2212</button>\n      </div>\n    </div>\n\n    <!-- ==================== 3D DOGFIGHT COCKPIT HUD ==================== -->\n    <div id=\"hud-3d\">\n      <!-- Top Combat Banner -->\n      <div id=\"combat-top-hud\">\n        <div>\n          <div style=\"font-size:0.68rem; color:var(--muted); text-transform:uppercase; font-weight:800;\">ACTIVE SOLAR SYSTEM</div>\n          <div id=\"hud3d-system-name\" style=\"font-size:0.95rem; font-weight:900; color:var(--cyan);\">System #15 \u2022 Vega Prime (Lvl 15)</div>\n        </div>\n        <div style=\"height:28px; width:1px; background:rgba(255,255,255,0.15);\"></div>\n        <div>\n          <div style=\"font-size:0.68rem; color:var(--muted); text-transform:uppercase; font-weight:800;\">PHASE / WAVE</div>\n          <div id=\"hud3d-wave\" style=\"font-size:0.95rem; font-weight:900; color:var(--gold);\">Wave 1 / 3 \u2022 Scout Squadron</div>\n        </div>\n        <div style=\"height:28px; width:1px; background:rgba(255,255,255,0.15);\"></div>\n        <div>\n          <div style=\"font-size:0.68rem; color:var(--muted); text-transform:uppercase; font-weight:800;\">HOSTILES REMAINING</div>\n          <div id=\"hud3d-enemies\" style=\"font-size:0.95rem; font-weight:900; color:#ff4d79;\">5 Ships</div>\n        </div>\n        <div style=\"height:28px; width:1px; background:rgba(255,255,255,0.15);\"></div>\n        <div>\n          <div style=\"font-size:0.68rem; color:var(--muted); text-transform:uppercase; font-weight:800;\">MISSION TIME</div>\n          <div id=\"hud3d-timer\" style=\"font-family:monospace; font-size:1rem; font-weight:900; color:#fff;\">00:00</div>\n        </div>\n        <button class=\"btn btn-danger\" style=\"padding:5px 10px; font-size:0.72rem;\" onclick=\"window.PolySpaceGalaxy.instance.switchMode('galaxy')\">\u2b05\ufe0f Abort to Galaxy</button>\n      </div>\n\n      <!-- Bottom-Left: Shield & Hull Integrity -->\n      <div class=\"hud-panel\" id=\"combat-left-hud\">\n        <div style=\"font-size:0.76rem; font-weight:900; color:var(--cyan); margin-bottom:4px; display:flex; justify-content:space-between;\">\n          <span>\ud83d\udee1\ufe0f QUANTUM SHIELD</span>\n          <span id=\"hud3d-shield-txt\" style=\"font-family:monospace;\">1,500 / 1,500</span>\n        </div>\n        <div class=\"bar-wrap\">\n          <div class=\"bar-fill\" id=\"hud3d-shield-bar\" style=\"width:100%; background:linear-gradient(90deg, #0284c7, #00f0ff); box-shadow:0 0 10px #00f0ff;\"></div>\n        </div>\n\n        <div style=\"font-size:0.76rem; font-weight:900; color:var(--green); margin-bottom:4px; display:flex; justify-content:space-between;\">\n          <span>\ud83d\udd29 HULL ARMOR</span>\n          <span id=\"hud3d-hull-txt\" style=\"font-family:monospace;\">1,000 / 1,000</span>\n        </div>\n        <div class=\"bar-wrap\" style=\"margin-bottom:4px;\">\n          <div class=\"bar-fill\" id=\"hud3d-hull-bar\" style=\"width:100%; background:linear-gradient(90deg, #059669, #00ff88);\"></div>\n        </div>\n        <div style=\"font-size:0.68rem; color:var(--muted);\">\n          \ud83d\udca1 Shields auto-regenerate when you evade enemy fire for 2.5s.\n        </div>\n      </div>\n\n      <!-- Bottom-Right: Weapons, Homing Missile & Controls Guide -->\n      <div class=\"hud-panel\" id=\"combat-right-hud\">\n        <div style=\"font-size:0.76rem; font-weight:900; color:#ff4d79; margin-bottom:5px; display:flex; justify-content:space-between;\">\n          <span id=\"hud3d-weapon-name\">\u2604\ufe0f TWIN PLASMA TURRETS</span>\n          <span id=\"hud3d-dps-txt\" style=\"font-family:monospace;\">165 DMG</span>\n        </div>\n        <div style=\"font-size:0.73rem; font-weight:900; color:var(--gold); margin-bottom:3px; display:flex; justify-content:space-between; align-items:center;\">\n          <span>\ud83d\ude80 AUTO-LOCK MISSILE [SPACE]</span>\n          <span id=\"hud3d-missile-txt\" style=\"font-family:monospace; color:var(--green);\">READY</span>\n        </div>\n        <div class=\"bar-wrap\" style=\"margin-bottom:6px;\">\n          <div class=\"bar-fill\" id=\"hud3d-missile-bar\" style=\"width:100%; background:linear-gradient(90deg, #f59e0b, #00ff88);\"></div>\n        </div>\n        <div style=\"display:flex; justify-content:space-between; align-items:center; gap:8px;\">\n          <div style=\"font-size:0.67rem; color:var(--muted); line-height:1.35;\">\n            \u2022 <strong>Steer:</strong> Mouse or <strong>WASD / Arrows</strong> (Auto-Fire ON)<br/>\n            \u2022 <strong>Homing Missile:</strong> <strong>Spacebar</strong> or <strong>R-Click</strong>\n          </div>\n          <button class=\"btn btn-gold\" id=\"btn-fire-missile\" style=\"padding:5px 9px; font-size:0.7rem; white-space:nowrap;\" onclick=\"window.PolySpaceGalaxy.instance.fireHomingMissile()\">\ud83d\ude80 LAUNCH</button>\n        </div>\n      </div>\n\n      <!-- Mobile Touch 3D Combat Control (Always-On Auto-Fire -> Only 1 Clean Missile Button!) -->\n      <div id=\"mobile-3d-controls\">\n        <button id=\"btn-mobile-missile\" class=\"touch-action-btn missile-btn\" onclick=\"window.PolySpaceGalaxy.instance.fireHomingMissile()\">\n          <span style=\"font-size:1.3rem;\">\ud83d\ude80</span>\n          <span id=\"mobile-missile-lbl\" style=\"font-size:0.64rem; color:#00ff88;\">READY</span>\n        </button>\n      </div>\n    </div>\n\n    <!-- Mission Victory / Defeat Modal -->\n    <div id=\"mission-modal\">\n      <div class=\"modal-box\">\n        <div id=\"modal-icon\" style=\"font-size:2.8rem; margin-bottom:6px;\">\ud83c\udfc6</div>\n        <h2 id=\"modal-title\" style=\"color:var(--green); font-size:1.45rem; font-weight:900; margin-bottom:8px;\">SOLAR SYSTEM CLEARED!</h2>\n        <p id=\"modal-desc\" style=\"color:var(--muted); font-size:0.88rem; margin-bottom:16px; line-height:1.45;\"></p>\n        <div id=\"modal-loot\" style=\"background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.3); border-radius:8px; padding:12px; margin-bottom:18px; font-weight:800; color:var(--gold); font-size:0.95rem;\"></div>\n        <div style=\"display:flex; gap:10px; justify-content:center;\">\n          <button class=\"btn\" onclick=\"window.PolySpaceGalaxy.instance.closeModalAndReturn()\">\ud83d\uddfa\ufe0f Return to Milky Way</button>\n          <button class=\"btn btn-gold\" onclick=\"window.PolySpaceGalaxy.instance.retry3DMission()\">\ud83d\udd04 Replay 3D Battle</button>\n        </div>\n      </div>\n    </div>\n\n    <!-- Tactical 3-Round Pre-Decided PvP Ship Duel Modal -->\n    <div class=\"overlay-modal\" id=\"tactical-duel-modal\">\n      <div class=\"duel-box\">\n        <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;\">\n          <div>\n            <div style=\"font-size:0.68rem; color:#ff4d79; font-weight:900; letter-spacing:0.8px;\">ASYNC SHIP-TO-SHIP TACTICAL DUEL</div>\n            <h3 id=\"duel-title\" style=\"font-size:1.1rem; font-weight:900; color:#fff;\">\u2694\ufe0f YOU vs. RIVAL PILOT</h3>\n          </div>\n          <button class=\"btn\" style=\"padding:4px 10px; font-size:0.75rem;\" onclick=\"window.PolySpaceGalaxy.instance.closeTacticalDuel()\">\u2715 Close</button>\n        </div>\n\n        <!-- Phase 1: Pre-Decide 3 Attack + 3 Defense Vectors -->\n        <div id=\"duel-setup-phase\">\n          <div style=\"font-size:0.76rem; color:var(--muted); margin-bottom:12px; line-height:1.4;\">\n            Pre-program your <strong>3 Attack Vectors</strong> and <strong>3 Shield Vectors</strong>. Matching the enemy's attack direction blocks <strong>70%</strong> of incoming damage!\n          </div>\n\n          <div id=\"duel-rounds-selector\" style=\"display:flex; flex-direction:column; gap:8px; margin-bottom:14px;\">\n            <!-- Populated dynamically by renderDuelSelector() -->\n          </div>\n\n          <div style=\"display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;\">\n            <div style=\"display:flex; align-items:center; gap:6px; font-size:0.76rem;\">\n              <span style=\"color:var(--gold); font-weight:800;\">Stake:</span>\n              <select id=\"duel-wager\" style=\"background:rgba(15,23,42,0.95); color:#fff; border:1px solid var(--gold); border-radius:6px; padding:4px 8px; font-weight:700;\">\n                <option value=\"0\">Friendly (0 PGT)</option>\n                <option value=\"25\" selected>25 PGT Pot</option>\n                <option value=\"50\">50 PGT Pot</option>\n                <option value=\"100\">100 PGT Pot</option>\n              </select>\n            </div>\n            <div style=\"display:flex; gap:8px;\">\n              <button class=\"btn\" style=\"font-size:0.75rem;\" onclick=\"window.PolySpaceGalaxy.instance.randomizeDuelMoves()\">\ud83c\udfb2 Randomize</button>\n              <button class=\"btn btn-danger\" style=\"padding:8px 16px; font-size:0.84rem;\" onclick=\"window.PolySpaceGalaxy.instance.startTacticalDuelPlayback()\">\ud83d\udd25 LOCK & WATCH 5s BATTLE</button>\n            </div>\n          </div>\n        </div>\n\n        <!-- Phase 2: 5-Second Animated Battle Playback -->\n        <div id=\"duel-playback-phase\" style=\"display:none;\">\n          <div style=\"display:grid; grid-template-columns:1fr auto 1fr; gap:10px; align-items:center; margin-bottom:8px;\">\n            <div>\n              <div style=\"font-size:0.72rem; font-weight:900; color:var(--cyan); display:flex; justify-content:space-between;\">\n                <span>YOUR FLAGSHIP</span>\n                <span id=\"duel-p1-hp-txt\">1000</span>\n              </div>\n              <div class=\"bar-wrap\" style=\"margin-bottom:0;\">\n                <div class=\"bar-fill\" id=\"duel-p1-hp-bar\" style=\"width:100%; background:linear-gradient(90deg, #0284c7, #00f0ff);\"></div>\n              </div>\n            </div>\n            <div id=\"duel-round-badge\" style=\"font-size:0.74rem; font-weight:900; color:var(--gold); padding:3px 9px; border-radius:6px; background:rgba(255,215,0,0.14); border:1px solid var(--gold);\">ROUND 1 / 3</div>\n            <div>\n              <div style=\"font-size:0.72rem; font-weight:900; color:#ff4d79; display:flex; justify-content:space-between;\">\n                <span id=\"duel-p2-name\">RIVAL</span>\n                <span id=\"duel-p2-hp-txt\">1000</span>\n              </div>\n              <div class=\"bar-wrap\" style=\"margin-bottom:0;\">\n                <div class=\"bar-fill\" id=\"duel-p2-hp-bar\" style=\"width:100%; background:linear-gradient(90deg, #be123c, #ff0055);\"></div>\n              </div>\n            </div>\n          </div>\n\n          <canvas id=\"duel-canvas\" width=\"570\" height=\"250\"></canvas>\n\n          <div id=\"duel-log-box\" style=\"margin-top:10px; font-size:0.74rem; color:#e2e8f0; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px 10px; min-height:54px; line-height:1.45;\"></div>\n\n          <div id=\"duel-result-actions\" style=\"display:none; justify-content:center; gap:10px; margin-top:12px;\">\n            <button class=\"btn btn-gold\" onclick=\"window.PolySpaceGalaxy.instance.openTacticalDuel()\">\ud83d\udd04 Rematch (New Tactics)</button>\n            <button class=\"btn\" onclick=\"window.PolySpaceGalaxy.instance.closeTacticalDuel()\">\ud83d\uddfa\ufe0f Return to Galaxy</button>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    <!-- Space Trade Beacon Modal (Post Open Offer OR 1-Click Accept Map Beacon) -->\n    <div class=\"overlay-modal\" id=\"trade-modal\">\n      <div class=\"trade-box\">\n        <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;\">\n          <div>\n            <div id=\"trade-subtitle\" style=\"font-size:0.68rem; color:var(--green); font-weight:900; letter-spacing:0.8px;\">OPEN MAP TRADE BEACON</div>\n            <h3 id=\"trade-title\" style=\"font-size:1.08rem; font-weight:900; color:#fff;\">\ud83e\udd1d POST TRADE BEACON</h3>\n          </div>\n          <button class=\"btn\" style=\"padding:4px 10px; font-size:0.75rem;\" onclick=\"document.getElementById('trade-modal').style.display='none'\">\u2715 Close</button>\n        </div>\n\n        <!-- Mode A: Post a New Trade Beacon at Your Current (X,Y) -->\n        <div id=\"trade-post-view\">\n          <div style=\"font-size:0.75rem; color:var(--muted); margin-bottom:10px;\">\n            Leave a fixed-price <strong>\ud83e\udd1d Trade Beacon</strong> on the galaxy map at your current location. Any pilot can accept it with 1 click!\n          </div>\n          <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;\">\n            <div style=\"background:rgba(0,240,255,0.06); border:1px solid rgba(0,240,255,0.28); border-radius:10px; padding:10px;\">\n              <div style=\"font-size:0.72rem; font-weight:900; color:var(--cyan); margin-bottom:6px;\">\ud83d\udce4 YOU OFFER (ESCROWED)</div>\n              <select id=\"beacon-offer-asset\" style=\"width:100%; background:#060c1a; border:1px solid rgba(0,240,255,0.4); color:#fff; border-radius:6px; padding:5px 6px; margin-bottom:6px; font-size:0.76rem;\">\n                <option value=\"\ud83d\udc8e Quantum Crystals\">\ud83d\udc8e Quantum Crystals</option>\n                <option value=\"\u2699\ufe0f Titanium Alloy\">\u2699\ufe0f Titanium Alloy</option>\n                <option value=\"\ud83e\udea8 Iron Ore\">\ud83e\udea8 Iron Ore</option>\n                <option value=\"\u2604\ufe0f Rare PGT Ore\">\u2604\ufe0f Rare PGT Ore</option>\n              </select>\n              <input type=\"number\" id=\"beacon-offer-amt\" value=\"500\" min=\"1\" style=\"width:100%; background:#060c1a; border:1px solid rgba(0,240,255,0.4); color:#fff; border-radius:6px; padding:5px 8px; font-family:monospace;\" />\n            </div>\n            <div style=\"background:rgba(0,255,136,0.06); border:1px solid rgba(0,255,136,0.28); border-radius:10px; padding:10px;\">\n              <div style=\"font-size:0.72rem; font-weight:900; color:var(--green); margin-bottom:6px;\">\ud83d\udce5 YOU REQUEST</div>\n              <select id=\"beacon-want-asset\" style=\"width:100%; background:#060c1a; border:1px solid rgba(0,255,136,0.4); color:#fff; border-radius:6px; padding:5px 6px; margin-bottom:6px; font-size:0.76rem;\">\n                <option value=\"\u2699\ufe0f Titanium Alloy\" selected>\u2699\ufe0f Titanium Alloy</option>\n                <option value=\"\ud83d\udc8e Quantum Crystals\">\ud83d\udc8e Quantum Crystals</option>\n                <option value=\"\ud83e\udea8 Iron Ore\">\ud83e\udea8 Iron Ore</option>\n                <option value=\"\u2604\ufe0f Rare PGT Ore\">\u2604\ufe0f Rare PGT Ore</option>\n              </select>\n              <input type=\"number\" id=\"beacon-want-amt\" value=\"1200\" min=\"1\" style=\"width:100%; background:#060c1a; border:1px solid rgba(0,255,136,0.4); color:#fff; border-radius:6px; padding:5px 8px; font-family:monospace;\" />\n            </div>\n          </div>\n          <div style=\"display:flex; justify-content:space-between; align-items:center; gap:10px;\">\n            <span style=\"font-size:0.7rem; color:var(--muted);\">\ud83d\udd25 5% resource burn fee \u2022 Auto-refunds if cancelled or expired (24h).</span>\n            <button class=\"btn\" style=\"border-color:var(--green); background:rgba(0,255,136,0.18); color:#fff; padding:8px 16px;\" onclick=\"window.PolySpaceGalaxy.instance.deployTradeBeacon()\">\n              \ud83d\udce1 DROP BEACON ON MAP\n            </button>\n          </div>\n        </div>\n\n        <!-- Mode B: Inspect & 1-Click Accept (or Cancel) an Existing Map Trade Beacon -->\n        <div id=\"trade-accept-view\" style=\"display:none;\">\n          <div id=\"beacon-detail-box\" style=\"background:rgba(0,255,136,0.07); border:1px solid rgba(0,255,136,0.3); border-radius:10px; padding:14px; margin-bottom:14px; font-size:0.84rem; line-height:1.6;\"></div>\n          <div style=\"display:flex; justify-content:space-between; align-items:center; gap:10px;\">\n            <span style=\"font-size:0.7rem; color:var(--muted);\">\ud83d\udd25 Atomic 1-click resource swap (5% burn fee).</span>\n            <button id=\"btn-accept-beacon\" class=\"btn\" style=\"border-color:var(--green); background:rgba(0,255,136,0.2); color:#fff; padding:8px 18px;\" onclick=\"window.PolySpaceGalaxy.instance.acceptSelectedBeacon()\">\n              \u2705 ACCEPT TRADE\n            </button>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    <!-- Ace Pilot Combat Ranking Leaderboard Modal (Weekly & All-Time) -->\n    <div class=\"overlay-modal\" id=\"rank-modal\">\n      <div class=\"trade-box\" style=\"border-color:var(--gold); max-width:580px;\">\n        <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;\">\n          <div>\n            <div style=\"font-size:0.68rem; color:var(--gold); font-weight:900; letter-spacing:0.8px;\">COMBAT XP \u2022 KILLS & TACTICAL DUELS</div>\n            <h3 style=\"font-size:1.08rem; font-weight:900; color:#fff;\">\ud83c\udfc6 ACE PILOT COMBAT RANKING</h3>\n          </div>\n          <button class=\"btn\" style=\"padding:4px 10px; font-size:0.75rem;\" onclick=\"document.getElementById('rank-modal').style.display='none'\">\u2715 Close</button>\n        </div>\n\n        <div id=\"rank-my-summary\" style=\"background:rgba(255,215,0,0.08); border:1px solid rgba(255,215,0,0.3); border-radius:8px; padding:8px 12px; margin-bottom:10px; font-size:0.78rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;\"></div>\n\n        <div style=\"display:flex; gap:8px; margin-bottom:10px;\">\n          <button id=\"tab-rank-weekly\" class=\"btn active\" style=\"flex:1; justify-content:center; font-size:0.76rem;\" onclick=\"window.PolySpaceGalaxy.instance.switchRankTab('weekly')\">\ud83d\udcc5 Weekly Sprint</button>\n          <button id=\"tab-rank-alltime\" class=\"btn\" style=\"flex:1; justify-content:center; font-size:0.76rem;\" onclick=\"window.PolySpaceGalaxy.instance.switchRankTab('alltime')\">\ud83c\udf0c All-Time Legends</button>\n        </div>\n\n        <div id=\"rank-table-wrap\" style=\"max-height:260px; overflow-y:auto; font-size:0.76rem;\"></div>\n      </div>\n    </div>\n  </div>";

// ============================================================================
    // PLAN-023 STANDALONE PROTOTYPE ENGINE
    // Mode 1: 2D Milky Way Spiral Galaxy Map + Click-to-Navigate + Hidden Gifts
    // Mode 2: 3D 6-DOF Physics Space Dogfight + 3D AI Multi-Pass + 360° Mini-Radar
    // ============================================================================

    class Plan023StandaloneDemo {
      constructor() {
        this.canvas = document.getElementById('demo-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.mode = 'galaxy'; // 'galaxy' | 'combat3d'

        // Sandbox Player Upgrades (1..50)
        this.shieldLevel = 15;
        this.turretLevel = 15;
        this.warpLevel = 15;

        // 2D Galaxy Camera & Coordinate Space (-10,000 .. +10,000)
        this.galaxyBound = 10000;
        this.camX = 0;
        this.camY = 0;
        this.camZoom = 0.42;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panOriginX = 0;
        this.panOriginY = 0;
        this.followShip2D = true;

        // Player 2D Flagship State
        this.ship2D = {
          x: 0,
          y: 80,
          vx: 0,
          vy: 0,
          angle: -Math.PI / 2,
          targetX: null,
          targetY: null,
          trail: []
        };

        this.clearedSystems = new Set();
        this.selectedSystemId = 15;
        this.combatXpAllTime = 0;
        this.combatXpWeekly = 0;
        this.totalKills = 0;
        this.duelWins = 0;
        this.rankTab = 'weekly';

        this.initGalaxyData();
        this.initEvents();
        this.updateUpgrades();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
      }

      // --------------------------------------------------------------------------
      // 1. MILKY WAY SPIRAL GALAXY & 50 SOLAR SYSTEMS GENERATOR
      // --------------------------------------------------------------------------
      initGalaxyData() {
        // Generate 1,400 procedural Milky Way spiral arm stars + dust clouds
        this.galaxyStars = [];
        const arms = 4;
        for (let i = 0; i < 1400; i++) {
          const arm = i % arms;
          const distFrac = Math.pow(Math.random(), 0.72); // 0..1 from galactic center
          const radius = 140 + distFrac * 3100;
          const spiralTwist = distFrac * 4.2;
          const baseAngle = (arm * (Math.PI * 2 / arms)) + spiralTwist;
          const scatter = (Math.random() - 0.5) * (0.48 + (1 - distFrac) * 0.45);
          const angle = baseAngle + scatter;

          const colors = ['#38bdf8', '#a855f7', '#f472b6', '#fde047', '#ffffff', '#818cf8'];
          this.galaxyStars.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            size: 0.7 + Math.random() * 1.9,
            color: colors[i % colors.length],
            alpha: 0.25 + Math.random() * 0.65
          });
        }

        // Outer Frontier Deep-Space Stars scattered out to ±10,000
        const outerColors = ['#94a3b8', '#38bdf8', '#a855f7', '#ffffff', '#64748b'];
        for (let i = 0; i < 450; i++) {
          this.galaxyStars.push({
            x: (Math.random() * 2 - 1) * this.galaxyBound,
            y: (Math.random() * 2 - 1) * this.galaxyBound,
            size: 0.9 + Math.random() * 1.8,
            color: outerColors[i % outerColors.length],
            alpha: 0.18 + Math.random() * 0.45
          });
        }

        // Inner Core 6 Original Idle Mining Nodes (Unchanged in center around Outpost Hub)
        this.innerDestinations = [
          { type: 'asteroids', name: '🪨 Asteroids (15m)', x: -120, y: -110, color: '#38bdf8' },
          { type: 'nebula',    name: '🪐 Nebula (2h)',     x: -140, y: 115,  color: '#a855f7' },
          { type: 'void',      name: '🌌 Deep Void (8h)',  x: 0,    y: 155,  color: '#f59e0b' },
          { type: 'sector9',   name: '🛸 Sector 9 (24h)',  x: 130,  y: -110, color: '#ff0055' },
          { type: 'deepspace', name: '🚀 Deep Space (3d)', x: 165,  y: 10,   color: '#00ffff' },
          { type: 'odyssey',   name: '🌌 Odyssey (7d)',    x: 135,  y: 130,  color: '#ffea00' }
        ];

        // 50 Outer Solar Systems distributed along the 4 spiral arms from radius 420 to 3050
        const sysNames = [
          'Alpha Centauri', 'Barnard Star', 'Wolf 359', 'Lalande', 'Sirius Prime',
          'Luyten Gate', 'Ross 154', 'Epsilon Eridani', 'Lacaille', 'Procyon Rim',
          'Cygnus X-1', 'Tau Ceti', 'Groombridge', 'Kapteyn Rift', 'Vega Prime',
          'Altair Forge', 'Fomalhaut', 'Deneb Citadel', 'Pollux Bastion', 'Castor Outpost',
          'Rigel Vortex', 'Betelgeuse Rim', 'Aldebaran', 'Spica Core', 'Antares Nebula',
          'Arcturus Gate', 'Regulus Station', 'Canopus Drift', 'Achernar', 'Bellatrix',
          'Alnilam Trench', 'Alnitak Spire', 'Mintaka', 'Saiph Abyss', 'Polaris Bastion',
          'Mirfak Crown', 'Algol Shadow', 'Hamal Reach', 'Diphda', 'Mirach',
          'Alpheratz', 'Markab Void', 'Scheat', 'Algenib', 'Enif Spire',
          'Sadalmelik', 'Sadalsuud', 'Albireo Core', 'Garnet Horizon', 'Aethelgard Singularity'
        ];

        this.solarSystems = [];
        for (let i = 1; i <= 50; i++) {
          const frac = (i - 1) / 49;
          const armIdx = (i - 1) % 4;
          const r = 420 + frac * 2600;
          const theta = (armIdx * (Math.PI / 2)) + frac * 3.8 + ((i % 2 === 0 ? 1 : -1) * 0.14);
          const sx = Math.round(Math.cos(theta) * r);
          const sy = Math.round(Math.sin(theta) * r);

          let color = '#00ff88';
          if (i > 40) color = '#ff0055';
          else if (i > 30) color = '#c084fc';
          else if (i > 20) color = '#f59e0b';
          else if (i > 10) color = '#38bdf8';

          const rewardPgt = i === 50 ? 2500 : Math.round(15 + Math.pow(i, 1.45) * 1.8);

          this.solarSystems.push({
            id: i,
            name: sysNames[i - 1] || `Sector-${i}`,
            level: i,
            x: sx,
            y: sy,
            color,
            radius: i === 50 ? 18 : (i % 10 === 0 ? 14 : 10),
            rewardPgt,
            hasNft: i === 50
          });
        }

        // Hidden Coordinate Gifts (Only materialize when player ship flies within 180 units!)
        this.hiddenGifts = [
          { id: 'gift_1', name: 'Ancient Perseus Supply Cache', x: -1150, y: 820, reward: '+150 PGT & +500 Quantum Crystals', claimed: false },
          { id: 'gift_2', name: 'Derelict Sagittarius Vault', x: 1740, y: -1290, reward: '+250 PGT & Rare Star Relic', claimed: false },
          { id: 'gift_3', name: 'Singularity Core Hidden Chest', x: -2350, y: -1920, reward: '+500 PGT & +10 Rare PGT Ore', claimed: false }
        ];

        // Simulated Live Pilots Flying Across the 2D Milky Way (for Pre-Decided Tactical Duels)
        this.selectedPilot = null;
        this.selectedBeacon = null;
        this.duelMyAttacks = ['RIGHT', 'TOP', 'RIGHT'];
        this.duelMyDefenses = ['LEFT', 'LEFT', 'LEFT'];
        this.duelAnimId = null;
        this.initOtherPilots();

        // Open Map Trade Beacons (Resources Only — No Relics, No PGT)
        this.tradeBeacons = [
          { id: 'tb_1', seller: 'Poss', isMine: false, x: 210, y: -165, offerAmt: 800, offerAsset: '💎 Quantum Crystals', wantAmt: 2400, wantAsset: '⚙️ Titanium Alloy' },
          { id: 'tb_2', seller: 'Patesz', isMine: false, x: -240, y: 175, offerAmt: 5000, offerAsset: '🪨 Iron Ore', wantAmt: 1100, wantAsset: '⚙️ Titanium Alloy' },
          { id: 'tb_3', seller: 'StarForge', isMine: false, x: 580, y: 410, offerAmt: 5, offerAsset: '☄️ Rare PGT Ore', wantAmt: 1800, wantAsset: '💎 Quantum Crystals' },
          { id: 'tb_4', seller: 'Valkyrie', isMine: false, x: -640, y: -480, offerAmt: 1800, offerAsset: '⚙️ Titanium Alloy', wantAmt: 6000, wantAsset: '🪨 Iron Ore' }
        ];
      }

      initOtherPilots() {
        const roster = [
          { name: 'Poss', rarity: 'Mythic', color: '#ffd700', shield: 28, turret: 30, offer: '• 🪨 2,400 Titanium Alloy<br/>• 🔮 1× Singularity Relic<br/>• ⚡ 150 PGT' },
          { name: 'Patesz', rarity: 'Legendary', color: '#c084fc', shield: 22, turret: 24, offer: '• 💎 900 Quantum Crystals<br/>• 🔮 1× Warp Coil Relic<br/>• ⚡ 80 PGT' },
          { name: 'Valkyrie', rarity: 'Epic', color: '#38bdf8', shield: 17, turret: 19, offer: '• 🪨 1,500 Iron Ore<br/>• 💎 400 Quantum Crystals<br/>• ⚡ 60 PGT' },
          { name: 'NeonAce', rarity: 'Rare', color: '#00ff88', shield: 12, turret: 14, offer: '• 🪨 950 Titanium Alloy<br/>• 🔮 1× Darkmatter Relic<br/>• ⚡ 40 PGT' },
          { name: 'StarForge', rarity: 'Mythic', color: '#ffd700', shield: 35, turret: 34, offer: '• ☄️ 5× Rare PGT Ore<br/>• 💎 1,200 Quantum Crystals<br/>• ⚡ 200 PGT' },
          { name: 'VoidWalker', rarity: 'Legendary', color: '#c084fc', shield: 25, turret: 22, offer: '• 🪨 1,800 Titanium Alloy<br/>• 🔮 1× Plasma Core Relic<br/>• ⚡ 95 PGT' },
          { name: 'NovaPrime', rarity: 'Epic', color: '#38bdf8', shield: 16, turret: 18, offer: '• 💎 650 Quantum Crystals<br/>• 🪨 1,400 Iron Ore<br/>• ⚡ 55 PGT' },
          { name: 'CyberFox', rarity: 'Rare', color: '#00ff88', shield: 11, turret: 13, offer: '• 🪨 1,100 Iron Ore<br/>• 💎 300 Quantum Crystals<br/>• ⚡ 35 PGT' },
          { name: 'Solaris', rarity: 'Legendary', color: '#c084fc', shield: 26, turret: 27, offer: '• ☄️ 3× Rare PGT Ore<br/>• 🔮 1× Starforge Relic<br/>• ⚡ 120 PGT' },
          { name: 'Orion9', rarity: 'Epic', color: '#38bdf8', shield: 19, turret: 16, offer: '• 🪨 1,600 Titanium Alloy<br/>• 💎 500 Quantum Crystals<br/>• ⚡ 70 PGT' },
          { name: 'DracoX', rarity: 'Rare', color: '#00ff88', shield: 14, turret: 15, offer: '• 🪨 800 Titanium Alloy<br/>• 💎 420 Quantum Crystals<br/>• ⚡ 45 PGT' },
          { name: 'Aether', rarity: 'Mythic', color: '#ffd700', shield: 40, turret: 38, offer: '• ☄️ 8× Rare PGT Ore<br/>• 🔮 1× Genesis Relic<br/>• ⚡ 250 PGT' }
        ];

        this.otherPilots = roster.map((r, idx) => {
          // Place first 4 near the Outpost Hub so players immediately see traffic!
          const nearHub = idx < 4;
          const ang = (idx / roster.length) * Math.PI * 2 + 0.4;
          const dist = nearHub ? (190 + idx * 65) : (550 + idx * 240);
          const x = Math.round(Math.cos(ang) * dist);
          const y = Math.round(Math.sin(ang) * dist);
          const wpSys = this.solarSystems[(idx * 4 + 2) % this.solarSystems.length];
          return {
            id: `pilot_${idx}`,
            name: r.name,
            rarity: r.rarity,
            color: r.color,
            shield: r.shield,
            turret: r.turret,
            offer: r.offer,
            x,
            y,
            angle: ang,
            speed: 120 + (idx % 5) * 28,
            targetX: nearHub ? Math.round(Math.cos(ang + 1.8) * 320) : wpSys.x,
            targetY: nearHub ? Math.round(Math.sin(ang + 1.8) * 320) : wpSys.y,
            nearHub,
            trail: []
          };
        });
      }

      // --------------------------------------------------------------------------
      // 2. INPUT & SANDBOX CONTROLS
      // --------------------------------------------------------------------------
      updateUpgrades() {
        const ps = (window.polySpace && window.polySpace.state) ? window.polySpace.state : {};
        this.shieldLevel = Math.max(1, parseInt(ps.shieldLevel, 10) || 1);
        this.turretLevel = Math.max(1, parseInt(ps.turretLevel, 10) || 1);
        this.warpLevel = Math.max(1, parseInt(ps.warpLevel, 10) || 1);

        const avg = Math.round((this.shieldLevel + this.turretLevel + this.warpLevel) / 3);
        const tierBadge = document.getElementById('ship-tier-badge');
        if (tierBadge) {
          const tier = avg >= 40 ? 'Tier 5 Singularity Titan' : avg >= 30 ? 'Tier 4 Dreadnought' : avg >= 20 ? 'Tier 3 Battlecruiser' : avg >= 10 ? 'Tier 2 Frigate' : 'Tier 1 Scout';
          tierBadge.innerText = `${tier} (Avg Lvl ${avg})`;
        }

        // If currently inside 3D battle, live-scale player ship stats immediately!
        if (this.mode === 'combat3d' && this.player3D) {
          const newMaxShield = 400 + this.shieldLevel * 120;
          this.player3D.maxShield = newMaxShield;
          this.player3D.shield = Math.min(newMaxShield, this.player3D.shield + 200);
          this.update3DHUD();
        }
      }

      maxAllUpgrades() {
        document.getElementById('slider-shield').value = 50;
        document.getElementById('slider-turret').value = 50;
        document.getElementById('slider-warp').value = 50;
        this.updateUpgrades();
        this.showToast('⚡ All Ship Upgrades set to MAX LEVEL 50! Ready for System #50!');
      }

      showToast(msg) {
        const el = document.getElementById('psg-toast-banner');
        if (!el) return;
        el.innerText = msg;
        el.style.display = 'block';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3600);
      }

      resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.width = rect.width || window.innerWidth;
        this.height = rect.height || (window.innerHeight - 62);
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      initEvents() {
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this.useKeyboardSteer = false;

        window.addEventListener('keydown', (e) => {
          this.keys[e.code] = true;
          if (this.mode === 'combat3d' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
            this.useKeyboardSteer = true;
            e.preventDefault();
          }
          if (e.code === 'Space' && this.mode === 'combat3d') {
            e.preventDefault();
            if (!e.repeat) this.fireHomingMissile();
          }
          if (e.code === 'KeyE' && this.mode === 'combat3d' && !e.repeat) {
            this.fireHomingMissile();
          }
        });
        window.addEventListener('keyup', (e) => {
          this.keys[e.code] = false;
        });

        // Canvas Mouse Events for both 2D Galaxy and 3D Dogfight
        this.canvas.addEventListener('mousedown', (e) => {
          const rect = this.canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;

          if (this.mode === 'galaxy') {
            if (e.button === 2 || e.shiftKey) {
              this.isPanning = true;
              this.followShip2D = false;
              this.panStartX = mx;
              this.panStartY = my;
              this.panOriginX = this.camX;
              this.panOriginY = this.camY;
              return;
            }
            this.panMoved = false;
            this.isPanning = true;
            this.panStartX = mx;
            this.panStartY = my;
            this.panOriginX = this.camX;
            this.panOriginY = this.camY;
          } else if (this.mode === 'combat3d') {
            if (e.button === 0) this.mouseDown = true;
            if (e.button === 2) this.fireHomingMissile();
          }
        });

        window.addEventListener('mousemove', (e) => {
          const rect = this.canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          if (this.useKeyboardSteer && Math.hypot(mx - this.mouseX, my - this.mouseY) > 4) {
            this.useKeyboardSteer = false;
          }
          this.mouseX = mx;
          this.mouseY = my;

          if (this.mode === 'galaxy' && this.isPanning) {
            const dx = mx - this.panStartX;
            const dy = my - this.panStartY;
            if (Math.hypot(dx, dy) > 6) {
              this.panMoved = true;
              this.followShip2D = false;
              const B = this.galaxyBound;
              this.camX = Math.max(-B, Math.min(B, this.panOriginX - dx / this.camZoom));
              this.camY = Math.max(-B, Math.min(B, this.panOriginY - dy / this.camZoom));
            }
          }
        });

        window.addEventListener('mouseup', (e) => {
          if (this.mode === 'galaxy' && this.isPanning) {
            this.isPanning = false;
            if (!this.panMoved && e.button === 0) {
              const rect = this.canvas.getBoundingClientRect();
              const mx = e.clientX - rect.left;
              const my = e.clientY - rect.top;
              this.handleGalaxyClick(mx, my);
            }
          }
          if (e.button === 0) this.mouseDown = false;
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('wheel', (e) => {
          if (this.mode !== 'galaxy') return;
          e.preventDefault();
          this._introZoomTarget = null;
          const factor = e.deltaY < 0 ? 1.16 : 0.86;
          this.camZoom = Math.max(0.06, Math.min(2.2, this.camZoom * factor));
        }, { passive: false });

        // ==================== MOBILE TOUCH CONTROLS ====================
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        this.autoFire3D = this.isTouchDevice;
        this.touchFiring = false;
        this.touchStick = { active: false, id: null, originX: 0, originY: 0, curX: 0, curY: 0, nx: 0, ny: 0 };
        this.touchPinch = { active: false, startDist: 0, startZoom: 1 };
        this.touchPanId = null;

        // Wire Mobile Hold-to-Fire Button
        const fireBtn = document.getElementById('btn-mobile-fire');
        if (fireBtn) {
          const startFire = (e) => { e.preventDefault(); this.touchFiring = true; fireBtn.classList.add('pressed'); };
          const endFire = (e) => { e.preventDefault(); this.touchFiring = false; fireBtn.classList.remove('pressed'); };
          fireBtn.addEventListener('touchstart', startFire, { passive: false });
          fireBtn.addEventListener('touchend', endFire, { passive: false });
          fireBtn.addEventListener('touchcancel', endFire, { passive: false });
          fireBtn.addEventListener('mousedown', startFire);
          window.addEventListener('mouseup', () => { this.touchFiring = false; fireBtn.classList.remove('pressed'); });
        }

        this.canvas.addEventListener('touchstart', (e) => {
          e.preventDefault();
          const rect = this.canvas.getBoundingClientRect();
          if (this.mode === 'galaxy') {
            if (e.touches.length === 2) {
              const t0 = e.touches[0], t1 = e.touches[1];
              this.touchPinch.active = true;
              this.touchPinch.startDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) || 1;
              this.touchPinch.startZoom = this.camZoom;
              this.isPanning = false;
              return;
            }
            if (e.touches.length === 1) {
              const t = e.touches[0];
              this.touchPanId = t.identifier;
              this.panMoved = false;
              this.isPanning = true;
              this.panStartX = t.clientX - rect.left;
              this.panStartY = t.clientY - rect.top;
              this.panOriginX = this.camX;
              this.panOriginY = this.camY;
            }
          } else if (this.mode === 'combat3d') {
            // Spawn Floating Virtual Flight Stick wherever thumb lands on canvas
            for (const t of e.changedTouches) {
              if (!this.touchStick.active) {
                const tx = t.clientX - rect.left;
                const ty = t.clientY - rect.top;
                this.touchStick = { active: true, id: t.identifier, originX: tx, originY: ty, curX: tx, curY: ty, nx: 0, ny: 0 };
              }
            }
          }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
          e.preventDefault();
          const rect = this.canvas.getBoundingClientRect();
          if (this.mode === 'galaxy') {
            if (e.touches.length === 2 && this.touchPinch.active) {
              const t0 = e.touches[0], t1 = e.touches[1];
              const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) || 1;
              const scale = dist / this.touchPinch.startDist;
              this.camZoom = Math.max(0.06, Math.min(2.2, this.touchPinch.startZoom * scale));
              return;
            }
            if (this.isPanning && e.touches.length === 1) {
              const t = e.touches[0];
              const mx = t.clientX - rect.left;
              const my = t.clientY - rect.top;
              const dx = mx - this.panStartX;
              const dy = my - this.panStartY;
              if (Math.hypot(dx, dy) > 8) {
                this.panMoved = true;
                this.followShip2D = false;
                const B = this.galaxyBound;
                this.camX = Math.max(-B, Math.min(B, this.panOriginX - dx / this.camZoom));
                this.camY = Math.max(-B, Math.min(B, this.panOriginY - dy / this.camZoom));
              }
            }
          } else if (this.mode === 'combat3d' && this.touchStick.active) {
            for (const t of e.touches) {
              if (t.identifier === this.touchStick.id) {
                const tx = t.clientX - rect.left;
                const ty = t.clientY - rect.top;
                const maxR = 62;
                const dx = tx - this.touchStick.originX;
                const dy = ty - this.touchStick.originY;
                const d = Math.hypot(dx, dy) || 1;
                const clamped = Math.min(maxR, d);
                this.touchStick.curX = this.touchStick.originX + (dx / d) * clamped;
                this.touchStick.curY = this.touchStick.originY + (dy / d) * clamped;
                this.touchStick.nx = (this.touchStick.curX - this.touchStick.originX) / maxR;
                this.touchStick.ny = (this.touchStick.curY - this.touchStick.originY) / maxR;
              }
            }
          }
        }, { passive: false });

        const endTouch = (e) => {
          const rect = this.canvas.getBoundingClientRect();
          if (this.mode === 'galaxy') {
            if (e.touches.length < 2) this.touchPinch.active = false;
            if (this.isPanning && e.touches.length === 0) {
              this.isPanning = false;
              if (!this.panMoved && e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                this.handleGalaxyClick(t.clientX - rect.left, t.clientY - rect.top);
              }
            }
          } else if (this.mode === 'combat3d') {
            for (const t of e.changedTouches) {
              if (this.touchStick.active && t.identifier === this.touchStick.id) {
                this.touchStick = { active: false, id: null, originX: 0, originY: 0, curX: 0, curY: 0, nx: 0, ny: 0 };
              }
            }
          }
        };
        this.canvas.addEventListener('touchend', endTouch, { passive: false });
        this.canvas.addEventListener('touchcancel', endTouch, { passive: false });
      }

      adjustZoom(factor) {
        this.camZoom = Math.max(0.06, Math.min(2.2, this.camZoom * factor));
      }

      toggleAutoFire() {
        this.autoFire3D = !this.autoFire3D;
        const btn = document.getElementById('btn-mobile-autofire');
        if (btn) {
          btn.innerText = this.autoFire3D ? '⚡ AUTO-FIRE: ON' : '⚡ AUTO-FIRE: OFF';
          btn.classList.toggle('off', !this.autoFire3D);
        }
      }

      // --------------------------------------------------------------------------
      // 3. 2D MILKY WAY NAVIGATION LOGIC
      // --------------------------------------------------------------------------
      screenToWorld(sx, sy) {
        return {
          x: (sx - this.width / 2) / this.camZoom + this.camX,
          y: (sy - this.height / 2) / this.camZoom + this.camY
        };
      }

      worldToScreen(wx, wy) {
        return {
          x: (wx - this.camX) * this.camZoom + this.width / 2,
          y: (wy - this.camY) * this.camZoom + this.height / 2
        };
      }

      handleGalaxyClick(sx, sy) {
        const world = this.screenToWorld(sx, sy);

        // Check if clicked on an unlocked/revealed Hidden Gift
        for (const g of this.hiddenGifts) {
          const distToShip = Math.hypot(this.ship2D.x - g.x, this.ship2D.y - g.y);
          const distClick = Math.hypot(world.x - g.x, world.y - g.y);
          if (!g.claimed && distToShip <= 210 && distClick <= 65 / this.camZoom) {
            g.claimed = true;
            this.showToast(`🎁 HIDDEN COORDINATE GIFT CLAIMED at (${g.x}, ${g.y}): ${g.reward}!`);
            return;
          }
        }

        // Check if clicked on an Open Map Trade Beacon
        if (this.tradeBeacons) {
          for (const tb of this.tradeBeacons) {
            const d = Math.hypot(world.x - tb.x, world.y - tb.y);
            if (d <= Math.max(44, 28 / this.camZoom)) {
              this.ship2D.targetX = tb.x;
              this.ship2D.targetY = tb.y;
              this.followShip2D = true;
              this.openInspectTradeBeacon(tb);
              return;
            }
          }
        }

        // Check if clicked near another Player Ship (for Trade or Tactical Duel)
        let clickedPilot = null;
        if (this.otherPilots) {
          for (const pl of this.otherPilots) {
            const d = Math.hypot(world.x - pl.x, world.y - pl.y);
            if (d <= Math.max(42, 26 / this.camZoom)) {
              clickedPilot = pl;
              break;
            }
          }
        }
        if (clickedPilot) {
          this.ship2D.targetX = Math.round(clickedPilot.x);
          this.ship2D.targetY = Math.round(clickedPilot.y);
          this.followShip2D = true;
          this.showPilotHailCard(clickedPilot);
          return;
        }

        // Check if clicked near one of the 50 Solar Systems
        let clickedSys = null;
        for (const sys of this.solarSystems) {
          const d = Math.hypot(world.x - sys.x, world.y - sys.y);
          if (d <= Math.max(38, 22 / this.camZoom)) {
            clickedSys = sys;
            break;
          }
        }

        if (clickedSys) {
          this.ship2D.targetX = clickedSys.x;
          this.ship2D.targetY = clickedSys.y;
          this.selectedSystemId = clickedSys.id;
          this.followShip2D = true;
          this.showSystemBriefing(clickedSys);
        } else {
          const B = this.galaxyBound;
          this.ship2D.targetX = Math.max(-B, Math.min(B, Math.round(world.x)));
          this.ship2D.targetY = Math.max(-B, Math.min(B, Math.round(world.y)));
          this.followShip2D = true;
        }
      }

      showSystemBriefing(sys) {
        const hail = document.getElementById('pilot-hail-card');
        if (hail) hail.style.display = 'none';
        const card = document.getElementById('system-briefing-card');
        if (!card) return;
        card.style.display = 'block';
        document.getElementById('brief-sys-title').innerText = `${sys.id === 50 ? '👑' : '☀️'} SYSTEM #${sys.id}: ${sys.name.toUpperCase()}`;
        const avgLvl = Math.round((this.shieldLevel + this.turretLevel + this.warpLevel) / 3);
        const lvlEl = document.getElementById('brief-sys-lvl');
        const isHard = sys.level > avgLvl + 5;
        lvlEl.innerText = `Recommended Lvl ${sys.level} ${isHard ? '⚠️ (Very Hard for your Lvl!)' : '✅'}`;
        lvlEl.style.color = isHard ? '#ff4d79' : '#00ff88';
        lvlEl.style.borderColor = isHard ? '#ff0055' : '#00ff88';

        const nftTag = sys.hasNft ? ' + 👑 EXCLUSIVE CONQUEROR NFT!' : '';
        const alreadyCleared = this.clearedSystems.has(sys.id);
        document.getElementById('brief-sys-desc').innerText = alreadyCleared
          ? `Coords: (X: ${sys.x}, Y: ${sys.y}) • ✅ ALREADY CLEARED — Replayable for practice (First-Clear Reward already claimed)`
          : `Coords: (X: ${sys.x}, Y: ${sys.y}) • 3D Dogfight (2 Waves + Boss) • First-Clear Reward (Once): +${sys.rewardPgt} PGT${nftTag}`;
      }

      flyToSystem(id) {
        const sys = this.solarSystems.find(s => s.id === id);
        if (!sys) return;
        if (this.mode !== 'galaxy') this.switchMode('galaxy');
        this.selectedSystemId = sys.id;
        this.ship2D.targetX = sys.x;
        this.ship2D.targetY = sys.y;
        this.followShip2D = true;
        this.showSystemBriefing(sys);
        this.showToast(`🧭 Autopilot engaged to System #${sys.id}: ${sys.name} (X: ${sys.x}, Y: ${sys.y})`);
      }

      flyToGiftHint() {
        const g = this.hiddenGifts[0];
        if (this.mode !== 'galaxy') this.switchMode('galaxy');
        this.ship2D.targetX = g.x;
        this.ship2D.targetY = g.y;
        this.followShip2D = true;
        this.showToast(`📡 Autopilot flying to shared coordinates (X: ${g.x}, Y: ${g.y})... Watch your radar scanner!`);
      }

      flyToInputCoords() {
        const gx = parseInt(document.getElementById('input-gx').value, 10);
        const gy = parseInt(document.getElementById('input-gy').value, 10);
        const B = this.galaxyBound;
        if (isNaN(gx) || isNaN(gy)) {
          this.showToast(`⚠️ Enter X and Y coordinates (-${B} to +${B}) first!`);
          return;
        }
        this.ship2D.targetX = Math.max(-B, Math.min(B, gx));
        this.ship2D.targetY = Math.max(-B, Math.min(B, gy));
        this.followShip2D = true;
        this.showToast(`🚀 Autopilot engaged to X: ${this.ship2D.targetX}, Y: ${this.ship2D.targetY}`);
      }

      shareLocation() {
        const x = Math.round(this.ship2D.x);
        const y = Math.round(this.ship2D.y);
        const shareStr = `🛸 Meet me in PolySpace Milky Way at coordinates [X: ${x >= 0 ? '+' + x : x}, Y: ${y >= 0 ? '+' + y : y}]! https://polygongaming.io/?tab=space&gx=${x}&gy=${y}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareStr).catch(() => {});
        }
        this.showToast(`📋 Copied to clipboard: "${shareStr}"`);
      }

      centerOnShip() {
        this.followShip2D = true;
      }

      flyToNearestPilot() {
        if (!this.otherPilots || this.otherPilots.length === 0) return;
        if (this.mode !== 'galaxy') this.switchMode('galaxy');
        let best = this.otherPilots[0];
        let bestD = Infinity;
        for (const pl of this.otherPilots) {
          const d = Math.hypot(pl.x - this.ship2D.x, pl.y - this.ship2D.y);
          if (d < bestD) { bestD = d; best = pl; }
        }
        this.ship2D.targetX = Math.round(best.x);
        this.ship2D.targetY = Math.round(best.y);
        this.followShip2D = true;
        this.showPilotHailCard(best);
        this.showToast(`📡 Hailing pilot ${best.name} (${Math.round(bestD)}u away)...`);
      }

      showPilotHailCard(pilot) {
        this.selectedPilot = pilot;
        const sysCard = document.getElementById('system-briefing-card');
        if (sysCard) sysCard.style.display = 'none';
        const card = document.getElementById('pilot-hail-card');
        if (!card) return;
        card.style.display = 'block';
        document.getElementById('hail-pilot-name').innerText = `🛸 ${pilot.name}`;
        const rar = document.getElementById('hail-pilot-rarity');
        rar.innerText = pilot.rarity.toUpperCase();
        rar.style.color = pilot.color;
        rar.style.borderColor = pilot.color;
        document.getElementById('hail-pilot-stats').innerText =
          `🛡️ Shield Lvl ${pilot.shield} • ☄️ Turret Lvl ${pilot.turret} • Coords: (${Math.round(pilot.x)}, ${Math.round(pilot.y)})`;
      }

      getPilotRank(xp) {
        if (xp >= 250000) return { title: 'Galactic Legend', icon: '👑', color: '#ffd700' };
        if (xp >= 100000) return { title: 'Fleet Admiral', icon: '💎', color: '#c084fc' };
        if (xp >= 40000) return { title: 'Star Commander', icon: '🔥', color: '#ff4d79' };
        if (xp >= 15000) return { title: 'Ace Pilot', icon: '⭐', color: '#f59e0b' };
        if (xp >= 5000) return { title: 'Vanguard', icon: '🔷', color: '#38bdf8' };
        if (xp >= 1000) return { title: 'Ensign', icon: '🟢', color: '#00ff88' };
        return { title: 'Cadet', icon: '🔹', color: '#94a3b8' };
      }

      awardCombatXp(amount, isKill = false) {
        if (!amount || amount <= 0) return;
        this.combatXpAllTime += amount;
        this.combatXpWeekly += amount;
        if (isKill) this.totalKills += 1;
        const rk = this.getPilotRank(this.combatXpAllTime);
        const badge = document.getElementById('hud-rank-badge');
        if (badge) badge.innerText = `${rk.icon} ${rk.title} • ${this.combatXpAllTime.toLocaleString()} XP`;
      }

      openRankLeaderboard() {
        document.getElementById('rank-modal').style.display = 'flex';
        this.renderRankLeaderboard();
      }

      switchRankTab(tab) {
        this.rankTab = tab;
        document.getElementById('tab-rank-weekly').classList.toggle('active', tab === 'weekly');
        document.getElementById('tab-rank-alltime').classList.toggle('active', tab === 'alltime');
        this.renderRankLeaderboard();
      }

      renderRankLeaderboard() {
        const myRank = this.getPilotRank(this.combatXpAllTime);
        document.getElementById('rank-my-summary').innerHTML = `
          <span><strong>Your Rank:</strong> <span style="color:${myRank.color}; font-weight:900;">${myRank.icon} ${myRank.title}</span></span>
          <span>Weekly: <strong style="color:#00ff88;">${this.combatXpWeekly.toLocaleString()} XP</strong> • All-Time: <strong style="color:#ffd700;">${this.combatXpAllTime.toLocaleString()} XP</strong> • Kills: <strong>${this.totalKills}</strong></span>
        `;

        const isWeekly = this.rankTab === 'weekly';
        const rows = this.otherPilots.map((pl, i) => ({
          name: pl.name,
          isMe: false,
          xp: isWeekly ? (1800 + (pl.turret * 185) + (i * 220)) : (8500 + (pl.turret * 3800) + (i * 1900)),
          kills: isWeekly ? (18 + pl.turret * 2) : (140 + pl.turret * 28),
          cleared: Math.min(50, Math.round(pl.turret * 1.25))
        }));
        rows.push({
          name: 'YOU',
          isMe: true,
          xp: isWeekly ? this.combatXpWeekly : this.combatXpAllTime,
          kills: this.totalKills,
          cleared: this.clearedSystems.size
        });
        rows.sort((a, b) => b.xp - a.xp);

        let html = `<table style="width:100%; border-collapse:collapse;">
          <tr style="color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.12); text-align:left;">
            <th style="padding:6px;">#</th>
            <th style="padding:6px;">Pilot & Rank</th>
            <th style="padding:6px; text-align:right;">${isWeekly ? 'Weekly XP' : 'All-Time XP'}</th>
            <th style="padding:6px; text-align:right;">Kills</th>
            <th style="padding:6px; text-align:right;">Sys</th>
          </tr>`;
        rows.forEach((r, idx) => {
          const rk = this.getPilotRank(isWeekly ? r.xp * 4 : r.xp);
          const bg = r.isMe ? 'rgba(0,240,255,0.14)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent');
          html += `<tr style="background:${bg}; border-bottom:1px solid rgba(255,255,255,0.05);">
            <td style="padding:6px; font-weight:900; color:${idx < 3 ? '#ffd700' : '#94a3b8'};">#${idx + 1}</td>
            <td style="padding:6px; font-weight:${r.isMe ? '900' : '700'}; color:${r.isMe ? '#00f0ff' : '#fff'};">${r.name} <span style="font-size:0.68rem; color:${rk.color};">${rk.icon} ${rk.title}</span></td>
            <td style="padding:6px; text-align:right; font-family:monospace; font-weight:800; color:${isWeekly ? '#00ff88' : '#ffd700'};">${r.xp.toLocaleString()}</td>
            <td style="padding:6px; text-align:right; font-family:monospace;">${r.kills}</td>
            <td style="padding:6px; text-align:right; font-family:monospace; color:#cbd5e1;">${r.cleared}/50</td>
          </tr>`;
        });
        html += '</table>';
        document.getElementById('rank-table-wrap').innerHTML = html;
      }

      openPostTradeBeacon() {
        this.selectedBeacon = null;
        document.getElementById('trade-subtitle').innerText = `POST AT YOUR COORDS (X: ${Math.round(this.ship2D.x)}, Y: ${Math.round(this.ship2D.y)})`;
        document.getElementById('trade-title').innerText = '🤝 DROP OPEN TRADE BEACON';
        document.getElementById('trade-post-view').style.display = 'block';
        document.getElementById('trade-accept-view').style.display = 'none';
        document.getElementById('trade-modal').style.display = 'flex';
      }

      deployTradeBeacon() {
        const offerAsset = document.getElementById('beacon-offer-asset').value;
        const offerAmt = Math.max(1, parseInt(document.getElementById('beacon-offer-amt').value, 10) || 1);
        const wantAsset = document.getElementById('beacon-want-asset').value;
        const wantAmt = Math.max(1, parseInt(document.getElementById('beacon-want-amt').value, 10) || 1);
        const bx = Math.round(this.ship2D.x);
        const by = Math.round(this.ship2D.y);

        this.tradeBeacons.push({
          id: `tb_${Date.now()}`,
          seller: 'You',
          isMine: true,
          x: bx,
          y: by,
          offerAmt,
          offerAsset,
          wantAmt,
          wantAsset
        });
        document.getElementById('trade-modal').style.display = 'none';
        this.showToast(`📡 Trade Beacon dropped at (${bx}, ${by}): ${offerAmt} ${offerAsset} for ${wantAmt} ${wantAsset}!`);
      }

      openInspectTradeBeacon(tb) {
        this.selectedBeacon = tb;
        const netReceive = Math.max(1, Math.floor(tb.offerAmt * 0.95));
        const burnedOffer = tb.offerAmt - netReceive;
        document.getElementById('trade-subtitle').innerText = `TRADE BEACON AT (X: ${tb.x}, Y: ${tb.y}) • POSTED BY ${tb.seller.toUpperCase()}`;
        document.getElementById('trade-title').innerText = tb.isMine ? '📡 YOUR ACTIVE TRADE BEACON' : `🤝 TRADE OFFER FROM ${tb.seller.toUpperCase()}`;
        document.getElementById('trade-post-view').style.display = 'none';
        document.getElementById('trade-accept-view').style.display = 'block';
        document.getElementById('beacon-detail-box').innerHTML = `
          <div><strong style="color:#00ff88;">YOU RECEIVE:</strong> ${netReceive.toLocaleString()} ${tb.offerAsset} <span style="color:#94a3b8; font-size:0.74rem;">(${tb.offerAmt.toLocaleString()} − ${burnedOffer.toLocaleString()} burned)</span></div>
          <div><strong style="color:#ffd700;">YOU PAY:</strong> ${tb.wantAmt.toLocaleString()} ${tb.wantAsset} <span style="color:#94a3b8; font-size:0.74rem;">(5% burn fee applies)</span></div>
        `;
        const btn = document.getElementById('btn-accept-beacon');
        btn.innerText = tb.isMine ? '🗑️ CANCEL & RECLAIM' : '✅ 1-CLICK ACCEPT TRADE';
        btn.style.borderColor = tb.isMine ? '#ff0055' : '#00ff88';
        document.getElementById('trade-modal').style.display = 'flex';
      }

      acceptSelectedBeacon() {
        const tb = this.selectedBeacon;
        if (!tb) return;
        this.tradeBeacons = this.tradeBeacons.filter(b => b.id !== tb.id);
        this.selectedBeacon = null;
        document.getElementById('trade-modal').style.display = 'none';
        if (tb.isMine) {
          this.showToast(`🔄 Cancelled Trade Beacon — ${tb.offerAmt} ${tb.offerAsset} returned to your cargo!`);
        } else {
          const netReceive = Math.max(1, Math.floor(tb.offerAmt * 0.95));
          this.showToast(`✅ Trade Complete with ${tb.seller}! Received ${netReceive.toLocaleString()} ${tb.offerAsset} (5% burn applied).`);
        }
      }

      openTacticalDuel() {
        if (!this.selectedPilot) return;
        if (this.duelAnimId) {
          cancelAnimationFrame(this.duelAnimId);
          this.duelAnimId = null;
        }
        document.getElementById('duel-title').innerText = `⚔️ YOU vs. ${this.selectedPilot.name.toUpperCase()} (${this.selectedPilot.rarity})`;
        document.getElementById('duel-setup-phase').style.display = 'block';
        document.getElementById('duel-playback-phase').style.display = 'none';
        document.getElementById('tactical-duel-modal').style.display = 'flex';
        this.renderDuelSelector();
      }

      closeTacticalDuel() {
        if (this.duelAnimId) {
          cancelAnimationFrame(this.duelAnimId);
          this.duelAnimId = null;
        }
        document.getElementById('tactical-duel-modal').style.display = 'none';
      }

      setDuelMove(kind, roundIdx, dir) {
        if (kind === 'atk') this.duelMyAttacks[roundIdx] = dir;
        else this.duelMyDefenses[roundIdx] = dir;
        this.renderDuelSelector();
      }

      randomizeDuelMoves() {
        const dirs = ['LEFT', 'TOP', 'RIGHT'];
        for (let r = 0; r < 3; r++) {
          this.duelMyAttacks[r] = dirs[Math.floor(Math.random() * 3)];
          this.duelMyDefenses[r] = dirs[Math.floor(Math.random() * 3)];
        }
        this.renderDuelSelector();
      }

      renderDuelSelector() {
        const wrap = document.getElementById('duel-rounds-selector');
        if (!wrap) return;
        const dirs = [
          { id: 'LEFT', label: '⬅️ LEFT' },
          { id: 'TOP', label: '⬆️ TOP' },
          { id: 'RIGHT', label: '➡️ RIGHT' }
        ];
        let html = '';
        for (let r = 0; r < 3; r++) {
          html += `
            <div style="display:grid; grid-template-columns:68px 1fr; align-items:center; gap:10px; background:rgba(15,23,42,0.75); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 10px;">
              <span style="font-size:0.74rem; font-weight:900; color:var(--gold);">ROUND ${r + 1}</span>
              <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:grid; grid-template-columns:34px 1fr; align-items:center; gap:6px;">
                  <span style="font-size:0.68rem; color:#ff4d79; font-weight:800;">ATK:</span>
                  <div class="vec-group" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
                    ${dirs.map(d => `<button class="vec-btn ${this.duelMyAttacks[r] === d.id ? 'atk-active' : ''}" onclick="window.PolySpaceGalaxy.instance.setDuelMove('atk', ${r}, '${d.id}')">${d.label}</button>`).join('')}
                  </div>
                </div>
                <div style="display:grid; grid-template-columns:34px 1fr; align-items:center; gap:6px;">
                  <span style="font-size:0.68rem; color:var(--cyan); font-weight:800;">DEF:</span>
                  <div class="vec-group" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
                    ${dirs.map(d => `<button class="vec-btn ${this.duelMyDefenses[r] === d.id ? 'def-active' : ''}" onclick="window.PolySpaceGalaxy.instance.setDuelMove('def', ${r}, '${d.id}')">${d.label}</button>`).join('')}
                  </div>
                </div>
              </div>
            </div>`;
        }
        wrap.innerHTML = html;
      }

      startTacticalDuelPlayback() {
        const rival = this.selectedPilot;
        if (!rival) return;
        const dirs = ['LEFT', 'TOP', 'RIGHT'];
        const rivalAtks = [0, 1, 2].map(() => dirs[Math.floor(Math.random() * 3)]);
        const rivalDefs = [0, 1, 2].map(() => dirs[Math.floor(Math.random() * 3)]);

        const myMaxHp = 500 + this.shieldLevel * 45;
        const rivalMaxHp = 500 + rival.shield * 45;
        const myBaseDmg = 140 + this.turretLevel * 14;
        const rivalBaseDmg = 140 + rival.turret * 14;

        // Pre-compute all 3 rounds deterministically (just like a Supabase RPC would!)
        const rounds = [];
        let p1Hp = myMaxHp;
        let p2Hp = rivalMaxHp;
        for (let r = 0; r < 3; r++) {
          const p1Atk = this.duelMyAttacks[r];
          const p1Def = this.duelMyDefenses[r];
          const p2Atk = rivalAtks[r];
          const p2Def = rivalDefs[r];

          const p1BlockedByP2 = (p1Atk === p2Def);
          const p2BlockedByP1 = (p2Atk === p1Def);

          const dmgToP2 = Math.round(myBaseDmg * (p1BlockedByP2 ? 0.30 : 1.0));
          const dmgToP1 = Math.round(rivalBaseDmg * (p2BlockedByP1 ? 0.30 : 1.0));

          const startP1 = p1Hp;
          const startP2 = p2Hp;
          p2Hp = Math.max(0, p2Hp - dmgToP2);
          p1Hp = Math.max(0, p1Hp - dmgToP1);

          rounds.push({
            num: r + 1,
            p1Atk, p1Def, p2Atk, p2Def,
            p1BlockedByP2, p2BlockedByP1,
            dmgToP2, dmgToP1,
            startP1, startP2,
            endP1: p1Hp, endP2: p2Hp
          });
        }

        const wager = parseInt(document.getElementById('duel-wager').value, 10) || 0;
        const winner = p1Hp > p2Hp ? 'p1' : (p2Hp > p1Hp ? 'p2' : 'draw');

        document.getElementById('duel-setup-phase').style.display = 'none';
        document.getElementById('duel-playback-phase').style.display = 'block';
        document.getElementById('duel-result-actions').style.display = 'none';
        document.getElementById('duel-p2-name').innerText = rival.name.toUpperCase();
        document.getElementById('duel-log-box').innerHTML = '⚡ Initializing 5-second tactical battle simulation...';

        this.duelSim = {
          rival,
          rounds,
          myMaxHp,
          rivalMaxHp,
          wager,
          winner,
          startTime: performance.now(),
          roundDuration: 1650, // 3 rounds × 1.65s = 4.95s total!
          lastLoggedRound: -1,
          finished: false
        };

        const tick = (now) => {
          this.animateDuelFrame(now);
          if (this.duelSim && !this.duelSim.finished) {
            this.duelAnimId = requestAnimationFrame(tick);
          }
        };
        this.duelAnimId = requestAnimationFrame(tick);
      }

      animateDuelFrame(now) {
        const sim = this.duelSim;
        if (!sim) return;
        const canvas = document.getElementById('duel-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        const elapsed = now - sim.startTime;
        const totalDur = sim.roundDuration * 3;
        const rIdx = Math.min(2, Math.floor(elapsed / sim.roundDuration));
        const rProg = Math.min(1, (elapsed - rIdx * sim.roundDuration) / sim.roundDuration);
        const rd = sim.rounds[rIdx];

        // Update HP bars at impact moment (rProg >= 0.58)
        const curP1 = rProg >= 0.58 ? rd.endP1 : rd.startP1;
        const curP2 = rProg >= 0.58 ? rd.endP2 : rd.startP2;
        document.getElementById('duel-p1-hp-txt').innerText = `${curP1} / ${sim.myMaxHp}`;
        document.getElementById('duel-p1-hp-bar').style.width = `${(curP1 / sim.myMaxHp) * 100}%`;
        document.getElementById('duel-p2-hp-txt').innerText = `${curP2} / ${sim.rivalMaxHp}`;
        document.getElementById('duel-p2-hp-bar').style.width = `${(curP2 / sim.rivalMaxHp) * 100}%`;
        document.getElementById('duel-round-badge').innerText = elapsed >= totalDur
          ? (sim.winner === 'p1' ? '🏆 VICTORY' : sim.winner === 'p2' ? '💀 DEFEAT' : '🤝 DRAW')
          : `ROUND ${rd.num} / 3`;

        // Update round text log once per round impact
        if (rProg >= 0.58 && sim.lastLoggedRound < rIdx) {
          sim.lastLoggedRound = rIdx;
          const lines = [];
          for (let k = 0; k <= rIdx; k++) {
            const rk = sim.rounds[k];
            const myRes = rk.p1BlockedByP2 ? `🛡️ Blocked (-${rk.dmgToP2})` : `💥 DIRECT HIT (-${rk.dmgToP2})`;
            const rvRes = rk.p2BlockedByP1 ? `🛡️ Blocked (-${rk.dmgToP1})` : `💥 HIT (-${rk.dmgToP1})`;
            lines.push(`<strong>R${rk.num}:</strong> You ATK <b>${rk.p1Atk}</b> vs DEF <b>${rk.p2Def}</b> → ${myRes} | Rival ATK <b>${rk.p2Atk}</b> vs your DEF <b>${rk.p1Def}</b> → ${rvRes}`);
          }
          document.getElementById('duel-log-box').innerHTML = lines.join('<br/>');
        }

        // Screen shake on direct hit impact
        const shake = (rProg >= 0.56 && rProg <= 0.78 && (!rd.p1BlockedByP2 || !rd.p2BlockedByP1))
          ? (Math.random() - 0.5) * 7 : 0;

        ctx.save();
        ctx.translate(shake, shake * 0.6);

        // Deep Space Duel Arena Background
        ctx.fillStyle = '#030816';
        ctx.fillRect(-10, -10, w + 20, h + 20);
        for (let i = 0; i < 42; i++) {
          const sx = ((i * 137 + elapsed * 0.04) % w);
          const sy = (i * 89) % h;
          ctx.fillStyle = i % 3 === 0 ? 'rgba(0,240,255,0.45)' : 'rgba(255,255,255,0.3)';
          ctx.fillRect(sx, sy, 2, 2);
        }

        const p1x = 108, p1y = h / 2 + Math.sin(elapsed / 260) * 6;
        const p2x = w - 108, p2y = h / 2 + Math.cos(elapsed / 240) * 6;

        // Helper: vector lane Y offset (TOP = high arc, LEFT = mid-upper/port, RIGHT = lower/starboard)
        const laneY = (dir) => dir === 'TOP' ? 38 : (dir === 'LEFT' ? h / 2 - 22 : h - 42);

        // Draw Deflector Shields for both ships
        const drawShieldArc = (cx, cy, facingRight, defDir, color, blocked) => {
          const dy = defDir === 'TOP' ? -36 : (defDir === 'LEFT' ? -10 : 34);
          const dx = facingRight ? 42 : -42;
          ctx.save();
          ctx.strokeStyle = blocked && rProg > 0.56 ? '#ffffff' : color;
          ctx.lineWidth = blocked && rProg > 0.56 ? 5 : 3;
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          if (facingRight) ctx.arc(cx + dx * 0.5, cy + dy * 0.55, 34, -0.85, 0.85);
          else ctx.arc(cx + dx * 0.5, cy + dy * 0.55, 34, Math.PI - 0.85, Math.PI + 0.85);
          ctx.stroke();
          ctx.restore();
        };

        drawShieldArc(p1x, p1y, true, rd.p1Def, '#00f0ff', rd.p2BlockedByP1);
        drawShieldArc(p2x, p2y, false, rd.p2Def, sim.rival.color, rd.p1BlockedByP2);

        // Draw Both Starships
        const drawDuelShip = (x, y, facingRight, primaryColor) => {
          ctx.save();
          ctx.translate(x, y);
          if (!facingRight) ctx.scale(-1, 1);
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(32, 0);
          ctx.lineTo(6, -10);
          ctx.lineTo(-14, -26);
          ctx.lineTo(-24, -20);
          ctx.lineTo(-18, -7);
          ctx.lineTo(-24, 0);
          ctx.lineTo(-18, 7);
          ctx.lineTo(-24, 20);
          ctx.lineTo(-14, 26);
          ctx.lineTo(6, 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Glowing Cockpit
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.ellipse(8, 0, 7, 3.2, 0, 0, Math.PI * 2);
          ctx.fill();

          // Thruster Glow
          ctx.fillStyle = primaryColor;
          ctx.beginPath();
          ctx.moveTo(-23, -6);
          ctx.lineTo(-38 - Math.random() * 10, 0);
          ctx.lineTo(-23, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        };

        drawDuelShip(p1x, p1y, true, '#00f0ff');
        drawDuelShip(p2x, p2y, false, sim.rival.color);

        // Animated Curved Attack Volleys (rProg 0.12 -> 0.58)
        const drawVolley = (sx, sy, tx, ty, atkDir, color, blocked) => {
          const ctrlX = (sx + tx) / 2;
          const ctrlY = laneY(atkDir);
          if (rProg >= 0.10 && rProg <= 0.62) {
            const t = Math.min(1, (rProg - 0.10) / 0.48);
            const bx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * ctrlX + t * t * tx;
            const by = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * ctrlY + t * t * ty;

            // Faint trajectory arc
            ctx.strokeStyle = `${color}44`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(ctrlX, ctrlY, tx, ty);
            ctx.stroke();
            ctx.setLineDash([]);

            // Glowing Plasma Volley Orb
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = color;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(bx, by, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
          }

          // Impact Flash / Block Sparks (rProg 0.56 -> 0.95)
          if (rProg >= 0.56) {
            const imp = (rProg - 0.56) / 0.44;
            const rBlast = (blocked ? 22 : 44) * imp;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - imp);
            ctx.fillStyle = blocked ? '#00f0ff' : '#ffd700';
            ctx.beginPath();
            ctx.arc(tx, ty, rBlast, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = blocked ? '#38bdf8' : '#ffd700';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(blocked ? '🛡️ BLOCKED!' : '💥 DIRECT HIT!', tx, ty - 34 - imp * 14);
          }
        };

        drawVolley(p1x + 30, p1y, p2x - 24, p2y, rd.p1Atk, '#00f0ff', rd.p1BlockedByP2);
        drawVolley(p2x - 30, p2y, p1x + 24, p1y, rd.p2Atk, sim.rival.color, rd.p2BlockedByP1);

        // Final Victory / Defeat Banner Overlay
        if (elapsed >= totalDur) {
          if (!sim.finished && sim.winner === 'p1') {
            this.duelWins += 1;
            const duelXp = Math.round(25 * ((sim.rival.shield + sim.rival.turret) / 2));
            this.awardCombatXp(duelXp, false);
          }
          sim.finished = true;
          ctx.fillStyle = 'rgba(2, 6, 18, 0.72)';
          ctx.fillRect(0, h / 2 - 36, w, 72);
          ctx.fillStyle = sim.winner === 'p1' ? '#00ff88' : (sim.winner === 'p2' ? '#ff4d79' : '#ffd700');
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          const potWin = Math.round(sim.wager * 1.9);
          const msg = sim.winner === 'p1'
            ? `🏆 VICTORY! ${sim.wager > 0 ? `+${potWin} PGT Won (5% Burned)` : 'Honor Earned!'}`
            : (sim.winner === 'p2' ? `💀 DEFEAT! ${sim.rival.name} outmaneuvered your fleet` : '🤝 TACTICAL DRAW! Stakes Refunded');
          ctx.fillText(msg, w / 2, h / 2 + 7);
          document.getElementById('duel-result-actions').style.display = 'flex';
        }

        ctx.restore();
      }

      updateGalaxy2D(dt) {
        const s = this.ship2D;
        const maxSpeed = 240 + this.warpLevel * 12; // Warp level scales 2D galaxy cruise speed

        if (s.targetX !== null && s.targetY !== null) {
          const dx = s.targetX - s.x;
          const dy = s.targetY - s.y;
          const dist = Math.hypot(dx, dy);

          if (dist > 6) {
            const desiredAngle = Math.atan2(dy, dx);
            // Smooth angular turn
            let diff = desiredAngle - s.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            s.angle += diff * Math.min(1, dt * 10);

            const speed = Math.min(maxSpeed, dist * 3.2 + 60);
            s.vx = Math.cos(s.angle) * speed;
            s.vy = Math.sin(s.angle) * speed;
            const B = this.galaxyBound;
            s.x = Math.max(-B, Math.min(B, s.x + s.vx * dt));
            s.y = Math.max(-B, Math.min(B, s.y + s.vy * dt));

            if (Math.random() < 0.7) {
              s.trail.push({ x: s.x, y: s.y, life: 1.0 });
            }
          } else {
            s.x = s.targetX;
            s.y = s.targetY;
            s.vx = 0;
            s.vy = 0;
            s.targetX = null;
            s.targetY = null;
          }
        }

        // Smooth Radar -> Galaxy Zoom-Out Intro Transition
        if (this._introZoomTarget != null) {
          this.camZoom += (this._introZoomTarget - this.camZoom) * Math.min(1, dt * 3.8);
          if (Math.abs(this.camZoom - this._introZoomTarget) < 0.006) {
            this.camZoom = this._introZoomTarget;
            this._introZoomTarget = null;
          }
        }

        // Update thruster trail
        for (let i = s.trail.length - 1; i >= 0; i--) {
          s.trail[i].life -= dt * 1.4;
          if (s.trail[i].life <= 0) s.trail.splice(i, 1);
        }

        // Update Simulated Other Pilots Flying Across the Galaxy
        if (this.otherPilots) {
          for (const pl of this.otherPilots) {
            const dx = pl.targetX - pl.x;
            const dy = pl.targetY - pl.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 14) {
              const ang = Math.atan2(dy, dx);
              let diff = ang - pl.angle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              pl.angle += diff * Math.min(1, dt * 6);
              pl.x += Math.cos(pl.angle) * pl.speed * dt;
              pl.y += Math.sin(pl.angle) * pl.speed * dt;
              if (Math.random() < 0.35) pl.trail.push({ x: pl.x, y: pl.y, life: 1.0 });
            } else {
              // Pick a fresh destination (hub patrol or random solar system)
              if (pl.nearHub) {
                const a = Math.random() * Math.PI * 2;
                const r = 170 + Math.random() * 240;
                pl.targetX = Math.round(Math.cos(a) * r);
                pl.targetY = Math.round(Math.sin(a) * r);
              } else {
                const nextSys = this.solarSystems[Math.floor(Math.random() * this.solarSystems.length)];
                pl.targetX = nextSys.x + (Math.random() - 0.5) * 140;
                pl.targetY = nextSys.y + (Math.random() - 0.5) * 140;
              }
            }
            for (let k = pl.trail.length - 1; k >= 0; k--) {
              pl.trail[k].life -= dt * 1.6;
              if (pl.trail[k].life <= 0) pl.trail.splice(k, 1);
            }
          }
        }

        if (this.followShip2D) {
          this.camX += (s.x - this.camX) * Math.min(1, dt * 7);
          this.camY += (s.y - this.camY) * Math.min(1, dt * 7);
        }

        // Check proximity to solar systems to auto-show briefing
        for (const sys of this.solarSystems) {
          if (Math.hypot(s.x - sys.x, s.y - sys.y) < 42 && this.selectedSystemId !== sys.id) {
            this.selectedSystemId = sys.id;
            this.showSystemBriefing(sys);
          }
        }

        // Update Live Coordinate Telemetry HUD
        const rx = Math.round(s.x);
        const ry = Math.round(s.y);
        const coordEl = document.getElementById('coord-readout');
        if (coordEl) {
          coordEl.innerText = `X: ${rx >= 0 ? '+' + rx : rx} | Y: ${ry >= 0 ? '+' + ry : ry}`;
        }
        const secEl = document.getElementById('sector-readout');
        if (secEl) {
          const rDist = Math.hypot(rx, ry);
          secEl.innerText = rDist < 260
            ? '🌍 Inner Core Sector (Outpost Hub & 6 Idle Missions)'
            : rDist < 1100
              ? '🌌 Orion-Perseus Rim (Solar Systems 1–20)'
              : rDist < 2100
                ? '☄️ Sagittarius-Scutum Arms (Solar Systems 21–40)'
                : '👑 Galactic Singularity Rim (Solar Systems 41–50)';
        }
      }

      renderGalaxy2D() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.fillStyle = '#02040a';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(this.camZoom, this.camZoom);
        ctx.translate(-this.camX, -this.camY);

        // 1. Milky Way Spiral Galaxy Core Glow
        const coreGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, 3200);
        coreGrad.addColorStop(0, 'rgba(255, 215, 0, 0.22)');
        coreGrad.addColorStop(0.12, 'rgba(168, 85, 247, 0.14)');
        coreGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.06)');
        coreGrad.addColorStop(1, 'rgba(2, 4, 10, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 3200, 0, Math.PI * 2);
        ctx.fill();

        // Concentric Galactic Coordinate Rings & Outer ±10,000 Sector Perimeter
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.lineWidth = 1 / this.camZoom;
        [250, 1000, 1800, 2600, 3200, 6000, 10000].forEach(r => {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Glowing Galactic Sector Boundary Box (-10,000 .. +10,000)
        const B = this.galaxyBound;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
        ctx.lineWidth = 2.5 / this.camZoom;
        ctx.setLineDash([28 / this.camZoom, 18 / this.camZoom]);
        ctx.strokeRect(-B, -B, B * 2, B * 2);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 77, 121, 0.72)';
        ctx.font = `bold ${Math.max(12, Math.round(13 / this.camZoom))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ GALACTIC PERIMETER (Y = -10,000)', 0, -B - 14 / this.camZoom);
        ctx.fillText('⚠️ GALACTIC PERIMETER (Y = +10,000)', 0, B + 22 / this.camZoom);
        ctx.restore();

        // 2. Render 1,400 Milky Way Spiral Arm Stars
        for (const st of this.galaxyStars) {
          ctx.fillStyle = st.color;
          ctx.globalAlpha = st.alpha;
          ctx.fillRect(st.x, st.y, st.size * 1.5, st.size * 1.5);
        }
        ctx.globalAlpha = 1.0;

        // 3. Inner Core Tactical Radar (Outpost Hub + 6 Live Idle Mining Missions + Radar Sweep)
        ctx.save();
        // Rotating Tactical Radar Sweep Cone
        const sweepAng = (Date.now() / 2200) % (Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.06)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 230, sweepAng, sweepAng + 0.55);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 230, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Outpost Hub at (0,0)
        ctx.fillStyle = '#1d4ed8';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🌍 Outpost Hub (0,0)', 0, 30);

        const destMap = {};
        for (const dest of this.innerDestinations) {
          destMap[dest.type] = dest;
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(dest.x, dest.y);
          ctx.stroke();

          ctx.fillStyle = dest.color;
          ctx.beginPath();
          ctx.arc(dest.x, dest.y, 6, 0, Math.PI * 2);
          ctx.fill();

          if (this.camZoom > 0.35) {
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.font = '9px sans-serif';
            ctx.fillText(dest.name, dest.x, dest.y + 15);
          }
        }

        // Mirror Live Active PolySpace Expeditions Flying Around the Inner Core!
        const liveExps = (window.polySpace && window.polySpace.state && Array.isArray(window.polySpace.state.expeditions))
          ? window.polySpace.state.expeditions : [];
        if (liveExps.length > 0) {
          const nowMs = Date.now();
          const routeCounts = {};
          liveExps.forEach((exp) => {
            const key = String(exp.type || 'asteroids').toLowerCase();
            const dNode = destMap[key] || this.innerDestinations[0];
            const idxOnRoute = routeCounts[key] || 0;
            routeCounts[key] = idxOnRoute + 1;

            const dur = Math.max(1, (exp.endTime || 0) - (exp.startTime || 0));
            const prog = Math.max(0.05, Math.min(1, (nowMs - (exp.startTime || 0)) / dur));
            const isReady = nowMs >= (exp.endTime || 0);

            // Slight perpendicular offset when multiple ships share the same route
            const len = Math.hypot(dNode.x, dNode.y) || 1;
            const perpX = (-dNode.y / len) * (idxOnRoute * 7 - 3);
            const perpY = (dNode.x / len) * (idxOnRoute * 7 - 3);

            // Dashed glowing expedition flight line
            ctx.strokeStyle = isReady ? '#00ff88' : dNode.color;
            ctx.lineWidth = 1.6;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(perpX * 0.25, perpY * 0.25);
            ctx.lineTo(dNode.x + perpX * 0.5, dNode.y + perpY * 0.5);
            ctx.stroke();
            ctx.setLineDash([]);

            // Live expedition shuttle position
            const ex = dNode.x * prog + perpX * (0.25 + prog * 0.25);
            const ey = dNode.y * prog + perpY * (0.25 + prog * 0.25);
            ctx.fillStyle = isReady ? '#00ff88' : '#ffd700';
            ctx.beginPath();
            ctx.arc(ex, ey, 3.8, 0, Math.PI * 2);
            ctx.fill();

            if (this.camZoom > 0.35) {
              ctx.fillStyle = isReady ? '#00ff88' : '#fde047';
              ctx.font = 'bold 8px monospace';
              ctx.fillText(isReady ? 'READY' : `${Math.floor(prog * 100)}%`, ex, ey - 6);
            }
          });
        }
        ctx.restore();

        // 4. Render 50 Outer Solar Systems (All Unlocked, Difficulty-Scaled)
        for (const sys of this.solarSystems) {
          const isSelected = this.selectedSystemId === sys.id;
          const isCleared = this.clearedSystems.has(sys.id);

          // Outer Aura
          if (isSelected || sys.id === 50 || isCleared) {
            ctx.strokeStyle = isCleared ? '#00ff88' : sys.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sys.x, sys.y, sys.radius + 6 + Math.sin(Date.now() / 250) * 2, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Sun Body
          ctx.fillStyle = isCleared ? '#00ff88' : sys.color;
          ctx.beginPath();
          ctx.arc(sys.x, sys.y, sys.radius, 0, Math.PI * 2);
          ctx.fill();

          // Orbiting Planet Ring
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(sys.x, sys.y, sys.radius * 1.7, sys.radius * 0.65, 0.3, 0, Math.PI * 2);
          ctx.stroke();

          // System Number & Level Label
          ctx.fillStyle = '#ffffff';
          ctx.font = sys.id === 50 ? 'bold 13px sans-serif' : 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${sys.id === 50 ? '👑 ' : ''}#${sys.id} ${sys.name} (Lvl ${sys.level})`,
            sys.x,
            sys.y + sys.radius + 14
          );
        }

        // 5. Hidden Coordinate Gifts (Radar Scanner Discovery Radius <= 210 units)
        for (const g of this.hiddenGifts) {
          const dist = Math.hypot(this.ship2D.x - g.x, this.ship2D.y - g.y);
          if (dist <= 210) {
            ctx.save();
            ctx.strokeStyle = g.claimed ? '#64748b' : '#ffd700';
            ctx.fillStyle = g.claimed ? 'rgba(100,116,139,0.2)' : 'rgba(255,215,0,0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(g.x, g.y, 18 + Math.sin(Date.now() / 180) * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = g.claimed ? '#94a3b8' : '#ffd700';
            ctx.textAlign = 'center';
            ctx.fillText(g.claimed ? `✅ ${g.name} (Claimed)` : `🎁 ${g.name} — CLICK TO CLAIM!`, g.x, g.y - 24);
            ctx.restore();
          }
        }

        // 5a. Render Open Map Trade Beacons (Glowing Green 🤝 Icons Any Pilot Can 1-Click Accept!)
        if (this.tradeBeacons) {
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 280);
          const bScale = Math.max(0.85, 1.05 / Math.sqrt(this.camZoom));
          for (const tb of this.tradeBeacons) {
            ctx.save();
            ctx.translate(tb.x, tb.y);

            // Pulsing Beacon Ring
            ctx.strokeStyle = tb.isMine ? `rgba(0, 240, 255, ${0.4 + pulse * 0.45})` : `rgba(0, 255, 136, ${0.4 + pulse * 0.45})`;
            ctx.lineWidth = 2 / this.camZoom;
            ctx.beginPath();
            ctx.arc(0, 0, (16 + pulse * 6) * bScale, 0, Math.PI * 2);
            ctx.stroke();

            // Solid Badge Circle
            ctx.fillStyle = tb.isMine ? 'rgba(6, 30, 52, 0.92)' : 'rgba(4, 34, 24, 0.92)';
            ctx.strokeStyle = tb.isMine ? '#00f0ff' : '#00ff88';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 13 * bScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.font = `${Math.round(13 * bScale)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🤝', 0, 1);

            if (this.camZoom > 0.24) {
              ctx.fillStyle = tb.isMine ? '#7dd3fc' : '#6ee7b7';
              ctx.font = `bold ${Math.max(9, Math.round(9.5 / Math.sqrt(this.camZoom)))}px sans-serif`;
              ctx.textBaseline = 'alphabetic';
              ctx.fillText(`${tb.seller}: ${tb.offerAmt} → ${tb.wantAmt}`, 0, -18 * bScale);
            }
            ctx.restore();
          }
        }

        // 5b. Render Other Live Pilots on the 2D Milky Way (Clickable for Trade or Tactical Duel!)
        if (this.otherPilots) {
          const pScale = Math.max(0.75, 1.0 / Math.sqrt(this.camZoom));
          for (const pl of this.otherPilots) {
            // Subtle wake trail
            for (const tr of pl.trail) {
              ctx.fillStyle = pl.color;
              ctx.globalAlpha = tr.life * 0.35;
              ctx.beginPath();
              ctx.arc(tr.x, tr.y, 2.2, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1.0;

            ctx.save();
            ctx.translate(pl.x, pl.y);
            ctx.rotate(pl.angle);
            ctx.scale(pScale, pScale);

            // Mini Starfighter Silhouette
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = pl.color;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(13, 0);
            ctx.lineTo(-4, -10);
            ctx.lineTo(-9, -7);
            ctx.lineTo(-6, 0);
            ctx.lineTo(-9, 7);
            ctx.lineTo(-4, 10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Cockpit core
            ctx.fillStyle = pl.color;
            ctx.beginPath();
            ctx.arc(2, 0, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Pilot Name Tag
            if (this.camZoom > 0.22) {
              ctx.fillStyle = pl.color;
              ctx.font = `bold ${Math.max(9, Math.round(10 / Math.sqrt(this.camZoom)))}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.fillText(`🛸 ${pl.name}`, pl.x, pl.y - 14 * pScale);
            }
          }
        }

        // 6. Player 2D Waypoint Line & Flagship Sprite
        const s = this.ship2D;
        if (s.targetX !== null && s.targetY !== null) {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.5 / this.camZoom;
          ctx.setLineDash([6 / this.camZoom, 6 / this.camZoom]);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.targetX, s.targetY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Target Crosshair
          ctx.strokeStyle = '#00ff88';
          ctx.beginPath();
          ctx.arc(s.targetX, s.targetY, 10 / this.camZoom, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Ship Radar Scanner Ring (210 unit discovery radius)
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 210, 0, Math.PI * 2);
        ctx.stroke();

        // Thruster Particles (tapered plasma wake)
        for (const tr of s.trail) {
          const r = Math.max(1.2, tr.life * 4.2);
          ctx.fillStyle = `rgba(0, 240, 255, ${tr.life * 0.55})`;
          ctx.beginPath();
          ctx.arc(tr.x, tr.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Player Flagship (Real Equipped On-Chain NFT Starship if available, else Cyber Starfighter)
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        const shipScale = Math.max(0.95, 1.3 / Math.sqrt(this.camZoom));
        ctx.scale(shipScale, shipScale);

        const _psShip = (window.polySpace && typeof window.polySpace.getEquippedStarshipMultiplier === 'function')
          ? window.polySpace.getEquippedStarshipMultiplier() : null;
        if (_psShip && _psShip.ship && _psShip.ship.dna && window.PolyHangar && typeof window.PolyHangar.renderProceduralShip === 'function') {
          window.PolyHangar.renderProceduralShip(ctx, 0, 0, _psShip.ship.dna, 0.34, 0, Date.now() / 300, s.targetX !== null);
          ctx.restore();
          ctx.restore();
          return;
        }

        const tPulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);
        const isCruising = s.targetX !== null;

        // Subtle Shield Energy Halo
        const shieldGrad = ctx.createRadialGradient(2, 0, 6, 2, 0, 28);
        shieldGrad.addColorStop(0, 'rgba(0, 240, 255, 0.02)');
        shieldGrad.addColorStop(0.75, 'rgba(0, 240, 255, 0.14)');
        shieldGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = shieldGrad;
        ctx.beginPath();
        ctx.arc(2, 0, 28, 0, Math.PI * 2);
        ctx.fill();

        // Twin Ion Afterburner Plumes
        const plumeLen = isCruising ? (24 + Math.random() * 10) : (10 + tPulse * 4);
        for (const ey of [-5.5, 5.5]) {
          // Outer cyan/violet plasma flame
          const flameGrad = ctx.createLinearGradient(-12, ey, -12 - plumeLen, ey);
          flameGrad.addColorStop(0, '#ffffff');
          flameGrad.addColorStop(0.3, '#00f0ff');
          flameGrad.addColorStop(0.75, 'rgba(168, 85, 247, 0.65)');
          flameGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.moveTo(-12, ey - 2.6);
          ctx.lineTo(-12 - plumeLen, ey);
          ctx.lineTo(-12, ey + 2.6);
          ctx.closePath();
          ctx.fill();

          // White-hot inner core
          ctx.fillStyle = '#e0faff';
          ctx.beginPath();
          ctx.moveTo(-12, ey - 1.2);
          ctx.lineTo(-12 - plumeLen * 0.45, ey);
          ctx.lineTo(-12, ey + 1.2);
          ctx.closePath();
          ctx.fill();
        }

        // Twin Forward Wing-Mounted Laser Cannons
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(4, -9.5); ctx.lineTo(14, -9.5);
        ctx.moveTo(4, 9.5);  ctx.lineTo(14, 9.5);
        ctx.stroke();
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(13.5, -10.3, 2.2, 1.6);
        ctx.fillRect(13.5, 8.7, 2.2, 1.6);

        // Swept Main Delta Wings + Metallic Hull Gradient
        const hullGrad = ctx.createLinearGradient(-15, -16, 22, 16);
        hullGrad.addColorStop(0, '#0f172a');
        hullGrad.addColorStop(0.45, '#1e293b');
        hullGrad.addColorStop(0.8, '#334155');
        hullGrad.addColorStop(1, '#0f172a');

        ctx.fillStyle = hullGrad;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(23, 0);          // Sharp nose tip
        ctx.lineTo(10, -4.5);       // Forward fuselage chine
        ctx.lineTo(3, -7);          // Inner wing root
        ctx.lineTo(-7, -18);        // Swept port wingtip
        ctx.lineTo(-13.5, -15.5);   // Wingtip trailing edge
        ctx.lineTo(-10, -8);        // Engine pod outer
        ctx.lineTo(-13.5, -7);      // Port thruster cowling
        ctx.lineTo(-13.5, -3.5);
        ctx.lineTo(-11, 0);         // Tail spine
        ctx.lineTo(-13.5, 3.5);
        ctx.lineTo(-13.5, 7);       // Starboard thruster cowling
        ctx.lineTo(-10, 8);
        ctx.lineTo(-13.5, 15.5);    // Starboard wingtip trailing
        ctx.lineTo(-7, 18);         // Swept starboard wingtip
        ctx.lineTo(3, 7);
        ctx.lineTo(10, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Armored Center Fuselage Spine
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(6, -4.2);
        ctx.lineTo(-10, -4.8);
        ctx.lineTo(-10, 4.8);
        ctx.lineTo(6, 4.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing Neon Energy Wing Trim Stripes
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(2, -7.5);  ctx.lineTo(-7.5, -15.5);
        ctx.moveTo(2, 7.5);   ctx.lineTo(-7.5, 15.5);
        ctx.stroke();

        // Sleek Illuminated Cockpit Canopy
        const canopyGrad = ctx.createLinearGradient(12, 0, -2, 0);
        canopyGrad.addColorStop(0, '#fde047');
        canopyGrad.addColorStop(0.55, '#00f0ff');
        canopyGrad.addColorStop(1, '#0284c7');
        ctx.fillStyle = canopyGrad;
        ctx.beginPath();
        ctx.moveTo(12.5, 0);
        ctx.quadraticCurveTo(6, -3.3, -1.5, -2.2);
        ctx.lineTo(-3.5, 0);
        ctx.lineTo(-1.5, 2.2);
        ctx.quadraticCurveTo(6, 3.3, 12.5, 0);
        ctx.closePath();
        ctx.fill();

        // Cockpit Specular Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.ellipse(6.5, -0.8, 3.2, 0.85, 0, 0, Math.PI * 2);
        ctx.fill();

        // Port (Red) & Starboard (Green) Wingtip Navigation Strobes
        ctx.fillStyle = `rgba(255, 59, 92, ${0.55 + tPulse * 0.45})`;
        ctx.beginPath();
        ctx.arc(-8.5, -16.8, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(0, 255, 136, ${0.55 + tPulse * 0.45})`;
        ctx.beginPath();
        ctx.arc(-8.5, 16.8, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.restore();
      }

      // --------------------------------------------------------------------------
      // 4. 3D SOLAR SYSTEM DOGFIGHT ENGINE (6-DOF Physics + 3D AI + 360° Mini-Radar)
      // --------------------------------------------------------------------------
      setFullscreen(enabled) {
        const root = document.getElementById('psg-root');
        const host = document.getElementById('space-galaxy-host');
        const vp = document.getElementById('psg-viewport');
        const dc = document.getElementById('demo-canvas');
        if (!root) return;
        this._isFullscreen = Boolean(enabled);
        if (enabled) {
          if (root.parentElement !== document.body) {
            document.body.appendChild(root);
          }
          root.classList.add('psg-fullscreen');
          root.style.position = 'fixed';
          root.style.inset = '0';
          root.style.width = '100vw';
          root.style.height = '100vh';
          root.style.zIndex = '99999';
          root.style.pointerEvents = 'auto';
          if (vp) { vp.style.background = '#02040a'; vp.style.pointerEvents = 'auto'; }
          if (dc) dc.style.display = 'block';
          document.body.style.overflow = 'hidden';
        } else {
          root.classList.remove('psg-fullscreen');
          root.style.position = '';
          root.style.inset = '';
          root.style.width = '';
          root.style.height = '';
          root.style.zIndex = '';
          root.style.pointerEvents = 'none';
          if (vp) { vp.style.background = 'transparent'; vp.style.pointerEvents = 'none'; }
          if (dc) dc.style.display = 'none';
          if (host && root.parentElement !== host) {
            host.appendChild(root);
          }
          document.body.style.overflow = '';
        }
        const fsBtn = document.getElementById('psg-btn-fullscreen');
        if (fsBtn) fsBtn.innerText = enabled ? '✕ Collapse' : '⛶ Expand';
        this.resize();
        setTimeout(() => this.resize(), 40);
      }

      switchMode(newMode) {
        this.mode = newMode;
        const h2 = document.getElementById('hud-2d');
        const h3 = document.getElementById('hud-3d');
        if (h2) h2.style.display = newMode === 'galaxy' ? 'block' : 'none';
        if (h3) h3.style.display = newMode === 'combat3d' ? 'block' : 'none';
        const mm = document.getElementById('mission-modal');
        if (mm) mm.style.display = 'none';
        const root = document.getElementById('psg-root');
        if (root) {
          if (newMode === 'combat3d') {
            this._wasFullscreenBefore3D = root.classList.contains('psg-fullscreen');
            this.setFullscreen(true);
          } else {
            this.setFullscreen(Boolean(this._wasFullscreenBefore3D));
          }
        }
      }

      toggleFullscreen() {
        const root = document.getElementById('psg-root');
        if (!root) return;
        const nextFs = !root.classList.contains('psg-fullscreen');
        this._wasFullscreenBefore3D = nextFs;
        this.setFullscreen(nextFs);
      }

      launch3DMission(systemId = 15) {
        this.updateUpgrades();
        const sys = this.solarSystems.find(s => s.id === systemId) || this.solarSystems[0];
        this.activeSystem = sys;
        this.selectedSystemId = sys.id;
        this.switchMode('combat3d');

        // Initialize 3D Player Ship with 6-DOF Orientation Basis Vectors (Forward, Up, Right)
        const maxShield = 400 + this.shieldLevel * 120; // Lvl 1: 520 -> Lvl 50: 6,400
        const maxHull = 500 + this.shieldLevel * 60;
        this.player3D = {
          pos: { x: 0, y: 0, z: 0 },
          vel: { x: 0, y: 0, z: 0 },
          forward: { x: 0, y: 0, z: 1 },
          up: { x: 0, y: 1, z: 0 },
          right: { x: 1, y: 0, z: 0 },
          pitchRate: 0,
          yawRate: 0,
          rollBank: 0,
          speed: 220,
          shield: maxShield,
          maxShield: maxShield,
          hull: maxHull,
          maxHull: maxHull,
          lastHitTime: 0,
          lastFireTime: 0
        };

        // 3D Starfield Dust particles around the ship for speed sensation
        this.spaceDust3D = [];
        for (let i = 0; i < 220; i++) {
          this.spaceDust3D.push({
            x: (Math.random() - 0.5) * 3000,
            y: (Math.random() - 0.5) * 3000,
            z: (Math.random() - 0.5) * 3000
          });
        }

        this.lasers3D = [];
        this.missiles3D = [];
        this.lastMissileTime = 0;
        this.missileCooldownMs = 10000;
        this.missileCamImpact = null;
        this.explosions3D = [];
        this.enemies3D = [];
        this.waveSpawnQueue = [];
        this.nextSpawnAt = 0;
        this.combatWave = 1;
        this.combatMaxWaves = 3;
        this.missionStartTime = performance.now();
        this.combatEnded = false;

        this.spawnCombatWave(1);
        this.update3DHUD();
        this.showToast(`⚔️ Entered 3D Dogfight in System #${sys.id}: ${sys.name} (Lvl ${sys.level})!`);
      }

      retry3DMission() {
        document.getElementById('mission-modal').style.display = 'none';
        this.launch3DMission(this.selectedSystemId);
      }

      closeModalAndReturn() {
        document.getElementById('mission-modal').style.display = 'none';
        this.switchMode('galaxy');
      }

      spawnCombatWave(waveNum) {
        this.combatWave = waveNum;
        const sysLvl = this.activeSystem.level;

        // Enemy HP & Damage scale with Solar System Level (1..50)
        const baseEnemyHp = 80 + Math.pow(sysLvl, 1.65) * 14;
        const baseEnemyDmg = 10 + Math.pow(sysLvl, 1.45) * 2.2;

        this.waveSpawnQueue = [];
        this.nextSpawnAt = performance.now(); // First ship warps in immediately; each subsequent ship every 1.0s

        if (waveNum < 3) {
          const count = waveNum === 1 ? 4 : 5;
          for (let i = 0; i < count; i++) {
            this.waveSpawnQueue.push({
              id: `e_${waveNum}_${i}`,
              name: waveNum === 1 ? `Scout Interceptor α-${i + 1}` : `Heavy Raider β-${i + 1}`,
              isBoss: false,
              hp: Math.round(baseEnemyHp * (waveNum === 2 ? 1.35 : 1.0)),
              dmg: baseEnemyDmg,
              speed: 135 + (i * 10),
              radius: 42,
              color: waveNum === 1 ? '#ff0055' : '#f59e0b',
              dist: 3200 + (i % 3) * 260,
              spreadX: (i - (count - 1) / 2) * 340,
              spreadY: ((i % 2 === 0 ? 1 : -1) * 180),
              flankSide: i % 2 === 0 ? 1 : -1,
              flankUp: ((i % 3) - 1) * 170,
              reengageDist: 2800 + (i % 3) * 260
            });
          }
        } else {
          // Wave 3: Solar System Command Boss
          this.waveSpawnQueue.push({
            id: 'boss_main',
            name: this.activeSystem.id === 50 ? '👑 SINGULARITY LEVIATHAN MOTHERSHIP' : `👑 ${this.activeSystem.name} Dreadnought`,
            isBoss: true,
            hp: Math.round(baseEnemyHp * 4.5),
            dmg: baseEnemyDmg * 1.6,
            speed: 105,
            radius: 88,
            color: '#c084fc',
            dist: 3500,
            spreadX: 0,
            spreadY: 60,
            flankSide: 1,
            flankUp: 120,
            reengageDist: 3000
          });
        }
      }

      processWaveSpawnQueue(now) {
        if (!this.waveSpawnQueue || this.waveSpawnQueue.length === 0) return;
        if (now < this.nextSpawnAt) return;

        const spec = this.waveSpawnQueue.shift();
        this.nextSpawnAt = now + 1000; // 1 ship every 1.0 second!

        const p = this.player3D;
        const spawnPos = {
          x: p.pos.x + p.forward.x * spec.dist + p.right.x * spec.spreadX + p.up.x * spec.spreadY,
          y: p.pos.y + p.forward.y * spec.dist + p.right.y * spec.spreadX + p.up.y * spec.spreadY,
          z: p.pos.z + p.forward.z * spec.dist + p.right.z * spec.spreadX + p.up.z * spec.spreadY
        };

        this.enemies3D.push({
          id: spec.id,
          name: spec.name,
          isBoss: spec.isBoss,
          pos: spawnPos,
          vel: { x: -p.forward.x * spec.speed, y: -p.forward.y * spec.speed, z: -p.forward.z * spec.speed },
          hp: spec.hp,
          maxHp: spec.hp,
          dmg: spec.dmg,
          speed: spec.speed,
          curSpeed: spec.speed,
          radius: spec.radius,
          color: spec.color,
          aiState: 'attack_pass',
          aiTimer: 0,
          flankSide: spec.flankSide,
          flankUp: spec.flankUp,
          reengageDist: spec.reengageDist,
          lastShot: now + 1100 + Math.random() * 1000
        });

        // Subtle warp-in flash at spawn point
        this.spawn3DExplosion(spawnPos, spec.isBoss ? '#c084fc' : '#00f0ff', spec.isBoss ? 26 : 10);
      }

      // Vector Math Helpers for 6-DOF 3D Flight
      vecNorm(v) {
        const len = Math.hypot(v.x, v.y, v.z) || 1;
        return { x: v.x / len, y: v.y / len, z: v.z / len };
      }
      vecCross(a, b) {
        return {
          x: a.y * b.z - a.z * b.y,
          y: a.z * b.x - a.x * b.z,
          z: a.x * b.y - a.y * b.x
        };
      }
      vecDot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
      }
      rotateBasis(v, axis, angle) {
        // Rodrigues' rotation formula
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dot = this.vecDot(v, axis);
        const cross = this.vecCross(axis, v);
        return this.vecNorm({
          x: v.x * cos + cross.x * sin + axis.x * dot * (1 - cos),
          y: v.y * cos + cross.y * sin + axis.y * dot * (1 - cos),
          z: v.z * cos + cross.z * sin + axis.z * dot * (1 - cos)
        });
      }

      // Transform world 3D point into Player Ship's local Camera Space (x: right, y: up, z: forward depth)
      worldToShipLocal(worldPt) {
        const p = this.player3D;
        const dx = worldPt.x - p.pos.x;
        const dy = worldPt.y - p.pos.y;
        const dz = worldPt.z - p.pos.z;
        return {
          x: dx * p.right.x + dy * p.right.y + dz * p.right.z,
          y: dx * p.up.x + dy * p.up.y + dz * p.up.z,
          z: dx * p.forward.x + dy * p.forward.y + dz * p.forward.z
        };
      }

      firePlayerLasers() {
        const now = performance.now();
        const cooldown = Math.max(95, 230 - this.turretLevel * 2.5);
        if (now - this.player3D.lastFireTime < cooldown) return;
        this.player3D.lastFireTime = now;

        const p = this.player3D;
        const dmgPerShot = Math.round(18 + Math.pow(this.turretLevel, 1.55) * 1.45);
        const laserSpeed = 1850 + this.turretLevel * 12;

        // Aim gently toward mouse cursor (desktop mouse mode) or straight ahead (mobile touch & keyboard mode — no auto-aim)
        let aimDir;
        if (this.isTouchDevice || this.useKeyboardSteer) {
          aimDir = { x: p.forward.x, y: p.forward.y, z: p.forward.z };
        } else {
          const normMx = (this.mouseX - this.width / 2) / (this.width / 2);
          const normMy = -(this.mouseY - this.height / 2) / (this.height / 2);
          aimDir = this.vecNorm({
            x: p.forward.x + p.right.x * normMx * 0.38 + p.up.x * normMy * 0.38,
            y: p.forward.y + p.right.y * normMx * 0.38 + p.up.y * normMy * 0.38,
            z: p.forward.z + p.right.z * normMx * 0.38 + p.up.z * normMy * 0.38
          });
        }

        // Wing hardpoint offsets (Twin cannons or Quad cannons at Turret Lvl 25+)
        const offsets = this.turretLevel >= 25 ? [-28, -12, 12, 28] : [-18, 18];
        const perBoltDmg = dmgPerShot / offsets.length;
        const color = this.turretLevel >= 40 ? '#ffd700' : this.turretLevel >= 20 ? '#c084fc' : '#00f0ff';

        for (const offX of offsets) {
          this.lasers3D.push({
            isPlayer: true,
            pos: {
              x: p.pos.x + p.forward.x * 35 + p.right.x * offX - p.up.x * 8,
              y: p.pos.y + p.forward.y * 35 + p.right.y * offX - p.up.y * 8,
              z: p.pos.z + p.forward.z * 35 + p.right.z * offX - p.up.z * 8
            },
            vel: {
              x: aimDir.x * laserSpeed,
              y: aimDir.y * laserSpeed,
              z: aimDir.z * laserSpeed
            },
            dmg: perBoltDmg,
            color,
            life: 2.2
          });
        }
      }

      getMissileLockTarget() {
        if (!this.enemies3D || this.enemies3D.length === 0) return null;
        let bestFront = null;
        let bestFrontDist = Infinity;
        let bestAny = null;
        let bestAnyDist = Infinity;

        for (const e of this.enemies3D) {
          const loc = this.worldToShipLocal(e.pos);
          const dist = Math.hypot(loc.x, loc.y, loc.z);
          if (dist < bestAnyDist) {
            bestAnyDist = dist;
            bestAny = e;
          }
          if (loc.z > 40 && dist < bestFrontDist) {
            bestFrontDist = dist;
            bestFront = e;
          }
        }
        return bestFront || bestAny;
      }

      fireHomingMissile() {
        if (this.mode !== 'combat3d' || this.combatEnded) return;
        const now = performance.now();
        const elapsed = now - (this.lastMissileTime || 0);
        if (this.lastMissileTime > 0 && elapsed < this.missileCooldownMs) {
          const rem = ((this.missileCooldownMs - elapsed) / 1000).toFixed(1);
          this.showToast(`⏳ Homing Missile recharging (${rem}s)...`);
          return;
        }
        const target = this.getMissileLockTarget();
        if (!target) return;

        this.lastMissileTime = now;
        const p = this.player3D;
        const baseShotDmg = Math.round(18 + Math.pow(this.turretLevel, 1.55) * 1.45);
        const missileDmg = Math.round(baseShotDmg * 5.0);

        this.missiles3D.push({
          pos: {
            x: p.pos.x + p.forward.x * 45 - p.up.x * 16,
            y: p.pos.y + p.forward.y * 45 - p.up.y * 16,
            z: p.pos.z + p.forward.z * 45 - p.up.z * 16
          },
          vel: {
            x: p.forward.x * 680,
            y: p.forward.y * 680,
            z: p.forward.z * 680
          },
          speed: 1080,
          targetId: target.id,
          dmg: missileDmg,
          life: 8.0,
          trail: []
        });
        this.missileCamImpact = null;
        this.showToast(`🚀 HOMING MISSILE LOCKED ON ${target.name.toUpperCase()}!`);
      }

      updateCombat3D(dt) {
        if (this.combatEnded) return;
        const p = this.player3D;
        const now = performance.now();

        // 0. Process Staggered 1-by-1 Wave Spawning (1 ship per second)
        this.processWaveSpawnQueue(now);

        // 1. Pitch & Yaw Steering Controls (Virtual Touch Stick on mobile, Mouse + WASD/Arrows on desktop)
        let targetYaw = 0;
        let targetPitch = 0;

        if (this.touchStick && this.touchStick.active) {
          if (Math.abs(this.touchStick.nx) > 0.08) targetYaw += this.touchStick.nx * 1.65;
          if (Math.abs(this.touchStick.ny) > 0.08) targetPitch -= this.touchStick.ny * 1.55;
        } else if (!this.isTouchDevice && !this.useKeyboardSteer) {
          // Mouse flight deadzone near center
          const mxNorm = (this.mouseX - this.width / 2) / (this.width / 2);
          const myNorm = (this.mouseY - this.height / 2) / (this.height / 2);
          if (Math.abs(mxNorm) > 0.08) targetYaw += mxNorm * 1.45;
          if (Math.abs(myNorm) > 0.08) targetPitch -= myNorm * 1.35;
        }

        if (this.keys['KeyA'] || this.keys['ArrowLeft']) targetYaw -= 1.6;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) targetYaw += 1.6;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) targetPitch += 1.5;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) targetPitch -= 1.5;

        // Smooth angular inertia
        p.yawRate += (targetYaw - p.yawRate) * Math.min(1, dt * 8);
        p.pitchRate += (targetPitch - p.pitchRate) * Math.min(1, dt * 8);
        p.rollBank += (-p.yawRate * 0.48 - p.rollBank) * Math.min(1, dt * 7);

        // Rotate ship 3D basis vectors
        if (Math.abs(p.yawRate) > 0.001) {
          p.forward = this.rotateBasis(p.forward, p.up, -p.yawRate * dt);
          p.right = this.vecNorm(this.vecCross(p.forward, p.up));
        }
        if (Math.abs(p.pitchRate) > 0.001) {
          p.forward = this.rotateBasis(p.forward, p.right, p.pitchRate * dt);
          p.up = this.vecNorm(this.vecCross(p.right, p.forward));
        }

        // 2. Constant 3D Combat Cruise Speed (Warp Drive only affects 2D Galaxy travel speed)
        p.speed = 220;
        p.vel.x = p.forward.x * p.speed;
        p.vel.y = p.forward.y * p.speed;
        p.vel.z = p.forward.z * p.speed;

        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.pos.z += p.vel.z * dt;

        // Wrap space dust particles inside a 3000x3000x3000 cube around the player ship
        for (const d of this.spaceDust3D) {
          if (d.x - p.pos.x > 1500) d.x -= 3000;
          else if (d.x - p.pos.x < -1500) d.x += 3000;
          if (d.y - p.pos.y > 1500) d.y -= 3000;
          else if (d.y - p.pos.y < -1500) d.y += 3000;
          if (d.z - p.pos.z > 1500) d.z -= 3000;
          else if (d.z - p.pos.z < -1500) d.z += 3000;
        }

        // 3. Always-On Smart Auto-Shoot (Desktop + Mobile) when any enemy is in front cone (L-Click also fires manually)
        let shouldAutoFire = false;
        if (this.enemies3D.length > 0) {
          for (const e of this.enemies3D) {
            const loc = this.worldToShipLocal(e.pos);
            if (loc.z > 40 && loc.z < 3000 && Math.abs(loc.x / loc.z) < 0.50 && Math.abs(loc.y / loc.z) < 0.50) {
              shouldAutoFire = true;
              break;
            }
          }
        }
        if (this.mouseDown || shouldAutoFire) {
          this.firePlayerLasers();
        }

        // 4. Shield Auto-Regeneration after 2.5s out of enemy fire
        if (now - p.lastHitTime > 2500 && p.shield < p.maxShield) {
          const regenRate = 30 + this.shieldLevel * 14;
          p.shield = Math.min(p.maxShield, p.shield + regenRate * dt);
        }

        // 5. Update 3D Enemy AI
        // Loop: Slow Face-to-Face Approach -> Brief Rear Flyby -> Wide Side Flank Overtake -> Curve Back Face-to-Face!
        for (let i = this.enemies3D.length - 1; i >= 0; i--) {
          const e = this.enemies3D[i];
          const local = this.worldToShipLocal(e.pos); // local.z > 0 is in front of player, local.x is right
          const toPlayer = {
            x: p.pos.x - e.pos.x,
            y: p.pos.y - e.pos.y,
            z: p.pos.z - e.pos.z
          };
          const dist = Math.hypot(toPlayer.x, toPlayer.y, toPlayer.z) || 1;
          const dirToPlayer = { x: toPlayer.x / dist, y: toPlayer.y / dist, z: toPlayer.z / dist };

          let desiredDir = dirToPlayer;
          let targetEnemySpeed = e.speed;

          if (e.aiState === 'attack_pass') {
            // Steady face-to-face approach; once close or behind player, transition to rear flyby & flank turn
            if (dist < 340 || local.z < -60) {
              e.aiState = 'pass_behind';
              e.aiTimer = 0.85;
              // Choose flank side away from current side or alternate for cinematic crossing passes
              if (Math.abs(local.x) > 80) {
                e.flankSide = local.x >= 0 ? 1 : -1;
              } else {
                e.flankSide = -e.flankSide;
              }
              e.flankUp = (Math.random() - 0.5) * 340;
            }
          } else if (e.aiState === 'pass_behind') {
            // Brief fly-past behind player while beginning to bank outward to the flank
            e.aiTimer -= dt;
            const bankTarget = {
              x: p.pos.x - p.forward.x * 450 + p.right.x * (e.flankSide * 620) + p.up.x * e.flankUp,
              y: p.pos.y - p.forward.y * 450 + p.right.y * (e.flankSide * 620) + p.up.y * e.flankUp,
              z: p.pos.z - p.forward.z * 450 + p.right.z * (e.flankSide * 620) + p.up.z * e.flankUp
            };
            desiredDir = this.vecNorm({
              x: bankTarget.x - e.pos.x,
              y: bankTarget.y - e.pos.y,
              z: bankTarget.z - e.pos.z
            });
            targetEnemySpeed = Math.max(e.speed * 1.4, p.speed * 0.9);
            if (e.aiTimer <= 0) {
              e.aiState = 'flank_return';
              e.aiTimer = 5.0;
            }
          } else if (e.aiState === 'flank_return') {
            // Turn around behind player and boost wide along the side to overtake into front hemisphere
            e.aiTimer -= dt;
            const flankWaypoint = {
              x: p.pos.x + p.forward.x * 1150 + p.right.x * (e.flankSide * 920) + p.up.x * e.flankUp,
              y: p.pos.y + p.forward.y * 1150 + p.right.y * (e.flankSide * 920) + p.up.y * e.flankUp,
              z: p.pos.z + p.forward.z * 1150 + p.right.z * (e.flankSide * 920) + p.up.z * e.flankUp
            };
            desiredDir = this.vecNorm({
              x: flankWaypoint.x - e.pos.x,
              y: flankWaypoint.y - e.pos.y,
              z: flankWaypoint.z - e.pos.z
            });
            // Boost faster than player so enemies never get stuck behind you
            targetEnemySpeed = Math.max(e.speed * 2.2, p.speed + 280);
            if (local.z > 650 || e.aiTimer <= 0) {
              e.aiState = 'reengage_front';
              e.aiTimer = 4.5;
            }
          } else if (e.aiState === 'reengage_front') {
            // Sweep back ahead of the player to set up a fresh face-to-face attack run
            e.aiTimer -= dt;
            const frontWaypoint = {
              x: p.pos.x + p.forward.x * e.reengageDist + p.right.x * (e.flankSide * 300) + p.up.x * (e.flankUp * 0.6),
              y: p.pos.y + p.forward.y * e.reengageDist + p.right.y * (e.flankSide * 300) + p.up.y * (e.flankUp * 0.6),
              z: p.pos.z + p.forward.z * e.reengageDist + p.right.z * (e.flankSide * 300) + p.up.z * (e.flankUp * 0.6)
            };
            desiredDir = this.vecNorm({
              x: frontWaypoint.x - e.pos.x,
              y: frontWaypoint.y - e.pos.y,
              z: frontWaypoint.z - e.pos.z
            });
            targetEnemySpeed = Math.max(e.speed * 1.9, p.speed + 230);
            if (local.z > 1850 || e.aiTimer <= 0) {
              e.aiState = 'attack_pass';
            }
          }

          const curDir = this.vecNorm(e.vel.x || e.vel.y || e.vel.z ? e.vel : desiredDir);
          const turnRate = e.aiState === 'attack_pass' ? (e.isBoss ? 1.5 : 2.2) : (e.isBoss ? 2.4 : 3.6);
          const newDir = this.vecNorm({
            x: curDir.x + (desiredDir.x - curDir.x) * Math.min(1, dt * turnRate),
            y: curDir.y + (desiredDir.y - curDir.y) * Math.min(1, dt * turnRate),
            z: curDir.z + (desiredDir.z - curDir.z) * Math.min(1, dt * turnRate)
          });

          e.curSpeed = (e.curSpeed || e.speed) + (targetEnemySpeed - (e.curSpeed || e.speed)) * Math.min(1, dt * 3.5);
          e.vel.x = newDir.x * e.curSpeed;
          e.vel.y = newDir.y * e.curSpeed;
          e.vel.z = newDir.z * e.curSpeed;

          e.pos.x += e.vel.x * dt;
          e.pos.y += e.vel.y * dt;
          e.pos.z += e.vel.z * dt;

          // Enemy Firing Plasma Bolts toward player (only when attacking from the front hemisphere)
          if (e.aiState === 'attack_pass' && local.z > 200 && dist < 2400 && now - e.lastShot > (e.isBoss ? 900 : 1550)) {
            e.lastShot = now;
            const boltSpeed = 860;
            this.lasers3D.push({
              isPlayer: false,
              pos: { x: e.pos.x, y: e.pos.y, z: e.pos.z },
              vel: {
                x: dirToPlayer.x * boltSpeed,
                y: dirToPlayer.y * boltSpeed,
                z: dirToPlayer.z * boltSpeed
              },
              dmg: e.dmg,
              color: e.isBoss ? '#c084fc' : '#ff0055',
              life: 2.6
            });
          }
        }

        // 6. Update 3D Lasers & Hit Detection
        for (let i = this.lasers3D.length - 1; i >= 0; i--) {
          const l = this.lasers3D[i];
          l.pos.x += l.vel.x * dt;
          l.pos.y += l.vel.y * dt;
          l.pos.z += l.vel.z * dt;
          l.life -= dt;

          if (l.life <= 0) {
            this.lasers3D.splice(i, 1);
            continue;
          }

          if (l.isPlayer) {
            // Check collision against 3D enemies
            let hit = false;
            for (let j = this.enemies3D.length - 1; j >= 0; j--) {
              const e = this.enemies3D[j];
              const d = Math.hypot(l.pos.x - e.pos.x, l.pos.y - e.pos.y, l.pos.z - e.pos.z);
              if (d <= e.radius + 18) {
                e.hp -= l.dmg;
                hit = true;
                this.spawn3DExplosion(l.pos, l.color, 6);
                if (e.hp <= 0) {
                  const killXp = (e.isBoss ? 50 : (e.color === '#f59e0b' ? 15 : 10)) * this.activeSystem.level;
                  this.awardCombatXp(killXp, true);
                  this.spawn3DExplosion(e.pos, e.color, e.isBoss ? 45 : 22);
                  this.enemies3D.splice(j, 1);
                  this.checkWaveProgression();
                }
                break;
              }
            }
            if (hit) this.lasers3D.splice(i, 1);
          } else {
            // Check collision against Player Ship
            const dPlayer = Math.hypot(l.pos.x - p.pos.x, l.pos.y - p.pos.y, l.pos.z - p.pos.z);
            if (dPlayer <= 42) {
              p.lastHitTime = now;
              if (p.shield >= l.dmg) {
                p.shield -= l.dmg;
              } else {
                const rem = l.dmg - p.shield;
                p.shield = 0;
                p.hull = Math.max(0, p.hull - rem);
              }
              this.lasers3D.splice(i, 1);
              if (p.hull <= 0) {
                this.end3DMission(false);
                return;
              }
            }
          }
        }

        // 6b. Update Auto-Lock Homing Missiles
        for (let i = this.missiles3D.length - 1; i >= 0; i--) {
          const m = this.missiles3D[i];
          m.life -= dt;
          if (m.life <= 0) {
            this.missiles3D.splice(i, 1);
            continue;
          }

          // Track locked target (re-acquire nearest alive enemy if original target died mid-flight)
          let target = this.enemies3D.find(e => e.id === m.targetId);
          if (!target && this.enemies3D.length > 0) {
            target = this.enemies3D[0];
            m.targetId = target.id;
          }

          if (target) {
            const toT = {
              x: target.pos.x - m.pos.x,
              y: target.pos.y - m.pos.y,
              z: target.pos.z - m.pos.z
            };
            const distToT = Math.hypot(toT.x, toT.y, toT.z) || 1;
            const desiredDir = { x: toT.x / distToT, y: toT.y / distToT, z: toT.z / distToT };
            const curDir = this.vecNorm(m.vel);
            const steer = Math.min(1, dt * 8.5);
            const newDir = this.vecNorm({
              x: curDir.x + (desiredDir.x - curDir.x) * steer,
              y: curDir.y + (desiredDir.y - curDir.y) * steer,
              z: curDir.z + (desiredDir.z - curDir.z) * steer
            });
            m.vel.x = newDir.x * m.speed;
            m.vel.y = newDir.y * m.speed;
            m.vel.z = newDir.z * m.speed;
          }

          m.trail.push({ x: m.pos.x, y: m.pos.y, z: m.pos.z });
          if (m.trail.length > 22) m.trail.shift();

          m.pos.x += m.vel.x * dt;
          m.pos.y += m.vel.y * dt;
          m.pos.z += m.vel.z * dt;

          // Check Impact
          let detonated = false;
          for (let j = this.enemies3D.length - 1; j >= 0; j--) {
            const e = this.enemies3D[j];
            const d = Math.hypot(m.pos.x - e.pos.x, m.pos.y - e.pos.y, m.pos.z - e.pos.z);
            if (d <= e.radius + 38) {
              e.hp -= m.dmg;
              detonated = true;
              const killed = e.hp <= 0;
              this.spawn3DExplosion(e.pos, '#ffd700', 28);
              this.spawn3DExplosion(e.pos, e.color, killed ? (e.isBoss ? 55 : 32) : 14);
              this.missileCamImpact = {
                time: now,
                targetName: e.name,
                killed,
                dmg: m.dmg
              };
              if (killed) {
                const killXp = (e.isBoss ? 50 : (e.color === '#f59e0b' ? 15 : 10)) * this.activeSystem.level;
                this.awardCombatXp(killXp, true);
                this.enemies3D.splice(j, 1);
                this.checkWaveProgression();
              }
              break;
            }
          }
          if (detonated) {
            this.missiles3D.splice(i, 1);
          }
        }

        // 7. Update 3D Particle Explosions
        for (let i = this.explosions3D.length - 1; i >= 0; i--) {
          const ex = this.explosions3D[i];
          ex.pos.x += ex.vel.x * dt;
          ex.pos.y += ex.vel.y * dt;
          ex.pos.z += ex.vel.z * dt;
          ex.life -= dt * 1.4;
          if (ex.life <= 0) this.explosions3D.splice(i, 1);
        }

        this.update3DHUD();
      }

      spawn3DExplosion(pos, color, count = 18) {
        for (let i = 0; i < count; i++) {
          this.explosions3D.push({
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: {
              x: (Math.random() - 0.5) * 420,
              y: (Math.random() - 0.5) * 420,
              z: (Math.random() - 0.5) * 420
            },
            color,
            life: 1.0
          });
        }
      }

      checkWaveProgression() {
        if (this.enemies3D.length > 0 || (this.waveSpawnQueue && this.waveSpawnQueue.length > 0)) return;
        if (this.combatWave < this.combatMaxWaves) {
          const nextWave = this.combatWave + 1;
          this.showToast(nextWave === 3 ? '🚨 WARNING: SOLAR SYSTEM COMMAND BOSS WARPING IN!' : `⚡ Wave ${this.combatWave} Cleared! Enemy Reinforcements Jumping In!`);
          this.spawnCombatWave(nextWave);
        } else {
          this.end3DMission(true);
        }
      }

      end3DMission(victory) {
        this.combatEnded = true;
        const sys = this.activeSystem;
        const modal = document.getElementById('mission-modal');
        modal.style.display = 'flex';

        if (victory) {
          const alreadyCleared = this.clearedSystems.has(sys.id);
          this.clearedSystems.add(sys.id);
          document.getElementById('modal-icon').innerText = sys.id === 50 ? '👑' : '🏆';
          document.getElementById('modal-title').innerText = alreadyCleared
            ? `SYSTEM #${sys.id} REPLAY CLEARED!`
            : (sys.id === 50 ? 'SYSTEM #50 CONQUERED!' : `SYSTEM #${sys.id} CLEARED!`);
          document.getElementById('modal-title').style.color = '#00ff88';
          document.getElementById('modal-desc').innerText = alreadyCleared
            ? `Great flying in ${sys.name} (Lvl ${sys.level})! You already claimed this system's one-time first-clear reward.`
            : `You destroyed all hostile squadrons and the Command Boss in ${sys.name} (Lvl ${sys.level})!`;
          document.getElementById('modal-loot').innerHTML = alreadyCleared
            ? '✅ First-Clear Reward Already Claimed (Replay Mode — 0 PGT)'
            : (sys.hasNft
              ? `💰 +${sys.rewardPgt} PGT Grand Prize (First-Clear)<br/>👑 +1 EXCLUSIVE SINGULARITY CONQUEROR NFT!`
              : `💰 +${sys.rewardPgt} PGT • 🪨 +${sys.level * 40} Iron • 💎 +${sys.level * 15} Titanium (First-Clear)`);
        } else {
          document.getElementById('modal-icon').innerText = '💥';
          document.getElementById('modal-title').innerText = 'SHIP DESTROYED!';
          document.getElementById('modal-title').style.color = '#ff0055';
          document.getElementById('modal-desc').innerText =
            `System #${sys.id} (Lvl ${sys.level}) firepower overwhelmed your shields! Use the top sliders to upgrade your Shield & Turrets closer to Level ${sys.level} and try again.`;
          document.getElementById('modal-loot').innerText = '⚠️ 0 PGT — Upgrade Quantum Shield & Plasma Turrets to survive!';
        }
      }

      update3DHUD() {
        const p = this.player3D;
        const sys = this.activeSystem;
        if (!p || !sys) return;

        document.getElementById('hud3d-system-name').innerText = `System #${sys.id} • ${sys.name} (Lvl ${sys.level})`;
        document.getElementById('hud3d-wave').innerText =
          this.combatWave === 3 ? 'Wave 3 / 3 • 👑 COMMAND BOSS' : `Wave ${this.combatWave} / 3 • Fighter Squadron`;
        const remHostiles = this.enemies3D.length + (this.waveSpawnQueue ? this.waveSpawnQueue.length : 0);
        document.getElementById('hud3d-enemies').innerText = `${remHostiles} Hostile${remHostiles === 1 ? '' : 's'}`;

        const elapsedSec = Math.floor((performance.now() - this.missionStartTime) / 1000);
        const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const secs = String(elapsedSec % 60).padStart(2, '0');
        document.getElementById('hud3d-timer').innerText = `${mins}:${secs}`;

        const sPct = Math.max(0, Math.min(100, (p.shield / p.maxShield) * 100));
        const hPct = Math.max(0, Math.min(100, (p.hull / p.maxHull) * 100));
        document.getElementById('hud3d-shield-txt').innerText = `${Math.round(p.shield).toLocaleString()} / ${p.maxShield.toLocaleString()}`;
        document.getElementById('hud3d-shield-bar').style.width = `${sPct}%`;
        document.getElementById('hud3d-hull-txt').innerText = `${Math.round(p.hull).toLocaleString()} / ${p.maxHull.toLocaleString()}`;
        document.getElementById('hud3d-hull-bar').style.width = `${hPct}%`;

        const dmgPerShot = Math.round(18 + Math.pow(this.turretLevel, 1.55) * 1.45);
        document.getElementById('hud3d-weapon-name').innerText =
          this.turretLevel >= 25 ? '☄️ QUAD SINGULARITY TURRETS' : '☄️ TWIN PLASMA TURRETS';
        document.getElementById('hud3d-dps-txt').innerText = `${dmgPerShot} DMG/shot`;

        // Homing Missile Cooldown Indicator
        const now = performance.now();
        const elapsed = this.lastMissileTime > 0 ? (now - this.lastMissileTime) : this.missileCooldownMs;
        const pct = Math.max(0, Math.min(100, (elapsed / this.missileCooldownMs) * 100));
        const ready = pct >= 100;
        const mTxt = document.getElementById('hud3d-missile-txt');
        const mBar = document.getElementById('hud3d-missile-bar');
        const mBtn = document.getElementById('btn-fire-missile');
        if (mTxt && mBar) {
          mTxt.innerText = ready ? 'READY' : `${((this.missileCooldownMs - elapsed) / 1000).toFixed(1)}s`;
          mTxt.style.color = ready ? '#00ff88' : '#ffd700';
          mBar.style.width = `${pct}%`;
          mBar.style.background = ready
            ? 'linear-gradient(90deg, #059669, #00ff88)'
            : 'linear-gradient(90deg, #b45309, #ffd700)';
        }
        if (mBtn) {
          mBtn.disabled = !ready || this.enemies3D.length === 0;
          mBtn.style.opacity = ready ? '1' : '0.45';
        }
        const mobMLbl = document.getElementById('mobile-missile-lbl');
        const mobMBtn = document.getElementById('btn-mobile-missile');
        if (mobMLbl) {
          mobMLbl.innerText = ready ? 'READY' : `${((this.missileCooldownMs - elapsed) / 1000).toFixed(1)}s`;
          mobMLbl.style.color = ready ? '#00ff88' : '#ffd700';
        }
        if (mobMBtn) {
          mobMBtn.style.opacity = ready ? '1' : '0.48';
        }
      }

      // --------------------------------------------------------------------------
      // 5. 3D PERSPECTIVE RENDERER + 360° SPHERICAL MINI-RADAR SCOPE
      // --------------------------------------------------------------------------
      renderCombat3D() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const cx = w / 2;
        const cy = h / 2;
        const fov = 560; // 3D Perspective Focal Length

        // Deep Space Backdrop
        ctx.fillStyle = '#02050d';
        ctx.fillRect(0, 0, w, h);

        // 1. Render 3D Space Dust Streaks (gives true 6-DOF speed & turning sensation)
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 1.3;
        for (const d of this.spaceDust3D) {
          const loc = this.worldToShipLocal(d);
          if (loc.z > 20 && loc.z < 1500) {
            const scale = fov / loc.z;
            const sx = cx + loc.x * scale;
            const sy = cy - loc.y * scale;
            const prevScale = fov / (loc.z + 35);
            const px = cx + loc.x * prevScale;
            const py = cy - loc.y * prevScale;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(px, py);
            ctx.stroke();
          }
        }

        // 2. Render 3D Lasers
        for (const l of this.lasers3D) {
          const loc = this.worldToShipLocal(l.pos);
          if (loc.z > 15) {
            const scale = fov / loc.z;
            const sx = cx + loc.x * scale;
            const sy = cy - loc.y * scale;
            const tailWorld = {
              x: l.pos.x - l.vel.x * 0.035,
              y: l.pos.y - l.vel.y * 0.035,
              z: l.pos.z - l.vel.z * 0.035
            };
            const tailLoc = this.worldToShipLocal(tailWorld);
            if (tailLoc.z > 15) {
              const tScale = fov / tailLoc.z;
              ctx.strokeStyle = l.color;
              ctx.lineWidth = Math.max(1.5, Math.min(6, 1800 / loc.z));
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(cx + tailLoc.x * tScale, cy - tailLoc.y * tScale);
              ctx.stroke();
            }
          }
        }

        // 2b. Render Homing Missiles & Glowing Exhaust Ribbons in 3D Space
        for (const m of this.missiles3D) {
          if (m.trail.length > 1) {
            ctx.beginPath();
            let started = false;
            for (const tp of m.trail) {
              const tLoc = this.worldToShipLocal(tp);
              if (tLoc.z > 15) {
                const sc = fov / tLoc.z;
                const tx = cx + tLoc.x * sc;
                const ty = cy - tLoc.y * sc;
                if (!started) { ctx.moveTo(tx, ty); started = true; }
                else ctx.lineTo(tx, ty);
              }
            }
            if (started) {
              ctx.strokeStyle = 'rgba(255, 215, 0, 0.72)';
              ctx.lineWidth = 3;
              ctx.stroke();
            }
          }
          const mLoc = this.worldToShipLocal(m.pos);
          if (mLoc.z > 15) {
            const sc = fov / mLoc.z;
            const mx = cx + mLoc.x * sc;
            const my = cy - mLoc.y * sc;
            const mr = Math.max(3.5, 16 * sc);
            const mg = ctx.createRadialGradient(mx, my, 1, mx, my, mr * 2.2);
            mg.addColorStop(0, '#ffffff');
            mg.addColorStop(0.4, '#ffd700');
            mg.addColorStop(1, 'rgba(255, 0, 85, 0)');
            ctx.fillStyle = mg;
            ctx.beginPath();
            ctx.arc(mx, my, mr * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 3. Sort & Render 3D Enemy Starfighters + Off-Screen Directional Arrows
        const nowMs = performance.now();
        const lockTarget = this.getMissileLockTarget();
        const missileReady = this.lastMissileTime === 0 || (nowMs - this.lastMissileTime >= this.missileCooldownMs);
        const sortedEnemies = this.enemies3D.map(e => ({
          enemy: e,
          local: this.worldToShipLocal(e.pos)
        })).sort((a, b) => b.local.z - a.local.z);

        for (const item of sortedEnemies) {
          const e = item.enemy;
          const loc = item.local;
          const dist = Math.hypot(loc.x, loc.y, loc.z);

          if (loc.z > 30) {
            const scale = fov / loc.z;
            const sx = cx + loc.x * scale;
            const sy = cy - loc.y * scale;
            const projRadius = Math.max(8, e.radius * scale);

            // Check if visible inside viewport
            if (sx > -90 && sx < w + 90 && sy > -90 && sy < h + 90) {
              // True 3D Projected Faceted Polyhedron Enemy Starship (oriented along its real 3D velocity!)
              this.renderEnemyMesh3D(ctx, e, (pt) => this.worldToShipLocal(pt), fov, cx, cy, nowMs);

              ctx.save();
              ctx.translate(sx, sy);

              // Tactical Target Lock Bracket & HP Bar
              const bSize = Math.max(16, projRadius + 10);
              const isLocked = lockTarget && lockTarget.id === e.id;
              ctx.strokeStyle = isLocked && missileReady ? '#ffd700' : 'rgba(0, 240, 255, 0.55)';
              ctx.lineWidth = isLocked && missileReady ? 1.8 : 1.1;
              // Corner brackets instead of plain box
              const corner = Math.max(5, bSize * 0.32);
              ctx.beginPath();
              ctx.moveTo(-bSize, -bSize + corner); ctx.lineTo(-bSize, -bSize); ctx.lineTo(-bSize + corner, -bSize);
              ctx.moveTo(bSize - corner, -bSize); ctx.lineTo(bSize, -bSize); ctx.lineTo(bSize, -bSize + corner);
              ctx.moveTo(bSize, bSize - corner); ctx.lineTo(bSize, bSize); ctx.lineTo(bSize - corner, bSize);
              ctx.moveTo(-bSize + corner, bSize); ctx.lineTo(-bSize, bSize); ctx.lineTo(-bSize, bSize - corner);
              ctx.stroke();

              // Pulsing Gold Auto-Lock Diamond when Missile is Ready
              if (isLocked && missileReady) {
                const lockPulse = 1 + 0.1 * Math.sin(nowMs / 130);
                const dR = (bSize + 6) * lockPulse;
                ctx.save();
                ctx.rotate(Math.PI / 4);
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
                ctx.lineWidth = 1.4;
                ctx.strokeRect(-dR * 0.7, -dR * 0.7, dR * 1.4, dR * 1.4);
                ctx.restore();

                ctx.fillStyle = '#ffd700';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('🎯 MISSILE LOCK [SPACE]', 0, -bSize - 17);
              }

              // HP Bar above enemy
              const hpW = Math.max(36, bSize * 1.8);
              const hpPct = Math.max(0, e.hp / e.maxHp);
              ctx.fillStyle = 'rgba(0,0,0,0.75)';
              ctx.fillRect(-hpW / 2, -bSize - 11, hpW, 5);
              ctx.fillStyle = e.isBoss ? '#c084fc' : '#00ff88';
              ctx.fillRect(-hpW / 2, -bSize - 11, hpW * hpPct, 5);

              // Name & Distance Readout
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(`${e.name} [${Math.round(dist)}m]`, 0, bSize + 13);

              ctx.restore();
              continue;
            }
          }

          // Off-Screen Enemy Indicator Arrow around circular HUD perimeter
          const dirAngle = Math.atan2(-loc.y, loc.x);
          const indicatorR = Math.min(w, h) * 0.36;
          const ix = cx + Math.cos(dirAngle) * indicatorR;
          const iy = cy + Math.sin(dirAngle) * indicatorR;

          ctx.save();
          ctx.translate(ix, iy);
          ctx.rotate(dirAngle);
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(-8, -7);
          ctx.lineTo(-8, 7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // 4. Render 3D Explosions
        for (const ex of this.explosions3D) {
          const loc = this.worldToShipLocal(ex.pos);
          if (loc.z > 15) {
            const scale = fov / loc.z;
            const sx = cx + loc.x * scale;
            const sy = cy - loc.y * scale;
            ctx.fillStyle = ex.color;
            ctx.globalAlpha = Math.max(0, ex.life);
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(2, 16 * scale), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1.0;

        // 5. Render Player 3D Starfighter in Foreground (Third-Person Banking View)
        this.renderPlayer3DShip(cx, h - 135);

        // 6. Render Center Aiming Crosshair & Mouse Vector Guide
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.stroke();

        if (!this.isTouchDevice && !this.useKeyboardSteer) {
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(this.mouseX, this.mouseY, 12, 0, Math.PI * 2);
          ctx.moveTo(this.mouseX - 18, this.mouseY);
          ctx.lineTo(this.mouseX + 18, this.mouseY);
          ctx.moveTo(this.mouseX, this.mouseY - 18);
          ctx.lineTo(this.mouseX, this.mouseY + 18);
          ctx.stroke();
        }

        // 7. Render 360° 3D Tactical Combat Mini-Radar Scope (Bottom-Center)
        this.render3DCombatMiniRadar(cx, h - 82);

        // 8. Render Picture-in-Picture Missile-Cam Viewport (Top-Right when missile active or just impacted)
        this.renderMissileCamPiP(w, h, nowMs);

        // 9. Render Floating Virtual Flight Stick on Mobile Touch
        if (this.touchStick && this.touchStick.active) {
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
          ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(this.touchStick.originX, this.touchStick.originY, 62, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = 'rgba(0, 240, 255, 0.72)';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(this.touchStick.curX, this.touchStick.curY, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // True 3D Projected Faceted Polyhedron Enemy Starships (Oriented Along Real 3D Flight Vector)
      renderEnemyMesh3D(ctx, e, toCamLocal, fov, cx, cy, nowMs) {
        // Build enemy's local 3D orientation basis (eFwd along its velocity)
        const eFwd = this.vecNorm(e.vel.x || e.vel.y || e.vel.z ? e.vel : { x: 0, y: 0, z: -1 });
        const refUp = Math.abs(eFwd.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
        const eRight = this.vecNorm(this.vecCross(eFwd, refUp));
        const eUp = this.vecNorm(this.vecCross(eRight, eFwd));

        const s = e.radius;
        const toWorld = (lx, ly, lz) => ({
          x: e.pos.x + eRight.x * lx * s + eUp.x * ly * s + eFwd.x * lz * s,
          y: e.pos.y + eRight.y * lx * s + eUp.y * ly * s + eFwd.y * lz * s,
          z: e.pos.z + eRight.z * lx * s + eUp.z * ly * s + eFwd.z * lz * s
        });

        let verts = [];
        let faces = []; // [i0, i1, i2, fillColor, strokeColor]

        if (e.isBoss) {
          // WAVE 3: Massive 3D Faceted Dreadnought Cruiser
          verts = [
            [0, 0, 1.35],       // 0: bow nose
            [0.65, 0.25, 0.35], // 1: front-right upper
            [-0.65, 0.25, 0.35],// 2: front-left upper
            [0.65, -0.25, 0.35],// 3: front-right lower
            [-0.65, -0.25, 0.35],// 4: front-left lower
            [1.35, 0, -0.25],   // 5: starboard sponson wing
            [-1.35, 0, -0.25],  // 6: port sponson wing
            [0, 0.48, -0.25],   // 7: upper bridge spire
            [0, -0.42, -0.25],  // 8: lower keel
            [0.55, 0.2, -1.15], // 9: stern right upper
            [-0.55, 0.2, -1.15],// 10: stern left upper
            [0.55, -0.2, -1.15],// 11: stern right lower
            [-0.55, -0.2, -1.15]// 12: stern left lower
          ];
          faces = [
            [0, 1, 2, '#3b2066', '#c084fc'],
            [0, 4, 3, '#1e1b4b', '#a855f7'],
            [0, 3, 1, '#2e1065', '#c084fc'],
            [0, 2, 4, '#2e1065', '#c084fc'],
            [1, 7, 2, '#4c1d95', '#e879f9'],
            [3, 4, 8, '#17153b', '#a855f7'],
            [1, 5, 7, '#312e81', '#c084fc'],
            [1, 3, 5, '#1e1b4b', '#a855f7'],
            [2, 7, 6, '#312e81', '#c084fc'],
            [2, 6, 4, '#1e1b4b', '#a855f7'],
            [7, 5, 9, '#2e1065', '#c084fc'],
            [7, 10, 6, '#2e1065', '#c084fc'],
            [7, 9, 10, '#4c1d95', '#ffd700'],
            [8, 11, 5, '#0f172a', '#a855f7'],
            [8, 6, 12, '#0f172a', '#a855f7'],
            [9, 11, 12, '#ffd700', '#c084fc'], // Glowing stern reactor
            [9, 12, 10, '#e879f9', '#c084fc']
          ];
        } else if (e.color === '#f59e0b') {
          // WAVE 2: Heavy 3D Twin-Boom Armored Gunship
          verts = [
            [0, 0, 1.25],       // 0: nose
            [0.42, 0.24, 0.2],  // 1: cockpit right
            [-0.42, 0.24, 0.2], // 2: cockpit left
            [0, -0.26, 0.15],   // 3: belly
            [1.25, 0.08, -0.35],// 4: right wingtip
            [-1.25, 0.08, -0.35],// 5: left wingtip
            [0.65, 0.16, 0.85], // 6: right forward boom
            [-0.65, 0.16, 0.85],// 7: left forward boom
            [0.45, 0.12, -1.05],// 8: right engine rear
            [-0.45, 0.12, -1.05],// 9: left engine rear
            [0, 0.42, -0.55]    // 10: dorsal ridge
          ];
          faces = [
            [0, 1, 2, '#78350f', '#fbbf24'],
            [0, 3, 1, '#451a03', '#f59e0b'],
            [0, 2, 3, '#451a03', '#f59e0b'],
            [1, 10, 2, '#92400e', '#fde047'],
            [1, 6, 4, '#292524', '#f59e0b'],
            [1, 4, 8, '#1c1917', '#f59e0b'],
            [2, 5, 7, '#292524', '#f59e0b'],
            [2, 9, 5, '#1c1917', '#f59e0b'],
            [10, 8, 9, '#451a03', '#fbbf24'],
            [3, 9, 8, '#0f172a', '#f59e0b'],
            [10, 1, 8, '#334155', '#f59e0b'],
            [10, 9, 2, '#334155', '#f59e0b']
          ];
        } else {
          // WAVE 1: Sleek 3D Crimson Predator Interceptor
          verts = [
            [0, 0, 1.4],        // 0: needle nose
            [0.32, 0.24, 0.1],  // 1: upper canopy right
            [-0.32, 0.24, 0.1], // 2: upper canopy left
            [0, -0.22, 0.05],   // 3: ventral keel
            [1.35, -0.05, -0.65],// 4: starboard swept wingtip
            [-1.35, -0.05, -0.65],// 5: port swept wingtip
            [0, 0.55, -0.85],   // 6: dorsal vertical tail fin
            [0.34, 0.05, -0.95],// 7: right thruster nozzle
            [-0.34, 0.05, -0.95]// 8: left thruster nozzle
          ];
          faces = [
            [0, 1, 2, '#881337', '#ff4d79'], // Glowing crimson canopy roof
            [0, 3, 1, '#4c0519', '#ff0055'],
            [0, 2, 3, '#4c0519', '#ff0055'],
            [1, 4, 7, '#1e293b', '#ff0055'], // Starboard upper wing
            [3, 7, 4, '#0f172a', '#ff0055'], // Starboard lower wing
            [2, 8, 5, '#1e293b', '#ff0055'], // Port upper wing
            [3, 5, 8, '#0f172a', '#ff0055'], // Port lower wing
            [1, 6, 2, '#334155', '#ff4d79'], // Dorsal spine
            [1, 7, 6, '#1e293b', '#ff0055'], // Tail fin right
            [2, 6, 8, '#1e293b', '#ff0055'], // Tail fin left
            [6, 7, 8, '#ff0055', '#fde047'], // Rear twin thruster bay
            [3, 8, 7, '#0f172a', '#ff0055']
          ];
        }

        // Project all 3D vertices into camera space
        const proj = verts.map(([lx, ly, lz]) => {
          const loc = toCamLocal(toWorld(lx, ly, lz));
          if (loc.z <= 12) return null;
          const sc = fov / loc.z;
          return { x: cx + loc.x * sc, y: cy - loc.y * sc, z: loc.z };
        });

        // Painter's algorithm: sort faces back-to-front by average Z depth
        const drawable = [];
        for (const [i0, i1, i2, fill, stroke] of faces) {
          const p0 = proj[i0], p1 = proj[i1], p2 = proj[i2];
          if (!p0 || !p1 || !p2) continue;
          const avgZ = (p0.z + p1.z + p2.z) / 3;
          drawable.push({ p0, p1, p2, avgZ, fill, stroke });
        }
        drawable.sort((a, b) => b.avgZ - a.avgZ);

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineWidth = e.isBoss ? 1.5 : 1.15;
        for (const f of drawable) {
          ctx.fillStyle = f.fill;
          ctx.strokeStyle = f.stroke;
          ctx.beginPath();
          ctx.moveTo(f.p0.x, f.p0.y);
          ctx.lineTo(f.p1.x, f.p1.y);
          ctx.lineTo(f.p2.x, f.p2.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Boss 3D Rotating Energy Halo Ring (projected in true 3D around the ship!)
        if (e.isBoss) {
          const rot = nowMs / 900;
          ctx.strokeStyle = 'rgba(232, 121, 249, 0.78)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          let started = false;
          for (let k = 0; k <= 16; k++) {
            const a = (k / 16) * Math.PI * 2 + rot;
            const loc = toCamLocal(toWorld(Math.cos(a) * 1.45, Math.sin(a) * 0.55, Math.sin(a) * 0.65));
            if (loc.z > 12) {
              const sc = fov / loc.z;
              const rx = cx + loc.x * sc;
              const ry = cy - loc.y * sc;
              if (!started) { ctx.moveTo(rx, ry); started = true; }
              else ctx.lineTo(rx, ry);
            }
          }
          if (started) ctx.stroke();
        }

        // Glowing Rear Engine Exhaust Core (visible especially when enemies bank/flank past you!)
        const engLoc = toCamLocal(toWorld(0, 0, -1.05));
        if (engLoc.z > 12) {
          const sc = fov / engLoc.z;
          const ex = cx + engLoc.x * sc;
          const ey = cy - engLoc.y * sc;
          const er = Math.max(3, (e.isBoss ? 22 : 12) * sc);
          const eg = ctx.createRadialGradient(ex, ey, 1, ex, ey, er);
          eg.addColorStop(0, '#ffffff');
          eg.addColorStop(0.45, e.color);
          eg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = eg;
          ctx.beginPath();
          ctx.arc(ex, ey, er, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // Detailed Multi-Layered 3D Enemy Starships (Shared by Main View & Missile-Cam)
      drawEnemyShip3D(ctx, e, r, nowMs) {
        const pulse = 0.5 + 0.5 * Math.sin(nowMs / 180);

        if (e.isBoss) {
          // WAVE 3: Armored Capital Dreadnought with Rotating Energy Ring & Singularity Core
          const rot = nowMs / 1400;

          // Outer Violet Shield Aura
          const aura = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r * 1.35);
          aura.addColorStop(0, 'rgba(192, 132, 252, 0.25)');
          aura.addColorStop(0.7, 'rgba(168, 85, 247, 0.10)');
          aura.addColorStop(1, 'rgba(168, 85, 247, 0)');
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
          ctx.fill();

          // Rotating Outer Battle Ring
          ctx.save();
          ctx.rotate(rot);
          ctx.strokeStyle = 'rgba(192, 132, 252, 0.75)';
          ctx.lineWidth = Math.max(1.5, r * 0.06);
          ctx.setLineDash([r * 0.35, r * 0.18]);
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.12, r * 0.72, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // Heavy Armored Dreadnought Main Hull
          const hullG = ctx.createLinearGradient(-r, -r * 0.6, r, r * 0.6);
          hullG.addColorStop(0, '#1e1b4b');
          hullG.addColorStop(0.5, '#312e81');
          hullG.addColorStop(1, '#0f172a');
          ctx.fillStyle = hullG;
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = Math.max(1.6, r * 0.05);
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.55);
          ctx.lineTo(r * 0.45, -r * 0.42);
          ctx.lineTo(r * 1.05, -r * 0.08);
          ctx.lineTo(r * 0.85, r * 0.38);
          ctx.lineTo(r * 0.35, r * 0.55);
          ctx.lineTo(-r * 0.35, r * 0.55);
          ctx.lineTo(-r * 0.85, r * 0.38);
          ctx.lineTo(-r * 1.05, -r * 0.08);
          ctx.lineTo(-r * 0.45, -r * 0.42);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Armored Deck Plates & 4 Turret Hardpoints
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-r * 0.72, 0); ctx.lineTo(r * 0.72, 0);
          ctx.moveTo(-r * 0.35, -r * 0.35); ctx.lineTo(-r * 0.35, r * 0.35);
          ctx.moveTo(r * 0.35, -r * 0.35); ctx.lineTo(r * 0.35, r * 0.35);
          ctx.stroke();

          for (const [tx, ty] of [[-0.58, -0.18], [0.58, -0.18], [-0.52, 0.24], [0.52, 0.24]]) {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(r * tx, r * ty, Math.max(2, r * 0.075), 0, Math.PI * 2);
            ctx.fill();
          }

          // Pulsing Singularity Core
          const coreG = ctx.createRadialGradient(0, 0, 1, 0, 0, r * (0.28 + pulse * 0.06));
          coreG.addColorStop(0, '#ffffff');
          coreG.addColorStop(0.45, '#e879f9');
          coreG.addColorStop(1, 'rgba(168, 85, 247, 0)');
          ctx.fillStyle = coreG;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
          ctx.fill();
        } else if (e.color === '#f59e0b') {
          // WAVE 2: Heavy Raider Twin-Boom Armored Gunship
          // Twin Engine Glows
          for (const ex of [-0.52, 0.52]) {
            const eg = ctx.createRadialGradient(r * ex, r * 0.22, 1, r * ex, r * 0.22, r * 0.36);
            eg.addColorStop(0, '#fef08a');
            eg.addColorStop(0.5, 'rgba(245, 158, 11, 0.7)');
            eg.addColorStop(1, 'rgba(245, 158, 11, 0)');
            ctx.fillStyle = eg;
            ctx.beginPath();
            ctx.arc(r * ex, r * 0.22, r * 0.36, 0, Math.PI * 2);
            ctx.fill();
          }

          // Heavy Twin-Boom Armored Wings
          const hullG = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
          hullG.addColorStop(0, '#451a03');
          hullG.addColorStop(0.5, '#1e293b');
          hullG.addColorStop(1, '#0f172a');
          ctx.fillStyle = hullG;
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = Math.max(1.4, r * 0.06);
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.52);
          ctx.lineTo(r * 0.32, -r * 0.28);
          ctx.lineTo(r * 0.55, -r * 0.62);  // Right forward boom
          ctx.lineTo(r * 1.05, -r * 0.12);  // Outer wing
          ctx.lineTo(r * 0.88, r * 0.45);
          ctx.lineTo(r * 0.34, r * 0.28);
          ctx.lineTo(0, r * 0.42);
          ctx.lineTo(-r * 0.34, r * 0.28);
          ctx.lineTo(-r * 0.88, r * 0.45);
          ctx.lineTo(-r * 1.05, -r * 0.12);
          ctx.lineTo(-r * 0.55, -r * 0.62); // Left forward boom
          ctx.lineTo(-r * 0.32, -r * 0.28);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Cockpit Slit & Energy Vents
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.22);
          ctx.lineTo(r * 0.22, -r * 0.02);
          ctx.lineTo(0, r * 0.10);
          ctx.lineTo(-r * 0.22, -r * 0.02);
          ctx.closePath();
          ctx.fill();
        } else {
          // WAVE 1: Crimson Predator Scout Interceptor
          // Glowing Engine Aura Behind Wings
          for (const ex of [-0.36, 0.36]) {
            const eg = ctx.createRadialGradient(r * ex, r * 0.12, 1, r * ex, r * 0.12, r * 0.32);
            eg.addColorStop(0, '#ffffff');
            eg.addColorStop(0.4, '#ff0055');
            eg.addColorStop(1, 'rgba(255, 0, 85, 0)');
            ctx.fillStyle = eg;
            ctx.beginPath();
            ctx.arc(r * ex, r * 0.12, r * 0.32, 0, Math.PI * 2);
            ctx.fill();
          }

          // Swept Predator Wings + Forward Mandibles
          const hullG = ctx.createLinearGradient(0, -r * 0.65, 0, r * 0.55);
          hullG.addColorStop(0, '#3f0a1d');
          hullG.addColorStop(0.45, '#1e293b');
          hullG.addColorStop(1, '#0f172a');
          ctx.fillStyle = hullG;
          ctx.strokeStyle = '#ff0055';
          ctx.lineWidth = Math.max(1.4, r * 0.06);
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.55);          // Nose crest
          ctx.lineTo(r * 0.24, -r * 0.18);
          ctx.lineTo(r * 1.12, -r * 0.38);   // Swept upper blade wing
          ctx.lineTo(r * 0.82, r * 0.12);
          ctx.lineTo(r * 0.98, r * 0.44);    // Lower stabilizer fin
          ctx.lineTo(r * 0.28, r * 0.22);
          ctx.lineTo(0, r * 0.48);           // Ventral keel
          ctx.lineTo(-r * 0.28, r * 0.22);
          ctx.lineTo(-r * 0.98, r * 0.44);
          ctx.lineTo(-r * 0.82, r * 0.12);
          ctx.lineTo(-r * 1.12, -r * 0.38);
          ctx.lineTo(-r * 0.24, -r * 0.18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Neon Wing Ribs
          ctx.strokeStyle = 'rgba(255, 77, 121, 0.85)';
          ctx.lineWidth = Math.max(1, r * 0.04);
          ctx.beginPath();
          ctx.moveTo(r * 0.22, -r * 0.05); ctx.lineTo(r * 0.88, -r * 0.26);
          ctx.moveTo(-r * 0.22, -r * 0.05); ctx.lineTo(-r * 0.88, -r * 0.26);
          ctx.stroke();

          // Menacing Crimson-Gold Cockpit Visor
          ctx.fillStyle = '#ff4d79';
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.26);
          ctx.lineTo(r * 0.19, 0);
          ctx.lineTo(0, r * 0.14);
          ctx.lineTo(-r * 0.19, 0);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(0, -r * 0.04, Math.max(2, r * (0.09 + pulse * 0.02)), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Picture-in-Picture Homing Missile Nose-Camera Viewport
      renderMissileCamPiP(w, h, nowMs) {
        const activeMissile = this.missiles3D && this.missiles3D.length > 0 ? this.missiles3D[this.missiles3D.length - 1] : null;
        const recentImpact = this.missileCamImpact && (nowMs - this.missileCamImpact.time < 1250) ? this.missileCamImpact : null;
        if (!activeMissile && !recentImpact) return;

        const ctx = this.ctx;
        const isSmall = w < 640;
        const pw = isSmall ? 168 : 248;
        const ph = isSmall ? 108 : 152;
        const px = w - pw - (isSmall ? 8 : 16);
        const py = isSmall ? 64 : 74;

        ctx.save();
        // Outer Tactical Frame
        ctx.fillStyle = 'rgba(3, 10, 22, 0.94)';
        ctx.strokeStyle = recentImpact ? '#ff0055' : '#ffd700';
        ctx.lineWidth = 2;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeRect(px, py, pw, ph);

        // Clip inside PiP Viewport
        ctx.beginPath();
        ctx.rect(px + 2, py + 2, pw - 4, ph - 4);
        ctx.clip();

        const cx = px + pw / 2;
        const cy = py + ph / 2;

        if (activeMissile) {
          // Compute Missile 3D Forward/Right/Up Camera Basis
          const mFwd = this.vecNorm(activeMissile.vel);
          const worldUp = Math.abs(mFwd.y) > 0.92 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
          const mRight = this.vecNorm(this.vecCross(mFwd, worldUp));
          const mUp = this.vecNorm(this.vecCross(mRight, mFwd));
          const mFov = 230;

          const toMissileLocal = (pt) => {
            const dx = pt.x - activeMissile.pos.x;
            const dy = pt.y - activeMissile.pos.y;
            const dz = pt.z - activeMissile.pos.z;
            return {
              x: dx * mRight.x + dy * mRight.y + dz * mRight.z,
              y: dx * mUp.x + dy * mUp.y + dz * mUp.z,
              z: dx * mFwd.x + dy * mFwd.y + dz * mFwd.z
            };
          };

          // Subtle night-vision/tactical dark green-blue tint
          ctx.fillStyle = '#031116';
          ctx.fillRect(px, py, pw, ph);

          // Speed streaks in missile cam
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
          ctx.lineWidth = 1;
          for (let i = 0; i < this.spaceDust3D.length; i += 3) {
            const loc = toMissileLocal(this.spaceDust3D[i]);
            if (loc.z > 20 && loc.z < 1400) {
              const sc = mFov / loc.z;
              const sx = cx + loc.x * sc;
              const sy = cy - loc.y * sc;
              const ps = mFov / (loc.z + 70);
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(cx + loc.x * ps, cy - loc.y * ps);
              ctx.stroke();
            }
          }

          // Project & Draw Enemies from Missile Nose Perspective
          let targetDist = null;
          let targetName = 'ACQUIRING...';
          for (const e of this.enemies3D) {
            const loc = toMissileLocal(e.pos);
            if (loc.z > 12) {
              const sc = mFov / loc.z;
              const sx = cx + loc.x * sc;
              const sy = cy - loc.y * sc;
              const pr = Math.max(6, Math.min(72, e.radius * sc));

              this.renderEnemyMesh3D(ctx, e, toMissileLocal, mFov, cx, cy, nowMs);

              if (e.id === activeMissile.targetId) {
                targetDist = Math.round(Math.hypot(loc.x, loc.y, loc.z));
                targetName = e.name;
                // Pulsing Red/Gold Lock Reticle on Target
                ctx.strokeStyle = '#ff0055';
                ctx.lineWidth = 1.4;
                const rr = Math.max(12, pr + 6);
                ctx.strokeRect(sx - rr, sy - rr, rr * 2, rr * 2);
              }
            }
          }

          // Missile Cam Center Crosshair
          ctx.strokeStyle = 'rgba(0, 255, 136, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy);
          ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16);
          ctx.stroke();

          // Top & Bottom Telemetry Overlay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.fillRect(px, py, pw, 20);
          ctx.fillRect(px, py + ph - 20, pw, 20);

          ctx.fillStyle = '#00ff88';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText('● MISSILE CAM • LIVE', px + 8, py + 14);

          ctx.fillStyle = '#ffd700';
          ctx.textAlign = 'right';
          ctx.fillText(targetDist !== null ? `DIST: ${targetDist}m` : 'SEEKING', px + pw - 8, py + 14);

          ctx.fillStyle = '#e2e8f0';
          ctx.textAlign = 'left';
          ctx.fillText(`🎯 ${targetName.slice(0, 26)}`, px + 8, py + ph - 6);
        } else if (recentImpact) {
          // Dramatic Impact / Kill Flash
          const age = (nowMs - recentImpact.time) / 1250;
          ctx.fillStyle = `rgba(255, 80, 20, ${Math.max(0.08, 0.45 * (1 - age))})`;
          ctx.fillRect(px, py, pw, ph);

          ctx.fillStyle = recentImpact.killed ? '#00ff88' : '#ffd700';
          ctx.font = 'bold 15px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(recentImpact.killed ? '💥 TARGET DESTROYED!' : '💥 DIRECT HIT!', cx, cy - 4);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`-${recentImpact.dmg} DMG • ${recentImpact.targetName.slice(0, 22)}`, cx, cy + 16);
        }

        // Subtle CRT Scanlines
        ctx.fillStyle = 'rgba(0, 255, 136, 0.06)';
        for (let sy = py; sy < py + ph; sy += 4) {
          ctx.fillRect(px, sy, pw, 1);
        }

        ctx.restore();
      }

      renderPlayer3DShip(sx, sy) {
        const ctx = this.ctx;
        const p = this.player3D;
        ctx.save();
        ctx.translate(sx, sy - p.pitchRate * 18);
        ctx.rotate(p.rollBank);

        // Swept 3D Starfighter Wings
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(68, 18);
        ctx.lineTo(48, 28);
        ctx.lineTo(16, 14);
        ctx.lineTo(-16, 14);
        ctx.lineTo(-48, 28);
        ctx.lineTo(-68, 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Central Fuselage
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, -38);
        ctx.lineTo(16, 18);
        ctx.lineTo(-16, 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Twin Glowing Afterburner Thruster Cores
        const thrusterRadius = 6 + (p.speed / 160);
        const grad = ctx.createRadialGradient(0, 18, 2, 0, 18, thrusterRadius * 2.2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#00f0ff');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(-11, 18, thrusterRadius * 1.5, 0, Math.PI * 2);
        ctx.arc(11, 18, thrusterRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // 360° 3D Spherical Combat Mini-Radar with Elevation Stems (Front/Rear/Above/Below)
      render3DCombatMiniRadar(rx, ry) {
        const ctx = this.ctx;
        const rad = 64;
        const maxRange = 2200;

        ctx.save();
        ctx.translate(rx, ry);

        // Glass Radar Dome
        ctx.fillStyle = 'rgba(4, 12, 28, 0.88)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner Range Ring & Forward Field-of-View Cone
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.5, 0, Math.PI * 2);
        ctx.moveTo(-rad, 0);
        ctx.lineTo(rad, 0);
        ctx.moveTo(0, -rad);
        ctx.lineTo(0, rad);
        ctx.stroke();

        // Forward Firing Cone Wedge (Top half = In Front of Ship, Bottom half = Behind Ship)
        ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rad, -Math.PI * 0.72, -Math.PI * 0.28);
        ctx.closePath();
        ctx.fill();

        // Center Player Icon
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Plot every 3D Enemy with X (left/right), Z (front/behind), and Y (elevation stem above/below)
        for (const e of this.enemies3D) {
          const loc = this.worldToShipLocal(e.pos);
          const bx = Math.max(-rad + 6, Math.min(rad - 6, (loc.x / maxRange) * rad));
          // On radar: Up (-Y on canvas) is Forward (+Z in ship space); Down (+Y on canvas) is Behind (-Z)
          const bz = Math.max(-rad + 6, Math.min(rad - 6, -(loc.z / maxRange) * rad));
          const elevStem = Math.max(-18, Math.min(18, -(loc.y / 900) * 18));

          // Vertical 3D Elevation Stem
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bx, bz);
          ctx.lineTo(bx, bz + elevStem);
          ctx.stroke();

          // Base plane shadow dot
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(bx - 1, bz - 1, 2, 2);

          // Enemy 3D Blip at tip of elevation stem
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(bx, bz + elevStem, e.isBoss ? 5.5 : 3.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Mini-Radar Labels
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FRONT', 0, -rad - 5);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('3D RADAR (REAR)', 0, rad + 11);

        ctx.restore();
      }

      // --------------------------------------------------------------------------
      // 6. MAIN ANIMATION LOOP
      // --------------------------------------------------------------------------
      loop(now) {
        if (this.paused) {
          this.lastFrameTime = now;
          requestAnimationFrame((t) => this.loop(t));
          return;
        }
        const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;

        if (this.mode === 'galaxy') {
          this.updateGalaxy2D(dt);
          if (this._isFullscreen) {
            this.renderGalaxy2D();
          }
        } else {
          this.updateCombat3D(dt);
          this.renderCombat3D();
        }

        requestAnimationFrame((t) => this.loop(t));
      }
    }

  window.PolySpaceGalaxy = {
    instance: null,
    mount(hostEl) {
      if (!window.isPolySpaceGalaxyBetaTester()) return;
      if (!hostEl) hostEl = document.getElementById('space-galaxy-host');
      if (!hostEl) return;

      if (!document.getElementById('psg-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'psg-style';
        styleEl.textContent = PSG_CSS;
        document.head.appendChild(styleEl);
      }

      if (!this.instance) {
        hostEl.innerHTML = '<div id="psg-root">' + PSG_HTML + '</div>';
        this.instance = new Plan023StandaloneDemo();
        this.instance.paused = false;
        this.instance.setFullscreen(false);
      } else {
        this.instance.paused = false;
        this.instance.updateUpgrades();
        if (this.instance.mode === 'galaxy') {
          this.instance.setFullscreen(false);
        }
      }
    },
    renderBackdropOnRadar(ctx, baseX, baseY, zoom) {
      const inst = this.instance;
      if (!inst || inst.paused || inst.mode !== 'galaxy' || inst._isFullscreen) return;
      ctx.save();
      ctx.translate(baseX, baseY);

      // 1. Milky Way Spiral Core Glow
      const coreGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, 3200);
      coreGrad.addColorStop(0, 'rgba(255, 215, 0, 0.16)');
      coreGrad.addColorStop(0.14, 'rgba(168, 85, 247, 0.12)');
      coreGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.05)');
      coreGrad.addColorStop(1, 'rgba(2, 4, 10, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 3200, 0, Math.PI * 2);
      ctx.fill();

      // Concentric Galactic Rings + ±10,000 Sector Perimeter
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.09)';
      ctx.lineWidth = 1 / zoom;
      [280, 1000, 1800, 2600, 3200, 6000, 10000].forEach(r => {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      const B = inst.galaxyBound || 10000;
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
      ctx.lineWidth = 2.2 / zoom;
      ctx.setLineDash([28 / zoom, 18 / zoom]);
      ctx.strokeRect(-B, -B, B * 2, B * 2);
      ctx.setLineDash([]);

      // Spiral & Outer Deep-Space Stars
      for (const st of inst.galaxyStars) {
        ctx.fillStyle = st.color;
        ctx.globalAlpha = st.alpha;
        ctx.fillRect(st.x, st.y, st.size * 1.5, st.size * 1.5);
      }
      ctx.globalAlpha = 1.0;
      ctx.restore();
    },
    renderForegroundOnRadar(ctx, baseX, baseY, zoom) {
      const inst = this.instance;
      if (!inst || inst.paused || inst.mode !== 'galaxy' || inst._isFullscreen) return;
      ctx.save();
      ctx.translate(baseX, baseY);

      // 50 Solar Systems
      for (const sys of inst.solarSystems) {
        const isSelected = inst.selectedSystemId === sys.id;
        const isCleared = inst.clearedSystems.has(sys.id);
        if (isSelected || sys.id === 50 || isCleared) {
          ctx.strokeStyle = isCleared ? '#00ff88' : sys.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sys.x, sys.y, sys.radius + 6 + Math.sin(Date.now() / 250) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = isCleared ? '#00ff88' : sys.color;
        ctx.beginPath();
        ctx.arc(sys.x, sys.y, sys.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(sys.x, sys.y, sys.radius * 1.7, sys.radius * 0.65, 0.3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = sys.id === 50 ? 'bold 13px sans-serif' : 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${sys.id === 50 ? '👑 ' : ''}#${sys.id} ${sys.name} (Lvl ${sys.level})`, sys.x, sys.y + sys.radius + 14);
      }

      // Open Map Resource Trade Beacons
      if (inst.tradeBeacons) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 280);
        const bScale = Math.max(0.85, 1.05 / Math.sqrt(zoom));
        for (const tb of inst.tradeBeacons) {
          ctx.save();
          ctx.translate(tb.x, tb.y);
          ctx.strokeStyle = tb.isMine ? `rgba(0,240,255,${0.4 + pulse * 0.45})` : `rgba(0,255,136,${0.4 + pulse * 0.45})`;
          ctx.lineWidth = 2 / zoom;
          ctx.beginPath();
          ctx.arc(0, 0, (16 + pulse * 6) * bScale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = tb.isMine ? 'rgba(6,30,52,0.92)' : 'rgba(4,34,24,0.92)';
          ctx.strokeStyle = tb.isMine ? '#00f0ff' : '#00ff88';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 13 * bScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.font = `${Math.round(13 * bScale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🤝', 0, 1);
          ctx.restore();
        }
      }

      // Other Live Pilots
      if (inst.otherPilots) {
        const pScale = Math.max(0.75, 1.0 / Math.sqrt(zoom));
        for (const pl of inst.otherPilots) {
          ctx.save();
          ctx.translate(pl.x, pl.y);
          ctx.rotate(pl.angle);
          ctx.scale(pScale, pScale);
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = pl.color;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(13, 0); ctx.lineTo(-4, -10); ctx.lineTo(-9, -7); ctx.lineTo(-6, 0); ctx.lineTo(-9, 7); ctx.lineTo(-4, 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          if (zoom > 0.22) {
            ctx.fillStyle = pl.color;
            ctx.font = `bold ${Math.max(9, Math.round(10 / Math.sqrt(zoom)))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`🛸 ${pl.name}`, pl.x, pl.y - 14 * pScale);
          }
        }
      }

      // Player Waypoint + Real Equipped On-Chain NFT Flagship!
      const s = inst.ship2D;
      if (s.targetX !== null && s.targetY !== null) {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([6 / zoom, 6 / zoom]);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.targetX, s.targetY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      const shipScale = Math.max(0.95, 1.3 / Math.sqrt(zoom));
      ctx.scale(shipScale, shipScale);
      const _psShip = (window.polySpace && typeof window.polySpace.getEquippedStarshipMultiplier === 'function')
        ? window.polySpace.getEquippedStarshipMultiplier() : null;
      if (_psShip && _psShip.ship && _psShip.ship.dna && window.PolyHangar && typeof window.PolyHangar.renderProceduralShip === 'function') {
        window.PolyHangar.renderProceduralShip(ctx, 0, 0, _psShip.ship.dna, 0.34, 0, Date.now() / 300, s.targetX !== null);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, 0); ctx.lineTo(-10, -14); ctx.lineTo(-6, 0); ctx.lineTo(-10, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    },
    handleWorldClick(wx, wy, zoom) {
      const inst = this.instance;
      if (!inst || inst.paused || inst.mode !== 'galaxy') return;
      const oldZoom = inst.camZoom;
      inst.camZoom = zoom || oldZoom;
      // Reuse the exact galaxy click resolution against world coords (wx, wy)
      const B = inst.galaxyBound || 10000;
      for (const g of inst.hiddenGifts) {
        const distToShip = Math.hypot(inst.ship2D.x - g.x, inst.ship2D.y - g.y);
        const distClick = Math.hypot(wx - g.x, wy - g.y);
        if (!g.claimed && distToShip <= 210 && distClick <= 65 / inst.camZoom) {
          g.claimed = true;
          inst.showToast(`🎁 HIDDEN COORDINATE GIFT CLAIMED at (${g.x}, ${g.y}): ${g.reward}!`);
          return;
        }
      }
      if (inst.tradeBeacons) {
        for (const tb of inst.tradeBeacons) {
          if (Math.hypot(wx - tb.x, wy - tb.y) <= Math.max(44, 28 / inst.camZoom)) {
            inst.ship2D.targetX = tb.x;
            inst.ship2D.targetY = tb.y;
            inst.followShip2D = true;
            inst.openInspectTradeBeacon(tb);
            return;
          }
        }
      }
      if (inst.otherPilots) {
        for (const pl of inst.otherPilots) {
          if (Math.hypot(wx - pl.x, wy - pl.y) <= Math.max(42, 26 / inst.camZoom)) {
            inst.ship2D.targetX = Math.round(pl.x);
            inst.ship2D.targetY = Math.round(pl.y);
            inst.followShip2D = true;
            inst.showPilotHailCard(pl);
            return;
          }
        }
      }
      for (const sys of inst.solarSystems) {
        if (Math.hypot(wx - sys.x, wy - sys.y) <= Math.max(38, 22 / inst.camZoom)) {
          inst.ship2D.targetX = sys.x;
          inst.ship2D.targetY = sys.y;
          inst.selectedSystemId = sys.id;
          inst.followShip2D = true;
          inst.showSystemBriefing(sys);
          return;
        }
      }
      inst.ship2D.targetX = Math.max(-B, Math.min(B, Math.round(wx)));
      inst.ship2D.targetY = Math.max(-B, Math.min(B, Math.round(wy)));
      inst.followShip2D = true;
    },
    pause() {
      if (this.instance) {
        this.instance.paused = true;
        if (typeof this.instance.setFullscreen === 'function') {
          this.instance.setFullscreen(false);
        }
      }
    }
  };
})();
