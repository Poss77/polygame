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

  const PSG_CSS = "\n    :root {\n      --bg-dark: #030712;\n      --bg-panel: rgba(8, 15, 32, 0.88);\n      --cyan: #00f0ff;\n      --pink: #ff0055;\n      --purple: #a855f7;\n      --gold: #ffd700;\n      --green: #00ff88;\n      --text: #f8fafc;\n      --muted: #94a3b8;\n    }\n    \n    \n\n    /* Top Control Bar (Sandbox Upgrade Sliders & Mode Switcher) */\n    \n    .brand {\n      display: flex;\n      align-items: center;\n      gap: 10px;\n    }\n    .brand-badge {\n      background: rgba(0, 240, 255, 0.15);\n      border: 1px solid var(--cyan);\n      color: var(--cyan);\n      font-weight: 900;\n      font-size: 0.72rem;\n      padding: 3px 8px;\n      border-radius: 6px;\n      letter-spacing: 0.8px;\n    }\n    .brand-title {\n      font-size: 1rem;\n      font-weight: 900;\n      color: #fff;\n      letter-spacing: 0.5px;\n    }\n\n    /* Sandbox Sliders */\n    .sandbox-controls {\n      display: flex;\n      align-items: center;\n      gap: 14px;\n      background: rgba(0, 0, 0, 0.45);\n      padding: 6px 14px;\n      border-radius: 10px;\n      border: 1px solid rgba(255, 255, 255, 0.1);\n    }\n    .slider-group {\n      display: flex;\n      align-items: center;\n      gap: 6px;\n      font-size: 0.76rem;\n    }\n    .slider-group label {\n      font-weight: 800;\n      white-space: nowrap;\n    }\n    .slider-group input[type=\"range\"] {\n      width: 78px;\n      accent-color: var(--cyan);\n      cursor: pointer;\n    }\n    .lvl-pill {\n      font-family: monospace;\n      font-weight: 900;\n      padding: 2px 6px;\n      border-radius: 4px;\n      background: rgba(255, 255, 255, 0.08);\n      min-width: 44px;\n      text-align: center;\n    }\n\n    .mode-buttons {\n      display: flex;\n      align-items: center;\n      gap: 8px;\n    }\n    #psg-root .btn {\n      background: rgba(0, 240, 255, 0.15);\n      border: 1px solid var(--cyan);\n      color: #fff;\n      font-weight: 800;\n      font-size: 0.78rem;\n      padding: 7px 14px;\n      border-radius: 8px;\n      cursor: pointer;\n      transition: all 0.18s ease;\n      display: inline-flex;\n      align-items: center;\n      gap: 6px;\n    }\n    #psg-root .btn:hover {\n      background: rgba(0, 240, 255, 0.3);\n      box-shadow: 0 0 12px rgba(0, 240, 255, 0.45);\n      transform: translateY(-1px);\n    }\n    .btn.active {\n      background: linear-gradient(135deg, #00f0ff, #0284c7);\n      color: #000;\n      box-shadow: 0 0 15px rgba(0, 240, 255, 0.6);\n    }\n    #psg-root .btn-danger {\n      background: rgba(255, 0, 85, 0.2);\n      border-color: var(--pink);\n      color: #ff94b4;\n    }\n    #psg-root .btn-danger:hover {\n      background: rgba(255, 0, 85, 0.4);\n      box-shadow: 0 0 12px rgba(255, 0, 85, 0.5);\n    }\n    #psg-root .btn-gold {\n      background: linear-gradient(135deg, #ffd700, #f59e0b);\n      border-color: #ffd700;\n      color: #000;\n    }\n\n    /* Main Viewport */\n    #psg-viewport {\n      position: relative;\n      flex: 1;\n      width: 100%;\n      height: 100%;\n      overflow: hidden;\n      background: #02040a;\n    }\n    #psg-viewport canvas {\n      display: block;\n      width: 100%;\n      height: 100%;\n      touch-action: none;\n      -webkit-user-select: none;\n      -webkit-touch-callout: none;\n    }\n\n    /* 2D Galaxy Radar Overlays */\n    #hud-2d {\n      position: absolute;\n      inset: 0;\n      pointer-events: none;\n    }\n    #psg-root .hud-panel {\n      pointer-events: auto;\n      background: var(--bg-panel);\n      border: 1px solid rgba(0, 240, 255, 0.35);\n      border-radius: 10px;\n      padding: 12px 14px;\n      backdrop-filter: blur(8px);\n      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.65);\n    }\n    #nav-telemetry-card {\n      position: absolute;\n      top: 14px;\n      left: 14px;\n      width: 310px;\n    }\n    #system-briefing-card {\n      position: absolute;\n      bottom: 18px;\n      left: 50%;\n      transform: translateX(-50%);\n      min-width: 440px;\n      max-width: 92vw;\n      display: none;\n      border-color: var(--gold);\n      box-shadow: 0 0 25px rgba(255, 215, 0, 0.25);\n    }\n    #galaxy-Quick-Jump {\n      position: absolute;\n      top: 14px;\n      right: 14px;\n      width: 265px;\n    }\n\n    /* 3D Combat Overlays */\n    #hud-3d {\n      position: absolute;\n      inset: 0;\n      pointer-events: none;\n      display: none;\n    }\n    #combat-top-hud {\n      position: absolute;\n      top: 14px;\n      left: 50%;\n      transform: translateX(-50%);\n      display: flex;\n      align-items: center;\n      gap: 18px;\n      background: rgba(4, 10, 24, 0.85);\n      border: 1px solid rgba(0, 240, 255, 0.4);\n      border-radius: 12px;\n      padding: 8px 20px;\n      pointer-events: auto;\n    }\n    #combat-left-hud {\n      position: absolute;\n      bottom: 18px;\n      left: 18px;\n      width: 260px;\n      pointer-events: auto;\n    }\n    #combat-right-hud {\n      position: absolute;\n      bottom: 18px;\n      right: 18px;\n      width: 260px;\n      pointer-events: auto;\n    }\n    #psg-root .bar-wrap {\n      width: 100%;\n      height: 11px;\n      background: rgba(0, 0, 0, 0.65);\n      border-radius: 6px;\n      overflow: hidden;\n      border: 1px solid rgba(255, 255, 255, 0.15);\n      margin-top: 4px;\n      margin-bottom: 10px;\n    }\n    #psg-root .bar-fill {\n      height: 100%;\n      transition: width 0.12s linear;\n    }\n\n    /* Toast Banner */\n    #psg-toast-banner {\n      position: fixed;\n      top: 76px;\n      left: 50%;\n      transform: translateX(-50%);\n      background: rgba(6, 18, 38, 0.95);\n      border: 1px solid var(--cyan);\n      color: #fff;\n      font-weight: 800;\n      font-size: 0.86rem;\n      padding: 10px 20px;\n      border-radius: 8px;\n      z-index: 100;\n      box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);\n      display: none;\n      pointer-events: none;\n    }\n\n    /* End of Mission Modal */\n    #mission-modal {\n      position: absolute;\n      inset: 0;\n      background: rgba(2, 6, 18, 0.84);\n      backdrop-filter: blur(6px);\n      display: none;\n      align-items: center;\n      justify-content: center;\n      z-index: 60;\n      pointer-events: auto;\n    }\n    #psg-root .modal-box {\n      background: linear-gradient(145deg, #091326, #040814);\n      border: 2px solid var(--cyan);\n      border-radius: 14px;\n      padding: 24px 30px;\n      max-width: 460px;\n      width: 90%;\n      text-align: center;\n      box-shadow: 0 0 40px rgba(0, 240, 255, 0.3);\n    }\n\n    /* Pilot Hail Card (2D Map) */\n    #pilot-hail-card {\n      position: absolute;\n      bottom: 16px;\n      left: 50%;\n      transform: translateX(-50%);\n      min-width: 440px;\n      max-width: 600px;\n      display: none;\n      border-color: var(--purple);\n      box-shadow: 0 0 28px rgba(168, 85, 247, 0.35);\n      pointer-events: auto;\n      z-index: 35;\n    }\n\n    /* Tactical Duel & Space Trade Modals */\n    #psg-root .overlay-modal {\n      position: absolute;\n      inset: 0;\n      background: rgba(2, 6, 18, 0.86);\n      backdrop-filter: blur(6px);\n      display: none;\n      align-items: center;\n      justify-content: center;\n      z-index: 70;\n      pointer-events: auto;\n    }\n    #psg-root .duel-box {\n      background: linear-gradient(145deg, #091326, #040814);\n      border: 2px solid var(--pink);\n      border-radius: 14px;\n      padding: 20px 24px;\n      width: 94%;\n      max-width: 620px;\n      box-shadow: 0 0 42px rgba(255, 0, 85, 0.28);\n    }\n    #psg-root .trade-box {\n      background: linear-gradient(145deg, #091326, #040814);\n      border: 2px solid var(--green);\n      border-radius: 14px;\n      padding: 20px 24px;\n      width: 94%;\n      max-width: 540px;\n      box-shadow: 0 0 42px rgba(0, 255, 136, 0.25);\n    }\n    #psg-root .vec-group {\n      display: flex;\n      gap: 5px;\n    }\n    #psg-root .vec-btn {\n      background: rgba(15, 23, 42, 0.9);\n      border: 1px solid rgba(148, 163, 184, 0.35);\n      color: var(--muted);\n      font-size: 0.72rem;\n      font-weight: 800;\n      padding: 5px 9px;\n      border-radius: 6px;\n      cursor: pointer;\n      transition: all 0.12s;\n    }\n    #psg-root .vec-btn.atk-active {\n      background: rgba(255, 0, 85, 0.28);\n      border-color: var(--pink);\n      color: #fff;\n      box-shadow: 0 0 10px rgba(255, 0, 85, 0.45);\n    }\n    #psg-root .vec-btn.def-active {\n      background: rgba(0, 240, 255, 0.25);\n      border-color: var(--cyan);\n      color: #fff;\n      box-shadow: 0 0 10px rgba(0, 240, 255, 0.45);\n    }\n    #duel-#psg-viewport canvas {\n      width: 100%;\n      height: 250px;\n      border-radius: 10px;\n      border: 1px solid rgba(0, 240, 255, 0.35);\n      background: #02050d;\n      display: block;\n    }\n\n    /* Mobile Touch Controls & Responsive HUD */\n    #mobile-3d-controls {\n      display: none;\n      position: absolute;\n      bottom: 16px;\n      right: 14px;\n      gap: 10px;\n      align-items: flex-end;\n      pointer-events: auto;\n      z-index: 30;\n    }\n    .touch-action-btn {\n      width: 68px;\n      height: 68px;\n      border-radius: 50%;\n      border: 2px solid var(--cyan);\n      background: rgba(6, 18, 38, 0.84);\n      color: #fff;\n      font-weight: 900;\n      font-size: 0.72rem;\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n      justify-content: center;\n      gap: 2px;\n      box-shadow: 0 0 18px rgba(0, 240, 255, 0.35);\n      touch-action: none;\n      -webkit-tap-highlight-color: transparent;\n      user-select: none;\n    }\n    .touch-action-btn:active, .touch-action-btn.pressed {\n      transform: scale(0.92);\n      background: rgba(0, 240, 255, 0.35);\n    }\n    .touch-action-btn.fire-btn {\n      width: 78px;\n      height: 78px;\n      border-color: var(--pink);\n      box-shadow: 0 0 20px rgba(255, 0, 85, 0.45);\n    }\n    .touch-action-btn.fire-btn:active, .touch-action-btn.fire-btn.pressed {\n      background: rgba(255, 0, 85, 0.4);\n    }\n    .touch-action-btn.missile-btn {\n      border-color: var(--gold);\n      box-shadow: 0 0 18px rgba(255, 215, 0, 0.38);\n    }\n    .touch-autofire-pill {\n      padding: 5px 10px;\n      border-radius: 999px;\n      border: 1px solid var(--green);\n      background: rgba(0, 255, 136, 0.2);\n      color: #a7f3d0;\n      font-size: 0.68rem;\n      font-weight: 900;\n      touch-action: none;\n    }\n    .touch-autofire-pill.off {\n      border-color: rgba(148, 163, 184, 0.4);\n      background: rgba(15, 23, 42, 0.8);\n      color: var(--muted);\n    }\n    #mobile-zoom-btns {\n      display: none;\n      position: absolute;\n      bottom: 16px;\n      right: 12px;\n      flex-direction: column;\n      gap: 6px;\n      pointer-events: auto;\n      z-index: 25;\n    }\n    #mobile-trade-btn {\n      display: flex;\n      position: absolute;\n      top: 12px;\n      right: 14px;\n      pointer-events: auto;\n      z-index: 25;\n    }\n\n    @media (max-width: 900px), (pointer: coarse) {\n      \n      .brand-title { display: none; }\n      .sandbox-controls {\n        width: 100%;\n        justify-content: space-between;\n        gap: 6px;\n        overflow-x: auto;\n        padding-bottom: 2px;\n      }\n      .slider-group { font-size: 0.68rem; gap: 4px; }\n      .slider-group input[type=\"range\"] { width: 54px; }\n      #psg-viewport { width: 100%; height: 100%; flex: 1; }\n      #nav-telemetry-card {\n        top: 6px;\n        left: 6px;\n        width: auto;\n        padding: 4px 7px;\n        font-size: 0.7rem;\n      }\n      .nav-help-text { display: none !important; }\n      #galaxy-Quick-Jump { display: none !important; }\n      #mobile-trade-btn { display: flex; top: 6px; right: 6px; gap: 4px; }\n      #system-briefing-card, #pilot-hail-card {\n        min-width: 0;\n        width: calc(100% - 12px);\n        max-width: calc(100% - 12px);\n        bottom: 8px;\n        padding: 6px 8px;\n        z-index: 40;\n      }\n      #mobile-zoom-btns { display: flex; bottom: 60px; right: 10px; }\n      #combat-top-hud {\n        top: 6px;\n        width: calc(100% - 16px);\n        padding: 6px 10px;\n        gap: 8px;\n        justify-content: space-between;\n        flex-wrap: nowrap;\n        overflow-x: auto;\n      }\n      #combat-top-hud > div { white-space: nowrap; }\n      #combat-left-hud {\n        bottom: auto;\n        top: 64px;\n        left: 8px;\n        width: 170px;\n        padding: 7px 9px;\n      }\n      #combat-left-hud #psg-root .bar-wrap { height: 8px; margin-bottom: 6px; }\n      #combat-right-hud { display: none; }\n      #mobile-3d-controls { display: flex; }\n      #psg-root .duel-box, #psg-root .trade-box, #psg-root .modal-box {\n        max-height: 92vh;\n        overflow-y: auto;\n        padding: 14px 14px;\n      }\n      #duel-#psg-viewport canvas { height: 195px; }\n    }\n  \n#psg-root { display: flex; flex-direction: column; position: relative; width: 100%; height: 100%; font-family: inherit; color: #f8fafc; overflow: hidden; }\n#psg-root.psg-fullscreen { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; height: 100dvh !important; z-index: 100000010 !important; background: #02040a !important; border-radius: 0 !important; }\n#psg-root.psg-fullscreen #system-briefing-card,\n#psg-root.psg-fullscreen #pilot-hail-card { bottom: max(14px, calc(env(safe-area-inset-bottom, 0px) + 12px)) !important; }\n#psg-root:not(.psg-fullscreen) #nav-telemetry-card { top: 6px; left: 6px; width: auto; padding: 4px 7px; }\n#psg-root:not(.psg-fullscreen) #nav-telemetry-card input { width: 48px !important; }\n#psg-root:not(.psg-fullscreen) #mobile-trade-btn { top: 6px; right: 6px; }\n#psg-root:not(.psg-fullscreen) #mobile-zoom-btns { display: none !important; }\n#psg-root:not(.psg-fullscreen) #system-briefing-card,\n#psg-root:not(.psg-fullscreen) #pilot-hail-card { min-width: 0; width: calc(100% - 12px); bottom: 8px; padding: 6px 8px; z-index: 40; }\n#psg-toast-banner { position: absolute !important; top: 10px !important; left: 50% !important; transform: translateX(-50%) !important; }\n\n/* Teleported Full-Viewport Modals (Rank, Trade, Tactical Duel) */\n#rank-modal, #trade-modal, #tactical-duel-modal {\n  display: none;\n  position: fixed !important;\n  inset: 0 !important;\n  width: 100vw !important;\n  height: 100vh !important;\n  height: 100dvh !important;\n  background: rgba(2, 6, 18, 0.86) !important;\n  backdrop-filter: blur(6px);\n  z-index: 100000020 !important;\n  align-items: center;\n  justify-content: center;\n  color: #f8fafc;\n}\n#rank-modal .trade-box, #trade-modal .trade-box {\n  background: linear-gradient(145deg, #091326, #040814);\n  border: 2px solid #00ff88;\n  border-radius: 14px;\n  padding: 20px 24px;\n  width: 94%;\n  max-width: 560px;\n  max-height: 90vh;\n  overflow-y: auto;\n  box-shadow: 0 0 42px rgba(0, 255, 136, 0.25);\n}\n#rank-modal .trade-box { border-color: #ffd700; box-shadow: 0 0 42px rgba(255, 215, 0, 0.28); }\n#tactical-duel-modal .duel-box {\n  background: linear-gradient(145deg, #091326, #040814);\n  border: 2px solid #ff0055;\n  border-radius: 14px;\n  padding: 20px 24px;\n  width: 94%;\n  max-width: 620px;\n  max-height: 90vh;\n  overflow-y: auto;\n  box-shadow: 0 0 42px rgba(255, 0, 85, 0.28);\n}\n#rank-modal .btn, #trade-modal .btn, #tactical-duel-modal .btn {\n  background: rgba(0, 240, 255, 0.12);\n  border: 1px solid #00f0ff;\n  color: #fff;\n  font-weight: 800;\n  font-size: 0.78rem;\n  padding: 6px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n}\n#rank-modal .btn.active, #trade-modal .btn.active, #tactical-duel-modal .btn.active {\n  background: #00f0ff;\n  color: #000;\n}\n#tactical-duel-modal .btn-danger { background: linear-gradient(135deg, #ff0055, #be123c); border-color: #ff0055; }\n#tactical-duel-modal .btn-gold { background: linear-gradient(135deg, #ffd700, #f59e0b); border-color: #ffd700; color: #000; }\n#tactical-duel-modal .vec-btn {\n  background: rgba(15, 23, 42, 0.9);\n  border: 1px solid rgba(148, 163, 184, 0.35);\n  color: #94a3b8;\n  font-size: 0.72rem;\n  font-weight: 800;\n  padding: 5px 9px;\n  border-radius: 6px;\n  cursor: pointer;\n}\n#tactical-duel-modal .vec-btn.atk-active { background: rgba(255, 0, 85, 0.28); border-color: #ff0055; color: #fff; }\n#tactical-duel-modal .vec-btn.def-active { background: rgba(0, 240, 255, 0.25); border-color: #00f0ff; color: #fff; }\n#tactical-duel-modal .bar-wrap { width: 100%; height: 10px; background: rgba(0,0,0,0.65); border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); margin-top: 4px; }\n#tactical-duel-modal .bar-fill { height: 100%; transition: width 0.12s linear; }\n#psg-chat-panel { position: absolute; top: 48px; right: 12px; width: 245px; height: 255px; padding: 0 !important; display: flex; flex-direction: column; z-index: 28; pointer-events: auto; background: rgba(5, 12, 28, 0.78) !important; border: 1px solid rgba(0, 240, 255, 0.35) !important; border-radius: 8px !important; overflow: hidden; }\n#psg-root:not(.psg-fullscreen) #psg-chat-panel { top: 38px; right: 6px; width: 215px; height: 210px; }\n#psg-chat-panel.collapsed { height: auto !important; width: auto !important; min-width: 140px; }\n#psg-chat-panel.collapsed #psg-chat-messages, #psg-chat-panel.collapsed #psg-chat-input-row { display: none !important; }\n#psg-chat-header { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 5px 8px; background: rgba(0, 240, 255, 0.08); border-bottom: 1px solid rgba(0, 240, 255, 0.22); cursor: pointer; user-select: none; flex-shrink: 0; }\n#psg-chat-messages { flex: 1; overflow-y: auto; padding: 6px 7px; display: flex; flex-direction: column; gap: 4px; font-size: 0.7rem; line-height: 1.32; color: #e2e8f0; scrollbar-width: thin; }\n#psg-chat-input-row { display: flex; align-items: center; gap: 4px; padding: 5px 6px; border-top: 1px solid rgba(255, 255, 255, 0.1); background: rgba(2, 6, 18, 0.75); flex-shrink: 0; }\n#psg-chat-input { flex: 1; min-width: 0; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(0, 240, 255, 0.3); color: #fff; border-radius: 5px; padding: 4px 6px; font-size: 0.7rem; outline: none; }\n#psg-chat-input:focus { border-color: #00f0ff; }\n.psg-chat-msg { word-break: break-word; }\n.psg-chat-coord { display: inline-block; margin-left: 4px; padding: 0 4px; border-radius: 4px; background: rgba(0, 240, 255, 0.16); border: 1px solid rgba(0, 240, 255, 0.45); color: #67e8f9; font-family: monospace; font-size: 0.64rem; cursor: pointer; }\n.psg-chat-coord:hover { background: rgba(0, 240, 255, 0.35); color: #fff; }\n";
  const PSG_HTML = "<div id=\"psg-toast-banner\"></div>\n<div id=\"psg-viewport\">\n    <canvas id=\"demo-canvas\"></canvas>\n\n    <!-- ==================== 2D MILKY WAY OVERLAY HUD ==================== -->\n    <div id=\"hud-2d\">\n      <!-- Top-Left: Ultra-Compact Coordinate Pill -->\n      <div class=\"hud-panel\" id=\"nav-telemetry-card\" style=\"padding:4px 7px; width:auto;\">\n        <div style=\"display:flex; align-items:center; gap:6px;\">\n          <span style=\"font-family:monospace; font-size:0.72rem; color:#00ff88; font-weight:800; white-space:nowrap;\" id=\"coord-readout\">X: +0 | Y: +0</span>\n          <span style=\"width:1px; height:12px; background:rgba(255,255,255,0.18); flex-shrink:0;\"></span>\n          <span style=\"font-family:monospace; font-size:0.72rem; color:#ffd700; font-weight:900; white-space:nowrap; transition:all 0.25s ease;\" id=\"galaxy-pgt-readout\" title=\"Live On-Site PGT Balance\">\ud83e\ude99 0 PGT</span>\n          <span style=\"width:1px; height:12px; background:rgba(255,255,255,0.18); flex-shrink:0;\"></span>\n          <button class=\"btn\" id=\"btn-gift-scan\" style=\"padding:2px 6px; font-size:0.68rem; border-color:rgba(255,215,0,0.55); color:#fde047;\" onclick=\"window.PolySpaceGalaxy.instance.scanForGalacticGifts(true)\" title=\"Deep-Space Cache Scanner (auto-scans as you fly, or click to ping):&#10;❄️ COLD: >2,400u away&#10;📡 WARM: within 2,400u&#10;🔥 HOT: within 950u&#10;🎁 FOUND: within 450u (reveals on map!)&#10;Fly within 300u &amp; click the 🎁 to claim 50–150 PGT!\">\ud83d\udce1 <span id=\"gift-scan-badge\">\u2744\ufe0f 0/10</span></button>\n          <button class=\"btn\" style=\"padding:2px 5px; font-size:0.68rem;\" onclick=\"window.PolySpaceGalaxy.instance.centerOnShip()\" title=\"Center on Ship\">\ud83c\udfaf</button>\n          <button class=\"btn\" style=\"padding:2px 5px; font-size:0.68rem;\" onclick=\"window.PolySpaceGalaxy.instance.shareLocation()\" title=\"Share Coordinates\">\ud83d\udce4</button>\n        </div>\n      </div>\n\n      <!-- Bottom-Center: Compact 1-Row Pilot Hail Bar -->\n      <div class=\"hud-panel\" id=\"pilot-hail-card\" style=\"padding:5px 10px; min-width:0; width:auto; max-width:calc(100% - 12px); z-index:40;\">\n        <div style=\"display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:nowrap;\">\n          <div style=\"display:flex; align-items:center; gap:5px; white-space:nowrap; overflow:hidden; min-width:0; flex:1;\">\n            <span id=\"hail-pilot-name\" style=\"font-size:0.78rem; font-weight:900; color:#e9d5ff; overflow:hidden; text-overflow:ellipsis;\">\ud83d\udef8 PILOT</span>\n            <span id=\"hail-pilot-rarity\" style=\"font-size:0.64rem; font-weight:800; padding:1px 5px; border-radius:4px; border:1px solid var(--purple); color:#e9d5ff; flex-shrink:0;\">EPIC</span>\n            <span id=\"hail-pilot-stats\" style=\"font-size:0.68rem; color:#94a3b8; flex-shrink:0;\">\ud83d\udee1\ufe0f18 \u2604\ufe0f20</span>\n          </div>\n          <div style=\"display:flex; gap:5px; align-items:center; flex-shrink:0;\">\n            <button class=\"btn btn-danger\" style=\"padding:4px 9px; font-size:0.72rem;\" onclick=\"window.PolySpaceGalaxy.instance.openTacticalDuel()\">\u2694\ufe0f DUEL</button>\n            <button class=\"btn\" style=\"padding:3px 7px; font-size:0.7rem;\" onclick=\"document.getElementById('pilot-hail-card').style.display='none'\">\u2715</button>\n          </div>\n        </div>\n      </div>\n\n      <!-- Bottom-Center: Compact 1-Row Solar System Launch Bar -->\n      <div class=\"hud-panel\" id=\"system-briefing-card\" style=\"padding:5px 10px; min-width:0; width:auto; max-width:calc(100% - 12px); z-index:40;\">\n        <div style=\"display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:nowrap;\">\n          <div style=\"display:flex; align-items:center; gap:5px; white-space:nowrap; overflow:hidden; min-width:0; flex:1;\">\n            <span id=\"brief-sys-title\" style=\"font-size:0.78rem; font-weight:900; color:var(--gold); overflow:hidden; text-overflow:ellipsis;\">\u2600\ufe0f #1 Alpha Centauri</span>\n            <span id=\"brief-sys-lvl\" style=\"font-size:0.64rem; font-weight:800; padding:1px 5px; border-radius:4px; border:1px solid var(--gold); color:var(--gold); flex-shrink:0;\">Lvl 1</span>\n            <span id=\"brief-sys-desc\" style=\"font-size:0.7rem; color:#00ff88; font-weight:800; flex-shrink:0;\">+17 PGT</span>\n          </div>\n          <div style=\"display:flex; gap:5px; align-items:center; flex-shrink:0;\">\n            <button class=\"btn btn-gold\" id=\"btn-engage-system\" style=\"padding:4px 9px; font-size:0.72rem;\" onclick=\"window.PolySpaceGalaxy.instance.launch3DMission(window.PolySpaceGalaxy.instance.selectedSystemId)\">\u2694\ufe0f LAUNCH</button>\n            <button class=\"btn\" style=\"padding:3px 7px; font-size:0.7rem;\" onclick=\"document.getElementById('system-briefing-card').style.display='none'\">\u2715</button>\n          </div>\n        </div>\n      </div>\n\n      <!-- Top-Right Compact Buttons: Rank + Trade + Fullscreen Expand -->\n      <div id=\"mobile-trade-btn\" style=\"gap:5px;\">\n        <button class=\"btn\" style=\"border-color:var(--gold); color:#fde047; padding:4px 8px; font-size:0.7rem;\" onclick=\"window.PolySpaceGalaxy.instance.openRankLeaderboard()\">\ud83c\udfc6 Rank</button>\n        <button class=\"btn\" style=\"border-color:var(--green); color:#a7f3d0; padding:4px 8px; font-size:0.7rem;\" onclick=\"window.PolySpaceGalaxy.instance.openPostTradeBeacon()\">\ud83e\udd1d Trade</button>\n        <button id=\"psg-btn-fullscreen\" class=\"btn\" style=\"border-color:#00f0ff; color:#00f0ff; padding:4px 8px; font-size:0.7rem;\" onclick=\"window.PolySpaceGalaxy.instance.toggleFullscreen()\">\u26f6 Expand</button>\n      </div>\n\n      <!-- Right-Side Live Galaxy Comms Chat Panel -->\n      <div id=\"psg-chat-panel\" class=\"hud-panel\" onmousedown=\"event.stopPropagation()\" onwheel=\"event.stopPropagation()\" ontouchstart=\"event.stopPropagation()\">\n        <div id=\"psg-chat-header\" onclick=\"window.PolySpaceGalaxy.instance.toggleGalaxyChat()\">\n          <span style=\"display:flex; align-items:center; gap:5px; font-weight:900; font-size:0.68rem; color:#00f0ff; letter-spacing:0.4px;\">\n            \ud83d\udcac COMMS\n            <span id=\"psg-chat-online\" style=\"font-size:0.6rem; color:#00ff88; background:rgba(0,255,136,0.12); border:1px solid rgba(0,255,136,0.35); border-radius:99px; padding:0 5px;\">1</span>\n            <span id=\"psg-chat-unread\" style=\"display:none; font-size:0.6rem; color:#000; background:#fbbf24; border-radius:99px; padding:0 5px; font-weight:900;\">0</span>\n          </span>\n          <button type=\"button\" id=\"psg-chat-toggle-btn\" style=\"background:none; border:none; color:#94a3b8; font-size:0.8rem; cursor:pointer; padding:0 2px; line-height:1;\" title=\"Minimize / Expand Chat\">\u2212</button>\n        </div>\n        <div id=\"psg-chat-messages\"></div>\n        <div id=\"psg-chat-input-row\">\n          <button type=\"button\" onclick=\"window.PolySpaceGalaxy.instance.sendGalaxyChat(true)\" style=\"background:rgba(0,240,255,0.12); border:1px solid rgba(0,240,255,0.35); color:#67e8f9; border-radius:5px; padding:3px 5px; font-size:0.68rem; cursor:pointer; flex-shrink:0;\" title=\"Share your current (X, Y) coordinates in chat\">\ud83d\udccd</button>\n          <input id=\"psg-chat-input\" type=\"text\" maxlength=\"140\" placeholder=\"Message galaxy...\" autocomplete=\"off\" onkeydown=\"if(event.key==='Enter'){event.preventDefault();window.PolySpaceGalaxy.instance.sendGalaxyChat(false);}\" />\n          <button type=\"button\" onclick=\"window.PolySpaceGalaxy.instance.sendGalaxyChat(false)\" style=\"background:rgba(0,240,255,0.22); border:1px solid #00f0ff; color:#fff; border-radius:5px; padding:3px 7px; font-size:0.7rem; font-weight:800; cursor:pointer; flex-shrink:0;\">\u27a4</button>\n        </div>\n      </div>\n    </div>\n\n    <!-- ==================== 3D DOGFIGHT COCKPIT HUD ==================== -->\n    <div id=\"hud-3d\">\n      <!-- Top Combat Banner -->\n      <div id=\"combat-top-hud\">\n        <div>\n          <div style=\"font-size:0.68rem; color:var(--muted); text-transform:uppercase; font-weight:800;\">ACTIVE SOLAR SYSTEM</div>\n          <div id=\"hud3d-system-name\" style=\"font-size:0.95rem; font-weight:900; color:var(--cyan);\">System #15 \u2022 Vega Prime (Lvl 15)</div>\n        </div>\n        <div style=\"height:28px; width:1px; background:rgba(255,255,255,0.15);\"></div>\n        <div>\n          <div style=\"font-size:0.68rem; color:var(--muted); text-transform:uppercase; font-weight:800;\">PHASE / WAVE</div>\n          <div id=\"hud3d-wave\" style=\"font-size:0.95rem; font-weight:900; color:var(--gold);\">Wave 1 / 3 \u2022 Scout Squadron</div>\n        </div>\n        <div style=\"height:28px; width:1px; background:rgba(255,255,255,0.15);\"></div>\n        <div>\n          <div style=\"font-size:0.68rem; color:var(--muted); text-transform:uppercase; font-weight:800;\">HOSTILES REMAINING</div>\n          <div id=\"hud3d-enemies\" style=\"font-size:0.95rem; font-weight:900; color:#ff4d79;\">5 Ships</div>\n        </div>\n        <div style=\"height:28px; width:1px; background:rgba(255,255,255,0.15);\"></div>\n        <div>\n          <div style=\"font-size:0.68rem; color:var(--muted); text-transform:uppercase; font-weight:800;\">MISSION TIME</div>\n          <div id=\"hud3d-timer\" style=\"font-family:monospace; font-size:1rem; font-weight:900; color:#fff;\">00:00</div>\n        </div>\n        <button class=\"btn btn-danger\" style=\"padding:5px 10px; font-size:0.72rem;\" onclick=\"window.PolySpaceGalaxy.instance.switchMode('galaxy')\">\u2b05\ufe0f Abort to Galaxy</button>\n      </div>\n\n      <!-- Bottom-Left: Shield & Hull Integrity -->\n      <div class=\"hud-panel\" id=\"combat-left-hud\">\n        <div style=\"font-size:0.76rem; font-weight:900; color:var(--cyan); margin-bottom:4px; display:flex; justify-content:space-between;\">\n          <span>\ud83d\udee1\ufe0f QUANTUM SHIELD</span>\n          <span id=\"hud3d-shield-txt\" style=\"font-family:monospace;\">1,500 / 1,500</span>\n        </div>\n        <div class=\"bar-wrap\">\n          <div class=\"bar-fill\" id=\"hud3d-shield-bar\" style=\"width:100%; background:linear-gradient(90deg, #0284c7, #00f0ff); box-shadow:0 0 10px #00f0ff;\"></div>\n        </div>\n\n        <div style=\"font-size:0.76rem; font-weight:900; color:var(--green); margin-bottom:4px; display:flex; justify-content:space-between;\">\n          <span>\ud83d\udd29 HULL ARMOR</span>\n          <span id=\"hud3d-hull-txt\" style=\"font-family:monospace;\">1,000 / 1,000</span>\n        </div>\n        <div class=\"bar-wrap\" style=\"margin-bottom:4px;\">\n          <div class=\"bar-fill\" id=\"hud3d-hull-bar\" style=\"width:100%; background:linear-gradient(90deg, #059669, #00ff88);\"></div>\n        </div>\n        <div style=\"font-size:0.68rem; color:var(--muted);\">\n          \ud83d\udca1 Shields auto-regenerate when you evade enemy fire for 2.5s.\n        </div>\n      </div>\n\n      <!-- Bottom-Right: Weapons, Homing Missile & Controls Guide -->\n      <div class=\"hud-panel\" id=\"combat-right-hud\">\n        <div style=\"font-size:0.76rem; font-weight:900; color:#ff4d79; margin-bottom:5px; display:flex; justify-content:space-between;\">\n          <span id=\"hud3d-weapon-name\">\u2604\ufe0f TWIN PLASMA TURRETS</span>\n          <span id=\"hud3d-dps-txt\" style=\"font-family:monospace;\">165 DMG</span>\n        </div>\n        <div style=\"font-size:0.73rem; font-weight:900; color:var(--gold); margin-bottom:3px; display:flex; justify-content:space-between; align-items:center;\">\n          <span>\ud83d\ude80 AUTO-LOCK MISSILE [SPACE]</span>\n          <span id=\"hud3d-missile-txt\" style=\"font-family:monospace; color:var(--green);\">READY</span>\n        </div>\n        <div class=\"bar-wrap\" style=\"margin-bottom:6px;\">\n          <div class=\"bar-fill\" id=\"hud3d-missile-bar\" style=\"width:100%; background:linear-gradient(90deg, #f59e0b, #00ff88);\"></div>\n        </div>\n        <div style=\"display:flex; justify-content:space-between; align-items:center; gap:8px;\">\n          <div style=\"font-size:0.67rem; color:var(--muted); line-height:1.35;\">\n            \u2022 <strong>Steer:</strong> Mouse or <strong>WASD / Arrows</strong> (Auto-Fire ON)<br/>\n            \u2022 <strong>Missile:</strong> <strong>Space</strong> / <strong>E</strong> &bull; <strong>Roll:</strong> <strong>Shift</strong> / <strong>Q</strong>\n          </div>\n          <div style=\"display:flex; flex-direction:column; gap:4px; align-items:flex-end;\">\n            <button class=\"btn btn-gold\" id=\"btn-fire-missile\" style=\"padding:4px 9px; font-size:0.68rem; white-space:nowrap;\" onclick=\"window.PolySpaceGalaxy.instance.fireHomingMissile()\">\ud83d\ude80 MISSILE</button>\n            <button class=\"btn\" id=\"btn-barrel-roll\" style=\"padding:4px 9px; font-size:0.68rem; white-space:nowrap; border-color:#00f0ff; color:#00f0ff;\" onclick=\"window.PolySpaceGalaxy.instance.triggerBarrelRoll()\">\ud83c\udf00 ROLL</button>\n          </div>\n        </div>\n      </div>\n\n      <!-- Mobile Touch 3D Combat Controls (Missile + Barrel Roll Evade) -->\n      <div id=\"mobile-3d-controls\" style=\"gap:10px;\">\n        <button id=\"btn-mobile-roll\" class=\"touch-action-btn\" style=\"border-color:#00f0ff; background:rgba(0,240,255,0.16);\" onclick=\"window.PolySpaceGalaxy.instance.triggerBarrelRoll()\">\n          <span style=\"font-size:1.25rem;\">\ud83c\udf00</span>\n          <span id=\"mobile-roll-lbl\" style=\"font-size:0.62rem; color:#00f0ff;\">ROLL</span>\n        </button>\n        <button id=\"btn-mobile-missile\" class=\"touch-action-btn missile-btn\" onclick=\"window.PolySpaceGalaxy.instance.fireHomingMissile()\">\n          <span style=\"font-size:1.3rem;\">\ud83d\ude80</span>\n          <span id=\"mobile-missile-lbl\" style=\"font-size:0.64rem; color:#00ff88;\">READY</span>\n        </button>\n      </div>\n    </div>\n\n    <!-- Mission Victory / Defeat Modal -->\n    <div id=\"mission-modal\">\n      <div class=\"modal-box\">\n        <div id=\"modal-icon\" style=\"font-size:2.8rem; margin-bottom:6px;\">\ud83c\udfc6</div>\n        <h2 id=\"modal-title\" style=\"color:var(--green); font-size:1.45rem; font-weight:900; margin-bottom:8px;\">SOLAR SYSTEM CLEARED!</h2>\n        <p id=\"modal-desc\" style=\"color:var(--muted); font-size:0.88rem; margin-bottom:16px; line-height:1.45;\"></p>\n        <div id=\"modal-loot\" style=\"background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.3); border-radius:8px; padding:12px; margin-bottom:18px; font-weight:800; color:var(--gold); font-size:0.95rem;\"></div>\n        <div style=\"display:flex; gap:10px; justify-content:center;\">\n          <button class=\"btn\" onclick=\"window.PolySpaceGalaxy.instance.closeModalAndReturn()\">\ud83d\uddfa\ufe0f Return to Milky Way</button>\n          <button class=\"btn btn-gold\" onclick=\"window.PolySpaceGalaxy.instance.retry3DMission()\">\ud83d\udd04 Replay 3D Battle</button>\n        </div>\n      </div>\n    </div>\n\n    <!-- Tactical 3-Round Pre-Decided PvP Ship Duel Modal -->\n    <div class=\"overlay-modal\" id=\"tactical-duel-modal\">\n      <div class=\"duel-box\">\n        <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;\">\n          <div>\n            <div style=\"font-size:0.68rem; color:#ff4d79; font-weight:900; letter-spacing:0.8px;\">ASYNC SHIP-TO-SHIP TACTICAL DUEL</div>\n            <h3 id=\"duel-title\" style=\"font-size:1.1rem; font-weight:900; color:#fff;\">\u2694\ufe0f YOU vs. RIVAL PILOT</h3>\n          </div>\n          <button class=\"btn\" style=\"padding:4px 10px; font-size:0.75rem;\" onclick=\"window.PolySpaceGalaxy.instance.closeTacticalDuel()\">\u2715 Close</button>\n        </div>\n\n        <!-- Phase 1: Pre-Decide 3 Attack + 3 Defense Vectors -->\n        <div id=\"duel-setup-phase\">\n          <div style=\"font-size:0.76rem; color:var(--muted); margin-bottom:12px; line-height:1.4;\">\n            Pre-program your <strong>3 Attack Vectors</strong> and <strong>3 Shield Vectors</strong>. Matching the enemy's attack direction blocks <strong>70%</strong> of incoming damage!\n          </div>\n\n          <div id=\"duel-rounds-selector\" style=\"display:flex; flex-direction:column; gap:8px; margin-bottom:14px;\">\n            <!-- Populated dynamically by renderDuelSelector() -->\n          </div>\n\n          <div style=\"display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;\">\n            <div style=\"display:flex; align-items:center; gap:6px; font-size:0.76rem;\">\n              <span style=\"color:var(--gold); font-weight:800;\">Stake:</span>\n              <select id=\"duel-wager\" style=\"background:rgba(15,23,42,0.95); color:#fff; border:1px solid var(--gold); border-radius:6px; padding:4px 8px; font-weight:700;\">\n                <option value=\"0\">Friendly (0 PGT)</option>\n                <option value=\"25\" selected>25 PGT Pot</option>\n                <option value=\"50\">50 PGT Pot</option>\n                <option value=\"100\">100 PGT Pot</option>\n              </select>\n            </div>\n            <div style=\"display:flex; gap:8px;\">\n              <button class=\"btn\" style=\"font-size:0.75rem;\" onclick=\"window.PolySpaceGalaxy.instance.randomizeDuelMoves()\">\ud83c\udfb2 Randomize</button>\n              <button class=\"btn btn-danger\" style=\"padding:8px 16px; font-size:0.84rem;\" onclick=\"window.PolySpaceGalaxy.instance.startTacticalDuelPlayback()\">\ud83d\udd25 LOCK & WATCH 5s BATTLE</button>\n            </div>\n          </div>\n        </div>\n\n        <!-- Phase 2: 5-Second Animated Battle Playback -->\n        <div id=\"duel-playback-phase\" style=\"display:none;\">\n          <div style=\"display:grid; grid-template-columns:1fr auto 1fr; gap:10px; align-items:center; margin-bottom:8px;\">\n            <div>\n              <div style=\"font-size:0.72rem; font-weight:900; color:var(--cyan); display:flex; justify-content:space-between;\">\n                <span>YOUR FLAGSHIP</span>\n                <span id=\"duel-p1-hp-txt\">1000</span>\n              </div>\n              <div class=\"bar-wrap\" style=\"margin-bottom:0;\">\n                <div class=\"bar-fill\" id=\"duel-p1-hp-bar\" style=\"width:100%; background:linear-gradient(90deg, #0284c7, #00f0ff);\"></div>\n              </div>\n            </div>\n            <div id=\"duel-round-badge\" style=\"font-size:0.74rem; font-weight:900; color:var(--gold); padding:3px 9px; border-radius:6px; background:rgba(255,215,0,0.14); border:1px solid var(--gold);\">ROUND 1 / 3</div>\n            <div>\n              <div style=\"font-size:0.72rem; font-weight:900; color:#ff4d79; display:flex; justify-content:space-between;\">\n                <span id=\"duel-p2-name\">RIVAL</span>\n                <span id=\"duel-p2-hp-txt\">1000</span>\n              </div>\n              <div class=\"bar-wrap\" style=\"margin-bottom:0;\">\n                <div class=\"bar-fill\" id=\"duel-p2-hp-bar\" style=\"width:100%; background:linear-gradient(90deg, #be123c, #ff0055);\"></div>\n              </div>\n            </div>\n          </div>\n\n          <canvas id=\"duel-canvas\" width=\"570\" height=\"250\"></canvas>\n\n          <div id=\"duel-log-box\" style=\"margin-top:10px; font-size:0.74rem; color:#e2e8f0; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px 10px; min-height:54px; line-height:1.45;\"></div>\n\n          <div id=\"duel-result-actions\" style=\"display:none; justify-content:center; gap:10px; margin-top:12px;\">\n            <button class=\"btn btn-gold\" onclick=\"window.PolySpaceGalaxy.instance.openTacticalDuel()\">\ud83d\udd04 Rematch (New Tactics)</button>\n            <button class=\"btn\" onclick=\"window.PolySpaceGalaxy.instance.closeTacticalDuel()\">\ud83d\uddfa\ufe0f Return to Galaxy</button>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    <!-- Space Trade Beacon Modal (Post Open Offer OR 1-Click Accept Map Beacon) -->\n    <div class=\"overlay-modal\" id=\"trade-modal\">\n      <div class=\"trade-box\">\n        <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;\">\n          <div>\n            <div id=\"trade-subtitle\" style=\"font-size:0.68rem; color:var(--green); font-weight:900; letter-spacing:0.8px;\">OPEN MAP TRADE BEACON</div>\n            <h3 id=\"trade-title\" style=\"font-size:1.08rem; font-weight:900; color:#fff;\">\ud83e\udd1d POST TRADE BEACON</h3>\n          </div>\n          <button class=\"btn\" style=\"padding:4px 10px; font-size:0.75rem;\" onclick=\"document.getElementById('trade-modal').style.display='none'\">\u2715 Close</button>\n        </div>\n\n        <!-- Mode A: Post a New Trade Beacon at Your Current (X,Y) -->\n        <div id=\"trade-post-view\">\n          <div style=\"font-size:0.75rem; color:var(--muted); margin-bottom:10px;\">\n            Leave a fixed-price <strong>\ud83e\udd1d Trade Beacon</strong> on the galaxy map at your current location. Any pilot can accept it with 1 click!\n          </div>\n          <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;\">\n            <div style=\"background:rgba(0,240,255,0.06); border:1px solid rgba(0,240,255,0.28); border-radius:10px; padding:10px;\">\n              <div style=\"font-size:0.72rem; font-weight:900; color:var(--cyan); margin-bottom:6px;\">\ud83d\udce4 YOU OFFER (ESCROWED)</div>\n              <select id=\"beacon-offer-asset\" style=\"width:100%; background:#060c1a; border:1px solid rgba(0,240,255,0.4); color:#fff; border-radius:6px; padding:5px 6px; margin-bottom:6px; font-size:0.76rem;\">\n                <option value=\"\ud83d\udc8e Quantum Crystals\">\ud83d\udc8e Quantum Crystals</option>\n                <option value=\"\u2699\ufe0f Titanium Alloy\">\u2699\ufe0f Titanium Alloy</option>\n                <option value=\"\ud83e\udea8 Iron Ore\">\ud83e\udea8 Iron Ore</option>\n                <option value=\"\u2604\ufe0f Rare PGT Ore\">\u2604\ufe0f Rare PGT Ore</option>\n              </select>\n              <input type=\"number\" id=\"beacon-offer-amt\" value=\"500\" min=\"1\" style=\"width:100%; background:#060c1a; border:1px solid rgba(0,240,255,0.4); color:#fff; border-radius:6px; padding:5px 8px; font-family:monospace;\" />\n            </div>\n            <div style=\"background:rgba(0,255,136,0.06); border:1px solid rgba(0,255,136,0.28); border-radius:10px; padding:10px;\">\n              <div style=\"font-size:0.72rem; font-weight:900; color:var(--green); margin-bottom:6px;\">\ud83d\udce5 YOU REQUEST</div>\n              <select id=\"beacon-want-asset\" style=\"width:100%; background:#060c1a; border:1px solid rgba(0,255,136,0.4); color:#fff; border-radius:6px; padding:5px 6px; margin-bottom:6px; font-size:0.76rem;\">\n                <option value=\"\u2699\ufe0f Titanium Alloy\" selected>\u2699\ufe0f Titanium Alloy</option>\n                <option value=\"\ud83d\udc8e Quantum Crystals\">\ud83d\udc8e Quantum Crystals</option>\n                <option value=\"\ud83e\udea8 Iron Ore\">\ud83e\udea8 Iron Ore</option>\n                <option value=\"\u2604\ufe0f Rare PGT Ore\">\u2604\ufe0f Rare PGT Ore</option>\n              </select>\n              <input type=\"number\" id=\"beacon-want-amt\" value=\"1200\" min=\"1\" style=\"width:100%; background:#060c1a; border:1px solid rgba(0,255,136,0.4); color:#fff; border-radius:6px; padding:5px 8px; font-family:monospace;\" />\n            </div>\n          </div>\n          <div style=\"display:flex; justify-content:space-between; align-items:center; gap:10px;\">\n            <span style=\"font-size:0.7rem; color:var(--muted);\">\ud83d\udd25 5% resource burn fee \u2022 Auto-refunds if cancelled or expired (24h).</span>\n            <button class=\"btn\" style=\"border-color:var(--green); background:rgba(0,255,136,0.18); color:#fff; padding:8px 16px;\" onclick=\"window.PolySpaceGalaxy.instance.deployTradeBeacon()\">\n              \ud83d\udce1 DROP BEACON ON MAP\n            </button>\n          </div>\n        </div>\n\n        <!-- Mode B: Inspect & 1-Click Accept (or Cancel) an Existing Map Trade Beacon -->\n        <div id=\"trade-accept-view\" style=\"display:none;\">\n          <div id=\"beacon-detail-box\" style=\"background:rgba(0,255,136,0.07); border:1px solid rgba(0,255,136,0.3); border-radius:10px; padding:14px; margin-bottom:14px; font-size:0.84rem; line-height:1.6;\"></div>\n          <div style=\"display:flex; justify-content:space-between; align-items:center; gap:10px;\">\n            <span style=\"font-size:0.7rem; color:var(--muted);\">\ud83d\udd25 Atomic 1-click resource swap (5% burn fee).</span>\n            <button id=\"btn-accept-beacon\" class=\"btn\" style=\"border-color:var(--green); background:rgba(0,255,136,0.2); color:#fff; padding:8px 18px;\" onclick=\"window.PolySpaceGalaxy.instance.acceptSelectedBeacon()\">\n              \u2705 ACCEPT TRADE\n            </button>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    <!-- Ace Pilot Combat Ranking Leaderboard Modal (Weekly & All-Time) -->\n    <div class=\"overlay-modal\" id=\"rank-modal\">\n      <div class=\"trade-box\" style=\"border-color:var(--gold); max-width:580px;\">\n        <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;\">\n          <div>\n            <div style=\"font-size:0.68rem; color:var(--gold); font-weight:900; letter-spacing:0.8px;\">COMBAT XP \u2022 KILLS & TACTICAL DUELS</div>\n            <h3 style=\"font-size:1.08rem; font-weight:900; color:#fff;\">\ud83c\udfc6 ACE PILOT COMBAT RANKING</h3>\n          </div>\n          <button class=\"btn\" style=\"padding:4px 10px; font-size:0.75rem;\" onclick=\"document.getElementById('rank-modal').style.display='none'\">\u2715 Close</button>\n        </div>\n\n        <div id=\"rank-my-summary\" style=\"background:rgba(255,215,0,0.08); border:1px solid rgba(255,215,0,0.3); border-radius:8px; padding:8px 12px; margin-bottom:10px; font-size:0.78rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;\"></div>\n\n        <div style=\"display:flex; gap:8px; margin-bottom:10px;\">\n          <button id=\"tab-rank-weekly\" class=\"btn active\" style=\"flex:1; justify-content:center; font-size:0.76rem;\" onclick=\"window.PolySpaceGalaxy.instance.switchRankTab('weekly')\">\ud83d\udcc5 Weekly Sprint</button>\n          <button id=\"tab-rank-alltime\" class=\"btn\" style=\"flex:1; justify-content:center; font-size:0.76rem;\" onclick=\"window.PolySpaceGalaxy.instance.switchRankTab('alltime')\">\ud83c\udf0c All-Time Legends</button>\n        </div>\n\n        <div id=\"rank-table-wrap\" style=\"max-height:260px; overflow-y:auto; font-size:0.76rem;\"></div>\n      </div>\n    </div>\n  </div>";

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
        this.camZoom = 1.0;
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
        this.funLasers2D = [];
        this.funSparks2D = [];
        this.funLaserCd2D = 0;
        this.combatXpAllTime = 0;
        this.combatXpWeekly = 0;
        this.totalKills = 0;
        this.missionKills = 0;
        this.activeMissionSessionId = null;
        this.dailyMissionsCount = 0;
        this.dailyMissionsMax = 10;
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

          const rewardPgt = i === 50 ? 50000 : Math.floor(32 * Math.pow(1.14, i - 1));

          this.solarSystems.push({
            id: i,
            name: sysNames[i - 1] || `Sector-${i}`,
            level: i,
            x: sx,
            y: sy,
            color,
            radius: i === 50 ? 36 : (i % 10 === 0 ? 28 : 20),
            rewardPgt,
            hasNft: i === 50
          });
        }

        // Phase 3: Server-authoritative Hidden Coordinate Gifts (materialized ONLY when scanned within <= 260 units)
        this.hiddenGifts = [];
        this.giftScanHeat = 'cold';
        this.giftsClaimedCount = 0;
        this.giftsTotalStandard = 10;
        this._lastGiftPingAt = 0;
        this._lastGiftPingX = 0;
        this._lastGiftPingY = 0;
        this._isPingingGifts = false;
        this._breachNotified = false;
        this.voidBound = 12200; // Secret Deep Void space beyond the NW corner breach of ±10,000

        // Live Pilots (Supabase Realtime Presence) + 1 Calm Sparring Bot
        this.selectedPilot = null;
        this.selectedBeacon = null;
        this.duelMyAttacks = ['RIGHT', 'TOP', 'RIGHT'];
        this.duelMyDefenses = ['LEFT', 'LEFT', 'LEFT'];
        this.duelAnimId = null;
        this.livePresenceChannel = null;
        this._lastPresencePushAt = 0;
        this._lastPresenceX = 0;
        this._lastPresenceY = 0;
        this.pendingIncomingDuel = null;
        this.pendingOutgoingDuel = null;
        this.acceptingDuelId = null;
        this._playedDuelIds = new Set();
        this.initOtherPilots();

        // Live Open Map Trade Beacons (loaded from Supabase)
        this.tradeBeacons = [];
      }

      initOtherPilots() {
        // 1 Calm Sparring Bot near the Outpost Hub (idles quietly, hops occasionally, accepts 0 PGT friendly duels)
        this.sparringBot = {
          id: 'bot_sentinel',
          playerId: 'bot_sentinel',
          isBot: true,
          name: '🤖 Sentinel Bot',
          rarity: 'Sparring',
          color: '#38bdf8',
          shield: 12,
          turret: 12,
          x: 215,
          y: -145,
          angle: 2.4,
          speed: 75,
          targetX: 215,
          targetY: -145,
          nextHopAt: performance.now() + 26000,
          nearHub: true,
          trail: []
        };
        this.otherPilots = [this.sparringBot];
      }

      _assetKeyToLabel(key) {
        const map = {
          iron: '🪨 Iron Ore',
          titanium: '⚙️ Titanium Alloy',
          quantum: '💎 Quantum Crystals',
          pgtOre: '☄️ Rare PGT Ore'
        };
        return map[key] || key;
      }

      _assetLabelToKey(val) {
        const v = String(val || '').toLowerCase();
        if (v.includes('iron')) return 'iron';
        if (v.includes('titanium')) return 'titanium';
        if (v.includes('quantum')) return 'quantum';
        if (v.includes('pgt')) return 'pgtOre';
        return 'iron';
      }

      async loadTradeBeaconsFromDB() {
        const { sb, pid } = this._getSupabaseAndPlayerId();
        if (!sb) return;
        try {
          const { data, error } = await sb.rpc('list_polyspace_trade_beacons');
          if (error || !data || !data.success || !Array.isArray(data.beacons)) return;
          this.tradeBeacons = data.beacons.map((b) => ({
            id: b.id,
            sellerId: String(b.seller_id || '').toLowerCase(),
            seller: b.seller_name || 'Pilot',
            isMine: Boolean(pid && String(b.seller_id || '').toLowerCase() === pid),
            x: Number(b.x || 0),
            y: Number(b.y || 0),
            offerKey: b.offer_asset,
            offerAmt: Number(b.offer_amount || 0),
            offerAsset: this._assetKeyToLabel(b.offer_asset),
            wantKey: b.want_asset,
            wantAmt: Number(b.want_amount || 0),
            wantAsset: this._assetKeyToLabel(b.want_asset)
          }));
        } catch (err) {
          console.warn('[PolySpaceGalaxy] loadTradeBeaconsFromDB warning:', err);
        }
      }

      connectRealtimeGalaxy() {
        const { sb, pid } = this._getSupabaseAndPlayerId();
        if (!sb || !pid || typeof sb.channel !== 'function') return;
        if (this.livePresenceChannel) return;

        const st = (window.appState && window.appState.state) || {};
        const myName = st.username || (pid.length > 10 ? `${pid.slice(0, 6)}…${pid.slice(-4)}` : pid);
        const _psShip = (window.polySpace && typeof window.polySpace.getEquippedStarshipMultiplier === 'function')
          ? window.polySpace.getEquippedStarshipMultiplier() : null;
        const myDna = (_psShip && _psShip.ship && _psShip.ship.dna) || null;
        const myRarity = (_psShip && _psShip.ship && _psShip.ship.rarity) || 'Pilot';

        const ch = sb.channel('polyspace-galaxy-live', { config: { presence: { key: pid } } });
        ch.on('presence', { event: 'sync' }, () => {
          const state = ch.presenceState();
          const prevById = new Map((this.otherPilots || []).map(p => [p.id, p]));
          const liveList = [this.sparringBot];
          Object.keys(state).forEach((key) => {
            if (key.toLowerCase() === pid) return;
            const entries = state[key];
            if (!entries || !entries.length) return;
            const p = entries[entries.length - 1];
            const prev = prevById.get(key);
            const tx = Number(p.x || 0);
            const ty = Number(p.y || 0);
            liveList.push({
              id: key,
              playerId: key,
              isBot: false,
              name: p.username || 'Pilot',
              rarity: p.rarity || 'Pilot',
              color: p.rarity === 'Mythic' ? '#ffd700' : (p.rarity === 'Legendary' ? '#c084fc' : '#00ff88'),
              shield: Number(p.shield || 1),
              turret: Number(p.turret || 1),
              dna: p.dna || null,
              x: prev ? prev.x : tx,
              y: prev ? prev.y : ty,
              targetX: tx,
              targetY: ty,
              angle: Number(p.angle || 0),
              speed: 260,
              trail: prev ? prev.trail : []
            });
          });
          this.otherPilots = liveList;
          const onlineEl = document.getElementById('psg-chat-online');
          if (onlineEl) {
            const count = Math.max(1, Object.keys(state || {}).length);
            onlineEl.innerText = `${count}`;
            onlineEl.title = `${count} pilot${count === 1 ? '' : 's'} online in Galaxy`;
          }
        });

        ch.on('broadcast', { event: 'galaxy_chat' }, (msg) => {
          if (msg && msg.payload) {
            this._onIncomingGalaxyChat(msg.payload);
          }
        });

        ch.on('broadcast', { event: 'beacon_updated' }, () => {
          this.loadTradeBeaconsFromDB();
        });
        ch.on('broadcast', { event: 'duel_challenge' }, (msg) => {
          if (msg && msg.payload && String(msg.payload.opponent_id || '').toLowerCase() === pid) {
            this.pollMyDuels();
          }
        });
        ch.on('broadcast', { event: 'duel_resolved' }, (msg) => {
          if (msg && msg.payload && (String(msg.payload.p1Id || '').toLowerCase() === pid || String(msg.payload.p2Id || '').toLowerCase() === pid)) {
            this.pollMyDuels();
          }
        });

        ch.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            this._lastPresencePushAt = performance.now();
            this._lastPresenceX = Math.round(this.ship2D.x);
            this._lastPresenceY = Math.round(this.ship2D.y);
            await ch.track({
              player_id: pid,
              username: myName,
              x: this._lastPresenceX,
              y: this._lastPresenceY,
              angle: Number(this.ship2D.angle.toFixed(2)),
              shield: this.shieldLevel,
              turret: this.turretLevel,
              dna: myDna,
              rarity: myRarity
            });
          }
        });
        this.livePresenceChannel = ch;

        if (!this._socialPollTimer) {
          this._socialPollTimer = setInterval(() => {
            if (!this.paused && this.mode === 'galaxy') {
              this.pollMyDuels();
            }
          }, 5000);
        }
        if (!this._beaconPollTimer) {
          this._beaconPollTimer = setInterval(() => {
            if (!this.paused && this.mode === 'galaxy') {
              this.loadTradeBeaconsFromDB();
            }
          }, 20000);
        }
      }

      pushPresenceIfMoved(force = false) {
        if (!this.livePresenceChannel) return;
        const now = performance.now();
        const sx = Math.round(this.ship2D.x);
        const sy = Math.round(this.ship2D.y);
        const moved = Math.hypot(sx - this._lastPresenceX, sy - this._lastPresenceY);
        if (!force && (moved < 8 || now - this._lastPresencePushAt < 1500)) return;
        this._lastPresencePushAt = now;
        this._lastPresenceX = sx;
        this._lastPresenceY = sy;

        const { pid } = this._getSupabaseAndPlayerId();
        const st = (window.appState && window.appState.state) || {};
        const myName = st.username || (pid.length > 10 ? `${pid.slice(0, 6)}…${pid.slice(-4)}` : pid);
        const _psShip = (window.polySpace && typeof window.polySpace.getEquippedStarshipMultiplier === 'function')
          ? window.polySpace.getEquippedStarshipMultiplier() : null;
        this.livePresenceChannel.track({
          player_id: pid,
          username: myName,
          x: sx,
          y: sy,
          angle: Number(this.ship2D.angle.toFixed(2)),
          shield: this.shieldLevel,
          turret: this.turretLevel,
          dna: (_psShip && _psShip.ship && _psShip.ship.dna) || null,
          rarity: (_psShip && _psShip.ship && _psShip.ship.rarity) || 'Pilot'
        });
      }

      async pollMyDuels() {
        const { sb, pid } = this._getSupabaseAndPlayerId();
        if (!sb || !pid) return;
        try {
          const { data, error } = await sb.rpc('get_my_polyspace_duels', { p_player_id: pid });
          if (error || !data || !data.success) return;

          // 1. Incoming 60s challenge banner
          const inc = Array.isArray(data.incoming) && data.incoming.length > 0 ? data.incoming[0] : null;
          this.pendingIncomingDuel = inc;
          this.renderIncomingDuelBanner();

          // 2. Outgoing pending status
          const out = Array.isArray(data.outgoing) && data.outgoing.length > 0 ? data.outgoing[0] : null;
          this.pendingOutgoingDuel = out;

          // 3. Recently completed duel -> trigger synchronized 5s playback if not yet played
          if (Array.isArray(data.recent)) {
            for (const d of data.recent) {
              if (d.status === 'completed' && d.battle_log && !this._playedDuelIds.has(d.id)) {
                this._playedDuelIds.add(d.id);
                this.playServerDuelLog(d.battle_log);
                if (window.appState && typeof window.appState.syncUI === 'function') window.appState.syncUI();
                break;
              } else if ((d.status === 'declined' || d.status === 'expired') && this._waitingDuelId === d.id) {
                this._waitingDuelId = null;
                this.showToast(d.status === 'expired' ? '⏱️ Duel challenge expired (60s) — wager refunded!' : '❌ Opponent declined the duel — wager refunded!');
                this.closeTacticalDuel();
                if (window.polySpace && typeof window.polySpace.syncCloudSpaceState === 'function') window.polySpace.syncCloudSpaceState(true);
              }
            }
          }
        } catch (err) {
          console.warn('[PolySpaceGalaxy] pollMyDuels warning:', err);
        }
      }

      renderIncomingDuelBanner() {
        let el = document.getElementById('psg-incoming-duel-banner');
        const inc = this.pendingIncomingDuel;
        if (!inc) {
          if (el) el.style.display = 'none';
          return;
        }
        if (!el) {
          el = document.createElement('div');
          el.id = 'psg-incoming-duel-banner';
          el.style.cssText = 'position:fixed; top:14px; left:50%; transform:translateX(-50%); z-index:100001; background:rgba(12,18,38,0.96); border:2px solid #ff0055; border-radius:10px; padding:8px 14px; display:flex; align-items:center; gap:10px; color:#fff; font-size:0.8rem; font-weight:800; box-shadow:0 0 28px rgba(255,0,85,0.45); max-width:94vw;';
          document.body.appendChild(el);
        }
        const remSec = Math.max(0, Math.ceil((new Date(inc.expires_at).getTime() - Date.now()) / 1000));
        if (remSec <= 0) {
          el.style.display = 'none';
          return;
        }
        const safeName = this._escapeHtml(inc.challenger_name);
        el.style.display = 'flex';
        el.innerHTML = `
          <span>⚔️ <strong style="color:#ff4d79;">${safeName}</strong> challenges you (${Number(inc.wager_pgt || 0)} PGT • 5% fee)</span>
          <button style="background:linear-gradient(135deg,#00ff88,#059669); color:#000; border:none; border-radius:6px; padding:4px 10px; font-weight:900; cursor:pointer;" onclick="window.PolySpaceGalaxy.instance.openAcceptIncomingDuel()">✅ Accept (${remSec}s)</button>
          <button style="background:rgba(255,0,85,0.25); color:#ff94b4; border:1px solid #ff0055; border-radius:6px; padding:4px 8px; font-weight:800; cursor:pointer;" onclick="window.PolySpaceGalaxy.instance.declineIncomingDuel()">✕</button>
        `;
      }

      openAcceptIncomingDuel() {
        const inc = this.pendingIncomingDuel;
        if (!inc) return;
        this.acceptingDuelId = inc.id;
        this.selectedPilot = {
          id: inc.challenger_id,
          playerId: inc.challenger_id,
          isBot: false,
          name: inc.challenger_name,
          rarity: 'Live Pilot',
          shield: 15,
          turret: 15
        };
        const banner = document.getElementById('psg-incoming-duel-banner');
        if (banner) banner.style.display = 'none';
        document.getElementById('duel-title').innerText = `⚔️ ACCEPT DUEL vs. ${inc.challenger_name.toUpperCase()} (${Number(inc.wager_pgt || 0)} PGT)`;
        const wagerSel = document.getElementById('duel-wager');
        if (wagerSel) {
          wagerSel.value = String(Number(inc.wager_pgt || 0));
          wagerSel.disabled = true;
        }
        document.getElementById('duel-setup-phase').style.display = 'block';
        document.getElementById('duel-playback-phase').style.display = 'none';
        document.getElementById('tactical-duel-modal').style.display = 'flex';
        this.renderDuelSelector();
      }

      async declineIncomingDuel() {
        const inc = this.pendingIncomingDuel;
        if (!inc) return;
        const { sb, pid } = this._getSupabaseAndPlayerId();
        this.pendingIncomingDuel = null;
        this.renderIncomingDuelBanner();
        if (!sb || !pid) return;
        await sb.rpc('cancel_or_decline_polyspace_duel', { p_player_id: pid, p_duel_id: inc.id });
        if (this.livePresenceChannel) {
          this.livePresenceChannel.send({ type: 'broadcast', event: 'duel_resolved', payload: { p1Id: inc.challenger_id, p2Id: pid } });
        }
        this.showToast('❌ Duel declined.');
      }

      playServerDuelLog(log) {
        if (!log || !Array.isArray(log.rounds)) return;
        const { pid } = this._getSupabaseAndPlayerId();
        const iAmP1 = String(log.p1Id || '').toLowerCase() === pid;
        const myMaxHp = iAmP1 ? log.p1MaxHp : log.p2MaxHp;
        const rivalMaxHp = iAmP1 ? log.p2MaxHp : log.p1MaxHp;
        const rivalName = iAmP1 ? log.p2Name : log.p1Name;

        let curP1 = myMaxHp;
        let curP2 = rivalMaxHp;
        const rounds = log.rounds.map((r) => {
          const startP1 = curP1;
          const startP2 = curP2;
          const endP1 = iAmP1 ? r.p1HpAfter : r.p2HpAfter;
          const endP2 = iAmP1 ? r.p2HpAfter : r.p1HpAfter;
          curP1 = endP1;
          curP2 = endP2;
          return {
            num: r.round,
            p1Atk: iAmP1 ? r.p1Atk : r.p2Atk,
            p1Def: iAmP1 ? r.p1Def : r.p2Def,
            p2Atk: iAmP1 ? r.p2Atk : r.p1Atk,
            p2Def: iAmP1 ? r.p2Def : r.p1Def,
            p1BlockedByP2: iAmP1 ? r.p2Blocked : r.p1Blocked,
            p2BlockedByP1: iAmP1 ? r.p1Blocked : r.p2Blocked,
            dmgToP2: iAmP1 ? r.p1Dmg : r.p2Dmg,
            dmgToP1: iAmP1 ? r.p2Dmg : r.p1Dmg,
            startP1, startP2, endP1, endP2
          };
        });

        const winner = !log.winnerId ? 'draw' : (String(log.winnerId).toLowerCase() === pid ? 'p1' : 'p2');
        document.getElementById('duel-title').innerText = `⚔️ YOU vs. ${String(rivalName || 'RIVAL').toUpperCase()}`;
        document.getElementById('duel-setup-phase').style.display = 'none';
        document.getElementById('duel-playback-phase').style.display = 'block';
        document.getElementById('duel-result-actions').style.display = 'none';
        document.getElementById('duel-p2-name').innerText = String(rivalName || 'RIVAL').toUpperCase();
        document.getElementById('duel-log-box').innerHTML = `⚡ Server-verified 5s battle (Pot: ${Number(log.wager || 0) * 2} PGT • 5% fee: ${Number(log.fee || 0)} PGT)...`;
        document.getElementById('tactical-duel-modal').style.display = 'flex';

        this.duelSim = {
          rival: { name: rivalName || 'RIVAL' },
          rounds, myMaxHp, rivalMaxHp,
          wager: Number(log.wager || 0),
          fee: Number(log.fee || 0),
          payout: Number(log.payout || 0),
          winner,
          startTime: performance.now(),
          roundDuration: 1650,
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
          const tag = (e.target && e.target.tagName) || '';
          const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
          if (isTyping || this.paused) return;

          this.keys[e.code] = true;
          if (this.mode === 'combat3d' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
            this.useKeyboardSteer = true;
            e.preventDefault();
          }
          if (this.mode === 'galaxy' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
          }
          if (e.code === 'Space') {
            if (this.mode === 'combat3d') {
              e.preventDefault();
              if (!e.repeat) this.fireHomingMissile();
            } else if (this.mode === 'galaxy') {
              e.preventDefault();
              if (!e.repeat && this.funLaserCd2D <= 0) this.fireFunLaser2D();
            }
          }
          if (e.code === 'KeyE' && this.mode === 'combat3d' && !e.repeat) {
            this.fireHomingMissile();
          }
          if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyQ') && this.mode === 'combat3d' && !e.repeat) {
            e.preventDefault();
            this.triggerBarrelRoll();
          }
        });
        window.addEventListener('keyup', (e) => {
          this.keys[e.code] = false;
        });
        window.addEventListener('blur', () => {
          this.keys = {};
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
              const VB = this.voidBound || 12200;
              this.camX = Math.max(-VB, Math.min(B, this.panOriginX - dx / this.camZoom));
              this.camY = Math.max(-VB, Math.min(B, this.panOriginY - dy / this.camZoom));
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
          this.camZoom = Math.max(0.06, Math.min(3.0, this.camZoom * factor));
          this._updateFullscreenZoomUI();
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
              this.camZoom = Math.max(0.06, Math.min(3.0, this.touchPinch.startZoom * scale));
              this._updateFullscreenZoomUI();
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
                const VB = this.voidBound || 12200;
                this.camX = Math.max(-VB, Math.min(B, this.panOriginX - dx / this.camZoom));
                this.camY = Math.max(-VB, Math.min(B, this.panOriginY - dy / this.camZoom));
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
        this.camZoom = Math.max(0.06, Math.min(3.0, this.camZoom * factor));
        this._updateFullscreenZoomUI();
      }

      _updateFullscreenZoomUI() {
        const disp = document.getElementById('psg-fs-zoom-display');
        if (disp) {
          const z = this.camZoom || 1.0;
          disp.innerText = `${z < 1.0 ? z.toFixed(2) : z.toFixed(1)}x`;
        }
      }

      // --------------------------------------------------------------------------
      // 2B. LIVE GALAXY COMMS CHAT PANEL (SUPABASE REALTIME BROADCAST)
      // --------------------------------------------------------------------------
      initGalaxyChatUI() {
        this.galaxyChatMessages = this.galaxyChatMessages || [];
        this._galaxyChatIds = this._galaxyChatIds || new Set();
        this._galaxyChatUnread = 0;
        this._lastGalaxyChatSentAt = 0;
        this._setGalaxyChatCollapsed(!this._isFullscreen || window.innerWidth <= 720);
        if (this.galaxyChatMessages.length === 0) {
          this._onIncomingGalaxyChat({
            id: 'sys-welcome',
            system: true,
            text: '📡 Live Galaxy Comms online. Tap 📍 to share your coordinates!'
          });
        }
      }

      _setGalaxyChatCollapsed(collapsed) {
        this._galaxyChatCollapsed = Boolean(collapsed);
        const panel = document.getElementById('psg-chat-panel');
        const toggleBtn = document.getElementById('psg-chat-toggle-btn');
        const unreadEl = document.getElementById('psg-chat-unread');
        if (panel) panel.classList.toggle('collapsed', this._galaxyChatCollapsed);
        if (toggleBtn) toggleBtn.innerText = this._galaxyChatCollapsed ? '+' : '−';
        if (!this._galaxyChatCollapsed) {
          this._galaxyChatUnread = 0;
          if (unreadEl) unreadEl.style.display = 'none';
          const box = document.getElementById('psg-chat-messages');
          if (box) box.scrollTop = box.scrollHeight;
        }
      }

      toggleGalaxyChat() {
        this._setGalaxyChatCollapsed(!this._galaxyChatCollapsed);
      }

      flyToChatCoords(x, y) {
        const nx = Number(x);
        const ny = Number(y);
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
        const clamped = this.clampGalaxyPos(Math.round(nx), Math.round(ny), this.ship2D.x, this.ship2D.y);
        this.ship2D.targetX = clamped.x;
        this.ship2D.targetY = clamped.y;
        this.followShip2D = true;
        this.showToast(`🧭 Autopilot locked to (${clamped.x}, ${clamped.y})!`);
      }

      _onIncomingGalaxyChat(payload) {
        if (!payload || !payload.text) return;
        this.galaxyChatMessages = this.galaxyChatMessages || [];
        this._galaxyChatIds = this._galaxyChatIds || new Set();
        const msgId = String(payload.id || `${payload.ts || Date.now()}-${Math.random()}`);
        if (this._galaxyChatIds.has(msgId)) return;
        this._galaxyChatIds.add(msgId);
        this.galaxyChatMessages.push({
          id: msgId,
          system: !!payload.system,
          username: String(payload.username || 'Pilot').slice(0, 24),
          rarity: String(payload.rarity || 'Pilot'),
          text: String(payload.text).slice(0, 140),
          x: Number.isFinite(Number(payload.x)) ? Math.round(Number(payload.x)) : null,
          y: Number.isFinite(Number(payload.y)) ? Math.round(Number(payload.y)) : null,
          ts: payload.ts || Date.now()
        });
        if (this.galaxyChatMessages.length > 40) {
          this.galaxyChatMessages.shift();
        }
        if (this._galaxyChatCollapsed && !payload.system) {
          this._galaxyChatUnread = (this._galaxyChatUnread || 0) + 1;
          const unreadEl = document.getElementById('psg-chat-unread');
          if (unreadEl) {
            unreadEl.innerText = this._galaxyChatUnread > 9 ? '9+' : String(this._galaxyChatUnread);
            unreadEl.style.display = 'inline-block';
          }
        }
        this._renderGalaxyChatMessages();
      }

      _renderGalaxyChatMessages() {
        const box = document.getElementById('psg-chat-messages');
        if (!box) return;
        box.innerHTML = (this.galaxyChatMessages || []).map((m) => {
          if (m.system) {
            return `<div class="psg-chat-msg" style="color:#67e8f9; font-size:0.66rem; opacity:0.88;">${this._escapeHtml(m.text)}</div>`;
          }
          const nameColor = m.rarity === 'Mythic' ? '#ffd700' : (m.rarity === 'Legendary' ? '#c084fc' : '#38bdf8');
          const coordBtn = (m.x !== null && m.y !== null)
            ? `<button type="button" class="psg-chat-coord" onclick="window.PolySpaceGalaxy.instance.flyToChatCoords(${m.x}, ${m.y})" title="Click to fly to (${m.x}, ${m.y})">📍${m.x},${m.y}</button>`
            : '';
          return `<div class="psg-chat-msg"><span style="color:${nameColor}; font-weight:800;">${this._escapeHtml(m.username)}:</span> <span>${this._escapeHtml(m.text)}</span>${coordBtn}</div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
      }

      async sendGalaxyChat(pinCoords = false) {
        const input = document.getElementById('psg-chat-input');
        const rawText = input ? input.value.trim() : '';
        const text = rawText || (pinCoords ? 'Meet me at my coordinates!' : '');
        if (!text) return;

        const now = Date.now();
        if (now - (this._lastGalaxyChatSentAt || 0) < 1800) {
          this.showToast('⏳ Slow down pilot — wait 2s between messages.');
          return;
        }
        const { pid } = this._getSupabaseAndPlayerId();
        if (!pid) {
          this.showToast('⚠️ Sign in to chat in Galaxy Comms!');
          return;
        }
        this._lastGalaxyChatSentAt = now;
        if (input) input.value = '';

        const st = (window.appState && window.appState.state) || window.PolyState || {};
        const myName = st.username || (pid.length > 10 ? `${pid.slice(0, 6)}…${pid.slice(-4)}` : pid);
        const _psShip = (window.polySpace && typeof window.polySpace.getEquippedStarshipMultiplier === 'function')
          ? window.polySpace.getEquippedStarshipMultiplier() : null;
        const myRarity = (_psShip && _psShip.ship && _psShip.ship.rarity) || 'Pilot';

        const payload = {
          id: `${pid.slice(0, 8)}-${now}-${Math.floor(Math.random() * 9999)}`,
          playerId: pid,
          username: myName,
          rarity: myRarity,
          text: text.slice(0, 140),
          x: pinCoords ? Math.round(this.ship2D.x) : null,
          y: pinCoords ? Math.round(this.ship2D.y) : null,
          ts: now
        };

        this._onIncomingGalaxyChat(payload);
        if (this.livePresenceChannel && typeof this.livePresenceChannel.send === 'function') {
          try {
            await this.livePresenceChannel.send({
              type: 'broadcast',
              event: 'galaxy_chat',
              payload
            });
          } catch (err) {
            console.warn('[PolySpaceGalaxy] galaxy_chat send warning:', err);
          }
        }
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

        // Check if clicked on an unlocked/revealed Hidden Gift (Server-Verified Claim)
        for (const g of this.hiddenGifts) {
          const distToShip = Math.hypot(this.ship2D.x - g.x, this.ship2D.y - g.y);
          const distClick = Math.hypot(world.x - g.x, world.y - g.y);
          if (!g.claimed && distClick <= Math.max(48, 65 / this.camZoom)) {
            if (distToShip <= 320) {
              this.claimGalacticGift(g);
            } else {
              this.ship2D.targetX = g.x;
              this.ship2D.targetY = g.y;
              this.followShip2D = true;
              this.showToast(`🛸 Flying closer to ${g.title || 'Hidden Cache'} (${Math.round(distToShip)}u away)...`);
            }
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
          if (d <= Math.max(sys.radius + 14, 28 / this.camZoom)) {
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
          const clamped = this.clampGalaxyPos(Math.round(world.x), Math.round(world.y), this.ship2D.x, this.ship2D.y);
          this.ship2D.targetX = clamped.x;
          this.ship2D.targetY = clamped.y;
          this.followShip2D = true;
        }
      }

      showSystemBriefing(sys) {
        const hail = document.getElementById('pilot-hail-card');
        if (hail) hail.style.display = 'none';
        const card = document.getElementById('system-briefing-card');
        if (!card) return;
        card.style.display = 'block';
        document.getElementById('brief-sys-title').innerText = `${sys.id === 50 ? '👑' : '☀️'} #${sys.id} ${sys.name}`;
        const avgLvl = Math.round((this.shieldLevel + this.turretLevel + this.warpLevel) / 3);
        const lvlEl = document.getElementById('brief-sys-lvl');
        const isHard = sys.level > avgLvl + 5;
        lvlEl.innerText = `Lvl ${sys.level}${isHard ? ' ⚠️' : ''}`;
        lvlEl.style.color = isHard ? '#ff4d79' : '#00ff88';
        lvlEl.style.borderColor = isHard ? '#ff0055' : '#00ff88';

        const alreadyCleared = this.clearedSystems.has(sys.id);
        const killRate = sys.level >= 26 ? 2 : 1;
        document.getElementById('brief-sys-desc').innerText = alreadyCleared
          ? `✅ +${killRate} PGT/kill`
          : `+${sys.rewardPgt.toLocaleString()} PGT${sys.hasNft ? ' + 👑 NFT' : ''}`;
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

      // --------------------------------------------------------------------------
      // 3B. PHASE 3: HIDDEN COORDINATE GIFTS + NW CORNER BREACH EASTER EGG
      // --------------------------------------------------------------------------
      clampGalaxyPos(nx, ny, curX, curY) {
        const B = this.galaxyBound || 10000;
        const VB = this.voidBound || 12200;
        const cx = typeof curX === 'number' ? curX : this.ship2D.x;
        const cy = typeof curY === 'number' ? curY : this.ship2D.y;
        // Secret Northwest Corner Breach: ships inside the NW corner (x <= -9720 && y <= -9720)
        // or already outside the ±10,000 rim can slip into Deep Void Space (-12,200 .. -9,600)
        const alreadyInVoid = cx < -B || cy < -B;
        const atNwBreach = (cx <= -9720 && cy <= -9720) && (nx <= -9650 && ny <= -9650);
        if (alreadyInVoid || atNwBreach) {
          // Inside Deep Void Space: allow movement in the NW void quadrant and re-entry through the breach
          const clampedX = Math.max(-VB, Math.min(B, nx));
          const clampedY = Math.max(-VB, Math.min(B, ny));
          // Prevent clipping back across the solid rim far from the NW corner
          if ((clampedX < -B || clampedY < -B) && !(clampedX <= -9600 && clampedY <= -9600)) {
            return {
              x: Math.max(-B, Math.min(B, clampedX)),
              y: Math.max(-B, Math.min(B, clampedY))
            };
          }
          return { x: clampedX, y: clampedY };
        }
        return {
          x: Math.max(-B, Math.min(B, nx)),
          y: Math.max(-B, Math.min(B, ny))
        };
      }

      _updateGiftScanBadge(hint, remainingCount) {
        const badge = document.getElementById('gift-scan-badge');
        if (!badge) return;
        const rem = typeof remainingCount === 'number' ? remainingCount : this.giftRemainingCount;
        if (hint === 'signal_locked') {
          badge.style.display = 'inline-flex';
          badge.style.color = '#fbbf24';
          badge.innerText = '🎁 FOUND!';
        } else if (hint === 'very_warm') {
          badge.style.display = 'inline-flex';
          badge.style.color = '#ff4d79';
          badge.innerText = `🔥 HOT (${rem ?? '?'})`;
        } else if (hint === 'warm') {
          badge.style.display = 'inline-flex';
          badge.style.color = '#f59e0b';
          badge.innerText = `📡 WARM (${rem ?? '?'})`;
        } else if (typeof rem === 'number') {
          badge.style.display = 'inline-flex';
          badge.style.color = '#67e8f9';
          badge.innerText = `❄️ ${rem} left`;
        }
      }

      async scanForGalacticGifts(isManual = false) {
        if (this._giftScanInFlight) return;
        const { sb, pid } = this._getSupabaseAndPlayerId();
        if (!sb || !pid) {
          if (isManual) this.showToast('⚠️ Sign in to scan for Galactic Caches!');
          return;
        }
        const now = Date.now();
        if (isManual && now - this._lastGiftPingAt < 3100) {
          const wait = Math.ceil((3100 - (now - this._lastGiftPingAt)) / 1000);
          this.showToast(`📡 Deep-Space Scanner recharging (${wait}s)...`);
          return;
        }

        this._giftScanInFlight = true;
        this._lastGiftPingAt = now;
        this._lastGiftPingX = Math.round(this.ship2D.x);
        this._lastGiftPingY = Math.round(this.ship2D.y);

        const badge = document.getElementById('gift-scan-badge');
        const prevBadgeText = badge ? badge.innerText : '';
        if (badge && isManual) badge.innerText = 'SCAN...';

        try {
          const { data, error } = await sb.rpc('ping_galactic_coordinates', {
            p_player_id: pid,
            p_x: this._lastGiftPingX,
            p_y: this._lastGiftPingY
          });
          if (error) {
            if (badge && isManual) badge.innerText = prevBadgeText || '❄️';
            if (isManual) this.showToast('⚠️ Scanner offline: ' + (error.message || 'RPC error'));
            return;
          }
          if (!data || data.throttled) {
            if (badge && isManual) badge.innerText = prevBadgeText || '❄️';
            if (isManual) this.showToast('📡 Scanner cooling down — try again in 3s.');
            return;
          }

          if (typeof data.remaining_count === 'number') {
            this.giftRemainingCount = data.remaining_count;
          }
          if (data.nearby_hint) {
            this.giftHint = data.nearby_hint;
          }

          const revealed = Array.isArray(data.revealed) ? data.revealed : [];
          let newlyRevealedCount = 0;
          for (const item of revealed) {
            const existing = this.hiddenGifts.find(g => g.id === item.id);
            if (existing) {
              existing.claimed = !!item.claimed;
              existing.reward_pgt = item.reward_pgt;
              existing.title = item.title;
              existing.is_easter_egg = !!item.is_easter_egg;
            } else {
              this.hiddenGifts.push({
                id: item.id,
                x: Number(item.x),
                y: Number(item.y),
                title: item.title || 'Galactic Cache',
                reward_pgt: Number(item.reward_pgt || 100),
                is_easter_egg: !!item.is_easter_egg,
                claimed: !!item.claimed
              });
              if (!item.claimed) newlyRevealedCount++;
            }
          }

          this._updateGiftScanBadge(data.nearby_hint, data.remaining_count);

          if (newlyRevealedCount > 0) {
            const egg = revealed.find(r => r.is_easter_egg && !r.claimed);
            if (egg) {
              this.showToast(`👑 ANOMALY LOCKED! ${egg.title} detected — fly close & click to claim +${Number(egg.reward_pgt).toLocaleString()} PGT!`);
            } else {
              this.showToast(`🎁 SIGNAL LOCKED! ${newlyRevealedCount} Hidden Cache revealed on radar — fly within 300u & click to claim!`);
            }
          } else if (isManual) {
            if (data.nearby_hint === 'signal_locked') {
              this.showToast(`🎁 Hidden Cache already locked on your radar nearby! Click it within 300u to claim.`);
            } else if (data.nearby_hint === 'very_warm') {
              this.showToast(`🔥 VERY WARM! A Hidden Cache is within ~950u of (${this._lastGiftPingX}, ${this._lastGiftPingY})!`);
            } else if (data.nearby_hint === 'warm') {
              this.showToast(`📡 WARM SIGNAL! A Hidden Cache is within ~2,400u. Keep sweeping this quadrant!`);
            } else {
              this.showToast(`❄️ Cold sector (${this.giftRemainingCount ?? 0} unclaimed caches active across the Galaxy).`);
            }
          }
        } catch (err) {
          console.warn('[PolySpaceGalaxy] scanForGalacticGifts error:', err);
          if (badge && isManual) badge.innerText = prevBadgeText || '❄️';
          if (isManual) this.showToast('⚠️ Scanner interference — please retry.');
        } finally {
          this._giftScanInFlight = false;
        }
      }

      async claimGalacticGift(g) {
        if (!g || g.claimed || this._giftClaimInFlight) return;
        const { sb, pid } = this._getSupabaseAndPlayerId();
        if (!sb || !pid) {
          this.showToast('⚠️ Sign in to claim Galactic Caches!');
          return;
        }
        this._giftClaimInFlight = true;
        try {
          const { data, error } = await sb.rpc('claim_polyspace_coordinate_gift', {
            p_player_id: pid,
            p_gift_id: g.id,
            p_x: Math.round(this.ship2D.x),
            p_y: Math.round(this.ship2D.y)
          });
          if (error) {
            this.showToast('⚠️ Claim failed: ' + (error.message || 'Server error'));
            return;
          }
          if (!data || !data.ok) {
            const msg = data?.error || 'Unable to claim cache.';
            if (msg.toLowerCase().includes('already claimed')) g.claimed = true;
            this.showToast(`⚠️ ${msg}`);
            return;
          }
          g.claimed = true;
          if (typeof this.giftRemainingCount === 'number' && !g.is_easter_egg) {
            this.giftRemainingCount = Math.max(0, this.giftRemainingCount - 1);
            this._updateGiftScanBadge('cold', this.giftRemainingCount);
          }
          const reward = Number(data.reward_pgt || g.reward_pgt || 0);
          if (typeof data.new_balance === 'number') {
            if (window.appState && window.appState.state) {
              window.appState.state.balance_pgt = data.new_balance;
              window.appState.state.balancePgt = data.new_balance;
            }
            if (window.PolyState) {
              window.PolyState.balancePgt = data.new_balance;
              window.PolyState.balance_pgt = data.new_balance;
            }
            if (typeof window.updateHeaderBalance === 'function') window.updateHeaderBalance();
          }
          if (typeof this._updateGalaxyPgtHud === 'function') {
            this._updateGalaxyPgtHud();
          }
          if (g.is_easter_egg || data.is_easter_egg) {
            this.showToast(`👑 BEYOND-THE-RIM VAULT UNLOCKED! +${reward.toLocaleString()} PGT credited!`, 6000);
          } else {
            this.showToast(`🎁 ${g.title || 'HIDDEN CACHE'} CLAIMED! +${reward.toLocaleString()} PGT credited!`, 4500);
          }
        } catch (err) {
          console.warn('[PolySpaceGalaxy] claimGalacticGift error:', err);
          this.showToast('⚠️ Claim request failed — please retry.');
        } finally {
          this._giftClaimInFlight = false;
        }
      }

      flyToGiftHint() {
        this.scanForGalacticGifts(true);
      }

      flyToInputCoords() {
        const gx = parseInt(document.getElementById('input-gx').value, 10);
        const gy = parseInt(document.getElementById('input-gy').value, 10);
        const B = this.galaxyBound;
        if (isNaN(gx) || isNaN(gy)) {
          this.showToast(`⚠️ Enter X and Y coordinates (-${B} to +${B}) first!`);
          return;
        }
        const clamped = this.clampGalaxyPos(gx, gy, this.ship2D.x, this.ship2D.y);
        this.ship2D.targetX = clamped.x;
        this.ship2D.targetY = clamped.y;
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
        document.getElementById('hail-pilot-stats').innerText = `🛡️${pilot.shield} ☄️${pilot.turret}`;
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
        if (isKill) {
          this.totalKills += 1;
          this.missionKills = (this.missionKills || 0) + 1;
        }
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

      async renderRankLeaderboard() {
        this.updateUpgrades();
        const myRank = this.getPilotRank(this.combatXpAllTime);
        document.getElementById('rank-my-summary').innerHTML = `
          <span><strong>Your Rank:</strong> <span style="color:${myRank.color}; font-weight:900;">${myRank.icon} ${myRank.title}</span> &nbsp;<span style="font-size:0.7rem; padding:1px 6px; border-radius:4px; background:rgba(56,189,248,0.14); border:1px solid rgba(56,189,248,0.35); color:#38bdf8;">🛡️ S${this.shieldLevel}</span> <span style="font-size:0.7rem; padding:1px 6px; border-radius:4px; background:rgba(255,77,121,0.14); border:1px solid rgba(255,77,121,0.35); color:#ff4d79;">☄️ T${this.turretLevel}</span></span>
          <span>Weekly: <strong style="color:#00ff88;">${this.combatXpWeekly.toLocaleString()} XP</strong> • All-Time: <strong style="color:#ffd700;">${this.combatXpAllTime.toLocaleString()} XP</strong> • Kills: <strong>${this.totalKills}</strong></span>
        `;

        const wrapEl = document.getElementById('rank-table-wrap');
        const isWeekly = this.rankTab === 'weekly';
        const mode = isWeekly ? 'weekly' : 'alltime';
        if (wrapEl) {
          wrapEl.innerHTML = '<div style="text-align:center; padding:18px; color:#94a3b8;">⏳ Loading live Ace Pilot rankings...</div>';
        }

        const { sb, pid } = this._getSupabaseAndPlayerId();
        let rows = [];
        if (sb) {
          try {
            const { data, error } = await sb.rpc('get_polyspace_combat_leaderboard', {
              p_mode: mode,
              p_limit: 50
            });
            if (!error && data && data.success && Array.isArray(data.rows)) {
              rows = data.rows.map((r) => {
                const rPid = String(r.player_id || '').toLowerCase();
                const isMe = Boolean(pid && rPid === pid);
                const rawName = r.username || (rPid.length > 10 ? `${rPid.slice(0, 6)}…${rPid.slice(-4)}` : (rPid || 'Pilot'));
                const safeName = typeof window.escapeHtml === 'function'
                  ? window.escapeHtml(rawName)
                  : rawName.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
                return {
                  name: isMe ? `${safeName} (You)` : safeName,
                  isMe,
                  xp: Number(r.xp || 0),
                  pgtEarned: Number(r.pgt_earned || 0),
                  totalXp: Number(r.combat_xp_total || r.xp || 0),
                  kills: Number(r.kills || 0),
                  cleared: Number(r.cleared || 0),
                  shield: Number(r.shield_level || 1),
                  turret: Number(r.turret_level || 1)
                };
              });
            }
          } catch (err) {
            console.warn('[PolySpaceGalaxy] get_polyspace_combat_leaderboard error:', err);
          }
        }

        if (!wrapEl) return;
        if (rows.length === 0) {
          wrapEl.innerHTML = `<div style="text-align:center; padding:22px 12px; color:#94a3b8;">
            🚀 No ${isWeekly ? 'Weekly Sprint' : 'All-Time'} combat clears yet — launch a 3D Solar System mission to claim <strong>#1</strong>!
          </div>`;
          return;
        }

        let html = `<table style="width:100%; border-collapse:collapse;">
          <tr style="color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.12); text-align:left;">
            <th style="padding:6px;">#</th>
            <th style="padding:6px;">Pilot & Rank</th>
            <th style="padding:6px; text-align:center;">Ship</th>
            <th style="padding:6px; text-align:right;">PGT</th>
            <th style="padding:6px; text-align:right;">${isWeekly ? 'Weekly XP' : 'All-Time XP'}</th>
            <th style="padding:6px; text-align:right;">Kills</th>
            <th style="padding:6px; text-align:right;">Sys</th>
          </tr>`;
        rows.forEach((r, idx) => {
          const rk = this.getPilotRank(r.totalXp);
          const bg = r.isMe ? 'rgba(0,240,255,0.14)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent');
          html += `<tr style="background:${bg}; border-bottom:1px solid rgba(255,255,255,0.05);">
            <td style="padding:6px; font-weight:900; color:${idx < 3 ? '#ffd700' : '#94a3b8'};">#${idx + 1}</td>
            <td style="padding:6px; font-weight:${r.isMe ? '900' : '700'}; color:${r.isMe ? '#00f0ff' : '#fff'};">${r.name} <span style="font-size:0.68rem; color:${rk.color};">${rk.icon} ${rk.title}</span></td>
            <td style="padding:6px; text-align:center; white-space:nowrap;">
              <span title="Quantum Shield Level" style="font-size:0.66rem; font-weight:800; padding:1px 5px; border-radius:4px; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.32); color:#38bdf8;">🛡️${r.shield}</span>
              <span title="Plasma Turrets Level" style="font-size:0.66rem; font-weight:800; padding:1px 5px; border-radius:4px; background:rgba(255,77,121,0.12); border:1px solid rgba(255,77,121,0.32); color:#ff4d79;">☄️${r.turret}</span>
            </td>
            <td style="padding:6px; text-align:right; font-family:monospace; font-weight:800; color:#ffd700; white-space:nowrap;">${Math.round(r.pgtEarned).toLocaleString()}</td>
            <td style="padding:6px; text-align:right; font-family:monospace; font-weight:800; color:${isWeekly ? '#00ff88' : '#ffd700'};">${r.xp.toLocaleString()}</td>
            <td style="padding:6px; text-align:right; font-family:monospace;">${r.kills.toLocaleString()}</td>
            <td style="padding:6px; text-align:right; font-family:monospace; color:#cbd5e1;">${r.cleared}/50</td>
          </tr>`;
        });
        html += '</table>';
        wrapEl.innerHTML = html;
      }

      openPostTradeBeacon() {
        this.selectedBeacon = null;
        document.getElementById('trade-subtitle').innerText = `POST AT YOUR COORDS (X: ${Math.round(this.ship2D.x)}, Y: ${Math.round(this.ship2D.y)})`;
        document.getElementById('trade-title').innerText = '🤝 DROP OPEN TRADE BEACON';
        document.getElementById('trade-post-view').style.display = 'block';
        document.getElementById('trade-accept-view').style.display = 'none';
        document.getElementById('trade-modal').style.display = 'flex';
      }

      async deployTradeBeacon() {
        const offerLabel = document.getElementById('beacon-offer-asset').value;
        const offerKey = this._assetLabelToKey(offerLabel);
        const offerAmt = Math.max(2, parseInt(document.getElementById('beacon-offer-amt').value, 10) || 2);
        const wantLabel = document.getElementById('beacon-want-asset').value;
        const wantKey = this._assetLabelToKey(wantLabel);
        const wantAmt = Math.max(2, parseInt(document.getElementById('beacon-want-amt').value, 10) || 2);
        const bx = Math.round(this.ship2D.x);
        const by = Math.round(this.ship2D.y);

        const { sb, pid } = this._getSupabaseAndPlayerId();
        if (!sb || !pid) {
          this.showToast('⚠️ Connect your account to drop a live Trade Beacon.');
          return;
        }
        const { data, error } = await sb.rpc('create_polyspace_trade_beacon', {
          p_player_id: pid,
          p_x: bx,
          p_y: by,
          p_offer_asset: offerKey,
          p_offer_amount: offerAmt,
          p_want_asset: wantKey,
          p_want_amount: wantAmt
        });
        if (error || !data || !data.success) {
          this.showToast(`❌ ${(data && data.error) || (error && error.message) || 'Could not drop Trade Beacon.'}`);
          return;
        }
        if (data.new_space_state && window.appState) {
          window.appState.update({ spaceState: data.new_space_state });
          if (window.polySpace && typeof window.polySpace.syncCloudSpaceState === 'function') window.polySpace.syncCloudSpaceState(true);
        }
        document.getElementById('trade-modal').style.display = 'none';
        await this.loadTradeBeaconsFromDB();
        if (this.livePresenceChannel) {
          this.livePresenceChannel.send({ type: 'broadcast', event: 'beacon_updated', payload: { by: pid } });
        }
        this.showToast(`📡 Live Trade Beacon dropped at (${bx}, ${by}): ${offerAmt.toLocaleString()} ${offerLabel} for ${wantAmt.toLocaleString()} ${wantLabel}!`);
      }

      openInspectTradeBeacon(tb) {
        this.selectedBeacon = tb;
        const burnedOffer = Math.max(1, Math.ceil(tb.offerAmt * 0.05));
        const netReceive = Math.max(1, tb.offerAmt - burnedOffer);
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

      async acceptSelectedBeacon() {
        const tb = this.selectedBeacon;
        if (!tb) return;
        const { sb, pid } = this._getSupabaseAndPlayerId();
        if (!sb || !pid) {
          this.showToast('⚠️ Connect your account to trade.');
          return;
        }
        const rpcName = tb.isMine ? 'cancel_polyspace_trade_beacon' : 'accept_polyspace_trade_beacon';
        const { data, error } = await sb.rpc(rpcName, { p_player_id: pid, p_beacon_id: tb.id });
        if (error || !data || !data.success) {
          this.showToast(`❌ ${(data && data.error) || (error && error.message) || 'Trade failed.'}`);
          return;
        }
        if (data.new_space_state && window.appState) {
          window.appState.update({ spaceState: data.new_space_state });
          if (window.polySpace && typeof window.polySpace.syncCloudSpaceState === 'function') window.polySpace.syncCloudSpaceState(true);
        }
        this.selectedBeacon = null;
        document.getElementById('trade-modal').style.display = 'none';
        await this.loadTradeBeaconsFromDB();
        if (this.livePresenceChannel) {
          this.livePresenceChannel.send({ type: 'broadcast', event: 'beacon_updated', payload: { by: pid } });
        }
        if (tb.isMine) {
          this.showToast(`🔄 Cancelled Trade Beacon — ${tb.offerAmt.toLocaleString()} ${tb.offerAsset} refunded!`);
        } else {
          const netReceive = Number(data.received_amount || Math.max(1, Math.floor(tb.offerAmt * 0.95)));
          this.showToast(`✅ Trade Complete with ${tb.seller}! Received ${netReceive.toLocaleString()} ${tb.offerAsset} (5% burn applied).`);
        }
      }

      openTacticalDuel() {
        if (!this.selectedPilot) return;
        this.acceptingDuelId = null;
        if (this.duelAnimId) {
          cancelAnimationFrame(this.duelAnimId);
          this.duelAnimId = null;
        }
        const isBot = Boolean(this.selectedPilot.isBot);
        document.getElementById('duel-title').innerText = isBot
          ? `🤖 SPARRING vs. ${this.selectedPilot.name.toUpperCase()} (0 PGT Friendly)`
          : `⚔️ CHALLENGE ${this.selectedPilot.name.toUpperCase()} (60s Accept • 5% Fee)`;
        const wagerSel = document.getElementById('duel-wager');
        if (wagerSel) {
          if (isBot) {
            wagerSel.value = '0';
            wagerSel.disabled = true;
          } else {
            wagerSel.disabled = false;
          }
        }
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

      async startTacticalDuelPlayback() {
        const rival = this.selectedPilot;
        if (!rival) return;

        // 1. Live PvP: Accepting an incoming 60s challenge
        if (this.acceptingDuelId) {
          const duelId = this.acceptingDuelId;
          this.acceptingDuelId = null;
          const { sb, pid } = this._getSupabaseAndPlayerId();
          const { data, error } = await sb.rpc('accept_polyspace_duel', {
            p_player_id: pid,
            p_duel_id: duelId,
            p_attacks: this.duelMyAttacks,
            p_defenses: this.duelMyDefenses
          });
          if (error || !data || !data.success) {
            this.showToast(`❌ ${(data && data.error) || (error && error.message) || 'Could not accept duel.'}`);
            this.closeTacticalDuel();
            return;
          }
          if (data.new_balance !== undefined && window.appState) {
            window.appState.update({ balancePgt: parseFloat(parseFloat(data.new_balance).toFixed(2)) });
            if (typeof window.appState.syncUI === 'function') window.appState.syncUI();
          }
          this._playedDuelIds.add(duelId);
          if (this.livePresenceChannel && data.battle_log) {
            this.livePresenceChannel.send({ type: 'broadcast', event: 'duel_resolved', payload: { p1Id: data.battle_log.p1Id, p2Id: data.battle_log.p2Id } });
          }
          this.playServerDuelLog(data.battle_log);
          return;
        }

        // 2. Live PvP: Sending a 60-second challenge to a real online pilot
        if (!rival.isBot) {
          const { sb, pid } = this._getSupabaseAndPlayerId();
          const wager = parseInt(document.getElementById('duel-wager').value, 10) || 0;
          const { data, error } = await sb.rpc('create_polyspace_duel', {
            p_player_id: pid,
            p_opponent_id: rival.playerId || rival.id,
            p_wager_pgt: wager,
            p_attacks: this.duelMyAttacks,
            p_defenses: this.duelMyDefenses
          });
          if (error || !data || !data.success) {
            this.showToast(`❌ ${(data && data.error) || (error && error.message) || 'Could not send challenge.'}`);
            return;
          }
          if (data.new_balance !== undefined && window.appState) {
            window.appState.update({ balancePgt: parseFloat(parseFloat(data.new_balance).toFixed(2)) });
            if (typeof window.appState.syncUI === 'function') window.appState.syncUI();
          }
          this._waitingDuelId = data.duel_id;
          if (this.livePresenceChannel) {
            this.livePresenceChannel.send({ type: 'broadcast', event: 'duel_challenge', payload: { duel_id: data.duel_id, opponent_id: rival.playerId || rival.id } });
          }
          document.getElementById('duel-setup-phase').style.display = 'none';
          document.getElementById('duel-playback-phase').style.display = 'block';
          document.getElementById('duel-result-actions').style.display = 'none';
          document.getElementById('duel-p2-name').innerText = rival.name.toUpperCase();
          document.getElementById('duel-log-box').innerHTML = `⏳ <strong>Challenge sent to ${this._escapeHtml(rival.name)}!</strong> Waiting up to <strong>60 seconds</strong> for them to accept (${wager} PGT escrowed, 5% fee on win; auto-refunds if declined/expired).`;
          this.showToast(`⚔️ Duel challenge sent to ${rival.name} (60s to accept)!`);
          return;
        }

        // 3. Calm Sparring Bot (0 PGT Friendly Practice Duel)
        const dirs = ['LEFT', 'TOP', 'RIGHT'];
        const rivalAtks = [0, 1, 2].map(() => dirs[Math.floor(Math.random() * 3)]);
        const rivalDefs = [0, 1, 2].map(() => dirs[Math.floor(Math.random() * 3)]);

        const myMaxHp = 500 + this.shieldLevel * 45;
        const rivalMaxHp = 500 + rival.shield * 45;
        const myBaseDmg = 140 + this.turretLevel * 14;
        const rivalBaseDmg = 140 + rival.turret * 14;

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

        const wager = 0;
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

      fireFunLaser2D() {
        const s = this.ship2D;
        if (!s) return;
        this.funLaserCd2D = 0.12;
        const cos = Math.cos(s.angle);
        const sin = Math.sin(s.angle);
        const px = -sin;
        const py = cos;
        const boltSpeed = 1150;
        const noseDist = 18;
        const wingOffset = 7;

        for (const side of [-1, 1]) {
          const bx = s.x + cos * noseDist + px * wingOffset * side;
          const by = s.y + sin * noseDist + py * wingOffset * side;
          this.funLasers2D.push({
            x: bx,
            y: by,
            vx: cos * boltSpeed + (s.vx || 0) * 0.25,
            vy: sin * boltSpeed + (s.vy || 0) * 0.25,
            angle: s.angle,
            life: 0.75,
            maxLife: 0.75,
            color: side === -1 ? '#00f0ff' : '#ff4d94'
          });
          this.funSparks2D.push({
            x: bx,
            y: by,
            vx: cos * 140 + (Math.random() - 0.5) * 90,
            vy: sin * 140 + (Math.random() - 0.5) * 90,
            life: 0.18,
            maxLife: 0.18,
            color: '#ffffff'
          });
        }
        if (this.funLasers2D.length > 80) this.funLasers2D.splice(0, this.funLasers2D.length - 80);
      }

      renderFunLasers2D(ctx, zoom) {
        const invZ = 1 / Math.max(0.25, Math.sqrt(zoom || 1));
        if (this.funLasers2D && this.funLasers2D.length) {
          ctx.save();
          ctx.lineCap = 'round';
          for (const b of this.funLasers2D) {
            const alpha = Math.max(0, Math.min(1, b.life / b.maxLife));
            const len = 18 * invZ;
            const tx = b.x - Math.cos(b.angle) * len;
            const ty = b.y - Math.sin(b.angle) * len;
            ctx.strokeStyle = b.color;
            ctx.globalAlpha = alpha * 0.9;
            ctx.lineWidth = 3.2 * invZ;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 1.4 * invZ;
            ctx.beginPath();
            ctx.moveTo(b.x - Math.cos(b.angle) * len * 0.45, b.y - Math.sin(b.angle) * len * 0.45);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
          ctx.restore();
        }
        if (this.funSparks2D && this.funSparks2D.length) {
          ctx.save();
          for (const sp of this.funSparks2D) {
            const alpha = Math.max(0, Math.min(1, sp.life / sp.maxLife));
            ctx.fillStyle = sp.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, Math.max(1.2, 2.8 * alpha * invZ), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      updateGalaxy2D(dt) {
        const s = this.ship2D;
        const maxSpeed = 240 + this.warpLevel * 12; // Warp level scales 2D galaxy cruise speed
        const B = this.galaxyBound;

        // Desktop Arrow-Key Manual Flight
        const k = this.keys || {};
        const ix = (k['ArrowRight'] ? 1 : 0) - (k['ArrowLeft'] ? 1 : 0);
        const iy = (k['ArrowDown'] ? 1 : 0) - (k['ArrowUp'] ? 1 : 0);

        if (ix !== 0 || iy !== 0) {
          s.targetX = null;
          s.targetY = null;
          this.followShip2D = true;
          s._isManualThrust = true;

          const desiredAngle = Math.atan2(iy, ix);
          let diff = desiredAngle - s.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          s.angle += diff * Math.min(1, dt * 14);

          const mag = Math.hypot(ix, iy) || 1;
          s.vx = (ix / mag) * maxSpeed;
          s.vy = (iy / mag) * maxSpeed;
          const nextPos = this.clampGalaxyPos(s.x + s.vx * dt, s.y + s.vy * dt, s.x, s.y);
          s.x = nextPos.x;
          s.y = nextPos.y;

          if (Math.random() < 0.75) {
            s.trail.push({ x: s.x, y: s.y, life: 1.0 });
          }
        } else if (s.targetX !== null && s.targetY !== null) {
          s._isManualThrust = false;
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
            const nextPos = this.clampGalaxyPos(s.x + s.vx * dt, s.y + s.vy * dt, s.x, s.y);
            s.x = nextPos.x;
            s.y = nextPos.y;

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
        } else {
          s._isManualThrust = false;
          if (Math.hypot(s.vx, s.vy) > 4) {
            const damp = Math.pow(0.02, dt);
            s.vx *= damp;
            s.vy *= damp;
            const nextPos = this.clampGalaxyPos(s.x + s.vx * dt, s.y + s.vy * dt, s.x, s.y);
            s.x = nextPos.x;
            s.y = nextPos.y;
          } else {
            s.vx = 0;
            s.vy = 0;
          }
        }

        // Silent movement-gated Galactic Cache proximity scan (0 requests while idle!)
        if (Math.hypot(s.x - this._lastGiftPingX, s.y - this._lastGiftPingY) >= 450 && Date.now() - this._lastGiftPingAt >= 6000) {
          this.scanForGalacticGifts(false);
        }

        // Cosmetic Spacebar Rapid-Fire Lasers (Just for fun!)
        this.funLaserCd2D = Math.max(0, (this.funLaserCd2D || 0) - dt);
        if (k['Space'] && this.funLaserCd2D <= 0) {
          this.fireFunLaser2D();
        }
        for (let i = this.funLasers2D.length - 1; i >= 0; i--) {
          const b = this.funLasers2D[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.life -= dt;
          let hit = false;
          for (const sys of this.solarSystems) {
            if (Math.hypot(b.x - sys.x, b.y - sys.y) <= sys.radius + 3) {
              hit = true;
              break;
            }
          }
          if (hit || b.life <= 0) {
            if (hit) {
              for (let p = 0; p < 5; p++) {
                const a = Math.random() * Math.PI * 2;
                const sp = 50 + Math.random() * 140;
                this.funSparks2D.push({
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(a) * sp,
                  vy: Math.sin(a) * sp,
                  life: 0.28,
                  maxLife: 0.28,
                  color: b.color
                });
              }
            }
            this.funLasers2D.splice(i, 1);
          }
        }
        for (let i = this.funSparks2D.length - 1; i >= 0; i--) {
          const sp = this.funSparks2D[i];
          sp.x += sp.vx * dt;
          sp.y += sp.vy * dt;
          sp.life -= dt;
          if (sp.life <= 0) this.funSparks2D.splice(i, 1);
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

        // Push our own live coordinates to Supabase Realtime Presence (throttled ~1.5s while moving, 0 traffic while parked)
        this.pushPresenceIfMoved(false);
        if (this.pendingIncomingDuel) {
          this.renderIncomingDuelBanner();
        }

        // Update Calm Sparring Bot (idles, hops every 25-40s) & Smoothly Interpolate Real Online Pilots
        if (this.otherPilots) {
          const nowMs = performance.now();
          for (const pl of this.otherPilots) {
            const dx = pl.targetX - pl.x;
            const dy = pl.targetY - pl.y;
            const dist = Math.hypot(dx, dy);
            if (pl.isBot) {
              if (dist > 8) {
                const ang = Math.atan2(dy, dx);
                let diff = ang - pl.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                pl.angle += diff * Math.min(1, dt * 4);
                pl.x += Math.cos(pl.angle) * pl.speed * dt;
                pl.y += Math.sin(pl.angle) * pl.speed * dt;
                if (Math.random() < 0.25) pl.trail.push({ x: pl.x, y: pl.y, life: 1.0 });
              } else if (nowMs >= (pl.nextHopAt || 0)) {
                const a = Math.random() * Math.PI * 2;
                const r = 170 + Math.random() * 190;
                pl.targetX = Math.round(Math.cos(a) * r);
                pl.targetY = Math.round(Math.sin(a) * r);
                pl.nextHopAt = nowMs + 25000 + Math.random() * 15000;
              }
            } else {
              // Real online pilot: smooth 60 FPS lerp toward their latest Presence coordinates
              if (dist > 2) {
                pl.x += dx * Math.min(1, dt * 4.5);
                pl.y += dy * Math.min(1, dt * 4.5);
                if (dist > 14 && Math.random() < 0.35) pl.trail.push({ x: pl.x, y: pl.y, life: 1.0 });
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
        const pgtEl = document.getElementById('galaxy-pgt-readout');
        if (pgtEl && window.appState && window.appState.state) {
          const livePgt = Number(window.appState.state.balancePgt || 0);
          if (this._lastDisplayedPgt !== livePgt) {
            const prevPgt = this._lastDisplayedPgt;
            this._lastDisplayedPgt = livePgt;
            const formatted = Math.floor(livePgt).toLocaleString();
            if (prevPgt !== undefined && livePgt > prevPgt) {
              const diff = Math.round(livePgt - prevPgt);
              pgtEl.innerHTML = `🪙 ${formatted} PGT <span style="color:#00ff88; margin-left:3px;">+${diff.toLocaleString()}</span>`;
              pgtEl.style.textShadow = '0 0 10px rgba(0, 255, 136, 0.85)';
              clearTimeout(this._pgtFlashTimer);
              this._pgtFlashTimer = setTimeout(() => {
                const el = document.getElementById('galaxy-pgt-readout');
                if (el) {
                  el.innerText = `🪙 ${Math.floor(Number(window.appState?.state?.balancePgt || 0)).toLocaleString()} PGT`;
                  el.style.textShadow = 'none';
                }
              }, 2400);
            } else {
              pgtEl.innerText = `🪙 ${formatted} PGT`;
            }
          }
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

      renderOutpostHub(ctx, x, y, nowOutpost = Date.now(), showCoords = true) {
        const hubPulse = 0.5 + 0.5 * Math.sin(nowOutpost / 650);
        const hubRot = (nowOutpost / 9000) % (Math.PI * 2);

        ctx.save();
        ctx.translate(x, y);

        // Soft Outer Energy Shield Halo
        const hubHalo = ctx.createRadialGradient(0, 0, 14, 0, 0, 56);
        hubHalo.addColorStop(0, 'rgba(0, 240, 255, 0.34)');
        hubHalo.addColorStop(0.55, 'rgba(29, 78, 216, 0.16)');
        hubHalo.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = hubHalo;
        ctx.beginPath();
        ctx.arc(0, 0, 56, 0, Math.PI * 2);
        ctx.fill();

        // Rotating Outer Starbase Docking Ring + 4 Cardinal Solar Wing Pylons
        ctx.save();
        ctx.rotate(hubRot);
        for (let a = 0; a < 4; a++) {
          ctx.save();
          ctx.rotate((a * Math.PI) / 2);
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.2;
          ctx.fillRect(14, -3.5, 24, 7);
          ctx.strokeRect(14, -3.5, 24, 7);
          ctx.fillStyle = 'rgba(0, 240, 255, 0.28)';
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1;
          ctx.fillRect(22, -10, 11, 5.5);
          ctx.strokeRect(22, -10, 11, 5.5);
          ctx.fillRect(22, 4.5, 11, 5.5);
          ctx.strokeRect(22, 4.5, 11, 5.5);
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(40, 0, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffd700';
          ctx.stroke();
          ctx.fillStyle = (Math.floor(nowOutpost / 450 + a) % 2 === 0) ? '#00ff88' : '#ffd700';
          ctx.beginPath();
          ctx.arc(40, 0, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 27, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, 27, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Central Octagonal Command Citadel
        ctx.save();
        ctx.rotate(-hubRot * 0.6);
        const hubCitadelGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 18);
        hubCitadelGrad.addColorStop(0, '#38bdf8');
        hubCitadelGrad.addColorStop(0.5, '#1d4ed8');
        hubCitadelGrad.addColorStop(1, '#0b1636');
        ctx.fillStyle = hubCitadelGrad;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const ang = (k * Math.PI) / 4;
          const px = Math.cos(ang) * 17;
          const py = Math.sin(ang) * 17;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Pulsing Quantum Reactor Core
        const reactorGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 9 + hubPulse * 2);
        reactorGrad.addColorStop(0, '#ffffff');
        reactorGrad.addColorStop(0.45, '#00f0ff');
        reactorGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = reactorGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 9 + hubPulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Outpost Label Pill
        const labelTxt = showCoords ? '🛰️ Outpost Hub (0,0)' : '🛰️ Outpost Hub';
        const pillW = showCoords ? 124 : 96;
        ctx.fillStyle = 'rgba(4, 12, 28, 0.82)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-pillW / 2, 46, pillW, 18, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labelTxt, 0, 58.5);
        ctx.restore();
      }

      renderSolarSystemPlanet(ctx, sys, nowPlanet = Date.now()) {
        const isSelected = this.selectedSystemId === sys.id;
        const isCleared = this.clearedSystems.has(sys.id);
        const r = sys.radius;
        const baseColor = isCleared ? '#00ff88' : sys.color;
        const hasRing = sys.id === 50 || sys.id % 2 === 0 || sys.id % 10 === 0;
        const ringTilt = ((sys.id % 5) - 2) * 0.16 + 0.25;
        const pulse = Math.sin(nowPlanet / 280 + sys.id) * 2.5;

        ctx.save();
        ctx.translate(sys.x, sys.y);

        // Atmospheric Halo Glow
        const haloR = r * (sys.id === 50 ? 2.25 : 1.75);
        const halo = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, haloR);
        halo.addColorStop(0, sys.id === 50 ? 'rgba(255, 215, 0, 0.42)' : `${baseColor}55`);
        halo.addColorStop(0.55, sys.id === 50 ? 'rgba(192, 132, 252, 0.22)' : `${baseColor}1f`);
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Back Half of Planetary Ring
        if (hasRing) {
          ctx.save();
          ctx.rotate(ringTilt);
          ctx.strokeStyle = sys.id === 50 ? 'rgba(255, 215, 0, 0.55)' : 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = sys.id === 50 ? 4.5 : 3;
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.72, r * 0.48, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = sys.id === 50 ? 'rgba(0, 240, 255, 0.45)' : `${baseColor}66`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.98, r * 0.56, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // 3D-Shaded Planet Sphere + Clipped Procedural Surface Details
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();

        if (sys.id === 50) {
          const bhGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
          bhGrad.addColorStop(0, '#02000a');
          bhGrad.addColorStop(0.62, '#1e0538');
          bhGrad.addColorStop(0.84, '#c084fc');
          bhGrad.addColorStop(1, '#ffd700');
          ctx.fillStyle = bhGrad;
          ctx.fillRect(-r, -r, r * 2, r * 2);
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.62, (nowPlanet / 500) % (Math.PI * 2), (nowPlanet / 500) % (Math.PI * 2) + 2.4);
          ctx.stroke();
        } else {
          const pGrad = ctx.createRadialGradient(-r * 0.36, -r * 0.36, r * 0.1, 0, 0, r * 1.15);
          pGrad.addColorStop(0, '#ffffff');
          pGrad.addColorStop(0.24, baseColor);
          pGrad.addColorStop(0.74, '#0c1630');
          pGrad.addColorStop(1, '#020612');
          ctx.fillStyle = pGrad;
          ctx.fillRect(-r, -r, r * 2, r * 2);

          const biome = sys.id % 3;
          if (biome === 0) {
            ctx.rotate(ringTilt * 0.5);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
            ctx.fillRect(-r, -r * 0.52, r * 2, r * 0.22);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.fillRect(-r, -r * 0.12, r * 2, r * 0.24);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.11)';
            ctx.fillRect(-r, r * 0.28, r * 2, r * 0.18);
            ctx.fillStyle = 'rgba(255, 230, 160, 0.28)';
            ctx.beginPath();
            ctx.ellipse(r * 0.2, r * 0.16, r * 0.26, r * 0.13, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (biome === 1) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.beginPath();
            ctx.ellipse(-r * 0.22, -r * 0.22, r * 0.42, r * 0.24, -0.4, 0, Math.PI * 2);
            ctx.ellipse(r * 0.28, r * 0.22, r * 0.36, r * 0.2, 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(230, 250, 255, 0.35)';
            ctx.beginPath();
            ctx.ellipse(0, -r * 0.85, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            const craters = [[-0.3, -0.15, 0.22], [0.22, 0.24, 0.18], [-0.08, 0.38, 0.14]];
            for (const [cxOff, cyOff, cr] of craters) {
              ctx.beginPath();
              ctx.arc(r * cxOff, r * cyOff, r * cr, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          }

          const shadowGrad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.55, 0, 0, r);
          shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          shadowGrad.addColorStop(1, 'rgba(2, 4, 14, 0.62)');
          ctx.fillStyle = shadowGrad;
          ctx.fillRect(-r, -r, r * 2, r * 2);
        }
        ctx.restore();

        // Crisp Lit Rim-Light Border
        ctx.strokeStyle = sys.id === 50 ? '#ffd700' : `${baseColor}cc`;
        ctx.lineWidth = sys.id === 50 ? 2.4 : 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // Front Half of Planetary Ring
        if (hasRing) {
          ctx.save();
          ctx.rotate(ringTilt);
          ctx.strokeStyle = sys.id === 50 ? 'rgba(255, 215, 0, 0.85)' : 'rgba(255, 255, 255, 0.48)';
          ctx.lineWidth = sys.id === 50 ? 4.5 : 3;
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.72, r * 0.48, 0, 0, Math.PI);
          ctx.stroke();
          ctx.strokeStyle = sys.id === 50 ? 'rgba(0, 240, 255, 0.72)' : `${baseColor}aa`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.98, r * 0.56, 0, 0, Math.PI);
          ctx.stroke();
          ctx.restore();
        }

        // Orbiting Moon
        const moonAng = (nowPlanet / (2400 + sys.id * 90)) + sys.id * 1.7;
        const mx = Math.cos(moonAng) * (r * 1.48);
        const my = Math.sin(moonAng) * (r * 0.62);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(2.4, r * 0.13), 0, Math.PI * 2);
        ctx.fill();

        // Selection / Cleared / Boss Outer Tactical Ring
        if (isSelected || sys.id === 50 || isCleared) {
          ctx.strokeStyle = isSelected ? '#ffd700' : (isCleared ? '#00ff88' : '#c084fc');
          ctx.lineWidth = isSelected ? 2.5 : 1.8;
          ctx.setLineDash(isSelected ? [8, 5] : []);
          ctx.beginPath();
          ctx.arc(0, 0, r + 9 + pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // System Number & Level Label
        ctx.fillStyle = '#ffffff';
        ctx.font = sys.id === 50 ? 'bold 13px sans-serif' : 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${sys.id === 50 ? '👑 ' : (isCleared ? '✅ ' : '')}#${sys.id} ${sys.name} (Lvl ${sys.level})`,
          0,
          r + 22
        );
        ctx.restore();
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

        // Glowing Galactic Sector Boundary Box (-10,000 .. +10,000) with Subtle NW Corner Breach Gap
        const B = this.galaxyBound;
        const gap = 260;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
        ctx.lineWidth = 2.5 / this.camZoom;
        ctx.setLineDash([28 / this.camZoom, 18 / this.camZoom]);
        ctx.beginPath();
        // Top edge (leaves subtle breach gap at NW corner -B..-B+gap)
        ctx.moveTo(-B + gap, -B); ctx.lineTo(B, -B);
        // Right edge
        ctx.lineTo(B, B);
        // Bottom edge
        ctx.lineTo(-B, B);
        // Left edge (stops short of NW corner breach gap)
        ctx.lineTo(-B, -B + gap);
        ctx.stroke();
        ctx.setLineDash([]);

        // Subtle Shimmering Rift Flicker at the NW Corner Breach
        const breachPulse = 0.25 + 0.35 * Math.sin(Date.now() / 380);
        ctx.strokeStyle = `rgba(0, 240, 255, ${breachPulse})`;
        ctx.lineWidth = 2 / this.camZoom;
        ctx.beginPath();
        ctx.moveTo(-B, -B + gap);
        ctx.lineTo(-B, -B);
        ctx.lineTo(-B + gap, -B);
        ctx.stroke();

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

        // Outpost Hub at (0,0) — Detailed Multi-Ring Orbital Starbase
        this.renderOutpostHub(ctx, 0, 0, Date.now(), true);

        const destMap = {};
        for (const dest of this.innerDestinations) {
          destMap[dest.type] = dest;
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(dest.x, dest.y);
          ctx.stroke();

          // Shaded Inner Core Mining Node Orb
          const dGrad = ctx.createRadialGradient(dest.x - 2.5, dest.y - 2.5, 1, dest.x, dest.y, 9);
          dGrad.addColorStop(0, '#ffffff');
          dGrad.addColorStop(0.35, dest.color);
          dGrad.addColorStop(1, '#091020');
          ctx.fillStyle = dGrad;
          ctx.beginPath();
          ctx.arc(dest.x, dest.y, 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = dest.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          if (this.camZoom > 0.35) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = 'bold 9.5px sans-serif';
            ctx.fillText(dest.name, dest.x, dest.y + 19);
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

        // 4. Render 50 Outer Solar Systems (2× Larger, 3D-Shaded Procedural Planets with Rings, Moons & Atmospheres)
        const nowPlanet = Date.now();
        const viewHalfW = (w / this.camZoom) * 0.65 + 180;
        const viewHalfH = (h / this.camZoom) * 0.65 + 180;

        for (const sys of this.solarSystems) {
          if (Math.abs(sys.x - this.camX) > viewHalfW || Math.abs(sys.y - this.camY) > viewHalfH) continue;
          this.renderSolarSystemPlanet(ctx, sys, nowPlanet);
        }

        // 5. Hidden Coordinate Gifts (Server-Discovered Caches & Beyond-the-Rim Vault)
        for (const g of this.hiddenGifts) {
          const dist = Math.hypot(this.ship2D.x - g.x, this.ship2D.y - g.y);
          if (dist <= 360 || g.claimed) {
            ctx.save();
            const isEgg = !!g.isEasterEgg;
            ctx.strokeStyle = g.claimed ? '#64748b' : (isEgg ? '#c084fc' : '#ffd700');
            ctx.fillStyle = g.claimed ? 'rgba(100,116,139,0.2)' : (isEgg ? 'rgba(192,132,252,0.32)' : 'rgba(255,215,0,0.28)');
            ctx.lineWidth = isEgg ? 3 : 2;
            ctx.beginPath();
            ctx.arc(g.x, g.y, (isEgg ? 24 : 18) + Math.sin(Date.now() / 180) * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = g.claimed ? '#94a3b8' : (isEgg ? '#fde047' : '#ffd700');
            ctx.textAlign = 'center';
            ctx.fillText(
              g.claimed ? `✅ ${g.name} (Claimed)` : `${isEgg ? '👑' : '🎁'} ${g.name} — CLICK TO CLAIM!`,
              g.x,
              g.y - (isEgg ? 30 : 24)
            );
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

        // Cosmetic 2D Fun Plasma Lasers
        this.renderFunLasers2D(ctx, this.camZoom);

        // Draw Player Flagship (Real Equipped On-Chain NFT Starship if available, else Cyber Starfighter)
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        const shipScale = Math.max(0.95, 1.3 / Math.sqrt(this.camZoom));
        ctx.scale(shipScale, shipScale);

        const _psShip = (window.polySpace && typeof window.polySpace.getEquippedStarshipMultiplier === 'function')
          ? window.polySpace.getEquippedStarshipMultiplier() : null;
        if (_psShip && _psShip.ship && _psShip.ship.dna && window.PolyHangar && typeof window.PolyHangar.renderProceduralShip === 'function') {
          window.PolyHangar.renderProceduralShip(ctx, 0, 0, _psShip.ship.dna, 0.34, 0, Date.now() / 300, s.targetX !== null || Boolean(s._isManualThrust));
          ctx.restore();
          ctx.restore();
          return;
        }

        const tPulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);
        const isCruising = s.targetX !== null || Boolean(s._isManualThrust);

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
        if (enabled) {
          if (window.polySpace && typeof window.polySpace._mapZoom === 'number') {
            this.camZoom = Math.max(0.06, Math.min(3.0, window.polySpace._mapZoom));
          }
          this._setGalaxyChatCollapsed(window.innerWidth <= 720);
        } else {
          this._setGalaxyChatCollapsed(true);
          if (window.polySpace && window.polySpace._canvasMode === 'galaxy' && typeof window.polySpace.setMapZoom === 'function') {
            window.polySpace.setMapZoom(this.camZoom);
          }
        }
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

      _escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      }

      _getSupabaseAndPlayerId() {
        const sb = (window.polySpace && typeof window.polySpace.getSupabaseClient === 'function' && window.polySpace.getSupabaseClient())
          || window.supabaseClient
          || window.supabase
          || null;
        const st = (window.appState && window.appState.state) || window.PolyState || {};
        const pid = String(st.playerId || st.player_id || st.walletAddress || '').trim().toLowerCase();
        return { sb, pid };
      }

      async loadGalaxyProfileFromDB() {
        const { sb, pid } = this._getSupabaseAndPlayerId();
        if (!sb || !pid) return;
        try {
          const { data, error } = await sb.rpc('get_polyspace_galaxy_profile', { p_player_id: pid });
          if (error || !data || !data.success) return;
          if (Array.isArray(data.cleared_systems)) {
            this.clearedSystems = new Set(data.cleared_systems.map(Number));
          }
          this.dailyMissionsCount = Number(data.daily_missions_count || 0);
          this.dailyMissionsMax = Number(data.daily_missions_max || 10);
          this.combatXpAllTime = Number(data.combat_xp_total || 0);
          this.combatXpWeekly = Number(data.combat_xp_weekly || 0);
          this.totalKills = Number(data.kills_total || 0);
          this.duelWins = Number(data.duel_wins || 0);
        } catch (err) {
          console.warn('[PolySpaceGalaxy] loadGalaxyProfileFromDB warning:', err);
        }
      }

      launch3DMission(systemId = 15) {
        this.updateUpgrades();
        const sys = this.solarSystems.find(s => s.id === systemId) || this.solarSystems[0];
        this.activeSystem = sys;
        this.selectedSystemId = sys.id;
        this.missionKills = 0;
        this.activeMissionSessionId = null;
        this.switchMode('combat3d');

        // Start authoritative server-side mission session (non-blocking)
        const { sb, pid } = this._getSupabaseAndPlayerId();
        if (sb && pid) {
          sb.rpc('start_polyspace_solar_mission', {
            p_player_id: pid,
            p_system_id: sys.id
          }).then(({ data, error }) => {
            if (!error && data && data.success && data.session_id) {
              this.activeMissionSessionId = data.session_id;
            }
          }).catch((e) => console.warn('[PolySpaceGalaxy] start_polyspace_solar_mission error:', e));
        }

        // Initialize 3D Player Ship with 6-DOF Orientation Basis Vectors (Forward, Up, Right)
        const maxShield = 340 + this.shieldLevel * 115; // Lvl 1: 455 -> Lvl 5: 915 -> Lvl 50: 6,090
        const maxHull = 440 + this.shieldLevel * 60;    // Lvl 1: 500 -> Lvl 5: 740 -> Lvl 50: 3,440
        this.hullHitFlash = 0;
        this.shieldHitFlash = 0;
        this.screenShake = 0;
        this.hitmarker = null;
        this.damagePopups3D = [];
        this.lastRollTime = 0;
        this.rollCooldownMs = 4000;
        this.rollDurationMs = 550;
        this.rollDir = 1;
        this.player3D = {
          pos: { x: 0, y: 0, z: 0 },
          vel: { x: 0, y: 0, z: 0 },
          forward: { x: 0, y: 0, z: 1 },
          up: { x: 0, y: 1, z: 0 },
          right: { x: 1, y: 0, z: 0 },
          pitchRate: 0,
          yawRate: 0,
          rollBank: 0,
          rollAnimAngle: 0,
          rollDir: 1,
          evadeTimer: 0,
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
        const baseEnemyHp = 105 + Math.pow(sysLvl, 1.68) * 16.5;
        const baseEnemyDmg = 16 + Math.pow(sysLvl, 1.48) * 3.0;
        const speedBonus = Math.min(60, sysLvl * 1.2);

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
              dmg: Math.round(baseEnemyDmg * (waveNum === 2 ? 1.1 : 1.0)),
              speed: 148 + speedBonus + (i * 10),
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
          // Wave 3: Solar System Command Boss (System #50 = Colossal Singularity Leviathan Mothership!)
          const isFinalBoss = this.activeSystem.id === 50;
          this.waveSpawnQueue.push({
            id: 'boss_main',
            name: isFinalBoss ? '👑 SINGULARITY LEVIATHAN MOTHERSHIP' : `👑 ${this.activeSystem.name} Dreadnought`,
            isBoss: true,
            isSingularityBoss: isFinalBoss,
            hp: Math.round(baseEnemyHp * (isFinalBoss ? 5.4 : 4.6)),
            dmg: Math.round(baseEnemyDmg * (isFinalBoss ? 1.75 : 1.6)),
            speed: isFinalBoss ? 128 : (112 + Math.min(35, sysLvl * 0.7)),
            radius: isFinalBoss ? 172 : 88,
            color: isFinalBoss ? '#ffd700' : '#c084fc',
            dist: isFinalBoss ? 3900 : 3500,
            spreadX: 0,
            spreadY: isFinalBoss ? 90 : 60,
            flankSide: 1,
            flankUp: isFinalBoss ? 160 : 120,
            reengageDist: isFinalBoss ? 3400 : 3000
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
          isSingularityBoss: !!spec.isSingularityBoss,
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

      // Web Audio 3D Starfighter Combat Synthesizer (respects global sfx mute toggle)
      playCombatSfx(type) {
        try {
          if (typeof window !== 'undefined' && window.sfx && window.sfx.enabled === false) return;
          let ctx = (typeof window !== 'undefined' && window.sfx && window.sfx.ctx) ? window.sfx.ctx : this._combatAudioCtx;
          if (!ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
              ctx = new AudioCtx();
              this._combatAudioCtx = ctx;
            }
          }
          if (!ctx) return;
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});

          const t = ctx.currentTime;
          const makeNoise = (dur, filterFreq, gainVal) => {
            const bufLen = Math.max(1, Math.floor(ctx.sampleRate * dur));
            const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const filt = ctx.createBiquadFilter();
            filt.type = 'lowpass';
            filt.frequency.setValueAtTime(filterFreq, t);
            filt.frequency.exponentialRampToValueAtTime(120, t + dur);
            const g = ctx.createGain();
            g.gain.setValueAtTime(gainVal, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            src.connect(filt);
            filt.connect(g);
            g.connect(ctx.destination);
            src.start(t);
          };

          if (type === 'laser') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(760 + Math.random() * 90, t);
            osc.frequency.exponentialRampToValueAtTime(210, t + 0.065);
            g.gain.setValueAtTime(0.032, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.07);
          } else if (type === 'hit') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1180, t);
            osc.frequency.exponentialRampToValueAtTime(640, t + 0.035);
            g.gain.setValueAtTime(0.035, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.04);
          } else if (type === 'crit') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1320, t);
            osc.frequency.setValueAtTime(1760, t + 0.03);
            g.gain.setValueAtTime(0.055, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.12);
          } else if (type === 'missile') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(980, t);
            osc.frequency.setValueAtTime(1320, t + 0.06);
            osc.frequency.exponentialRampToValueAtTime(340, t + 0.28);
            g.gain.setValueAtTime(0.045, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.29);
            makeNoise(0.32, 1600, 0.07);
          } else if (type === 'barrel_roll') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(280, t);
            osc.frequency.exponentialRampToValueAtTime(860, t + 0.18);
            osc.frequency.exponentialRampToValueAtTime(420, t + 0.42);
            g.gain.setValueAtTime(0.06, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.45);
            makeNoise(0.35, 2200, 0.055);
          } else if (type === 'shield_hit') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(420, t);
            osc.frequency.exponentialRampToValueAtTime(150, t + 0.12);
            g.gain.setValueAtTime(0.05, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.14);
          } else if (type === 'hull_hit') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(155, t);
            osc.frequency.exponentialRampToValueAtTime(42, t + 0.26);
            g.gain.setValueAtTime(0.14, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.29);
            makeNoise(0.24, 900, 0.12);
          } else if (type === 'explosion' || type === 'boss_explosion') {
            const isBoss = type === 'boss_explosion';
            const dur = isBoss ? 0.72 : 0.34;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(isBoss ? 120 : 160, t);
            osc.frequency.exponentialRampToValueAtTime(28, t + dur);
            g.gain.setValueAtTime(isBoss ? 0.16 : 0.09, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + dur + 0.02);
            makeNoise(dur, isBoss ? 1400 : 1100, isBoss ? 0.15 : 0.09);
          } else if (type === 'boss_warp') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(92, t);
            osc.frequency.exponentialRampToValueAtTime(55, t + 0.65);
            g.gain.setValueAtTime(0.08, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.7);
          } else if (type === 'victory') {
            [392, 523.25, 659.25, 783.99].forEach((freq, idx) => {
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, t + idx * 0.09);
              g.gain.setValueAtTime(0.07, t + idx * 0.09);
              g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.09 + 0.25);
              osc.connect(g); g.connect(ctx.destination);
              osc.start(t + idx * 0.09); osc.stop(t + idx * 0.09 + 0.26);
            });
          } else if (type === 'defeat') {
            [260, 210, 155, 98].forEach((freq, idx) => {
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(freq, t + idx * 0.12);
              g.gain.setValueAtTime(0.06, t + idx * 0.12);
              g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + 0.24);
              osc.connect(g); g.connect(ctx.destination);
              osc.start(t + idx * 0.12); osc.stop(t + idx * 0.12 + 0.25);
            });
          }
        } catch (e) {}
      }

      spawnDamagePopup3D(pos, text, color = '#ffffff', isBig = false) {
        if (!this.damagePopups3D) this.damagePopups3D = [];
        this.damagePopups3D.push({
          pos: { x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + 20, z: pos.z },
          text,
          color,
          isBig,
          life: isBig ? 0.95 : 0.65,
          maxLife: isBig ? 0.95 : 0.65
        });
        if (this.damagePopups3D.length > 16) this.damagePopups3D.shift();
      }

      triggerBarrelRoll() {
        if (this.mode !== 'combat3d' || this.combatEnded || !this.player3D) return;
        const now = performance.now();
        const elapsed = now - (this.lastRollTime || 0);
        if (this.lastRollTime > 0 && elapsed < this.rollCooldownMs) {
          return;
        }
        this.lastRollTime = now;
        const p = this.player3D;
        let dir = this.rollDir;
        if (this.keys['KeyA'] || this.keys['ArrowLeft'] || (this.touchStick && this.touchStick.active && this.touchStick.nx < -0.15)) {
          dir = -1;
        } else if (this.keys['KeyD'] || this.keys['ArrowRight'] || (this.touchStick && this.touchStick.active && this.touchStick.nx > 0.15)) {
          dir = 1;
        } else {
          dir = -this.rollDir;
        }
        this.rollDir = dir;
        p.rollDir = dir;
        p.evadeTimer = this.rollDurationMs / 1000;
        p.rollAnimAngle = 0;
        this.screenShake = Math.max(this.screenShake || 0, 4);
        this.playCombatSfx('barrel_roll');
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
        this.playCombatSfx('laser');
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
        this.screenShake = Math.max(this.screenShake || 0, 3.5);
        this.playCombatSfx('missile');
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
          if (Math.abs(this.touchStick.nx) > 0.08) targetYaw += this.touchStick.nx * 0.82;
          if (Math.abs(this.touchStick.ny) > 0.08) targetPitch -= this.touchStick.ny * 0.78;
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

        // 2. 3D Combat Cruise Speed + Barrel-Roll Evade Boost & 360° Spin
        if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 28);
        if (p.evadeTimer > 0) {
          p.evadeTimer = Math.max(0, p.evadeTimer - dt);
          const rollDurSec = (this.rollDurationMs || 550) / 1000;
          const progress = 1 - (p.evadeTimer / rollDurSec);
          p.rollAnimAngle = progress * Math.PI * 2 * (p.rollDir || 1);
          p.speed = 360;
          const strafe = 290 * (p.rollDir || 1) * Math.sin(progress * Math.PI);
          p.vel.x = p.forward.x * p.speed + p.right.x * strafe;
          p.vel.y = p.forward.y * p.speed + p.right.y * strafe;
          p.vel.z = p.forward.z * p.speed + p.right.z * strafe;
        } else {
          p.rollAnimAngle = 0;
          p.speed = 220;
          p.vel.x = p.forward.x * p.speed;
          p.vel.y = p.forward.y * p.speed;
          p.vel.z = p.forward.z * p.speed;
        }

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

        // 4. Shield Auto-Regeneration after 3.2s out of enemy fire & hit-flash decay
        if (this.hullHitFlash > 0) this.hullHitFlash = Math.max(0, this.hullHitFlash - dt * 1.6);
        if (this.shieldHitFlash > 0) this.shieldHitFlash = Math.max(0, this.shieldHitFlash - dt * 2.2);
        if (now - p.lastHitTime > 3200 && p.shield < p.maxShield) {
          const regenRate = 24 + this.shieldLevel * 11;
          p.shield = Math.min(p.maxShield, p.shield + regenRate * dt);
        }

        // 5. Update 3D Enemy AI
        // Loop: Face-to-Face Approach (ramming hazard if you fly straight in!) -> Brief Rear Flyby -> Wide Side Flank Overtake -> Curve Back Face-to-Face!
        const sysLvl = this.activeSystem ? this.activeSystem.level : 1;
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
            // Face-to-face approach; breaks off late enough that flying straight into an enemy risks a hull collision
            const breakOffDist = e.isSingularityBoss ? 340 : 215;
            if (dist < breakOffDist || local.z < -60) {
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

          // Direct Ship-to-Ship Collision -> Bypasses Shield and damages HULL directly! (Evaded during Barrel Roll)
          const postDist = Math.hypot(p.pos.x - e.pos.x, p.pos.y - e.pos.y, p.pos.z - e.pos.z);
          if (p.evadeTimer <= 0 && postDist <= (e.radius + 34) && now - (e.lastCollisionAt || 0) > 1200) {
            e.lastCollisionAt = now;
            const collisionHullDmg = Math.round(p.maxHull * (e.isBoss ? 0.24 : 0.14) + e.dmg * 0.35);
            p.hull = Math.max(0, p.hull - collisionHullDmg);
            p.lastHitTime = now;
            this.hullHitFlash = 0.65;
            this.screenShake = Math.max(this.screenShake || 0, 15);
            this.playCombatSfx('hull_hit');
            this.spawn3DExplosion(e.pos, '#ff3300', 22);
            this.showToast(`💥 HULL COLLISION! -${collisionHullDmg.toLocaleString()} HULL!`);

            // Knock enemy into break-off pass and inflict minor ramming damage to enemy
            e.aiState = 'pass_behind';
            e.aiTimer = 0.9;
            e.hp -= Math.round(e.maxHp * 0.12);
            if (e.hp <= 0) {
              const killXp = (e.isBoss ? 50 : (e.color === '#f59e0b' ? 15 : 10)) * this.activeSystem.level;
              this.awardCombatXp(killXp, true);
              this.spawn3DExplosion(e.pos, e.color, e.isBoss ? 45 : 22);
              this.enemies3D.splice(i, 1);
              this.checkWaveProgression();
            }

            if (p.hull <= 0) {
              this.end3DMission(false);
              return;
            }
            continue;
          }

          // Enemy Firing Predictive Plasma Bolts toward player (35% lead; Boss fires 3-bolt spread)
          const fireCd = e.isBoss
            ? Math.max(620, 920 - sysLvl * 6)
            : Math.max(850, 1400 - sysLvl * 10);
          if (e.aiState === 'attack_pass' && local.z > 180 && dist < 2450 && now - e.lastShot > fireCd) {
            e.lastShot = now;
            const boltSpeed = 980 + sysLvl * 6;
            const leadTime = Math.min(1.1, dist / boltSpeed) * 0.35;
            const aimTarget = {
              x: p.pos.x + p.vel.x * leadTime,
              y: p.pos.y + p.vel.y * leadTime,
              z: p.pos.z + p.vel.z * leadTime
            };
            const leadDir = this.vecNorm({
              x: aimTarget.x - e.pos.x,
              y: aimTarget.y - e.pos.y,
              z: aimTarget.z - e.pos.z
            });
            const spreadOffsets = e.isSingularityBoss
              ? [-0.19, -0.095, 0, 0.095, 0.19]
              : (e.isBoss ? [-0.12, 0, 0.12] : [0]);
            for (const ang of spreadOffsets) {
              const shotDir = ang === 0 ? leadDir : this.rotateBasis(leadDir, p.up, ang);
              this.lasers3D.push({
                isPlayer: false,
                pos: { x: e.pos.x, y: e.pos.y, z: e.pos.z },
                vel: {
                  x: shotDir.x * boltSpeed,
                  y: shotDir.y * boltSpeed,
                  z: shotDir.z * boltSpeed
                },
                dmg: e.isBoss && ang !== 0 ? Math.round(e.dmg * 0.55) : e.dmg,
                color: e.isSingularityBoss ? (ang === 0 ? '#ffd700' : '#00f0ff') : (e.isBoss ? '#c084fc' : '#ff0055'),
                life: 2.8
              });
            }
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
                const isCrit = Math.random() < 0.12;
                const dealt = isCrit ? Math.round(l.dmg * 1.5) : l.dmg;
                e.hp -= dealt;
                hit = true;
                const killed = e.hp <= 0;
                this.hitmarker = { time: now, isCrit, isKill: killed };
                this.spawn3DExplosion(l.pos, isCrit ? '#ffd700' : l.color, isCrit ? 9 : 6);
                if (isCrit && !killed) {
                  this.spawnDamagePopup3D(e.pos, `⚡${Math.round(dealt)}`, '#ffd700', false);
                }
                if (killed) {
                  const killXp = (e.isBoss ? 50 : (e.color === '#f59e0b' ? 15 : 10)) * this.activeSystem.level;
                  this.awardCombatXp(killXp, true);
                  this.spawn3DExplosion(e.pos, e.color, e.isBoss ? 45 : 22);
                  this.spawnDamagePopup3D(e.pos, e.isBoss ? '👑 BOSS DOWN!' : '💥 KILL!', '#00ff88', true);
                  this.screenShake = Math.max(this.screenShake || 0, e.isBoss ? 14 : 6);
                  this.playCombatSfx(e.isBoss ? 'boss_explosion' : 'explosion');
                  this.enemies3D.splice(j, 1);
                  this.checkWaveProgression();
                } else {
                  this.playCombatSfx(isCrit ? 'crit' : 'hit');
                }
                break;
              }
            }
            if (hit) this.lasers3D.splice(i, 1);
          } else {
            // Check collision against Player Ship (Evaded during Barrel Roll)
            if (p.evadeTimer > 0) continue;
            const dPlayer = Math.hypot(l.pos.x - p.pos.x, l.pos.y - p.pos.y, l.pos.z - p.pos.z);
            if (dPlayer <= 44) {
              p.lastHitTime = now;
              if (p.shield >= l.dmg) {
                p.shield -= l.dmg;
                this.shieldHitFlash = Math.max(this.shieldHitFlash || 0, 0.28);
                this.screenShake = Math.max(this.screenShake || 0, 5);
                this.playCombatSfx('shield_hit');
              } else {
                const rem = l.dmg - p.shield;
                p.shield = 0;
                p.hull = Math.max(0, p.hull - rem);
                this.hullHitFlash = Math.max(this.hullHitFlash || 0, 0.42);
                this.screenShake = Math.max(this.screenShake || 0, 8.5);
                this.playCombatSfx('hull_hit');
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
              this.hitmarker = { time: now, isCrit: true, isKill: killed };
              this.screenShake = Math.max(this.screenShake || 0, (killed && e.isBoss) ? 16 : 9);
              this.playCombatSfx((killed && e.isBoss) ? 'boss_explosion' : 'explosion');
              this.spawnDamagePopup3D(e.pos, `🚀 -${m.dmg.toLocaleString()}`, '#ffd700', true);
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

        // 7. Update 3D Particle Explosions & Damage Popups
        for (let i = this.explosions3D.length - 1; i >= 0; i--) {
          const ex = this.explosions3D[i];
          ex.pos.x += ex.vel.x * dt;
          ex.pos.y += ex.vel.y * dt;
          ex.pos.z += ex.vel.z * dt;
          ex.life -= dt * 1.4;
          if (ex.life <= 0) this.explosions3D.splice(i, 1);
        }
        if (this.damagePopups3D) {
          for (let i = this.damagePopups3D.length - 1; i >= 0; i--) {
            const dp = this.damagePopups3D[i];
            dp.pos.y += 85 * dt;
            dp.life -= dt;
            if (dp.life <= 0) this.damagePopups3D.splice(i, 1);
          }
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
          if (nextWave === 3) {
            this.playCombatSfx('boss_warp');
            this.screenShake = Math.max(this.screenShake || 0, 8);
          }
          this.showToast(nextWave === 3 ? '🚨 WARNING: SOLAR SYSTEM COMMAND BOSS WARPING IN!' : `⚡ Wave ${this.combatWave} Cleared! Enemy Reinforcements Jumping In!`);
          this.spawnCombatWave(nextWave);
        } else {
          this.end3DMission(true);
        }
      }

      async end3DMission(victory) {
        this.combatEnded = true;
        this.playCombatSfx(victory ? 'victory' : 'defeat');
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
            ? `Great flying in ${sys.name} (Lvl ${sys.level})! Verifying combat rewards on server...`
            : `You destroyed all hostile squadrons and the Command Boss in ${sys.name} (Lvl ${sys.level})! Verifying rewards...`;

          const lootEl = document.getElementById('modal-loot');
          lootEl.innerHTML = '⏳ Verifying mission rewards with Polygon Gaming server...';

          const { sb, pid } = this._getSupabaseAndPlayerId();
          const killsToReport = Math.max(1, Math.min(10, this.missionKills || 10));

          if (sb && pid && this.activeMissionSessionId) {
            try {
              const { data: res, error } = await sb.rpc('complete_polyspace_solar_mission', {
                p_player_id: pid,
                p_session_id: this.activeMissionSessionId,
                p_system_id: sys.id,
                p_kills: killsToReport
              });
              this.activeMissionSessionId = null;

              if (!error && res && res.success) {
                if (Array.isArray(res.cleared_systems)) {
                  this.clearedSystems = new Set(res.cleared_systems.map(Number));
                }
                this.dailyMissionsCount = Number(res.daily_missions_count || 0);
                this.dailyMissionsMax = Number(res.daily_missions_max || 10);
                this.combatXpAllTime = Number(res.combat_xp_total || this.combatXpAllTime);
                this.combatXpWeekly = Number(res.combat_xp_weekly || this.combatXpWeekly);
                this.totalKills = Number(res.kills_total || this.totalKills);

                // Sync authoritative balance & space_state back into appState & PolySpace
                if (window.appState && typeof window.appState.update === 'function') {
                  const patch = {};
                  if (res.new_balance !== undefined && res.new_balance !== null) {
                    patch.balancePgt = parseFloat(parseFloat(res.new_balance).toFixed(2));
                  }
                  if (res.new_space_state && typeof res.new_space_state === 'object') {
                    patch.spaceState = res.new_space_state;
                  }
                  if (res.nft_awarded) {
                    const existingCrates = Array.isArray(window.appState.state?.crateNfts)
                      ? [...window.appState.state.crateNfts]
                      : [];
                    if (!existingCrates.includes('nft_singularity_conqueror')) {
                      existingCrates.push('nft_singularity_conqueror');
                    }
                    patch.crateNfts = existingCrates;
                  }
                  window.appState.update(patch);
                  if (typeof window.appState.syncUI === 'function') window.appState.syncUI();
                  if (res.nft_awarded) {
                    if (typeof window.renderNftInventory === 'function') window.renderNftInventory();
                    if (typeof window.renderNftMarketplace === 'function') window.renderNftMarketplace();
                  }
                }
                if (window.polySpace && typeof window.polySpace.syncCloudSpaceState === 'function') {
                  window.polySpace.syncCloudSpaceState(true);
                }

                const fcPgt = Number(res.first_clear_pgt || 0);
                const kPgt = Number(res.kill_pgt || 0);
                const kRate = Number(res.kill_rate || 1);
                const rIron = Number(res.reward_iron || 0);
                const rTit = Number(res.reward_tit || 0);
                const xpGain = Number(res.xp_gained || 0);

                const parts = [];
                if (res.is_first_clear && fcPgt > 0) parts.push(`💰 +${fcPgt.toLocaleString()} PGT (First-Clear)`);
                if (kPgt > 0) parts.push(`🎯 +${kPgt.toLocaleString()} Kill PGT (${res.kills}×${kRate})`);
                else parts.push(`🎯 Daily Kill PGT cap reached (${this.dailyMissionsCount}/${this.dailyMissionsMax})`);
                if (rIron > 0 || rTit > 0) parts.push(`🪨 +${rIron.toLocaleString()} Iron • 💎 +${rTit.toLocaleString()} Tit`);
                parts.push(`⭐ +${xpGain.toLocaleString()} Combat XP`);
                if (res.nft_awarded) parts.push(`<br/>👑 +1 EXCLUSIVE SINGULARITY CONQUEROR NFT CREDITED!`);

                document.getElementById('modal-desc').innerText = res.is_first_clear
                  ? `Victory verified! System #${sys.id} (${sys.name}) conquered!`
                  : `Replay verified! Daily kill missions: ${this.dailyMissionsCount}/${this.dailyMissionsMax}`;
                lootEl.innerHTML = parts.join(' • ');
                return;
              } else {
                const errMsg = (res && res.error) || (error && error.message) || 'Verification failed.';
                document.getElementById('modal-desc').innerText = `System #${sys.id} cleared, but server verification returned an error.`;
                lootEl.innerText = `⚠️ ${errMsg}`;
                return;
              }
            } catch (e) {
              console.warn('[PolySpaceGalaxy] complete_polyspace_solar_mission exception:', e);
              lootEl.innerHTML = '⚠️ Network error verifying rewards. Please try again.';
              return;
            }
          }

          // Fallback display if offline/disconnected
          const killRate = sys.level >= 26 ? 2 : 1;
          const killPgt = killsToReport * killRate;
          lootEl.innerHTML = alreadyCleared
            ? `✅ Replay Clear (Offline) • +${killPgt.toLocaleString()} PGT preview`
            : `💰 +${sys.rewardPgt.toLocaleString()} PGT preview (Connect account to claim on-chain/DB rewards)`;
        } else {
          this.activeMissionSessionId = null;
          document.getElementById('modal-icon').innerText = '💥';
          document.getElementById('modal-title').innerText = 'SHIP DESTROYED!';
          document.getElementById('modal-title').style.color = '#ff0055';
          document.getElementById('modal-desc').innerText =
            `System #${sys.id} (Lvl ${sys.level}) firepower overwhelmed your shields! Upgrade your Quantum Shield & Plasma Turrets closer to Level ${sys.level} and try again.`;
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

        // Barrel Roll Evade Cooldown Indicator
        const rElapsed = this.lastRollTime > 0 ? (now - this.lastRollTime) : (this.rollCooldownMs || 4000);
        const rReady = rElapsed >= (this.rollCooldownMs || 4000);
        const rRem = Math.max(0, ((this.rollCooldownMs || 4000) - rElapsed) / 1000).toFixed(1);
        const rBtn = document.getElementById('btn-barrel-roll');
        if (rBtn) {
          rBtn.disabled = !rReady;
          rBtn.style.opacity = rReady ? '1' : '0.45';
          rBtn.innerText = rReady ? '🌀 ROLL' : `🌀 ${rRem}s`;
        }
        const mobRLbl = document.getElementById('mobile-roll-lbl');
        const mobRBtn = document.getElementById('btn-mobile-roll');
        if (mobRLbl) {
          mobRLbl.innerText = rReady ? 'ROLL' : `${rRem}s`;
          mobRLbl.style.color = rReady ? '#00f0ff' : '#94a3b8';
        }
        if (mobRBtn) {
          mobRBtn.style.opacity = rReady ? '1' : '0.48';
        }
      }

      // --------------------------------------------------------------------------
      // 5. 3D PERSPECTIVE RENDERER + 360° SPHERICAL MINI-RADAR SCOPE
      // --------------------------------------------------------------------------
      renderCombat3D() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const shakeAmt = this.screenShake || 0;
        const shakeX = shakeAmt > 0.2 ? (Math.random() - 0.5) * shakeAmt * 2 : 0;
        const shakeY = shakeAmt > 0.2 ? (Math.random() - 0.5) * shakeAmt * 2 : 0;
        const cx = w / 2 + shakeX;
        const cy = h / 2 + shakeY;
        const fov = (this.player3D && this.player3D.evadeTimer > 0) ? 515 : 560; // Dynamic FOV stretch during Barrel Roll!

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

        // 4b. Render Floating 3D Damage / Crit / Kill Popups
        if (this.damagePopups3D && this.damagePopups3D.length > 0) {
          ctx.save();
          ctx.textAlign = 'center';
          for (const dp of this.damagePopups3D) {
            const loc = this.worldToShipLocal(dp.pos);
            if (loc.z > 20 && loc.z < 3400) {
              const scale = fov / loc.z;
              const sx = cx + loc.x * scale;
              const sy = cy - loc.y * scale;
              ctx.globalAlpha = Math.max(0, Math.min(1, dp.life / dp.maxLife));
              ctx.font = dp.isBig ? '900 15px monospace' : '800 12px monospace';
              ctx.fillStyle = '#000';
              ctx.fillText(dp.text, sx + 1, sy + 1);
              ctx.fillStyle = dp.color;
              ctx.fillText(dp.text, sx, sy);
            }
          }
          ctx.restore();
        }

        // 5. Render Player 3D Starfighter in Foreground (Positioned cleanly above the 3D Mini-Radar)
        this.renderPlayer3DShip(cx, Math.max(cy + 40, h - 208));

        // 6. Render Center Aiming Crosshair, Hitmarker Flash & Mouse Vector Guide
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.stroke();

        // Crisp Arcade Hitmarker (×) on Laser / Missile / Kill Impact
        if (this.hitmarker) {
          const hmAge = nowMs - this.hitmarker.time;
          if (hmAge < 190) {
            const alpha = 1 - (hmAge / 190);
            const hmX = (!this.isTouchDevice && !this.useKeyboardSteer) ? this.mouseX : cx;
            const hmY = (!this.isTouchDevice && !this.useKeyboardSteer) ? this.mouseY : cy;
            const inner = this.hitmarker.isKill ? 9 : 6;
            const outer = this.hitmarker.isKill ? 20 : (this.hitmarker.isCrit ? 16 : 13);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = this.hitmarker.isKill ? '#00ff88' : (this.hitmarker.isCrit ? '#ffd700' : '#ffffff');
            ctx.lineWidth = this.hitmarker.isKill || this.hitmarker.isCrit ? 2.6 : 1.8;
            ctx.beginPath();
            ctx.moveTo(hmX - outer, hmY - outer); ctx.lineTo(hmX - inner, hmY - inner);
            ctx.moveTo(hmX + outer, hmY - outer); ctx.lineTo(hmX + inner, hmY - inner);
            ctx.moveTo(hmX - outer, hmY + outer); ctx.lineTo(hmX - inner, hmY + inner);
            ctx.moveTo(hmX + outer, hmY + outer); ctx.lineTo(hmX + inner, hmY + inner);
            ctx.stroke();
            ctx.restore();
          } else {
            this.hitmarker = null;
          }
        }

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

        // 7. Render 360° 3D Tactical Combat Mini-Radar Scope (Bottom-Center, below Player Ship)
        this.render3DCombatMiniRadar(cx, h - 72);

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

        // 10. Cockpit Damage Vignette Flash (Red on Direct Hull / Collision Hit, Cyan on Shield Hit)
        if ((this.hullHitFlash || 0) > 0.01) {
          ctx.save();
          const grad = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.25, cx, cy, Math.max(w, h) * 0.72);
          grad.addColorStop(0, 'rgba(255, 0, 50, 0)');
          grad.addColorStop(1, `rgba(255, 20, 40, ${Math.min(0.62, this.hullHitFlash)})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        } else if ((this.shieldHitFlash || 0) > 0.01) {
          ctx.save();
          const grad = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.35, cx, cy, Math.max(w, h) * 0.75);
          grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
          grad.addColorStop(1, `rgba(0, 220, 255, ${Math.min(0.32, this.shieldHitFlash)})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
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

        if (e.isSingularityBoss) {
          // SYSTEM #50 FINAL BOSS: Colossal Imperial Singularity Leviathan Mothership
          verts = [
            [0, 0.04, 1.55],     // 0: central singularity prow
            [0.62, 0.16, 1.38],  // 1: starboard plasma mandible tip
            [-0.62, 0.16, 1.38], // 2: port plasma mandible tip
            [0.48, 0.34, 0.45],  // 3: starboard upper citadel hull
            [-0.48, 0.34, 0.45], // 4: port upper citadel hull
            [0.48, -0.30, 0.45], // 5: starboard lower hull
            [-0.48, -0.30, 0.45],// 6: port lower hull
            [1.95, 0.10, -0.15], // 7: colossal starboard crescent wingtip
            [-1.95, 0.10, -0.15],// 8: colossal port crescent wingtip
            [1.28, 0.28, -0.78], // 9: starboard rear wing barb
            [-1.28, 0.28, -0.78],// 10: port rear wing barb
            [0, 0.78, -0.15],    // 11: imperial crown spire apex
            [0, -0.62, -0.18],   // 12: lower singularity keel
            [0.68, 0.26, -1.28], // 13: stern starboard upper
            [-0.68, 0.26, -1.28],// 14: stern port upper
            [0.68, -0.24, -1.28],// 15: stern starboard lower
            [-0.68, -0.24, -1.28],// 16: stern port lower
            [1.15, 0.0, 0.55],   // 17: starboard forward wing shoulder
            [-1.15, 0.0, 0.55]   // 18: port forward wing shoulder
          ];
          faces = [
            // Twin Forward Mandibles & Prow
            [0, 1, 3, '#3b0764', '#ffd700'],
            [0, 4, 2, '#3b0764', '#ffd700'],
            [0, 3, 4, '#581c87', '#00f0ff'],
            [0, 6, 5, '#1e0538', '#c084fc'],
            [0, 5, 1, '#2e1065', '#ffd700'],
            [0, 2, 6, '#2e1065', '#ffd700'],
            [1, 17, 3, '#4c1d95', '#ffd700'],
            [2, 4, 18, '#4c1d95', '#ffd700'],
            // Imperial Crown Spire
            [3, 11, 4, '#6b21a8', '#ffd700'],
            [3, 13, 11, '#3b0764', '#e879f9'],
            [4, 11, 14, '#3b0764', '#e879f9'],
            [11, 13, 14, '#581c87', '#ffd700'],
            // Colossal Starboard Crescent Wing
            [3, 17, 7, '#1e1b4b', '#00f0ff'],
            [3, 7, 9, '#312e81', '#ffd700'],
            [3, 9, 13, '#2e1065', '#c084fc'],
            [5, 7, 17, '#0f172a', '#00f0ff'],
            [5, 9, 7, '#17153b', '#a855f7'],
            [5, 15, 9, '#0f172a', '#c084fc'],
            // Colossal Port Crescent Wing
            [4, 8, 18, '#1e1b4b', '#00f0ff'],
            [4, 10, 8, '#312e81', '#ffd700'],
            [4, 14, 10, '#2e1065', '#c084fc'],
            [6, 18, 8, '#0f172a', '#00f0ff'],
            [6, 8, 10, '#17153b', '#a855f7'],
            [6, 10, 16, '#0f172a', '#c084fc'],
            // Ventral Keel & Armored Belly
            [5, 6, 12, '#140b2d', '#a855f7'],
            [5, 12, 15, '#090d1f', '#c084fc'],
            [6, 16, 12, '#090d1f', '#c084fc'],
            [12, 16, 15, '#1e0538', '#ffd700'],
            // Radiant Stern Reactor Bay
            [13, 15, 16, '#ffd700', '#00f0ff'],
            [13, 16, 14, '#e879f9', '#ffd700']
          ];
        } else if (e.isBoss) {
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

        // Boss 3D Rotating Energy Halo Rings (projected in true 3D around the ship!)
        if (e.isSingularityBoss) {
          // Outer Golden Accretion Halo Ring
          const rot1 = nowMs / 850;
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          let started1 = false;
          for (let k = 0; k <= 24; k++) {
            const a = (k / 24) * Math.PI * 2 + rot1;
            const loc = toCamLocal(toWorld(Math.cos(a) * 1.75, Math.sin(a) * 0.45, Math.sin(a) * 0.85));
            if (loc.z > 12) {
              const sc = fov / loc.z;
              const rx = cx + loc.x * sc;
              const ry = cy - loc.y * sc;
              if (!started1) { ctx.moveTo(rx, ry); started1 = true; }
              else ctx.lineTo(rx, ry);
            }
          }
          if (started1) ctx.stroke();

          // Inner Counter-Rotating Cyan/Violet Quantum Ring
          const rot2 = -nowMs / 620;
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          let started2 = false;
          for (let k = 0; k <= 20; k++) {
            const a = (k / 20) * Math.PI * 2 + rot2;
            const loc = toCamLocal(toWorld(Math.cos(a) * 1.38, -Math.sin(a) * 0.78, Math.sin(a) * 0.55));
            if (loc.z > 12) {
              const sc = fov / loc.z;
              const rx = cx + loc.x * sc;
              const ry = cy - loc.y * sc;
              if (!started2) { ctx.moveTo(rx, ry); started2 = true; }
              else ctx.lineTo(rx, ry);
            }
          }
          if (started2) ctx.stroke();

          // Central Glowing Singularity Event Horizon Core suspended between Mandibles
          const coreLoc = toCamLocal(toWorld(0, 0.04, 0.55));
          if (coreLoc.z > 12) {
            const sc = fov / coreLoc.z;
            const sxCore = cx + coreLoc.x * sc;
            const syCore = cy - coreLoc.y * sc;
            const cr = Math.max(8, 42 * sc);
            const cg = ctx.createRadialGradient(sxCore, syCore, cr * 0.18, sxCore, syCore, cr);
            cg.addColorStop(0, '#02000a');
            cg.addColorStop(0.38, '#581c87');
            cg.addColorStop(0.65, '#00f0ff');
            cg.addColorStop(0.84, 'rgba(255, 215, 0, 0.85)');
            cg.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.arc(sxCore, syCore, cr, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (e.isBoss) {
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
        const pw = isSmall ? Math.min(240, Math.round(w * 0.56)) : Math.min(390, Math.round(w * 0.30));
        const ph = Math.round(pw * 0.62);
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
          const mFov = Math.round(pw * 0.96);

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
        ctx.rotate(p.rollBank + (p.rollAnimAngle || 0));

        // Glowing Phase-Evade Aura during Barrel Roll
        if (p.evadeTimer > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
          ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 74, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

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
        const rad = 56;
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
        // Teleport modals to document.body so they NEVER clip inside the 320px radar box
        ['rank-modal', 'trade-modal', 'tactical-duel-modal'].forEach((mid) => {
          const el = document.getElementById(mid);
          if (el && el.parentElement !== document.body) {
            el.style.display = 'none';
            document.body.appendChild(el);
            el.addEventListener('click', (ev) => {
              if (ev.target === el) {
                if (mid === 'tactical-duel-modal' && window.PolySpaceGalaxy.instance) {
                  window.PolySpaceGalaxy.instance.closeTacticalDuel();
                } else {
                  el.style.display = 'none';
                }
              }
            });
          }
        });
        window.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape') {
            ['rank-modal', 'trade-modal'].forEach((mid) => {
              const el = document.getElementById(mid);
              if (el) el.style.display = 'none';
            });
            if (window.PolySpaceGalaxy.instance) window.PolySpaceGalaxy.instance.closeTacticalDuel();
          }
        });
        this.instance = new Plan023StandaloneDemo();
        this.instance.paused = false;
        this.instance.initGalaxyChatUI();
        this.instance.setFullscreen(false);
        this.instance.loadGalaxyProfileFromDB();
        this.instance.loadTradeBeaconsFromDB();
        this.instance.connectRealtimeGalaxy();
        this.instance.pollMyDuels();
        setTimeout(() => { if (this.instance && !this.instance.paused) this.instance.scanForGalacticGifts(false); }, 900);
      } else {
        this.instance.paused = false;
        this.instance.updateUpgrades();
        this.instance.loadGalaxyProfileFromDB();
        this.instance.loadTradeBeaconsFromDB();
        this.instance.connectRealtimeGalaxy();
        this.instance.pollMyDuels();
        setTimeout(() => { if (this.instance && !this.instance.paused) this.instance.scanForGalacticGifts(false); }, 900);
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
      const nwGap = 280;
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
      ctx.lineWidth = 2.2 / zoom;
      ctx.setLineDash([28 / zoom, 18 / zoom]);
      ctx.beginPath();
      // Top edge (leaves a hidden 280u breach at the NW corner)
      ctx.moveTo(-B + nwGap, -B); ctx.lineTo(B, -B);
      // Right edge
      ctx.lineTo(B, B);
      // Bottom edge
      ctx.lineTo(-B, B);
      // Left edge (stops 280u short of the NW corner)
      ctx.lineTo(-B, -B + nwGap);
      ctx.stroke();
      ctx.setLineDash([]);
      // Subtle cyan anomaly flicker at the NW breach
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.22 + 0.18 * Math.sin(Date.now() * 0.004)})`;
      ctx.lineWidth = 1.6 / zoom;
      ctx.beginPath();
      ctx.moveTo(-B + nwGap, -B);
      ctx.lineTo(-B, -B + nwGap);
      ctx.stroke();

      // Spiral & Outer Deep-Space Stars
      for (const st of inst.galaxyStars) {
        ctx.fillStyle = st.color;
        ctx.globalAlpha = st.alpha;
        ctx.fillRect(st.x, st.y, st.size * 1.5, st.size * 1.5);
      }
      ctx.globalAlpha = 1.0;
      ctx.restore();
    },
    renderOutpostHub(ctx, x, y, showCoords = false) {
      const fn = (this.instance && typeof this.instance.renderOutpostHub === 'function')
        ? this.instance.renderOutpostHub.bind(this.instance)
        : (Plan023StandaloneDemo && Plan023StandaloneDemo.prototype && Plan023StandaloneDemo.prototype.renderOutpostHub);
      if (typeof fn === 'function') {
        fn(ctx, x, y, Date.now(), showCoords);
        return true;
      }
      return false;
    },
    renderForegroundOnRadar(ctx, baseX, baseY, zoom) {
      const inst = this.instance;
      if (!inst || inst.paused || inst.mode !== 'galaxy' || inst._isFullscreen) return;
      ctx.save();
      ctx.translate(baseX, baseY);

      // 50 Solar Systems (Exact same 2× 3D-Shaded Procedural Planets as Fullscreen!)
      const nowPlanet = Date.now();
      for (const sys of inst.solarSystems) {
        inst.renderSolarSystemPlanet(ctx, sys, nowPlanet);
      }

      // Discovered Hidden Coordinate Gifts on Embedded Radar
      if (inst.hiddenGifts && inst.hiddenGifts.length > 0) {
        for (const g of inst.hiddenGifts) {
          const dist = Math.hypot(inst.ship2D.x - g.x, inst.ship2D.y - g.y);
          if (dist <= 360 || g.claimed) {
            ctx.save();
            const isEgg = !!g.isEasterEgg;
            ctx.strokeStyle = g.claimed ? '#64748b' : (isEgg ? '#c084fc' : '#ffd700');
            ctx.fillStyle = g.claimed ? 'rgba(100,116,139,0.2)' : (isEgg ? 'rgba(192,132,252,0.32)' : 'rgba(255,215,0,0.28)');
            ctx.lineWidth = isEgg ? 3 : 2;
            ctx.beginPath();
            ctx.arc(g.x, g.y, (isEgg ? 24 : 18) + Math.sin(nowPlanet / 180) * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = g.claimed ? '#94a3b8' : '#ffd700';
            ctx.textAlign = 'center';
            ctx.fillText(g.claimed ? `✅ ${g.name}` : `${isEgg ? '👑' : '🎁'} ${g.name} — CLICK TO CLAIM!`, g.x, g.y - 26);
            ctx.restore();
          }
        }
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
      // Thruster Trail + Cosmetic 2D Fun Plasma Lasers on embedded radar
      for (const tr of s.trail) {
        const r = Math.max(1.2, tr.life * 4.2);
        ctx.fillStyle = `rgba(0, 240, 255, ${tr.life * 0.55})`;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      inst.renderFunLasers2D(ctx, zoom);

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      const shipScale = Math.max(0.95, 1.3 / Math.sqrt(zoom));
      ctx.scale(shipScale, shipScale);
      const _psShip = (window.polySpace && typeof window.polySpace.getEquippedStarshipMultiplier === 'function')
        ? window.polySpace.getEquippedStarshipMultiplier() : null;
      if (_psShip && _psShip.ship && _psShip.ship.dna && window.PolyHangar && typeof window.PolyHangar.renderProceduralShip === 'function') {
        window.PolyHangar.renderProceduralShip(ctx, 0, 0, _psShip.ship.dna, 0.34, 0, Date.now() / 300, s.targetX !== null || Boolean(s._isManualThrust));
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
        if (!g.claimed && distToShip <= 320 && distClick <= Math.max(46, 65 / inst.camZoom)) {
          inst.claimGalacticGift(g);
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
        if (Math.hypot(wx - sys.x, wy - sys.y) <= Math.max(sys.radius + 14, 28 / inst.camZoom)) {
          inst.ship2D.targetX = sys.x;
          inst.ship2D.targetY = sys.y;
          inst.selectedSystemId = sys.id;
          inst.followShip2D = true;
          inst.showSystemBriefing(sys);
          return;
        }
      }
      const clamped = inst.clampGalaxyPos(Math.round(wx), Math.round(wy), inst.ship2D.x, inst.ship2D.y);
      inst.ship2D.targetX = clamped.x;
      inst.ship2D.targetY = clamped.y;
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
