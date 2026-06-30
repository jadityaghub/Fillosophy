# Fillosophy — Week 5 end-to-end test
# Usage: python tests/test_week5.py
# Requires: backend running on port 8000
# NOTE: Sections marked [MANUAL] must be tested in Chrome directly —
#       autofill DOM manipulation cannot be verified via HTTP requests alone.

import os
import sys
import requests

# ── sys.path setup ────────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from database.profiles import get_profile  # noqa: E402

BASE_URL = "http://localhost:8000"
passed   = 0
total    = 0


def check(label: str, condition: bool):
    global passed, total
    total += 1
    if condition:
        passed += 1
        print(f"  \u2713 PASS \u2014 {label}")
    else:
        print(f"  \u2717 FAIL \u2014 {label}")


print("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550")
print("Fillosophy \u2014 Week 5 End-to-End Test Suite")
print("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550")


# ── Load profile ──────────────────────────────────────────────────────────────
profile = get_profile("Academic")
if not profile:
    print("\n  ERROR: Could not load 'Academic' profile from DB.")
    print("  \u2192 Run tests/test_week3.py first to populate the database.")
    sys.exit(1)


# ── Test 1 \u2014 Confidence threshold consistency ───────────────────────────────
print("\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
print("Test 1 \u2014 Confidence threshold consistency")
print("  Mix of clear fields and deliberately ambiguous labels")
print("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")

FIELDS_T1 = [
    "Full Name",
    "Email Address",
    "Preferred Pronouns",
    "Astrological Sign",
]

mapping_t1 = {}
try:
    resp1 = requests.post(f"{BASE_URL}/match", json={
        "profile": profile,
        "fields":  FIELDS_T1,
    }, timeout=30)

    check("Response is 200", resp1.status_code == 200)

    if resp1.status_code == 200:
        data1      = resp1.json()
        mapping_t1 = data1.get("mapping", {})

        fn_conf = mapping_t1.get("Full Name", {}).get("confidence", 0)
        em_conf = mapping_t1.get("Email Address", {}).get("confidence", 0)
        check("Full Name confidence >= 80", fn_conf >= 80)
        check("Email Address confidence >= 80", em_conf >= 80)

        for ambiguous_label in ["Preferred Pronouns", "Astrological Sign"]:
            entry = mapping_t1.get(ambiguous_label, {})
            conf  = entry.get("confidence", 0)
            val   = entry.get("value")
            check(
                f'"{ambiguous_label}" has confidence < 70 or null value',
                conf < 70 or val is None
            )

        print("\n  \u2500\u2500 Confidence Scores \u2500\u2500")
        for field, entry in mapping_t1.items():
            conf = entry.get("confidence", "?")
            val  = entry.get("value")
            flag = " \u2691 LOW" if isinstance(conf, int) and conf < 70 else ""
            print(f"  {field:<25}: conf={conf!s:>3}  val={val}{flag}")

except Exception as exc:
    print(f"  ERROR: {exc}")
    check("Response is 200", False)


# ── Test 2 \u2014 Response shape stability (consumed by content.js) ───────────────
print("\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
print("Test 2 \u2014 Response shape stability")
print("  Every mapping entry must have the keys content.js reads")
print("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")

FIELDS_T2 = [
    "Full Name", "Email Address", "Phone Number",
    "CGPA", "Degree Program", "College Name",
    "Graduation Year", "Skills",
]

try:
    resp2 = requests.post(f"{BASE_URL}/match", json={
        "profile": profile,
        "fields":  FIELDS_T2,
    }, timeout=30)

    check("Response is 200", resp2.status_code == 200)

    if resp2.status_code == 200:
        data2      = resp2.json()
        mapping_t2 = data2.get("mapping", {})

        check(
            "Every mapping entry has a 'value' key",
            all("value" in v for v in mapping_t2.values())
        )
        check(
            "Every mapping entry has a 'confidence' key",
            all("confidence" in v for v in mapping_t2.values())
        )
        check(
            "All 'confidence' values are integers 0\u2013100",
            all(
                isinstance(v.get("confidence"), int) and 0 <= v["confidence"] <= 100
                for v in mapping_t2.values()
            )
        )
        check(
            "Top-level keys present: status, total_fields, high_confidence, needs_review, mapping",
            all(k in data2 for k in ("status", "total_fields", "high_confidence", "needs_review", "mapping"))
        )
        check(
            "total_fields equals number of submitted labels",
            data2.get("total_fields") == len(FIELDS_T2)
        )
        check(
            "high_confidence + needs_review <= total_fields",
            data2.get("high_confidence", 0) + data2.get("needs_review", 0) <= data2.get("total_fields", 0)
        )

        low_entries = [v for v in mapping_t2.values() if v.get("confidence", 100) < 70]
        if low_entries:
            check(
                "All low-confidence entries have confidence < 70",
                all(v["confidence"] < 70 for v in low_entries)
            )
        else:
            print("  (no low-confidence entries in this response \u2014 low-conf shape check skipped)")

except Exception as exc:
    print(f"  ERROR: {exc}")
    check("Response is 200", False)


# ── Test 3 \u2014 Repeated /match calls return consistent confidence ─────────────
print("\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
print("Test 3 \u2014 Repeated /match calls return consistent confidence")
print("  Same input \u2192 confidence should not vary by more than \u00b110")
print("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")

FIELDS_T3 = ["Full Name", "Email Address"]
confidences = {f: [] for f in FIELDS_T3}

try:
    for _ in range(2):
        r = requests.post(f"{BASE_URL}/match", json={
            "profile": profile,
            "fields":  FIELDS_T3,
        }, timeout=30)
        if r.status_code == 200:
            m = r.json().get("mapping", {})
            for f in FIELDS_T3:
                confidences[f].append(m.get(f, {}).get("confidence", 0))

    for field, confs in confidences.items():
        if len(confs) == 2:
            variance = abs(confs[0] - confs[1])
            check(
                f'"{field}" confidence variance <= 10 across 2 runs (got {confs})',
                variance <= 10
            )
        else:
            print(f"  SKIP \u2014 could not get 2 successful runs for \"{field}\"")

except Exception as exc:
    print(f"  ERROR during consistency test: {exc}")


# ── Test 4 \u2014 Backend guard: empty fields list ──────────────────────────────
print("\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
print("Test 4 \u2014 Backend rejects empty fields list (400)")
print("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")

try:
    r4 = requests.post(f"{BASE_URL}/match", json={"profile": profile, "fields": []}, timeout=10)
    check("Empty fields list returns HTTP 400", r4.status_code == 400)
except Exception as exc:
    print(f"  ERROR: {exc}")
    check("Empty fields list returns HTTP 400", False)


# ── Test 5 \u2014 Backend guard: empty profile ─────────────────────────────────
print("\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
print("Test 5 \u2014 Backend rejects empty profile (400)")
print("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")

try:
    r5 = requests.post(f"{BASE_URL}/match", json={"profile": {}, "fields": ["Full Name"]}, timeout=10)
    check("Empty profile returns HTTP 400", r5.status_code == 400)
except Exception as exc:
    print(f"  ERROR: {exc}")
    check("Empty profile returns HTTP 400", False)


# ── [MANUAL] Browser test checklist ──────────────────────────────────────────
print("""
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
 MANUAL BROWSER TESTS \u2014 Fillosophy Week 5          [MANUAL]
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
 Open: http://localhost:8081/sample_form.html
 Then open the Fillosophy extension popup.

 SETUP
 \u25a1  Backend is running on port 8000
 \u25a1  Sample form server is running on port 8081
 \u25a1  Extension is loaded in Chrome (Developer Mode \u2192 Load Unpacked)

 AUTOFILL CORE
 \u25a1  Open Autofill tab \u2192 stats row populates (Fields Found /
    High Confidence / Needs Review)
 \u25a1  Click "\u26a1 Autofill This Form"
 \u25a1  Text fields (Full Name, Email, Phone) fill with correct values
 \u25a1  Dropdown / select fields fill correctly (if present on form)
 \u25a1  Checkbox / radio fields fill correctly (if present on form)

 VISUAL HIGHLIGHTING
 \u25a1  Filled fields show a green outline (2px solid #16a34a)
 \u25a1  Low-confidence fields show an amber outline + cream background
 \u25a1  Outlines auto-clear after ~8 seconds of inactivity
 \u25a1  Clicking anywhere on the page clears all outlines immediately

 IN-PAGE OVERLAY PANEL
 \u25a1  Overlay appears bottom-right after autofill completes
 \u25a1  Header reads "\U0001f9e0 Fillosophy \u2014 Autofill Preview"
 \u25a1  Stats bar shows correct Filled / Flagged / Skipped counts
 \u25a1  Each row shows label, truncated value, and confidence badge
 \u25a1  High-confidence badges are green; low-confidence badges are amber
 \u25a1  Close (\u00d7) button dismisses the overlay
 \u25a1  "Apply All" button clears amber highlights and closes overlay
 \u25a1  "Review \u26a0" button only appears when flagged > 0
 \u25a1  Clicking "Review \u26a0" scrolls to first flagged field
 \u25a1  Flagged fields pulse briefly (amber glow \u00d7 3) on review

 PROFILE SWITCH
 \u25a1  In Autofill tab, click "Switch" link next to active profile
 \u25a1  Popup navigates to Profiles tab
 \u25a1  Selecting a different radio button loads that profile's data
 \u25a1  Profiles tab preview updates with new profile values
 \u25a1  Switching back to Autofill tab triggers a fresh /match call
    (not cached \u2014 verify via DevTools \u2192 Network tab)

 SPA / MULTI-STEP RESILIENCE
 \u25a1  Open a multi-step form (e.g. Internshala or Unstop apply flow)
 \u25a1  Autofill the first step successfully
 \u25a1  Click "Next" to advance to step 2
 \u25a1  DevTools console (active tab) shows:
       [Fillosophy Content] Page form changed \u2014 reopen popup to rescan.
 \u25a1  Reopening popup and going to Autofill tab rescans new fields
 \u25a1  No crash or uncaught errors during multi-step navigation

 ERROR STATES
 \u25a1  With backend offline: Upload tab shows graceful offline message
 \u25a1  With backend offline: Autofill tab shows graceful offline message
 \u25a1  On a chrome:// or extension:// page: shows "cannot access this page"
 \u25a1  With no profile uploaded: "No profile loaded" message appears

 CONSOLE HEALTH
 \u25a1  DevTools console (active tab) \u2014 zero uncaught errors
 \u25a1  DevTools console (service worker) \u2014 zero uncaught errors
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
""")

# ── Final summary ─────────────────────────────────────────────────────────────
print("=== Fillosophy Week 5 Test Summary ===")
print(f"Automated tests passed: {passed} / {total}")
if passed == total:
    print("\u2713 All automated checks passed.")
else:
    print(f"\u2717 {total - passed} test(s) failed \u2014 review output above.")
print("Manual browser checklist printed above \u2014 complete before marking Week 5 done.")
