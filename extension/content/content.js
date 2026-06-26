// Fillosophy — Content Script | Form field detection & autofill
// Injected into every active tab via manifest.json content_scripts

(function () {
  'use strict';

  // Guard against multiple injections on the same page
  if (window.__fillosophyLoaded) return;
  window.__fillosophyLoaded = true;

  console.log('[Fillosophy Content] Content script loaded on:', window.location.href);

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
  // MESSAGE LISTENER
  // ════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

    // PING — lets the popup verify the content script is alive
    if (message.type === 'PING') {
      console.log('[Fillosophy Content] PING received — responding ready.');
      sendResponse({ status: 'content_script_ready' });
      return true;
    }

    // DETECT_FIELDS — scan the page and return all field descriptors
    if (message.type === 'DETECT_FIELDS') {
      console.log('[Fillosophy Content] DETECT_FIELDS received — scanning page.');
      const fields = detectFormFields();
      sendResponse({ status: 'ok', fields: fields, count: fields.length });
      return true;
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
   * Naive keyword-based field → profile mapping.
   * Replaced by AI matching in Week 4+ once /match is fully wired.
   *
   * @param {Object} descriptor - Field descriptor from detectFormFields().
   * @param {Object} profile    - Active profile dict.
   * @returns {string|null}
   */
  function matchFieldToProfile(descriptor, profile) {
    const hint = [
      descriptor.label,
      descriptor.name,
      descriptor.id,
      descriptor.placeholder,
      descriptor.ariaLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (hint.includes('name'))  return profile.full_name ?? profile.name ?? null;
    if (hint.includes('email')) return profile.email    ?? null;
    if (hint.includes('phone') || hint.includes('mobile') || hint.includes('contact'))
      return profile.phone ?? null;
    if (hint.includes('cgpa')  || hint.includes('gpa') || hint.includes('grade'))
      return profile.cgpa  != null ? String(profile.cgpa) : null;
    if (hint.includes('degree') || hint.includes('program') || hint.includes('branch'))
      return profile.degree ?? null;
    if (hint.includes('college') || hint.includes('university') || hint.includes('institution'))
      return profile.institution ?? null;
    if (hint.includes('year') || hint.includes('graduation') || hint.includes('passing'))
      return profile.graduation_year != null ? String(profile.graduation_year) : null;
    if (hint.includes('skill'))
      return Array.isArray(profile.skills)
        ? profile.skills.join(', ')
        : profile.skills ?? null;

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
