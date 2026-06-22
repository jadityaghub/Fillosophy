// Fillosophy — Content Script | Form field detection & autofill

(function () {
  'use strict';

  // Guard against multiple injections on the same page
  if (window.__fillosophyLoaded) return;
  window.__fillosophyLoaded = true;

  console.log('[Fillosophy Content] Content script loaded on:', window.location.href);

  // ─── Message listener ──────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

    // PING — lets the popup verify the content script is alive
    if (message.type === 'PING') {
      console.log('[Fillosophy Content] PING received — responding ready.');
      sendResponse({ status: 'content_script_ready' });
      return; // synchronous response, no need to return true
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
  });

  // ─── Form field detection ──────────────────────────────────────

  /**
   * Queries all input, select, and textarea elements on the page
   * and logs the count.
   *
   * Returns an empty array for now — Week 4 will implement field
   * classification and AI-powered matching.
   *
   * @returns {HTMLElement[]}
   */
  function detectFormFields() {
    const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select';
    const fields   = Array.from(document.querySelectorAll(selector)).filter(isVisible);
    console.log(`[Fillosophy Content] Found ${fields.length} form field(s) on this page.`);
    return [];  // placeholder — real implementation in Week 4
  }

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

  // ─── Autofill handler ──────────────────────────────────────────

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
        fillField(field, value);
        filledCount++;
      }
    }

    console.log(`[Fillosophy Content] Filled ${filledCount} field(s).`);
    return { filledCount };
  }

  /**
   * Naive keyword-based field → profile mapping.
   * Replaced by AI matching in Week 3.
   *
   * @param {HTMLElement} field
   * @param {Object}      profile
   * @returns {string|null}
   */
  function matchFieldToProfile(field, profile) {
    const hint = (field.name || field.id || field.placeholder || '').toLowerCase();
    if (hint.includes('name'))  return profile.name  ?? null;
    if (hint.includes('email')) return profile.email ?? null;
    if (hint.includes('phone')) return profile.phone ?? null;
    return null;
  }

  /**
   * Sets a field's value and dispatches synthetic input + change events
   * so React / Vue / Angular frameworks register the update.
   *
   * @param {HTMLElement} field
   * @param {string}      value
   */
  function fillField(field, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(field, value);
    } else {
      field.value = value;
    }

    field.dispatchEvent(new Event('input',  { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

})();
