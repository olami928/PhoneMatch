"""
shop_recommender.py  (M4)

The recommender the shop actually calls. One function, `recommend(answers)`,
takes the 5 questionnaire answers and returns what the results page needs.

THE ORDER MATTERS AND IS NOT AN ARBITRARY CHOICE
    1. map the answers              (questionnaire_mapper.map_answers)
    2. HARD FILTER the candidates   (apply_hard_filters)
    3. the Random Forest RANKS what survived
    4. scoring.py builds reasons and ratings for the picks

Step 2 must come before step 3. A Random Forest regresses a score; it cannot
enforce a rule. It has no concept of stock, active or budget_min, and it WILL
happily put a phone the shopper cannot buy at the top (AGENTS.md D34). So we
filter the candidate list FIRST and pass candidates IN, never scores out.

Ranking comes from the forest (owner decision, D34). Reason lines and ratings
come from scoring.py, because the forest cannot explain itself.

Usage:
    from shop_recommender import recommend
    out = recommend({
        "budget": "300000-500000",
        "main_use": "Photos and video",
        "top_priority": "Camera",
        "storage": "Medium (128GB)",
        "brand_preference": "No preference",
    })
"""

import sys
from pathlib import Path

import pandas as pd

MODEL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(MODEL_DIR / "legacy" / "src"))
sys.path.insert(0, str(MODEL_DIR / "src"))

from data_processing import _processor_tier                 # noqa: E402
from scoring import (                                       # noqa: E402
    camera_score, battery_score, storage_score, performance_score,
)
from ml_recommender import top_recommendations_ml           # noqa: E402
from questionnaire_mapper import (                          # noqa: E402
    map_answers, apply_hard_filters, reorder_for_lowest_price,
    CONFIG,
)

PHONES_CSV = MODEL_DIR / "data" / "phones.csv"

# Bump when the ranking behaviour changes. Stored with every session so we can
# tell later whether a bad recommendation came from this version.
MODEL_VERSION = "rf-shop-0.1"


def load_phones() -> pd.DataFrame:
    """Load the M3 launch catalog and add the derived columns the model needs.

    `phones.csv` already carries stock and active, which the legacy CSV never
    had, so the hard filters act on the real launch catalog, not a stand-in.
    """
    df = pd.read_csv(PHONES_CSV)
    df["brand_norm"] = df["brand"].str.strip()
    df["processor_tier"] = df["processor"].apply(_processor_tier)
    return df


def _catalog_bounds(df: pd.DataFrame) -> dict:
    """Min/max of each spec across the CANDIDATE set, for the scoring functions.

    Computed over candidates, not the whole catalog, so scores reflect what
    this shopper can actually buy.
    """
    return {
        "main_camera_mp": (df.main_camera_mp.min(), df.main_camera_mp.max()),
        "selfie_camera_mp": (df.selfie_camera_mp.min(), df.selfie_camera_mp.max()),
        "battery_mah": (df.battery_mah.min(), df.battery_mah.max()),
        "storage_gb": (df.storage_gb.min(), df.storage_gb.max()),
        "ram_gb": (df.ram_gb.min(), df.ram_gb.max()),
        "processor_tier": (df.processor_tier.min(), df.processor_tier.max()),
        "refresh_rate_hz": (df.refresh_rate_hz.min(), df.refresh_rate_hz.max()),
    }


def _rate(score: float) -> str:
    """Component score (0-100) to a plain word the shopper understands.

    No match percentage on the results page (AGENTS.md section 10): a
    percentage reads as precision this model does not have.
    """
    t = CONFIG["reasons"]["rating_thresholds"]
    if score >= t["excellent"]:
        return "Excellent"
    if score >= t["good"]:
        return "Good"
    return "Fair"


def _why(row, bounds, customer, filters) -> list:
    """Reason lines built from REAL component scores, never invented text.

    Ordered by contribution so the line that actually earned the pick leads.
    This fixes audit change 8: the legacy version used fixed thresholds and
    could return a camera pick with no camera reason at all.
    """
    cam = camera_score(row.main_camera_mp, row.selfie_camera_mp, bounds)
    bat = battery_score(row.battery_mah, bounds)
    perf = performance_score(row.ram_gb, row.processor_tier, row.refresh_rate_hz, bounds)
    sto = storage_score(row.storage_gb, bounds)
    good = CONFIG["reasons"]["rating_thresholds"]["good"]
    great = CONFIG["reasons"]["rating_thresholds"]["excellent"]

    # The shopper's stated use decides which line leads. A camera persona gets
    # the camera reason first even when the battery happens to score higher.
    priority = customer.get("primary_use", "general")
    noun = {"camera": "camera", "gaming": "performance", "work": "performance",
            "social_media": "performance"}.get(priority, "battery")
    lead = {"camera": cam, "gaming": perf, "work": perf,
            "social_media": perf}.get(priority, bat)

    lines = []
    if lead >= good:
        lines.append(f"Strong {noun} for your needs")
    if row.price_ngn <= filters["price_max_ngn"]:
        lines.append("Fits within your budget")
    if sto >= good:
        lines.append(f"{int(row.storage_gb)}GB storage meets what you need")
    if cam >= great:
        lines.append(f"{int(row.main_camera_mp)}MP main camera")
    if (filters.get("brand_preference") not in (None, "Any")
            and row.brand == filters.get("brand_preference")):
        lines.append(f"You asked for {row.brand}")
    if str(row.imputed_fields) not in ("none", "nan", ""):
        lines.append("Some specs on this phone are estimates, not confirmed")

    return lines[:3] or ["A well-rounded phone within your budget"]


def apply_available_ids(
    df: pd.DataFrame, available_ids: list[str] | None
) -> pd.DataFrame:
    """Restrict the catalog to the ids the shop can sell right now.

    WHY THIS EXISTS (Stage 3): the shop's real stock lives in its `products`
    table and changes every time an order is placed. The CSV's `stock` column was
    written once at build time, so once the shop is live the model would keep
    recommending a phone that had already sold out. The backend therefore sends
    the currently sellable ids and this applies them.

    SECURITY — THE WHOLE POINT OF HOW THIS IS WRITTEN: this is an INTERSECTION
    with the catalog, never an addition to it. An id that is not already in
    phones.csv cannot be introduced by this call, so a caller cannot smuggle in a
    phone that is not in our catalog. And because the hard filters in
    `recommend()` still run afterwards, naming an in-catalog but over-budget,
    under-stored, out-of-stock or inactive phone does not get it recommended
    either. The caller's list can only ever take options AWAY.

    `None` means the caller does not know current stock (e.g. the database is
    not configured), so the catalog is returned untouched and the CSV's own stock
    column is used. An empty list is honoured as "nothing is sellable" and
    returns no rows: the backend deliberately omits the field rather than sending
    an empty list, so a misconfigured deploy degrades to stale stock instead of
    wiping out every recommendation.
    """
    if available_ids is None:
        return df

    allowed = {str(pid) for pid in available_ids}
    if not allowed:
        return df.iloc[0:0]  # an empty frame, not the whole catalog

    # `isin` on a column of the existing frame is the intersection. No row is
    # created here, only rows dropped.
    return df[df["product_id"].isin(allowed)]


def recommend(answers: dict, df: pd.DataFrame | None = None, n: int = 5) -> dict:
    """Answer the questionnaire, return ranked picks with reasons and ratings.

    Returns a dict shaped for the shop's POST /recommend contract.
    """
    df = load_phones() if df is None else df
    customer, filters = map_answers(answers)

    # 1. HARD FILTERS FIRST. The forest cannot enforce these itself.
    candidates = apply_hard_filters(df, filters)

    if candidates.empty:
        return {
            "model_version": MODEL_VERSION,
            "recommendations": [],
            "total_candidates": 0,
            "message": "No phone in our catalog matches every answer yet. "
                       "Try a wider budget or less storage.",
        }

    # 2. the forest ranks whatever survived
    picks = reorder_for_lowest_price(
        top_recommendations_ml(candidates, customer, n=n), filters)

    bounds = _catalog_bounds(candidates)
    out = []
    for p in picks:
        match = candidates[
            (candidates.brand == p["brand"]) & (candidates.model == p["model"])
        ]
        if match.empty:
            continue
        row = match.iloc[0]
        out.append({
            "product_id": row.product_id,
            "rank": len(out) + 1,
            "brand": p["brand"],
            "model": p["model"],
            "price_ngn": float(p["price_ngn"]),
            "match_score": round(float(p["match_score"]), 1),
            "reasons": _why(row, bounds, customer, filters),
            "ratings": {
                "camera": _rate(camera_score(
                    row.main_camera_mp, row.selfie_camera_mp, bounds)),
                "battery": _rate(battery_score(row.battery_mah, bounds)),
                "performance": _rate(performance_score(
                    row.ram_gb, row.processor_tier, row.refresh_rate_hz, bounds)),
            },
            "specs": {
                "ram_gb": float(row.ram_gb),
                "storage_gb": float(row.storage_gb),
                "battery_mah": float(row.battery_mah),
                "main_camera_mp": float(row.main_camera_mp),
                "five_g": bool(row.five_g),
            },
        })

    # Two honest notices, because both conditions are real and the shopper
    # would otherwise think the model ignored them.
    notices = []
    if len(candidates) < n:
        notices.append(
            "Only a few phones fit every answer, so these are all of them.")
    if filters.get("brand_filter_fallback_from"):
        wanted = filters["brand_filter_fallback_from"]
        found = filters.get("brand_filter_fallback_count", 0)
        # Say "none", not "0", which reads like a bug.
        detail = ("we have none in that price and storage range"
                  if found == 0 else
                  f"only {found} in that price and storage range")
        notices.append(
            f"You asked for {wanted}, but {detail}, so we have shown you "
            f"the closest matches from other brands.")

    return {
        "model_version": MODEL_VERSION,
        "recommendations": out,
        "total_candidates": int(len(candidates)),
        "brand_filter_applied": bool(filters.get("brand_filter_applied")),
        # Thin catalog is a real condition here (M3 measured 2m+ at 2 phones),
        # so say so rather than showing 2 results as if they were 5.
        "message": " ".join(notices) if notices else None,
    }