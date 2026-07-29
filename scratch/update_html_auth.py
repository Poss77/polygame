import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

old_select_state = '''      <!-- Wallet Select State -->
      <div id="wallet-select-state">
        <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 1.25rem; line-height: 1.4;">Select your Web3 wallet to connect to Polygon Gaming.</p>
        <div class="wallet-option-list">'''

new_select_state = '''      <!-- Wallet Select State -->
      <div id="wallet-select-state">
        <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 1.25rem; line-height: 1.4;">Sign in with Google (passwordless) or connect your Web3 wallet.</p>
        <div class="wallet-option-list">
          
          <!-- Option 0: Google OAuth -->
          <div class="wallet-option" id="wallet-opt-google" onclick="loginWithGoogle()" style="border: 1px solid #4285F4; background: rgba(66, 133, 244, 0.12);">
            <div class="wallet-icon" style="background: #FFF; font-size: 1.2rem; font-weight: bold;">🌐</div>
            <div style="display: flex; flex-direction: column; text-align: left;">
              <span class="wallet-name" style="color: #fff; font-weight: 700;">Sign in with Google</span>
              <span style="font-size: 0.75rem; color: #4285F4;">Passwordless social login (Link Web3 wallet anytime)</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; margin: 0.75rem 0; color: var(--text-muted); font-size: 0.75rem;">
            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
            <span style="padding: 0 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">OR CONNECT WEB3 WALLET</span>
            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
          </div>'''

if old_select_state in html:
    html = html.replace(old_select_state, new_select_state)
    print('Updated wallet-select-state')
else:
    print('old_select_state not found')

old_connected_state = '''      <!-- Wallet Connected Dashboard / Swap State -->
      <div id="wallet-connected-state" style="display: none;">
        <div style="background: rgba(0, 240, 255, 0.05); padding: 1rem; border-radius: var(--border-radius-md); border: 1px solid var(--border-cyan); margin-bottom: 1.5rem; text-align: center;">
          <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Active address</span>
          <div class="wallet-address" style="font-size: 1.1rem; margin-top: 0.25rem;" id="wallet-addr-full">0x71C...8976</div>
          <span style="font-size: 0.75rem; color: var(--color-accent); font-weight: 700; margin-top: 0.5rem; display: block;">⚡ POLYGON NETWORK ONLINE</span>
        </div>



        <button class="btn-secondary" style="width: 100%; margin-top: 1rem;" id="btn-wallet-disconnect">Disconnect Wallet</button>
      </div>'''

new_connected_state = '''      <!-- Wallet Connected Dashboard / Swap State -->
      <div id="wallet-connected-state" style="display: none;">
        <div style="background: rgba(0, 240, 255, 0.05); padding: 1rem; border-radius: var(--border-radius-md); border: 1px solid var(--border-cyan); margin-bottom: 1.5rem; text-align: center;">
          <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Active Account / Address</span>
          <div class="wallet-address" style="font-size: 1rem; margin-top: 0.25rem; word-break: break-all;" id="wallet-addr-full">Not Connected</div>
          <span style="font-size: 0.75rem; color: var(--color-accent); font-weight: 700; margin-top: 0.5rem; display: block;">⚡ POLYGON NETWORK ONLINE</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button class="btn-primary" style="width: 100%; font-size: 0.85rem; background: var(--color-accent); color: #000; border: none;" onclick="connectWeb3()" id="btn-link-wallet-action">
            🔗 Connect / Link Web3 Wallet
          </button>
          
          <button class="btn-secondary" style="width: 100%; margin-top: 0.5rem;" id="btn-wallet-disconnect">Disconnect / Log Out</button>
          
          <button class="btn-secondary" style="width: 100%; border: 1px solid var(--color-danger); color: var(--color-danger); background: rgba(255, 0, 85, 0.1); margin-top: 0.5rem;" onclick="deleteUserAccount()">
            🗑️ Delete Account & Reset Data
          </button>
        </div>
      </div>'''

if old_connected_state in html:
    html = html.replace(old_connected_state, new_connected_state)
    print('Updated wallet-connected-state')
else:
    print('old_connected_state not found')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
