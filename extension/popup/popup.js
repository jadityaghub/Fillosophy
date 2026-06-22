// Fillosophy — Popup controller | Tab switching, PDF upload, backend fetch

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
// MODULE STATE
// ════════════════════════════════════════════════════════════

/**
 * Holds the currently selected File object.
 * Set by applyFileSelection(); consumed by handleExtract().
 * @type {File|null}
 */
let selectedFile = null;

// ════════════════════════════════════════════════════════════
// INITIALISATION
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ── Tab elements ────────────────────────────────────────
  const tabBtns = Object.fromEntries(
    TAB_IDS.map((id) => [id, document.getElementById(`tab-${id}`)])
  );
  const tabPanels = Object.fromEntries(
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
  extractBtn.disabled   = true;   // enabled only after a valid file is chosen
  uploadStatus.textContent = '';

  // ── Wire tabs ───────────────────────────────────────────
  TAB_IDS.forEach((id) => {
    tabBtns[id].addEventListener('click', () => activateTab(id, tabBtns, tabPanels));
  });
  activateTab(DEFAULT_TAB, tabBtns, tabPanels);

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
 *
 * @param {string} tabId     - 'upload' | 'profiles' | 'autofill'
 * @param {Object} tabBtns   - Map of tabId → <button>
 * @param {Object} tabPanels - Map of tabId → <section>
 */
function activateTab(tabId, tabBtns, tabPanels) {
  TAB_IDS.forEach((id) => {
    const btn      = tabBtns[id];
    const panel    = tabPanels[id];
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
 * Shows loading state on the button; surfaces success or error feedback.
 * Does NOT reload or navigate the popup.
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

    // On success: show char count, leave button disabled (re-select to run again)
    setStatus(
      uploadStatus,
      `✓ Profile saved! ${data.char_count} characters extracted.`,
      'success'
    );
    // Keep button disabled — user must select a new file to run again
    extractBtn.disabled = true;

  } catch (err) {
    const isNetworkError = err instanceof TypeError;
    const message = isNetworkError
      ? '✗ Could not reach Fillosophy backend. Is it running on port 8000?'
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
  if (labelEl) labelEl.textContent   = isLoading ? 'Extracting…' : 'Extract & Save Profile';
  if (iconEl)  iconEl.style.opacity  = isLoading ? '0' : '1';
  // Only force-disable on entry; re-enable decisions are made by the caller
  if (isLoading) btn.disabled = true;
}
