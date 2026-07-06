// Fillosophy — Content Script | Form field detection & autofill
// Injected into every active tab via manifest.json content_scripts

(function () {
  'use strict';

  // Guard against multiple injections on the same page
  if (window.__fillosophyLoaded) return;
  window.__fillosophyLoaded = true;

  console.log('[Fillosophy Content] Content script loaded on:', window.location.href);

  // ════════════════════════════════════════════════════════════
  // SPA RESILIENCE — persistent post-autofill form-change watcher
  // ════════════════════════════════════════════════════════════

  /**
   * Tracks whether autofill has run at least once on this page load.
   * Set to true by applyAutofill() so the watcher only activates after
   * the first real fill, avoiding noise on initial page load.
   */
  let autofillHasRun = false;

  /**
   * Persistent MutationObserver that watches for major DOM changes
   * AFTER autofill has already run. Notifies the user (via console) that
   * they should reopen the popup to rescan — e.g. on multi-step forms.
   * Non-intrusive: never auto-fills or auto-detects again.
   */
  (function installSpaChangeWatcher() {
    let lastFieldCount = 0;
    let spaDebounceTid = null;

    const spaObserver = new MutationObserver(() => {
      if (!autofillHasRun) return; // silent until first autofill
      clearTimeout(spaDebounceTid);
      spaDebounceTid = setTimeout(() => {
        const newCount = detectFormFields().length;
        if (newCount !== lastFieldCount && newCount > 0) {
          lastFieldCount = newCount;
          console.log('[Fillosophy Content] Page form changed — reopen popup to rescan.');
        }
      }, 600);
    });

    spaObserver.observe(document.body, { childList: true, subtree: true });
  })();

  // ════════════════════════════════════════════════════════════
  // LABEL RESOLUTION
  // ════════════════════════════════════════════════════════════

  /**
   * Resolves the human-readable label for a form element.
   * Tries five strategies in order and returns the first non-empty result.
   *
   * @param {HTMLElement} element
   * @returns {string|null}
   */
  function getLabelText(element) {
    // Strategy 1 — Explicit <label for="id">
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        const text = label.innerText.trim();
        if (text) return text;
      }
    }

    // Strategy 2 — Element is wrapped inside a <label>
    const wrappingLabel = element.closest('label');
    if (wrappingLabel) {
      const text = wrappingLabel.innerText.trim();
      if (text) return text;
    }

    // Strategy 3 — Preceding sibling <label> (up to 3 steps back)
    let sibling = element.previousElementSibling;
    for (let step = 0; step < 3 && sibling; step++) {
      if (sibling.tagName === 'LABEL') {
        const text = sibling.innerText.trim();
        if (text) return text;
      }
      sibling = sibling.previousElementSibling;
    }

    // Strategy 4 — aria-labelledby attribute
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const referred = document.getElementById(labelledBy);
      if (referred) {
        const text = referred.innerText.trim();
        if (text) return text;
      }
    }

    // Strategy 5 — Closest ancestor whose className contains a label-like word
    const labelClasses = ['label', 'field-name', 'form-label', 'input-label'];
    let ancestor = element.parentElement;
    for (let level = 0; level < 4 && ancestor; level++) {
      const cls = (ancestor.className || '').toLowerCase();
      if (labelClasses.some((lc) => cls.includes(lc))) {
        const text = ancestor.innerText.trim();
        if (text) return text;
      }
      ancestor = ancestor.parentElement;
    }

    return null;
  }

  // ════════════════════════════════════════════════════════════
  // FIELD DETECTION
  // ════════════════════════════════════════════════════════════

  /**
   * Determines if an element is visible to the user.
   * @param {HTMLElement} el
   * @returns {boolean}
   */
  function isVisible(el) {
    const style = window.getComputedStyle(el);
    return (
      style.display    !== 'none'   &&
      style.visibility !== 'hidden' &&
      el.offsetParent  !== null
    );
  }

  /**
   * Queries all fillable form elements on the page, builds a structured
   * descriptor for each one, and filters out those with no identifiable context.
   *
   * @returns {Object[]} Array of field descriptor objects.
   */
  function detectFormFields() {
    // Step 1 — Query all interactive elements (excludes hidden/submit/button/reset/image/file)
    const elements = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])' +
      ':not([type="reset"]):not([type="image"]):not([type="file"]),' +
      'select, textarea'
    );

    const fields = [];

    Array.from(elements).forEach((element, i) => {
      // Skip invisible elements — they are not user-facing fields
      if (!isVisible(element)) return;

      // Step 2 — Build descriptor object
      const descriptor = {
        index:       i,
        tag:         element.tagName,
        type:        element.type        ?? null,
        name:        element.name        || null,
        id:          element.id          || null,
        placeholder: element.placeholder || null,
        label:       getLabelText(element),
        ariaLabel:   element.getAttribute('aria-label') ?? null,
        required:    element.required    ?? false,
        value:       element.value       ?? null,
      };
      Object.defineProperty(descriptor, 'element', { value: element, enumerable: false });

      // Step 3 — Skip fields with no identifiable context whatsoever
      const hasContext =
        descriptor.name      !== null ||
        descriptor.id        !== null ||
        descriptor.placeholder !== null ||
        descriptor.label     !== null ||
        descriptor.ariaLabel !== null;

      if (hasContext) {
        fields.push(descriptor);
      }
    });

    // Step 4 — Log summary and table for easy debugging in DevTools
    console.log(`[Fillosophy Content] Detected ${fields.length} form fields`);
    console.table(fields.map((f) => ({
      label:       f.label,
      name:        f.name,
      type:        f.type,
      placeholder: f.placeholder,
    })));

    return fields;
  }

  // ════════════════════════════════════════════════════════════
  // SPA RESILIENCE — waitForStableForm
  // ════════════════════════════════════════════════════════════

  /**
   * Waits until the number of form fields on the page is stable
   * for two consecutive 300ms debounce cycles, or until timeoutMs
   * has elapsed — whichever comes first.
   *
   * Designed for SPA portals (React / Vue / Angular) where forms render
   * asynchronously after the initial page load.
   *
   * @param {number} timeoutMs - Maximum wait time in milliseconds.
   * @returns {Promise<void>}
   */
  function waitForStableForm(timeoutMs = 3000) {
    return new Promise((resolve) => {
      const startTime  = Date.now();
      // ── Wait for DOM to stabilise ────────
      let lastCount   = 0;
      let stableCount = 0;
      let debounceTid = null;

      const checkStability = () => {
        clearTimeout(debounceTid);
        debounceTid = setTimeout(() => {
          const newCount = detectFormFields().length;

          if (newCount === lastCount) {
            stableCount++;
          } else {
            stableCount = 0;
            lastCount   = newCount;
          }

          const elapsed = Date.now() - startTime;

          // Resolve when stable for 2 consecutive cycles, or on timeout
          if (stableCount >= 2 || elapsed >= timeoutMs) {
            observer.disconnect();
            clearTimeout(debounceTid);
            console.log(
              `[Fillosophy Content] Form stabilized after ${elapsed}ms`,
              `(${lastCount} fields found)`
            );
            resolve();
          } else {
            // Kick off the next check manually in case there are no mutations (static pages)
            checkStability();
          }
        }, 300);
      };

      const observer = new MutationObserver(() => {
        // Reset stability counter if a mutation happens
        stableCount = 0;
        checkStability();
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Start the first check cycle immediately
      checkStability();

      // Hard timeout fallback — always disconnect and resolve
      setTimeout(() => {
        observer.disconnect();
        clearTimeout(debounceTid);
        const elapsed = Date.now() - startTime;
        console.log(
          `[Fillosophy Content] Form stabilized after ${elapsed}ms (timeout),`,
          `${detectFormFields().length} fields found`
        );
        resolve();
      }, timeoutMs);
    });
  }

  // MESSAGE LISTENER
  // ════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

    // PING — lets the popup verify the content script is alive
    if (message.type === 'PING') {
      console.log('[Fillosophy Content] PING received — responding ready.');
      sendResponse({ status: 'content_script_ready' });
      return true;
    }

    // DETECT_FIELDS — wait for SPA form to stabilise, then scan
    if (message.type === 'DETECT_FIELDS') {
      console.log('[Fillosophy Content] DETECT_FIELDS received — waiting for form to stabilise…');
      waitForStableForm(3000)
        .then(() => {
          const fields = detectFormFields();

          // Deduplicate labels: if two fields resolve to the same label string,
          // append the field index to make it unique. Must stay in sync with
          // the same logic in applyAutofill().
          const seenLabels = new Set();
          for (const field of fields) {
            const baseLabel =
              field.label       ??
              field.placeholder ??
              field.ariaLabel   ??
              field.name        ??
              field.id          ??
              `field_${field.index}`;

            if (seenLabels.has(baseLabel)) {
              // Override the descriptor's label so the label sent to /match
              // matches the key used in applyAutofill()
              field.label = `${baseLabel} (${field.index})`;
            } else {
              seenLabels.add(baseLabel);
            }
          }

          sendResponse({ status: 'ok', fields: fields, count: fields.length });
        })
        .catch((err) => {
          console.error('[Fillosophy Content] waitForStableForm error:', err);
          const fields = detectFormFields();

          // Deduplicate labels (same logic as the success path above)
          const seenLabels = new Set();
          for (const field of fields) {
            const baseLabel =
              field.label       ??
              field.placeholder ??
              field.ariaLabel   ??
              field.name        ??
              field.id          ??
              `field_${field.index}`;

            if (seenLabels.has(baseLabel)) {
              field.label = `${baseLabel} (${field.index})`;
            } else {
              seenLabels.add(baseLabel);
            }
          }

          sendResponse({ status: 'ok', fields: fields, count: fields.length });
        });
      return true; // async — keep port open
    }

    // GET_PAGE_INFO — lightweight metadata about the current page
    if (message.type === 'GET_PAGE_INFO') {
      console.log('[Fillosophy Content] GET_PAGE_INFO received.');
      sendResponse({
        url:        window.location.href,
        title:      document.title,
        fieldCount: detectFormFields().length,
      });
      return true;
    }

    // FILLOSOPHY_AUTOFILL — trigger form autofill with the active profile
    if (message.type === 'FILLOSOPHY_AUTOFILL') {
      handleAutofill(message.profile)
        .then((result) => sendResponse({ success: true, result }))
        .catch((err) => {
          console.error('[Fillosophy Content] Autofill error:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // async response — keep port open
    }

    // APPLY_AUTOFILL — actual AI form filling
    if (message.type === 'APPLY_AUTOFILL') {
      console.log('[Fillosophy Content] APPLY_AUTOFILL received.');
      try {
        const summary = applyAutofill(message.mapping, message.fields);
        sendResponse({ status: 'ok', summary });
      } catch (err) {
        console.error('[Fillosophy Content] applyAutofill error:', err);
        sendResponse({ status: 'error', message: err.message });
      }
      return true;
    }

    return true; // always return true for async safety
  });

  // ════════════════════════════════════════════════════════════
  // AUTOFILL HANDLER
  // ════════════════════════════════════════════════════════════

  /**
   * Main autofill flow.
   * Detects form fields, then fills each one with the matching profile value.
   *
   * @param {Object|null} profile - Parsed resume profile from storage.
   * @returns {Promise<{ filledCount: number }>}
   */
  async function handleAutofill(profile) {
    if (!profile) {
      console.warn('[Fillosophy Content] No profile provided for autofill.');
      return { filledCount: 0 };
    }

    const fields = detectFormFields();
    let filledCount = 0;

    for (const field of fields) {
      const value = matchFieldToProfile(field, profile);
      if (value !== null) {
        const el = document.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"])' +
          ':not([type="reset"]):not([type="image"]):not([type="file"]),' +
          'select, textarea'
        )[field.index];
        if (el) {
          fillField(el, value);
          filledCount++;
        }
      }
    }

    console.log(`[Fillosophy Content] Filled ${filledCount} field(s).`);
    return { filledCount };
  }

  /**
   * Applies the AI field mapping to the actual DOM elements.
   *
   * @param {Object} mapping - AI response from /match.
   * @param {Object[]} fieldDescriptors - DetectFormFields array.
   * @returns {Object} Autofill summary.
   */
  function applyAutofill(mapping, fieldDescriptors) {
    const elements = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])' +
      ':not([type="reset"]):not([type="image"]):not([type="file"]),' +
      'select, textarea'
    );

    const labelToElementMap = {};
    for (const descriptor of fieldDescriptors) {
      const el = elements[descriptor.index];
      if (!el) continue;

      // MUST use the exact same priority as collectFieldLabels() in popup.js
      // so that mapping keys from /match line up with the right elements.
      let label =
        descriptor.label       ??
        descriptor.placeholder ??
        descriptor.ariaLabel   ??
        descriptor.name        ??
        descriptor.id          ??
        `field_${descriptor.index}`;

      // Deduplicate: if this label already exists in the map, append
      // the field index to make it unique. This must match the same
      // deduplication logic in the DETECT_FIELDS handler.
      if (label in labelToElementMap) {
        label = `${label} (${descriptor.index})`;
      }

      labelToElementMap[label] = el;
    }

    // Debug — surface the map so mismatches can be spotted in DevTools
    console.log('[Fillosophy Content] labelToElementMap keys:', Object.keys(labelToElementMap));
    console.log('[Fillosophy Content] mapping keys:', Object.keys(mapping));

    const results = [];
    const summary = { filled: 0, flagged: 0, skipped: 0, details: [] };

    for (const [label, fieldData] of Object.entries(mapping)) {
      const element = labelToElementMap[label];

      if (!element || fieldData.value == null || element.disabled || element.readOnly) {
        continue;
      }

      let status = "filled";

      if (fieldData.confidence < 70) {
        element.setAttribute("data-fillosophy-flag", "low-confidence");
        element.style.border = "2px solid #D97706";
        element.style.backgroundColor = "#FEF3C7";
        status = "low_confidence";
      }

      const tagName = element.tagName.toLowerCase();
      const type = (element.type || "").toLowerCase();

      try {
        if (tagName === 'input' && (type === 'checkbox' || type === 'radio')) {
          if (type === 'checkbox') {
            const valStr = String(fieldData.value).toLowerCase();
            element.checked = ["yes", "true", "1"].includes(valStr) || fieldData.value === true;
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (type === 'radio') {
            const radios = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
            let matched = false;
            for (const radio of radios) {
              if (radio.value.toLowerCase() === String(fieldData.value).toLowerCase()) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                matched = true;
                break;
              }
            }
            if (!matched) status = "skipped";
          }
        } else if (tagName === 'select') {
          let matched = false;
          const options = element.options;
          const targetValue = String(fieldData.value).toLowerCase();
          for (let i = 0; i < options.length; i++) {
            const optVal = options[i].value.toLowerCase();
            const optText = options[i].text.toLowerCase();
            if (!optVal) continue; // Skip default empty options like "Select a degree"

            if (optVal === targetValue || 
                optText === targetValue || 
                optText.includes(targetValue) ||
                targetValue.includes(optVal) ||
                targetValue.includes(optText) ||
                // Basic degree fuzzy mapping
                (targetValue.includes('b.tech') && optVal.includes('bachelor')) ||
                (targetValue.includes('b.e') && optVal.includes('bachelor')) ||
                (targetValue.includes('master') && optVal.includes('master')) ||
                (targetValue.includes('phd') && optVal.includes('phd'))) {
              element.value = options[i].value;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              matched = true;
              break;
            }
          }
          if (!matched) status = "skipped";
        } else {
          fillField(element, String(fieldData.value));
        }
      } catch (err) {
        console.error(`[Fillosophy Content] Error filling ${label}:`, err);
        status = "skipped";
      }

      // ── Visual outline highlighting ──────────────────────────────────────
      if (status === "filled") {
        element.style.outline = "2px solid #16a34a";
        element.style.outlineOffset = "1px";
      } else if (status === "low_confidence") {
        element.style.outline = "2px solid #d97706";
        element.style.outlineOffset = "1px";
        element.style.backgroundColor = "#fffbeb";
      }

      const resObj = {
        label: label,
        status: status,
        confidence: fieldData.confidence,
        value: fieldData.value
      };
      results.push(resObj);

      if (status === "filled") summary.filled++;
      else if (status === "low_confidence") summary.flagged++;
      else if (status === "skipped") summary.skipped++;
    }

    summary.details = results;
    // Activate the SPA change watcher from this point on
    autofillHasRun = true;
    console.log(`[Fillosophy Content] Autofill complete:`, summary);

    // ── Auto-clear outlines after 8 s OR on next page click ───────────────
    const allFilled = document.querySelectorAll(
      'input[style*="outline"], select[style*="outline"], textarea[style*="outline"]'
    );

    const clearOutlines = () => {
      allFilled.forEach((el) => {
        el.style.outline = '';
        el.style.outlineOffset = '';
      });
      document.querySelectorAll('[data-fillosophy-flag]').forEach((el) => {
        el.style.outline = '';
        el.style.outlineOffset = '';
      });
    };

    const autoTimer = setTimeout(clearOutlines, 8000);

    const clickHandler = () => {
      clearOutlines();
      clearTimeout(autoTimer);
      document.removeEventListener('click', clickHandler, { capture: true });
    };
    // Use capture so even clicks inside form elements fire this
    document.addEventListener('click', clickHandler, { capture: true, once: true });

    renderOverlay(summary);
    return summary;
  }

  /**
   * Sets a field's value and dispatches synthetic input + change events
   * so React / Vue / Angular frameworks register the update.
   *
   * @param {HTMLElement} field
   * @param {string}      value
   */
  function fillField(field, value) {
    let proto = window.HTMLInputElement.prototype;
    if (field.tagName === 'TEXTAREA') {
      proto = window.HTMLTextAreaElement.prototype;
    } else if (field.tagName === 'SELECT') {
      proto = window.HTMLSelectElement.prototype;
    }

    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(field, value);
    } else {
      field.value = value;
    }

    field.dispatchEvent(new Event('input',  { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ════════════════════════════════════════════════════════════
  // OVERLAY RENDERER
  // ════════════════════════════════════════════════════════════

  /**
   * Renders the Fillosophy confidence overlay panel anchored to the
   * bottom-right of the page, matching the SmartFill preview design.
   *
   * @param {Object} summary - Result object from applyAutofill().
   */
  function renderOverlay(summary) {
    // Step 1 — Remove any existing overlay
    const existing = document.getElementById('fillosophy-overlay');
    if (existing) existing.remove();

    // Step 2 — Inject CSS once
    if (!document.getElementById('fillosophy-overlay-styles')) {
      const style = document.createElement('style');
      style.id = 'fillosophy-overlay-styles';
      style.textContent = `
        #fillosophy-overlay {
          position: fixed;
          bottom: 16px;
          right: 16px;
          width: 320px;
          max-height: 420px;
          overflow-y: auto;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 13px;
          z-index: 2147483647;
          border: 1px solid #e5e7eb;
          animation: fillosophy-slide-in 0.25s ease;
        }
        @keyframes fillosophy-slide-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fillosophy-overlay-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #2563EB;
          color: white;
          border-radius: 12px 12px 0 0;
          font-weight: 600;
          font-size: 13px;
          position: sticky;
          top: 0;
        }
        .fillosophy-overlay-close {
          cursor: pointer;
          font-size: 18px;
          background: none;
          border: none;
          color: white;
          line-height: 1;
          padding: 0 2px;
          opacity: 0.85;
        }
        .fillosophy-overlay-close:hover { opacity: 1; }
        .fillosophy-stats-bar {
          display: flex;
          gap: 0;
          background: #f0f7ff;
          border-bottom: 1px solid #e5e7eb;
        }
        .fillosophy-stat-pill {
          flex: 1;
          text-align: center;
          padding: 6px 4px;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
        }
        .fillosophy-stat-pill span {
          display: block;
          font-size: 16px;
          font-weight: 700;
        }
        .fillosophy-stat-pill.green span { color: #16a34a; }
        .fillosophy-stat-pill.amber span { color: #d97706; }
        .fillosophy-stat-pill.gray span  { color: #6b7280; }
        .fillosophy-field-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 9px 16px;
          border-bottom: 1px solid #f3f4f6;
          gap: 8px;
        }
        .fillosophy-field-left {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }
        .fillosophy-field-label {
          font-weight: 500;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fillosophy-field-value {
          color: #6b7280;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fillosophy-badge {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 99px;
        }
        .fillosophy-confidence-high {
          color: #16a34a;
          background: #dcfce7;
        }
        .fillosophy-confidence-mid {
          color: #374151;
          background: #f3f4f6;
        }
        .fillosophy-confidence-low {
          color: #d97706;
          background: #fef3c7;
        }
        .fillosophy-overlay-footer {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: #fafafa;
          border-top: 1px solid #e5e7eb;
          border-radius: 0 0 12px 12px;
          position: sticky;
          bottom: 0;
        }
        .fillosophy-btn-primary {
          flex: 1;
          background: #2563EB;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          font-family: inherit;
          transition: background 0.15s;
        }
        .fillosophy-btn-primary:hover { background: #1d4ed8; }
        .fillosophy-btn-secondary {
          flex: 1;
          background: #fef3c7;
          color: #92400e;
          border: none;
          border-radius: 6px;
          padding: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          font-family: inherit;
          transition: background 0.15s;
        }
        .fillosophy-btn-secondary:hover { background: #fde68a; }
      `;
      document.head.appendChild(style);
    }

    // Step 3 — Build overlay DOM
    const overlay = document.createElement('div');
    overlay.id = 'fillosophy-overlay';

    // Header
    const header = document.createElement('div');
    header.className = 'fillosophy-overlay-header';
    header.innerHTML = `<span>🧠 Fillosophy — Autofill Preview</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'fillosophy-overlay-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close';
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    // Stats bar
    const statsBar = document.createElement('div');
    statsBar.className = 'fillosophy-stats-bar';
    statsBar.innerHTML = `
      <div class="fillosophy-stat-pill green"><span>${summary.filled}</span>Filled</div>
      <div class="fillosophy-stat-pill amber"><span>${summary.flagged}</span>Flagged</div>
      <div class="fillosophy-stat-pill gray"><span>${summary.skipped}</span>Skipped</div>
    `;
    overlay.appendChild(statsBar);

    // Field rows
    const scrollArea = document.createElement('div');
    for (const detail of summary.details) {
      const row = document.createElement('div');
      row.className = 'fillosophy-field-row';

      const truncatedValue = detail.value != null && String(detail.value).length > 30
        ? String(detail.value).slice(0, 30) + '…'
        : String(detail.value ?? '—');

      let badgeClass = 'fillosophy-confidence-high';
      if (detail.confidence < 70) badgeClass = 'fillosophy-confidence-low';
      else if (detail.confidence < 80) badgeClass = 'fillosophy-confidence-mid';

      row.innerHTML = `
        <div class="fillosophy-field-left">
          <span class="fillosophy-field-label">${detail.label}</span>
          <span class="fillosophy-field-value">${truncatedValue}</span>
        </div>
        <span class="fillosophy-badge ${badgeClass}">${detail.confidence}%</span>
      `;
      scrollArea.appendChild(row);
    }
    overlay.appendChild(scrollArea);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'fillosophy-overlay-footer';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'fillosophy-btn-primary';
    applyBtn.textContent = `Apply All (${summary.filled + summary.flagged})`;
    footer.appendChild(applyBtn);

    if (summary.flagged > 0) {
      const reviewBtn = document.createElement('button');
      reviewBtn.className = 'fillosophy-btn-secondary';
      reviewBtn.textContent = `Review (${summary.flagged}) ⚠`;
      reviewBtn.addEventListener('click', () => {
        scrollToFlaggedFields();
      });
      footer.appendChild(reviewBtn);
    }

    overlay.appendChild(footer);

    // Step 4 — Event listeners
    closeBtn.addEventListener('click', () => overlay.remove());
    applyBtn.addEventListener('click', () => {
      confirmAllFields();
      overlay.remove();
    });

    // Step 5 — Mount
    document.body.appendChild(overlay);
    console.log(`[Fillosophy Content] Overlay rendered with ${summary.details.length} fields`);
  }

  // ════════════════════════════════════════════════════════════
  // OVERLAY HELPERS
  // ════════════════════════════════════════════════════════════

  /**
   * Confirms all flagged low-confidence fields — removes amber highlight,
   * applies a green confirmed state, clears all outlines, removes overlay.
   */
  function confirmAllFields() {
    const flagged = document.querySelectorAll('[data-fillosophy-flag="low-confidence"]');
    flagged.forEach((el) => {
      el.removeAttribute('data-fillosophy-flag');
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.border = '2px solid #16a34a';
      el.style.backgroundColor = '#f0fdf4';
    });
    // Also clear any remaining green outlines from high-confidence fields
    document.querySelectorAll('input[style*="outline"], select[style*="outline"], textarea[style*="outline"]')
      .forEach((el) => { el.style.outline = ''; el.style.outlineOffset = ''; });
    // Remove the overlay
    const overlay = document.getElementById('fillosophy-overlay');
    if (overlay) overlay.remove();
    console.log(`[Fillosophy Content] All fields confirmed by user (${flagged.length} flagged cleared).`);
  }

  /**
   * Scrolls to the first low-confidence field and pulses all flagged
   * fields with a CSS animation for 2 seconds.
   */
  function scrollToFlaggedFields() {
    const flaggedEls = document.querySelectorAll('[data-fillosophy-flag="low-confidence"]');
    if (!flaggedEls.length) return;

    // Inject pulse keyframes once
    if (!document.getElementById('fillosophy-pulse-styles')) {
      const ps = document.createElement('style');
      ps.id = 'fillosophy-pulse-styles';
      ps.textContent = `
        @keyframes fillosophy-pulse-anim {
          0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
          50%       { box-shadow: 0 0 0 6px rgba(217, 119, 6, 0); }
        }
        .fillosophy-pulse {
          animation: fillosophy-pulse-anim 0.6s ease-in-out 3;
        }
      `;
      document.head.appendChild(ps);
    }

    // Scroll to the first flagged element
    flaggedEls[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add pulse class to all flagged elements, remove after 2 s
    flaggedEls.forEach((el) => el.classList.add('fillosophy-pulse'));
    setTimeout(() => {
      flaggedEls.forEach((el) => el.classList.remove('fillosophy-pulse'));
    }, 2000);

    console.log(`[Fillosophy Content] Scrolled to ${flaggedEls.length} flagged fields`);
    // NOTE: Overlay intentionally left open so user can continue reviewing
  }

})();
