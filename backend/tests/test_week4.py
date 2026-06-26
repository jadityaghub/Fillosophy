# Fillosophy — Week 4 end-to-end test
# Usage: python tests/test_week4.py
# Requires: backend running on port 8000

import json
import os
import sys
import requests

# ── sys.path setup ────────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from database.profiles import get_profile  # noqa: E402

BASE_URL = "http://localhost:8000"
passed = 0
total = 0

def check(label: str, condition: bool):
    global passed, total
    total += 1
    if condition:
        passed += 1
        print(f"  ✓ PASS — {label}")
    else:
        print(f"  ✗ FAIL — {label}")


print("\n════════════════════════════════════════════════════════════")
print("Fillosophy — Week 4 End-to-End Test Suite")
print("════════════════════════════════════════════════════════════")

# ── Test 1 ────────────────────────────────────────────────────────────────────
print("\n────────────────────────────────────────────────────────────")
print("Test 1 — /match with real field labels")
print("────────────────────────────────────────────────────────────")

profile = get_profile("Academic")
if not profile:
    print("  ERROR: Could not load 'Academic' profile from DB. Run test_week3.py first.")
    sys.exit(1)

fields_t1 = [
    "Full Name", "Email Address", "Phone Number",
    "CGPA", "Degree Program", "College Name",
    "Graduation Year", "Skills", "Current City"
]

try:
    resp1 = requests.post(f"{BASE_URL}/match", json={
        "profile": profile,
        "fields": fields_t1
    })
    
    check("Response is 200", resp1.status_code == 200)
    
    if resp1.status_code == 200:
        data1 = resp1.json()
        mapping1 = data1.get("mapping", {})
        
        check("mapping has 9 keys", len(mapping1) == 9)
        check("total_fields is 9", data1.get("total_fields") == 9)
        check("Full Name matched", mapping1.get("Full Name", {}).get("value") is not None)
        check("CGPA matched", mapping1.get("CGPA", {}).get("value") is not None)
        check("confidence scores present", all("confidence" in v for v in mapping1.values()))
        
        print("\n  ── Match Results ──")
        for field, result in mapping1.items():
            print(f"  {field:<20} : {result.get('value')} (confidence: {result.get('confidence')})")

except Exception as e:
    print(f"  ERROR: {e}")
    check("Response is 200", False)


# ── Test 2 ────────────────────────────────────────────────────────────────────
print("\n────────────────────────────────────────────────────────────")
print("Test 2 — High vs low confidence counts")
print("────────────────────────────────────────────────────────────")

if 'resp1' in locals() and resp1.status_code == 200:
    check("high_confidence is an integer", isinstance(data1.get("high_confidence"), int))
    check("needs_review is an integer", isinstance(data1.get("needs_review"), int))
    
    high = data1.get("high_confidence", 0)
    review = data1.get("needs_review", 0)
    total_fields = data1.get("total_fields", 0)
    
    check("counts add up", high + review <= total_fields)
else:
    print("  SKIP — Test 1 failed")
    total += 3


# ── Test 3 ────────────────────────────────────────────────────────────────────
print("\n────────────────────────────────────────────────────────────")
print("Test 3 — Semantic matching quality")
print("────────────────────────────────────────────────────────────")

fields_semantic = ["Academic Score", "Mobile", "Branch", "Passing Year"]

try:
    resp2 = requests.post(f"{BASE_URL}/match", json={
        "profile": profile,
        "fields": fields_semantic
    })
    
    if resp2.status_code == 200:
        data2 = resp2.json()
        mapping2 = data2.get("mapping", {})
        
        check("Academic Score maps to cgpa value", mapping2.get("Academic Score", {}).get("value") == profile.get("cgpa"))
        check("Mobile maps to phone value", mapping2.get("Mobile", {}).get("value") == profile.get("phone"))
        check("Branch maps to degree value", mapping2.get("Branch", {}).get("value") == profile.get("degree"))
    else:
        print(f"  ERROR: /match returned {resp2.status_code}")
        total += 3

except Exception as e:
    print(f"  ERROR: {e}")
    total += 3


# ── Test 4 ────────────────────────────────────────────────────────────────────
print("\n────────────────────────────────────────────────────────────")
print("Test 4 — Empty fields rejection")
print("────────────────────────────────────────────────────────────")

try:
    resp4 = requests.post(f"{BASE_URL}/match", json={
        "profile": profile,
        "fields": []
    })
    check("Empty fields returns 400", resp4.status_code == 400)
except Exception as e:
    print(f"  ERROR: {e}")
    check("Empty fields returns 400", False)


# ── Test 5 ────────────────────────────────────────────────────────────────────
print("\n────────────────────────────────────────────────────────────")
print("Test 5 — Empty profile rejection")
print("────────────────────────────────────────────────────────────")

try:
    resp5 = requests.post(f"{BASE_URL}/match", json={
        "profile": {},
        "fields": ["Full Name"]
    })
    check("Empty profile returns 400", resp5.status_code == 400)
except Exception as e:
    print(f"  ERROR: {e}")
    check("Empty profile returns 400", False)


# ── Final Summary ─────────────────────────────────────────────────────────────
print("\n=== Fillosophy Week 4 Test Summary ===")
print(f"Passed: {passed} / {total}")
if passed == total:
    print("All tests passed. Ready for Week 5.")
else:
    print(f"{total - passed} test(s) failed. Review output above.")
