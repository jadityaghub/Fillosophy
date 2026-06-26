// Fillosophy — Popup controller | Tab switching, PDF upload, backend fetch

import { saveProfile, setActiveProfile } from '../utils/storage.js';

// ════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════

/** Tab IDs — left-to-right order matches the DOM. */
const TAB_IDS = ['upload', 'profiles', 'autofill'];

/** Tab shown when the popup first opens. */
const DEFAULT_TAB = 'upload';

/** Backend endpoint for resume extraction. */
const EXTRACT_URL = 'http://localhost:8000/extract';

/** Only PDFs are accepted by the upload flow. */
const ACCEPTED_MIME = 'application/pdf';

// ════════════════════════════════════════════════════════════
// CHROME MESSAGING HELPER
// ════════════════════════════════════════════════════════════

/**
 * Promise-based wrapper around chrome.runtime.sendMessage.
 * Rejects if chrome.runtime.lastError is set (e.g. no listener,
 * service worker not active) so callers can use async/await cleanly.
 *
 * @param {string} type    - Message type string.
 * @param {Object} payload - Optional extra fields merged into the message.
 * @returns {Promise<any>}
 */
function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type, ...payload },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      }
    );
  });
}

// ════════════════════════════════════════════════════════════
// MODULE STATE
// ════════════════════════════════════════════════════════════

/**
 * Holds the currently selected File object.
 * Set by applyFileSelection(); consumed by handleExtract().
 * @type {File|null}
 */
let selectedFile = null;

/**
 * Holds the most recently extracted profile dict returned by the backend.
 * Set on successful POST /extract; used by displayProfile().
 * @type {Object|null}
 */
let currentProfile = null;

/**
 * Module-level maps so switchTab() can be called from anywhere in the file
 * without needing to pass DOM refs as arguments every time.
 * Populated in DOMContentLoaded.
 */
let _tabBtns   = {};
let _tabPanels = {};

/**
 * Full descriptor objects returned by the last DETECT_FIELDS call.
 * Consumed by the autofill handler in Week 5 to map matches back to elements.
 * @type {Object[]}
 */
let detectedFields = [];

/**
 * Best-available label string for each detected field.
 * Sent to the AI /match endpoint as the "fields" payload.
 * @type {string[]}
 */
let fieldLabels = [];

/**
 * Mapping object returned by the last successful /match call.
 * Key: field label, Value: { value, confidence }
 * @type {Object}
 */
let fieldMapping = {};

// ════════════════════════════════════════════════════════════
// INITIALISATION
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ── Tab elements ────────────────────────────────────────
  _tabBtns = Object.fromEntries(
    TAB_IDS.map((id) => [id, document.getElementById(`tab-${id}`)])
  );
  _tabPanels = Object.fromEntries(
    TAB_IDS.map((id) => [id, document.getElementById(`panel-${id}`)])
  );

  // ── Upload tab elements ─────────────────────────────────
  const dropzone        = document.getElementById('dropzone');
  const fileInput       = document.getElementById('resume-file-input');
  const dropzoneTitle   = document.getElementById('dropzone-title');
  const dropzoneSub     = document.getElementById('dropzone-sub');
  const profileSelect   = document.getElementById('profile-name-select');
  const extractBtn      = document.getElementById('extract-btn');
  const extractBtnLabel = document.getElementById('extract-btn-label');
  const extractBtnIcon  = document.getElementById('extract-btn-icon');
  const uploadStatus    = document.getElementById('upload-status');

  // ── Initial state ───────────────────────────────────────
  extractBtn.disabled      = true;   // enabled only after a valid file is chosen
  uploadStatus.textContent = '';

  // ── Wire tabs ───────────────────────────────────────────
  TAB_IDS.forEach((id) => {
    _tabBtns[id].addEventListener('click', () => switchTab(id));
  });
  switchTab(DEFAULT_TAB);

  // ── Wire dropzone ───────────────────────────────────────
  initDropzone({ dropzone, fileInput, dropzoneTitle, dropzoneSub,
                 extractBtn, uploadStatus });

  // ── Wire extract button ─────────────────────────────────
  extractBtn.addEventListener('click', () => {
    handleExtract({ profileSelect, extractBtn, extractBtnLabel,
                    extractBtnIcon, uploadStatus });
  });
});

// ════════════════════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════════════════════

/**
 * Activates one tab and deactivates all others.
 * Uses the module-level _tabBtns / _tabPanels maps.
 *
 * @param {string} tabId - 'upload' | 'profiles' | 'autofill'
 */
function switchTab(tabId) {
  TAB_IDS.forEach((id) => {
    const btn      = _tabBtns[id];
    const panel    = _tabPanels[id];
    const isActive = id === tabId;

    if (!btn || !panel) {
      console.warn(`[Fillosophy] Missing DOM element for tab: "${id}"`);
      return;
    }

    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
    panel.classList.toggle('active', isActive);

    if (isActive) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });

  const label = tabId.charAt(0).toUpperCase() + tabId.slice(1);
  console.log(`[Fillosophy] Tab switched to: ${label}`);

  // Side-effect: refresh live data whenever the Autofill tab becomes active
  if (tabId === 'autofill') {
    loadAutofillTab();
  }
}

// Keep the old name around in case other code calls activateTab directly
function activateTab(tabId, tabBtns, tabPanels) {
  switchTab(tabId);
}

// ════════════════════════════════════════════════════════════
// DROPZONE
// ════════════════════════════════════════════════════════════

/**
 * Wires all dropzone interactions.
 * Both drag-drop and file-input change call applyFileSelection(file).
 *
 * @param {Object} els - Named DOM references from DOMContentLoaded.
 */
function initDropzone(els) {
  const { dropzone, fileInput, dropzoneTitle, dropzoneSub,
          extractBtn, uploadStatus } = els;

  if (!dropzone || !fileInput) {
    console.warn('[Fillosophy Upload] Dropzone or file input not found.');
    return;
  }

  // Click anywhere on the zone → open file picker
  dropzone.addEventListener('click', () => fileInput.click());

  // Keyboard access (Enter / Space)
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // dragover → visual highlight
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  // dragleave → remove highlight
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  // drop → validate and accept
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    console.log(`[Fillosophy Upload] File dropped: ${file?.name ?? 'none'}`);
    applyFileSelection(file, { dropzone, dropzoneTitle, dropzoneSub,
                               extractBtn, uploadStatus });
  });

  // File picker selection
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    console.log(`[Fillosophy Upload] File selected via picker: ${file?.name ?? 'none'}`);
    applyFileSelection(file, { dropzone, dropzoneTitle, dropzoneSub,
                               extractBtn, uploadStatus });
    // Reset so the same file can be re-selected
    fileInput.value = '';
  });
}

/**
 * Validates the chosen file (must be a PDF), stores it in selectedFile,
 * and updates the dropzone UI.
 *
 * @param {File|undefined} file - The file to validate.
 * @param {Object}         els  - DOM element references.
 */
function applyFileSelection(file, els) {
  const { dropzone, dropzoneTitle, dropzoneSub, extractBtn, uploadStatus } = els;

  // Clear any previous status
  setStatus(uploadStatus, '', '');

  if (!file) {
    console.warn('[Fillosophy Upload] No file provided.');
    return;
  }

  // PDF-only validation
  if (file.type !== ACCEPTED_MIME && !file.name.toLowerCase().endsWith('.pdf')) {
    console.warn(`[Fillosophy Upload] Rejected — not a PDF: ${file.name} (${file.type})`);
    setStatus(uploadStatus, '✗ Only PDF files are supported.', 'error');
    return;
  }

  // Accept
  selectedFile = file;
  console.log(`[Fillosophy Upload] File accepted: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

  dropzone.classList.add('has-file');
  dropzoneTitle.textContent = `✓ ${file.name}`;
  dropzoneSub.textContent   = `${(file.size / 1024).toFixed(1)} KB · Click to change`;

  extractBtn.disabled = false;
}

// ════════════════════════════════════════════════════════════
// EXTRACT & SAVE
// ════════════════════════════════════════════════════════════

/**
 * POSTs the selected PDF to the /extract endpoint.
 * On success: stores the profile, updates the Profiles tab, and switches to it.
 * On failure: surfaces the error in the status bar.
 *
 * @param {Object} els - Named DOM element references.
 */
async function handleExtract(els) {
  const { profileSelect, extractBtn, extractBtnLabel,
          extractBtnIcon, uploadStatus } = els;

  if (!selectedFile) {
    console.warn('[Fillosophy Upload] handleExtract called without a selected file.');
    return;
  }

  const profileName = profileSelect?.value ?? 'personal';
  console.log(`[Fillosophy Upload] Starting extract — file: "${selectedFile.name}", profile: "${profileName}"`);

  // Loading state
  setLoadingState(extractBtn, extractBtnLabel, extractBtnIcon, true);
  setStatus(uploadStatus, '', '');

  // Build multipart payload
  const formData = new FormData();
  formData.append('file', selectedFile, selectedFile.name);
  formData.append('profile_name', profileName);

  try {
    console.log(`[Fillosophy Upload] POST ${EXTRACT_URL}`);

    const response = await fetch(EXTRACT_URL, {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type — browser sets it with the correct boundary
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errBody = await response.json();
        if (errBody?.detail) detail = errBody.detail;
      } catch { /* ignore JSON parse errors on error body */ }
      throw new Error(detail);
    }

    const data = await response.json();
    console.log('[Fillosophy Upload] Extract success:', data);

    // ── Store and display the profile ───────────────────────────────────────
    currentProfile = data.profile;
    displayProfile(data.profile);

    // ── Persist to chrome.storage ───────────────────────────────────────────
    try {
      await saveProfile(profileName, data.profile);
      await setActiveProfile(profileName);
      console.log(`[Fillosophy] Profile saved to chrome.storage`);
    } catch (storageErr) {
      // Non-fatal — the backend already saved to SQLite; just warn
      console.warn('[Fillosophy] chrome.storage save failed:', storageErr.message);
    }

    // ── Update status & switch tab ──────────────────────────────────────────
    setStatus(
      uploadStatus,
      `✓ Profile saved! ${data.profile.full_name} — ${data.char_count} chars extracted.`,
      'success'
    );

    // Keep button disabled — user must select a new file to run again
    extractBtn.disabled = true;

    // Switch to Profiles tab after a short delay so the user sees the message
    setTimeout(() => switchTab('profiles'), 1200);

  } catch (err) {
    const isNetworkError = err instanceof TypeError;
    const message = isNetworkError
      ? '⚠️ The backend server is currently offline. Please start it to extract profiles.'
      : `✗ Error: ${err.message}`;

    console.error('[Fillosophy Upload] Extract failed:', err.message);
    setStatus(uploadStatus, message, 'error');

    // Re-enable button so user can retry
    extractBtn.disabled = false;

  } finally {
    // Restore button label/icon regardless of outcome
    setLoadingState(extractBtn, extractBtnLabel, extractBtnIcon, false);
  }
}

// ════════════════════════════════════════════════════════════
// PROFILE DISPLAY
// ════════════════════════════════════════════════════════════

/**
 * Populates the readonly preview fields in the Profiles tab with extracted
 * profile data and syncs the active-profile radio button.
 *
 * @param {Object} profile - Structured profile dict returned by /extract.
 */
function displayProfile(profile) {
  // ── Populate preview inputs ─────────────────────────────────────────────
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };

  set('profile-field-name',   profile.full_name ?? '—');
  set('profile-field-email',  profile.email     ?? '—');
  set('profile-field-cgpa',   profile.cgpa      ?? '—');
  set('profile-field-degree', profile.degree    ?? '—');
  set('profile-field-skills',
    Array.isArray(profile.skills)
      ? profile.skills.join(', ')
      : (profile.skills ?? '—')
  );

  console.log('[Fillosophy] Profile displayed in Profiles tab');
}

// ════════════════════════════════════════════════════════════
// AUTOFILL TAB — LIVE DATA LOADER
// ════════════════════════════════════════════════════════════

/**
 * Called every time the Autofill tab becomes active.
 * Fetches live page info from the content script and the active profile
 * from chrome.storage via the service worker, then updates the UI.
 */
async function loadAutofillTab() {
  // Grab all the elements we'll update
  const urlEl            = document.getElementById('current-page-url');
  const fieldsFoundEl    = document.getElementById('stat-fields-found');
  const highConfidenceEl = document.getElementById('stat-high-confidence');
  const needsReviewEl    = document.getElementById('stat-needs-review');
  const activeProfileEl  = document.getElementById('active-profile-name');
  const autofillBtn      = document.getElementById('autofill-btn');
  const tabStatus        = document.getElementById('autofill-tab-status');

  // ── Step 1: loading state ──────────────────────────────────────────────────
  if (urlEl)         urlEl.textContent         = 'Scanning page…';
  if (fieldsFoundEl) fieldsFoundEl.textContent = '—';
  if (highConfidenceEl) highConfidenceEl.textContent = '—';
  if (needsReviewEl)    needsReviewEl.textContent    = '—';
  if (tabStatus)     { tabStatus.textContent = ''; tabStatus.className = 'upload-status'; }
  if (autofillBtn)   autofillBtn.disabled      = true; // Disable until everything is ready

  // ── Step 1a: PING — verify content script is reachable before proceeding ───
  try {
    const ping = await sendMessage('PING_CONTENT');
    if (ping?.status !== 'content_script_ready') {
      throw new Error(ping?.message ?? 'Content script did not respond');
    }
  } catch (pingErr) {
    console.warn('[Fillosophy] PING_CONTENT failed:', pingErr.message);
    if (urlEl)     urlEl.textContent     = 'Unavailable';
    if (tabStatus) {
      tabStatus.textContent = '⚠ Fillosophy cannot access this page. Navigate to a website with a form and try again.';
      tabStatus.className   = 'upload-status error';
    }
    if (autofillBtn) autofillBtn.disabled = true;
    return; // abort — no point calling GET_PAGE_INFO or DETECT_FIELDS
  }

  // ── Step 2: GET_PAGE_INFO via service worker ───────────────────────────────
  try {
    const pageInfo = await sendMessage('GET_PAGE_INFO');
    if (pageInfo?.status === 'error') {
      throw new Error(pageInfo.message ?? 'Content script not reachable');
    }
    if (urlEl) urlEl.textContent = pageInfo.url ?? 'Unknown URL';
    console.log(`[Fillosophy] Page info loaded — ${pageInfo.fieldCount} field(s) on ${pageInfo.url}`);
  } catch (pageErr) {
    console.warn('[Fillosophy] GET_PAGE_INFO failed:', pageErr.message);
    if (urlEl)       urlEl.textContent       = 'Unavailable';
    if (tabStatus) {
      tabStatus.textContent = '⚠ Fillosophy cannot read this page. Try refreshing or navigate to a page with a form.';
      tabStatus.className   = 'upload-status error';
    }
    if (autofillBtn) autofillBtn.disabled = true;
    return;
  }

  // ── Step 3: GET_ACTIVE_PROFILE via service worker ──────────────────────────
  try {
    const profileRes = await sendMessage('GET_ACTIVE_PROFILE');
    if (profileRes?.status === 'ok') {
      const name = profileRes.profileName ?? 'Unknown';
      if (activeProfileEl) activeProfileEl.textContent = name;
      currentProfile = profileRes.profile;
      console.log(`[Fillosophy] Active profile loaded: ${name}`);
    } else {
      if (activeProfileEl) activeProfileEl.textContent = 'None';
      if (tabStatus) {
        tabStatus.textContent = '⚠ No profile loaded. Upload a resume first.';
        tabStatus.className   = 'upload-status error';
      }
      if (autofillBtn) autofillBtn.disabled = true;
      console.warn('[Fillosophy] No active profile found in storage.');
      return;
    }
  } catch (profileErr) {
    console.warn('[Fillosophy] GET_ACTIVE_PROFILE failed:', profileErr.message);
    if (activeProfileEl) activeProfileEl.textContent = 'Unknown';
    if (tabStatus) {
      tabStatus.textContent = '⚠ Could not load profile data.';
      tabStatus.className   = 'upload-status error';
    }
    if (autofillBtn) autofillBtn.disabled = true;
    return;
  }

  // ── Step 4: Collect full field labels ──────────────────────────────────────
  try {
    fieldLabels = await collectFieldLabels();
    if (fieldsFoundEl) fieldsFoundEl.textContent = fieldLabels.length;
    console.log('[Fillosophy] Field labels:', fieldLabels);

    if (fieldLabels.length === 0) {
      if (fieldsFoundEl) fieldsFoundEl.textContent = '0';
      if (tabStatus) {
        tabStatus.textContent = '⚠ No form fields detected on this page.';
        tabStatus.className   = 'upload-status error';
      }
      if (autofillBtn) autofillBtn.disabled = true;
      console.log('[Fillosophy] No fields detected — autofill disabled');
      return;
    }
  } catch (labelErr) {
    console.warn('[Fillosophy] collectFieldLabels failed:', labelErr.message);
    if (tabStatus) {
      tabStatus.textContent = '⚠ Failed to detect form fields on this page.';
      tabStatus.className   = 'upload-status error';
    }
    if (autofillBtn) autofillBtn.disabled = true;
    return;
  }

  // ── Step 5: previewMatch ───────────────────────────────────────────────────
  await previewMatch();
}

/**
 * Calls the /match endpoint to get a preview of the fill confidence.
 */
async function previewMatch() {
  if (fieldLabels.length === 0 || !currentProfile) return;

  const highConfidenceEl = document.getElementById('stat-high-confidence');
  const needsReviewEl    = document.getElementById('stat-needs-review');
  const tabStatus        = document.getElementById('autofill-tab-status');
  const autofillBtn      = document.getElementById('autofill-btn');
  const fieldsFoundEl    = document.getElementById('stat-fields-found');

  if (highConfidenceEl) highConfidenceEl.textContent = '...';
  if (needsReviewEl)    needsReviewEl.textContent    = '...';

  try {
    const response = await fetch('http://localhost:8000/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: currentProfile, fields: fieldLabels })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    fieldMapping = data.mapping || {};

    if (fieldsFoundEl)    fieldsFoundEl.textContent    = data.total_fields;
    if (highConfidenceEl) highConfidenceEl.textContent = data.high_confidence;
    if (needsReviewEl)    needsReviewEl.textContent    = data.needs_review;

    if (data.needs_review > 0) {
      if (tabStatus) {
        tabStatus.textContent = `⚠ ${data.needs_review} field(s) will be flagged for review.`;
        tabStatus.className   = 'upload-status amber';
      }
    } else {
      if (tabStatus) {
        tabStatus.textContent = '✓ All fields matched with high confidence.';
        tabStatus.className   = 'upload-status success';
      }
    }

    if (autofillBtn) autofillBtn.disabled = false;
    console.log('[Fillosophy] Match preview complete. Mapping ready.');

  } catch (err) {
    console.error('[Fillosophy] Match preview failed:', err);
    if (tabStatus) {
      tabStatus.textContent = '⚠️ The backend server is offline. Please start it to map fields.';
      tabStatus.className   = 'upload-status error';
    }
    if (autofillBtn) autofillBtn.disabled = true;
  }
}

// ════════════════════════════════════════════════════════════
// FIELD LABEL COLLECTION
// ════════════════════════════════════════════════════════════

/**
 * Sends DETECT_FIELDS to the service worker, stores the full descriptor
 * objects in detectedFields, and returns a flat array of best-available
 * label strings for the AI /match endpoint.
 *
 * Priority order per descriptor:
 *   label → placeholder → ariaLabel → name → id → "field_{index}"
 *
 * @returns {Promise<string[]>} One label string per detected field.
 */
async function collectFieldLabels() {
  const response = await sendMessage('DETECT_FIELDS');

  if (response?.status !== 'ok') {
    throw new Error(`DETECT_FIELDS returned status: ${response?.status ?? 'undefined'}`);
  }

  // Store full descriptors for the Week 5 autofill handler
  detectedFields = response.fields ?? [];

  // Build the label list using the specified priority order
  const labels = detectedFields.map((d) =>
    d.label       ??
    d.placeholder ??
    d.ariaLabel   ??
    d.name        ??
    d.id          ??
    `field_${d.index}`
  );

  console.log(`[Fillosophy] Collected ${labels.length} field labels for matching`);
  return labels;
}

/**
 * Finds the radio button in the Profiles tab whose value matches profileName
 * and sets it as checked.
 *
 * @param {string} profileName - e.g. "personal" | "academic" | "job"
 */
function setActiveProfileRadio(profileName) {
  const radio = document.querySelector(
    `input[type="radio"][name="active-profile"][value="${profileName}"]`
  );
  if (radio) {
    radio.checked = true;
    console.log(`[Fillosophy] Active profile radio set to: ${profileName}`);
  } else {
    console.warn(`[Fillosophy] No radio found for profile: "${profileName}"`);
  }
}

// ════════════════════════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Sets the #upload-status paragraph text and CSS modifier class.
 *
 * @param {HTMLElement}          el      - The status element.
 * @param {string}               message - Text to display ('': clears it).
 * @param {'success'|'error'|''} type    - CSS modifier class.
 */
function setStatus(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className   = `upload-status${type ? ` ${type}` : ''}`;
}

/**
 * Swaps button text/icon for loading state and back.
 * Note: disabled state is managed separately by the caller.
 *
 * @param {HTMLButtonElement} btn
 * @param {HTMLElement}       labelEl
 * @param {HTMLElement}       iconEl
 * @param {boolean}           isLoading
 */
function setLoadingState(btn, labelEl, iconEl, isLoading) {
  if (labelEl) labelEl.textContent  = isLoading ? 'Extracting…' : 'Extract & Save Profile';
  if (iconEl)  iconEl.style.opacity = isLoading ? '0' : '1';
  // Only force-disable on entry; re-enable decisions are made by the caller
  if (isLoading) btn.disabled = true;
}
