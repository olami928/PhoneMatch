"""test_personas.py  (M4 acceptance check)

M4 is done when it "runs locally and gives sensible results for 10 test
personas". This is those 10, plus the hard-rule checks that matter more than
whether the picks look nice.

Hard rules are checked on EVERY persona, because a violation is a bug that
would ship an unbuyable phone to a real shopper:
  - no result above the shopper's budget maximum
  - no result below their storage floor
  - no result that is out of stock or inactive

Run:  python model/src/test_personas.py
Exit code 1 means a hard rule broke.
"""

import sys
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(MODEL_DIR / "src"))

from shop_recommender import recommend, load_phones     # noqa: E402
from questionnaire_mapper import CONFIG, QUESTIONS     # noqa: E402


def _label(question_id: str, needle: str) -> str:
    """Look the option up by the config, never by a hardcoded string.

    The frozen labels contain double spaces and full display wording, so
    typing them by hand here would let the test drift away from the config it
    is meant to verify.
    """
    for o in QUESTIONS[question_id]["options"]:
        if needle.lower() in o["label"].lower():
            return o["label"]
    raise KeyError(f"{question_id} has no option matching {needle!r}")


def _budget(needle: str) -> str:
    for _opt in QUESTIONS["budget"]["options"]:
        if needle.lower() in _opt["label"].lower():
            return f'{_opt["min"]}-{_opt["max"]}'
    raise KeyError(needle)


S_LIGHT = _label("storage", "Light")
S_MED = _label("storage", "Medium")
S_HEAVY = _label("storage", "Heavy")

STORAGE_FLOOR = {
    S_LIGHT: 64,
    S_MED: 128,
    S_HEAVY: 256,
}

PERSONAS = [
    ("Student, cheapest band", {
        "budget": _budget("Under"), "main_use": "Calls and everyday use",
        "top_priority": "Lowest price", "storage": S_LIGHT,
        "brand_preference": "No preference"}),
    ("Student, mid budget", {
        "budget": _budget("150,000 - 300,000"),
        "main_use": "Social media and streaming",
        "top_priority": "Battery life", "storage": S_MED,
        "brand_preference": "No preference"}),
    ("Camera lover, mid", {
        "budget": _budget("300,000 - 500,000"),
        "main_use": "Photos and video",
        "top_priority": "Camera", "storage": S_MED,
        "brand_preference": "No preference"}),
    ("Camera lover, tight", {
        "budget": _budget("150,000 - 300,000"),
        "main_use": "Photos and video",
        "top_priority": "Camera", "storage": S_LIGHT,
        "brand_preference": "No preference"}),
    ("Gamer, upper budget", {
        "budget": _budget("500,000 - 1,000,000"),
        "main_use": "Gaming",
        "top_priority": "Performance", "storage": S_MED,
        "brand_preference": "No preference"}),
    ("Gamer, flagship", {
        "budget": _budget("1,000,000 - 2,000,000"),
        "main_use": "Gaming",
        "top_priority": "Performance", "storage": S_HEAVY,
        "brand_preference": "No preference"}),
    ("Worker, Samsung only", {
        "budget": _budget("500,000 - 1,000,000"),
        "main_use": "Work and study",
        "top_priority": "Battery life", "storage": S_MED,
        "brand_preference": "Samsung"}),
    ("Worker, big storage", {
        "budget": _budget("300,000 - 500,000"),
        "main_use": "Work and study",
        "top_priority": "Screen", "storage": S_HEAVY,
        "brand_preference": "No preference"}),
    ("Cheapest possible, heavy storage", {
        "budget": _budget("1,000,000 - 2,000,000"),
        "main_use": "Calls and everyday use",
        "top_priority": "Lowest price", "storage": S_HEAVY,
        "brand_preference": "No preference"}),
    ("Flagship, camera", {
        "budget": _budget("1,000,000 - 2,000,000"),
        "main_use": "Photos and video",
        "top_priority": "Camera", "storage": S_HEAVY,
        "brand_preference": "No preference"}),
]


def main() -> int:
    phones = load_phones()
    failures = []

    for name, answers in PERSONAS:
        out = recommend(answers, df=phones)
        recs = out["recommendations"]
        band = answers["budget"]
        cap = int(band.split("-")[1])
        floor = STORAGE_FLOOR[answers["storage"]]

        print(f"\n=== {name}  (budget {band}, storage >={floor}GB) ===")
        print(f"    candidates: {out['total_candidates']}"
              + (f"  [{out['message']}]" if out["message"] else ""))
        if not recs:
            print("    NO RESULTS")
            failures.append(f"{name}: no results")
            continue

        for r in recs:
            print(f"    {r['rank']}. {r['brand']} {r['model']:<24} "
                  f"NGN{r['price_ngn']:>10,.0f}  {r['match_score']}")
            print(f"       {' | '.join(r['reasons'])}")
            print(f"       camera {r['ratings']['camera']}, "
                  f"battery {r['ratings']['battery']}, "
                  f"performance {r['ratings']['performance']}")

            if r["price_ngn"] > cap:
                failures.append(f"{name}: {r['model']} NGN{r['price_ngn']:,.0f} "
                                f"over cap NGN{cap:,.0f}")
            if r["specs"]["storage_gb"] < floor:
                failures.append(f"{name}: {r['model']} storage "
                                f"{r['specs']['storage_gb']} below {floor}")

        # ranks must be sequential from 1, or the UI numbering breaks
        if [r["rank"] for r in recs] != list(range(1, len(recs) + 1)):
            failures.append(f"{name}: ranks are not sequential")
        # every pick must carry a reason, per the model rules
        for r in recs:
            if not r["reasons"]:
                failures.append(f"{name}: {r['model']} has no reason line")

    # out-of-stock and inactive must be impossible, tested directly
    print("\n=== hard rule: stock and active ===")
    dead = phones.copy()
    dead["stock"] = 0
    r1 = recommend(PERSONAS[2][1], df=dead)
    print(f"    all stock=0  -> {r1['total_candidates']} candidates")
    if r1["total_candidates"]:
        failures.append("out-of-stock phones were not filtered")

    gone = phones.copy()
    gone["active"] = False
    r2 = recommend(PERSONAS[2][1], df=gone)
    print(f"    all inactive -> {r2['total_candidates']} candidates")
    if r2["total_candidates"]:
        failures.append("inactive phones were not filtered")

    print("\n" + "=" * 60)
    if failures:
        print(f"FAIL: {len(failures)} hard-rule violation(s)")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"PASS: {len(PERSONAS)} personas, all hard rules held")
    return 0


if __name__ == "__main__":
    sys.exit(main())