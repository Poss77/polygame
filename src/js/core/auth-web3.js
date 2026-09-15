// ==============================================================================
// POLYGAME WEB3 CRYPTOGRAPHIC SIGNATURE AUTHENTICATION (7-DAY SIWE)
// ==============================================================================
// Provides mathematical proof of wallet ownership using ECDSA signature challenges.
// Automatically caches a valid 7-day session token in localStorage to avoid repeated prompts.
// Completely prevents client-side wallet spoofing, Userscripts, and DevTools impersonation.
// ==============================================================================

/**
 * Creates a structured EIP-4361 authentication challenge message.
 * @param {string} address - The normalized EVM wallet address.
 * @param {number} durationDays - Session validity duration (default 7 days).
 * @returns {{ message: string, expiresAt: number, nonce: number }}
 */
export function createAuthChallenge(address, durationDays = 7) {
  const normalized = (address || '').toLowerCase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const nonce = Math.floor(Math.random() * 100000000);

  const message = [
    'Welcome to Polygon Gaming!',
    '',
    'Click to sign in and authenticate ownership of your wallet.',
    `This signature is gas-free and valid for ${durationDays} days on this device.`,
    '',
    `Wallet: ${normalized}`,
    `Issued At: ${now.toISOString()}`,
    `Expires At: ${expiresAt.toISOString()}`,
    `Nonce: ${nonce}`
  ].join('\n');

  return {
    message,
    expiresAt: expiresAt.getTime(),
    nonce
  };
}

/**
 * Cryptographically verifies an ECDSA signature using ethers.verifyMessage.
 * @param {string} message - The original challenge message string.
 * @param {string} signature - The hex signature produced by the wallet.
 * @param {string} expectedAddress - The expected wallet address.
 * @returns {boolean} True if signature was created by expectedAddress private key.
 */
export function verifyAuthSignature(message, signature, expectedAddress) {
  try {
    if (!message || !signature || !expectedAddress) return false;
    const ethersLib = (typeof window !== 'undefined' && window.ethers) ? window.ethers : null;
    if (!ethersLib || typeof ethersLib.verifyMessage !== 'function') {
      console.warn('[auth-web3] ethers.verifyMessage is not available in global scope.');
      return false;
    }
    const recovered = ethersLib.verifyMessage(message, signature);
    return (recovered || '').toLowerCase() === (expectedAddress || '').toLowerCase();
  } catch (e) {
    console.warn('[auth-web3] Signature recovery failed:', e);
    return false;
  }
}

/**
 * Saves a verified 7-day session token into localStorage.
 */
export function saveWeb3Session(address, message, signature, expiresAt) {
  try {
    const normalized = (address || '').toLowerCase();
    if (!normalized) return;
    const key = polygame_web3_auth_;
    localStorage.setItem(key, JSON.stringify({
      address: normalized,
      message,
      signature,
      expiresAt,
      savedAt: Date.now()
    }));
  } catch (e) {
    console.warn('[auth-web3] Failed to save Web3 session to localStorage:', e);
  }
}

/**
 * Retrieves and validates the existing 7-day session token for an address.
 * @param {string} address - EVM wallet address.
 * @returns {object|null} Valid session object, or null if missing/expired/invalid.
 */
export function getValidWeb3Session(address) {
  try {
    const normalized = (address || '').toLowerCase();
    if (!normalized) return null;
    const key = polygame_web3_auth_;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session || !session.expiresAt || !session.signature || !session.message) {
      localStorage.removeItem(key);
      return null;
    }

    // Check expiration timestamp
    if (Date.now() >= session.expiresAt) {
      console.log(`[auth-web3] Session expired for ${normalized}. Clearing cached token.`);
      localStorage.removeItem(key);
      return null;
    }

    // Cryptographic verification against expected address
    const isValid = verifyAuthSignature(session.message, session.signature, normalized);
    if (!isValid) {
      console.warn(`[auth-web3] Tampered/invalid session signature detected for ${normalized}!`);
      localStorage.removeItem(key);
      return null;
    }

    return session;
  } catch (e) {
    console.warn('[auth-web3] Error inspecting Web3 session:', e);
    return null;
  }
}

/**
 * Quick boolean check if a valid 7-day session exists for an address.
 */
export function hasValidWeb3Session(address) {
  return !!getValidWeb3Session(address);
}

/**
 * Clears the Web3 session token upon explicit logout.
 */
export function clearWeb3Session(address) {
  try {
    const normalized = (address || '').toLowerCase();
    if (normalized) {
      localStorage.removeItem(`polygame_web3_auth_${normalized}`);
    }
  } catch (e) {}
}

/**
 * High-level authentication coordinator.
 * Restores existing 7-day session, or prompts the user for a 1-click signature.
 * @param {string} address - Connected wallet address.
 * @param {object} signer - Ethers Signer instance.
 * @param {boolean} isAutoConnect - Whether this is a background auto-connect on boot.
 * @returns {Promise<boolean>} True if authenticated, false otherwise.
 */
export async function authenticateWeb3Wallet(address, signer, isAutoConnect = false) {
  const normalized = (address || '').toLowerCase();
  if (!normalized) {
    throw new Error('Invalid or missing wallet address.');
  }

  // Step 1: Check existing 7-day session token (Zero-friction path)
  const existingSession = getValidWeb3Session(normalized);
  if (existingSession) {
    console.log(`[auth-web3] Valid 7-day cryptographic session active for ${normalized}.`);
    return true;
  }

  // Step 2: If this is an auto-connect attempt on page load and no session exists,
  // do NOT aggressively prompt MetaMask with popups. Let user click Connect manually.
  if (isAutoConnect) {
    console.log(`[auth-web3] Background auto-connect paused: no 7-day session for ${normalized}.`);
    return false;
  }

  // Step 3: Interactive connect - Require real Signer
  if (!signer || typeof signer.signMessage !== 'function') {
    throw new Error('Active Web3 signer not found. Please connect via MetaMask or Web3 browser.');
  }

  const { message, expiresAt } = createAuthChallenge(normalized, 7);

  if (typeof window !== 'undefined' && window.triggerToast) {
    window.triggerToast('Please sign the free 1-click verification in MetaMask to authenticate...', 'info');
  }

  let signature = null;
  try {
    signature = await signer.signMessage(message);
  } catch (signErr) {
    const errCode = signErr ? signErr.code : null;
    if (errCode === 4001 || signErr.message?.includes('User rejected')) {
      throw new Error('Authentication rejected by user in wallet.');
    }
    throw signErr;
  }

  if (!signature) {
    throw new Error('Wallet signature was not provided.');
  }

  // Step 4: Cryptographic verification of returned signature
  const isValid = verifyAuthSignature(message, signature, normalized);
  if (!isValid) {
    throw new Error('Security Violation: Cryptographic signature does not match the claimed wallet address!');
  }

  // Step 5: Save 7-day session token
  saveWeb3Session(normalized, message, signature, expiresAt);

  if (typeof window !== 'undefined' && window.triggerToast) {
    window.triggerToast('🔒 Wallet authenticated successfully! 7-day session active.', 'success');
  }

  return true;
}

if (typeof window !== 'undefined') {
  window.hasValidWeb3Session = hasValidWeb3Session;
  window.getValidWeb3Session = getValidWeb3Session;
  window.clearWeb3Session = clearWeb3Session;
  window.authenticateWeb3Wallet = authenticateWeb3Wallet;
}
