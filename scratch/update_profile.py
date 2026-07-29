with open('src/js/features/profile.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = '''  if (statusLabel && addressLabel && networkLabel) {
    if (appState.state.walletConnected) {
      statusLabel.innerText = "Connected";
      statusLabel.style.color = "var(--color-accent)";
      addressLabel.innerText = appState.state.walletAddress;
      
      const providerStr = appState.state.walletProvider.toUpperCase();
      networkLabel.innerText = `${providerStr} (Polygon Ledger)`;
    } else {
      statusLabel.innerText = "Disconnected";
      statusLabel.style.color = "var(--color-danger)";
      addressLabel.innerText = "None";
      networkLabel.innerText = "None";
    }
  }'''

replacement = '''  if (statusLabel && addressLabel && networkLabel) {
    if (appState.state.walletConnected || appState.state.authUserEmail) {
      statusLabel.innerText = "Connected";
      statusLabel.style.color = "var(--color-accent)";
      
      if (appState.state.walletAddress) {
        addressLabel.innerText = appState.state.walletAddress;
      } else if (appState.state.authUserEmail) {
        addressLabel.innerText = `Google: ${appState.state.authUserEmail}`;
      } else {
        addressLabel.innerText = "None";
      }

      const providerStr = (appState.state.walletProvider || 'google').toUpperCase();
      networkLabel.innerText = `${providerStr} (Polygon Ledger)`;
    } else {
      statusLabel.innerText = "Disconnected";
      statusLabel.style.color = "var(--color-danger)";
      addressLabel.innerText = "None";
      networkLabel.innerText = "None";
    }
  }'''

if target in code:
    code = code.replace(target, replacement)
    with open('src/js/features/profile.js', 'w', encoding='utf-8') as f:
        f.write(code)
    print('Successfully updated profile.js')
else:
    print('Target snippet not found')
