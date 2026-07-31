// ============================================================
// POLYGAME PWA INSTALLATION MANAGER & SERVICE WORKER HANDLER
// ============================================================

let deferredPrompt = null;

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

export function initPWA() {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('[PWA] Service Worker active:', reg.scope);
      }).catch((err) => {
        console.warn('[PWA] Service Worker registration skipped:', err);
      });
    });
  }

  // Hide PWA installer UI if already installed & running in standalone mode
  if (isStandalone()) {
    console.log('[PWA] Running in standalone PWA mode.');
    return;
  }

  // Listen for Chrome/Android native install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    renderPWABanner();
  });

  // Render PWA banner on iOS Safari / Supported browsers after short delay
  setTimeout(() => {
    if (!isStandalone()) {
      renderPWABanner();
    }
  }, 3000);
}

export function renderPWABanner() {
  if (isStandalone()) return;
  if (document.getElementById('pwa-install-banner')) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99990;
    width: 90%;
    max-width: 460px;
    background: linear-gradient(135deg, rgba(10, 15, 30, 0.95), rgba(40, 20, 60, 0.95));
    border: 1px solid var(--color-accent);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    box-shadow: 0 0 25px rgba(0, 240, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    backdrop-filter: blur(10px);
    animation: fadeInUp 0.4s ease-out;
  `;

  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.65rem;">
      <img src="./pgt-token-icon.jpg" alt="PolyGame Icon" style="width: 38px; height: 38px; border-radius: 8px; border: 1px solid var(--color-accent);">
      <div style="display: flex; flex-direction: column;">
        <strong style="color: #fff; font-size: 0.82rem;">Install PolyGame App</strong>
        <span style="color: var(--text-muted); font-size: 0.72rem;">Fullscreen 60 FPS Web3 Arcade & Mining</span>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 0.4rem;">
      <button id="pwa-install-btn" style="background: linear-gradient(135deg, #00f0ff, #00a8ff); color: #000; font-weight: 800; font-size: 0.75rem; padding: 0.45rem 0.85rem; border-radius: 6px; border: none; cursor: pointer; white-space: nowrap;">
        📲 ${isIOS ? 'Install' : 'Install'}
      </button>
      <button id="pwa-close-btn" style="background: transparent; color: var(--text-dim); border: none; font-size: 1.1rem; cursor: pointer; padding: 0 0.25rem;">&times;</button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('pwa-close-btn').onclick = () => {
    banner.remove();
  };

  document.getElementById('pwa-install-btn').onclick = () => {
    triggerPWAInstall(isIOS);
  };
}

export function triggerPWAInstall(isIOS) {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted installation prompt');
        if (window.triggerToast) window.triggerToast("🎉 PolyGame App Installed Successfully!", "success");
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.remove();
      }
      deferredPrompt = null;
    });
  } else if (isIOS) {
    // Show iOS Safari 2-step installation modal instructions
    showIOSInstallModal();
  } else {
    if (window.triggerToast) window.triggerToast("To install: Open browser menu (⋮) and tap 'Add to Home Screen' or 'Install App'", "info");
  }
}

export function showIOSInstallModal() {
  const modal = document.createElement('div');
  modal.id = 'pwa-ios-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 999999;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  `;

  modal.innerHTML = `
    <div style="background: #0f172a; border: 1px solid var(--color-accent); border-radius: 14px; padding: 1.5rem; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 0 30px rgba(0, 240, 255, 0.3);">
      <img src="./pgt-token-icon.jpg" style="width: 56px; height: 56px; border-radius: 12px; border: 2px solid var(--color-accent); margin-bottom: 1rem;">
      <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.2rem;">Install PolyGame on iOS</h3>
      <p style="color: var(--text-muted); font-size: 0.82rem; margin-bottom: 1.25rem;">Follow 2 simple steps to launch PolyGame in fullscreen app mode on iPhone / iPad:</p>
      
      <div style="text-align: left; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 8px; padding: 0.85rem; font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.2rem;">1️⃣</span>
          <span>Tap the <strong style="color: var(--color-accent);">Share button (⎋)</strong> at the bottom of Safari.</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.2rem;">2️⃣</span>
          <span>Scroll down and tap <strong style="color: var(--color-success);">"Add to Home Screen" (➕)</strong>.</span>
        </div>
      </div>

      <button id="pwa-ios-close-btn" class="btn-primary" style="width: 100%; background: var(--color-accent); color: #000; font-weight: 800; border: none; padding: 0.65rem;">Got It!</button>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('pwa-ios-close-btn').onclick = () => modal.remove();
}

window.initPWA = initPWA;
window.renderPWABanner = renderPWABanner;
window.triggerPWAInstall = triggerPWAInstall;
