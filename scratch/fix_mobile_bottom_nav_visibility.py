import re

# 1. Update src/css/mobile.css to expand media query to 1024px and strengthen fixed bottom nav positioning
with open('src/css/mobile.css', 'r', encoding='utf-8') as f:
    mobile_css = f.read()

mobile_css = mobile_css.replace('@media (max-width: 768px) {', '@media (max-width: 1024px) {')

# Add alias for .mobile-bottom-nav and reinforce fixed positioning
target_sidebar_rule = '''  .sidebar {
    position: fixed !important;
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: 65px !important;
    background: rgba(6, 9, 19, 0.98) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border-right: none !important;
    border-top: 1px solid var(--border-cyan) !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-around !important;
    padding: 0 !important;
    padding-bottom: max(5px, env(safe-area-inset-bottom)) !important;
    z-index: 99999 !important;
    transform: translateZ(0) !important;
    -webkit-transform: translateZ(0) !important;
    box-shadow: 0 -5px 25px rgba(0, 0, 0, 0.8) !important;
  }'''

replacement_sidebar_rule = '''  .sidebar,
  .mobile-bottom-nav {
    position: fixed !important;
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: 65px !important;
    background: rgba(6, 9, 19, 0.98) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border-right: none !important;
    border-top: 1px solid var(--border-cyan) !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-around !important;
    padding: 0 !important;
    padding-bottom: max(5px, env(safe-area-inset-bottom)) !important;
    z-index: 999999 !important;
    transform: translateZ(0) !important;
    -webkit-transform: translateZ(0) !important;
    box-shadow: 0 -5px 25px rgba(0, 0, 0, 0.8) !important;
  }'''

if target_sidebar_rule in mobile_css:
    mobile_css = mobile_css.replace(target_sidebar_rule, replacement_sidebar_rule)

with open('src/css/mobile.css', 'w', encoding='utf-8') as f:
    f.write(mobile_css)
print('Updated src/css/mobile.css to 1024px and reinforced bottom nav z-index')

# 2. Update switchTab in src/js/app.js to always clear game-fullscreen-open
with open('src/js/app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

target_switch_tab_start = "export function switchTab(tabId) {"
replacement_switch_tab_start = '''export function switchTab(tabId) {
  // Ensure game fullscreen mode is cleared so bottom nav is always visible
  document.body.classList.remove('game-fullscreen-open');'''

if target_switch_tab_start in app_js and "document.body.classList.remove('game-fullscreen-open')" not in app_js:
    app_js = app_js.replace(target_switch_tab_start, replacement_switch_tab_start)
    with open('src/js/app.js', 'w', encoding='utf-8') as f:
        f.write(app_js)
    print('Updated switchTab in app.js to clear game-fullscreen-open on navigation')
