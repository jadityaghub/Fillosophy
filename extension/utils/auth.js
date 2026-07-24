// Fillosophy — Supabase Auth Client (REST API)
// Provides authentication methods (Sign Up, Log In, Log Out, Session)
// without adding heavy external dependencies to the Chrome extension popup.

const SUPABASE_URL = 'https://bqbdshptdsrovpnhscvr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l1HyfLhLKPMACDLLGHZ2Kg_rCNos5ZR';
const STORAGE_KEY  = 'fillosophy_auth_session';

/**
 * Sends an HTTP request to the Supabase Auth GoTrue REST endpoints.
 *
 * @param {string} endpoint - Relative path (e.g. '/auth/v1/signup')
 * @param {string} method   - 'GET' | 'POST'
 * @param {Object} [body]   - Request payload
 * @param {string} [token]  - Bearer access token
 * @returns {Promise<Object>} JSON response
 */
async function supabaseAuthFetch(endpoint, method = 'POST', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${SUPABASE_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error_description || data.msg || data.message || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Registers a new user with Name, Email, and Password.
 *
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} { user, session }
 */
export async function signUp(name, email, password) {
  const payload = {
    email: email.trim(),
    password: password.trim(),
    data: { name: name.trim() }
  };

  const data = await supabaseAuthFetch('/auth/v1/signup', 'POST', payload);

  const user = data.user || data;
  const session = data.session || (data.access_token ? data : null);

  const authState = {
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || name.trim()
    },
    accessToken: session?.access_token || null,
    refreshToken: session?.refresh_token || null,
    loggedAt: Date.now()
  };

  if (session?.access_token) {
    await setStoredSession(authState);
  }

  return authState;
}

/**
 * Authenticates an existing user with Email and Password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} { user, session }
 */
export async function signIn(email, password) {
  const payload = {
    email: email.trim(),
    password: password.trim()
  };

  const data = await supabaseAuthFetch('/auth/v1/token?grant_type=password', 'POST', payload);

  const authState = {
    user: {
      id: data.user?.id,
      email: data.user?.email || email.trim(),
      name: data.user?.user_metadata?.name || data.user?.email?.split('@')[0] || 'User'
    },
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    loggedAt: Date.now()
  };

  await setStoredSession(authState);
  return authState;
}

/**
 * Logs out the current user and clears stored credentials.
 */
export async function signOut() {
  const current = await getStoredSession();
  if (current?.accessToken) {
    try {
      await supabaseAuthFetch('/auth/v1/logout', 'POST', null, current.accessToken);
    } catch {
      /* ignore remote logout errors on local signout */
    }
  }
  await clearStoredSession();
}

/**
 * Retrieves the currently saved session from chrome.storage.local.
 *
 * @returns {Promise<Object|null>}
 */
export async function getStoredSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      resolve(res?.[STORAGE_KEY] || null);
    });
  });
}

/**
 * Stores the active session into chrome.storage.local.
 */
async function setStoredSession(sessionData) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: sessionData }, () => {
      resolve();
    });
  });
}

/**
 * Clears the stored session from chrome.storage.local.
 */
async function clearStoredSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY], () => {
      resolve();
    });
  });
}
