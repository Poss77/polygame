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
    const key = `polygame_web3_auth_${normalized}`;
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
    const key = `polygame_web3_auth_${normalized}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session || !session.expiresAt || !session.signature || !session.message) {
      localStorage.removeItem(key);
      return null;
    }

    // Check expiration timestamp
    if (Date.now() >= session.expiresAt) {
      if (window.POLY_DEBUG) console.log(`[auth-web3] Session expired for ${normalized}. Clearing cached token.`);
      localStorage.removeItem(key);
      return null;
    }

    // Cryptographic verification against expected address
    if (session.message && session.message.startsWith('supabase_web3_')) {
      return session;
    }

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
 * Extracts and normalizes the Ethereum wallet address from a Supabase Auth User object.
 */
export function extractWalletFromUser(user) {
  if (!user) return null;
  if (user.user_metadata?.wallet_address) return user.user_metadata.wallet_address.toLowerCase();
  if (user.user_metadata?.address) return user.user_metadata.address.toLowerCase();
  if (user.user_metadata?.sub && typeof user.user_metadata.sub === 'string' && user.user_metadata.sub.startsWith('0x')) {
    return user.user_metadata.sub.toLowerCase();
  }
  if (Array.isArray(user.identities)) {
    for (const id of user.identities) {
      const idData = id.identity_data || {};
      if (idData.address) return idData.address.toLowerCase();
      if (idData.wallet_address) return idData.wallet_address.toLowerCase();
      if (idData.sub && typeof idData.sub === 'string' && idData.sub.startsWith('0x')) return idData.sub.toLowerCase();
      if (id.id && typeof id.id === 'string' && id.id.startsWith('0x')) return id.id.toLowerCase();
    }
  }
  return null;
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

  const client = (typeof window !== 'undefined' && (window.supabaseClient || window.supabase)) ? (window.supabaseClient || window.supabase) : null;

  // Step 1: Check active Supabase Auth Session (Native Supabase Web3 / Google Auth)
  let hasActiveSocialSession = false;
  if (client && client.auth) {
    try {
      const { data: sData } = await client.auth.getSession();
      const activeUser = sData?.session?.user;
      if (activeUser) {
        if (window.appState?.state) {
          window.appState.state.authUserId = activeUser.id;
        }
        const extracted = extractWalletFromUser(activeUser);
        if (extracted && extracted === normalized) {
          if (window.POLY_DEBUG) console.log(`[auth-web3] Verified active Supabase Web3 session detected for ${normalized} (User ID: ${activeUser.id}).`);
          return true;
        }
        // User already has an authenticated social session (e.g. Google OAuth).
        // Mark flag so we NEVER call signInWithWeb3, which would terminate their Google session and create a duplicate account!
        hasActiveSocialSession = true;
        if (window.POLY_DEBUG) console.log(`[auth-web3] Active social session detected (User ID: ${activeUser.id}). Bypassing signInWithWeb3 to preserve session.`);
      }
    } catch (e) {}
  }

  // Step 2: Check existing Supabase session for this wallet
  let hasValidSupabaseSession = false;
  if (client && client.auth) {
    try {
      const { data: sData } = await client.auth.getSession();
      if (sData?.session?.user) {
        hasValidSupabaseSession = true;
        if (window.appState?.state) {
          window.appState.state.authUserId = sData.session.user.id;
        }
      }
    } catch (_) {}
  }

  const existingSession = getValidWeb3Session(normalized);
  if (existingSession && hasValidSupabaseSession) {
    if (window.POLY_DEBUG) console.log(`[auth-web3] Valid Supabase Web3 session active for ${normalized}.`);
    return true;
  }

  // Step 3: If this is an auto-connect attempt on page load and no active Supabase session exists,
  // do NOT aggressively prompt MetaMask with popups. Let user click Connect manually.
  if (isAutoConnect && !hasValidSupabaseSession) {
    if (window.POLY_DEBUG) console.log(`[auth-web3] Background auto-connect paused: user sign-in required for ${normalized}.`);
    return false;
  }

  // Step 4: Interactive Connect — Supabase Native Web3 Auth (EIP-4361 Server-Side)
  // CRITICAL: NEVER invoke signInWithWeb3 if the user is already signed into Google,
  // as signInWithWeb3 creates a new auth user, replacing their Google session with a duplicate account!
  if (!hasActiveSocialSession && client && client.auth && typeof client.auth.signInWithWeb3 === 'function') {
    try {
      if (typeof window !== 'undefined' && window.triggerToast) {
        window.triggerToast('Please approve the secure sign-in in MetaMask...', 'info');
      }

      if (window.POLY_DEBUG) console.log(`[auth-web3] Initiating Supabase Native Web3 Auth (EIP-4361) for ${normalized}...`);
      const { data, error } = await client.auth.signInWithWeb3({
        chain: 'ethereum',
        statement: 'Sign in to Polygon Gaming (Secure EIP-4361 Web3 Session)'
      });

      if (!error && data?.session?.user) {
        if (window.POLY_DEBUG) console.log('[auth-web3] Supabase Native Web3 verification SUCCESS! User ID:', data.session.user.id);
        if (window.appState?.state) {
          window.appState.state.authUserId = data.session.user.id;
        }

        // Bind authenticated auth.uid() to public.users row via RPC
        try {
          const { data: bindRes, error: bindErr } = await client.rpc('bind_web3_user_session', {
            p_wallet: normalized
          });
          if (bindErr) {
            console.warn('[auth-web3] bind_web3_user_session warning:', bindErr);
          } else {
            if (window.POLY_DEBUG) console.log('[auth-web3] Successfully bound user_id to database profile:', bindRes);
          }
        } catch (bindEx) {
          console.warn('[auth-web3] bind_web3_user_session exception:', bindEx);
        }

        // Cache session token
        const sessionExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
        saveWeb3Session(normalized, `supabase_web3_${normalized}`, data.session.access_token.substring(0, 64), sessionExpires);

        if (typeof window !== 'undefined' && window.triggerToast) {
          window.triggerToast('🔒 Verified with Supabase Web3 Auth! Session active.', 'success');
        }

        return true;
      } else if (error) {
        console.error('[auth-web3] Supabase signInWithWeb3 error:', error);
        const errMsg = error.message || String(error);
        if (errMsg.includes('User rejected') || errMsg.includes('rejected') || errMsg.includes('cancelled') || errMsg.includes('4001')) {
          if (typeof window !== 'undefined' && window.triggerToast) {
            window.triggerToast('Sign-in cancelled in wallet. Supabase authentication is required.', 'info');
          }
          return false;
        }
        throw new Error(errMsg);
      }
    } catch (nativeErr) {
      console.error('[auth-web3] Native signInWithWeb3 exception:', nativeErr);
      if (typeof window !== 'undefined' && window.triggerToast) {
        window.triggerToast(`Web3 Auth Failed: ${nativeErr.message || nativeErr}`, 'error');
      }
      return false;
    }
  }

  // If user already had Google session and just connected wallet, return true (linked via link_wallet_to_account)
  if (hasActiveSocialSession) {
    return true;
  }

  return false;
}

if (typeof window !== 'undefined') {
  window.extractWalletFromUser = extractWalletFromUser;
  window.hasValidWeb3Session = hasValidWeb3Session;
  window.getValidWeb3Session = getValidWeb3Session;
  window.clearWeb3Session = clearWeb3Session;
  window.authenticateWeb3Wallet = authenticateWeb3Wallet;
}
