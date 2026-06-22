// Fillosophy — Background Service Worker | Message bus & API relay

import {
  getProfile,
  getActiveProfile,
  saveProfile,
  setActiveProfile,
} from '../utils/storage.js';

/** Base URL of the local FastAPI backend. */
const BACKEND_BASE_URL = 'http://localhost:8000';

// ─── Lifecycle ─────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  console.log('[Fillosophy] Extension installed/updated.');

  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    // First-install hook — uncomment to open an onboarding page:
    // chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
  }
});

// ─── Message router ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(
    '[Fillosophy SW] Message received:',
    message.type,
    '| from:',
    sender.tab?.id ?? 'popup'
  );

  switch (message.type) {

    // Fetch the active profile from chrome.storage and return it
    case 'GET_ACTIVE_PROFILE':
      handleGetActiveProfile()
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // async — keep port open

    // Forward a PING to the active tab's content script
    case 'PING_CONTENT':
      handlePingContent(sender)
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    // Set the active profile by name
    case 'SW_SET_ACTIVE_PROFILE':
      handleSetActiveProfile(message.payload?.name)
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    // Resume extraction relay (wired in Week 3)
    case 'SW_EXTRACT_RESUME':
      handleExtractResume(message.payload)
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    default:
      console.warn('[Fillosophy SW] Unknown message type:', message.type);
      // No return true — synchronous / no response needed
  }
});

// ─── Handlers ──────────────────────────────────────────────────

/**
 * Reads the active profile name and its data from chrome.storage.
 *
 * @returns {Promise<{ success: boolean, name: string|null, profile: object|null }>}
 */
async function handleGetActiveProfile() {
  const name    = await getActiveProfile();
  const profile = name ? await getProfile(name) : null;
  console.log('[Fillosophy SW] GET_ACTIVE_PROFILE →', name ?? 'none');
  return { success: true, name, profile };
}

/**
 * Sends a PING message to the content script on the currently active tab
 * and returns its response.
 *
 * @param {chrome.runtime.MessageSender} _sender - Original message sender (unused).
 * @returns {Promise<{ success: boolean, response?: object, error?: string }>}
 */
async function handlePingContent(_sender) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return { success: false, error: 'No active tab found.' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    console.log('[Fillosophy SW] PING_CONTENT → tab', tab.id, '→', response);
    return { success: true, response };
  } catch (err) {
    // Content script may not be injected on this page (e.g. chrome:// pages)
    console.warn('[Fillosophy SW] PING_CONTENT failed on tab', tab.id, ':', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sets the active profile name in chrome.storage.
 *
 * @param {string} name
 * @returns {Promise<{ success: boolean }>}
 */
async function handleSetActiveProfile(name) {
  if (!name) return { success: false, error: 'Profile name is required.' };
  await setActiveProfile(name);
  console.log('[Fillosophy SW] SW_SET_ACTIVE_PROFILE → set to:', name);
  return { success: true };
}

/**
 * Forwards the uploaded resume to the backend /extract endpoint.
 * Full implementation in Week 3.
 *
 * @param {{ fileDataUrl: string, fileName: string, profileName: string }} payload
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function handleExtractResume(payload) {
  console.log('[Fillosophy SW] SW_EXTRACT_RESUME received —', payload?.fileName);
  // Week 3: convert fileDataUrl → Blob, POST to /extract, save profile
  return { success: false, error: 'Not yet implemented — coming in Week 3.' };
}
