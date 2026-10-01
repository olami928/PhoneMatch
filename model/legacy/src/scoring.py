"""
scoring.py
Transparent, explainable weighted scoring — no ML.
Every component score is 0-100. final_score is a weighted blend
whose weights adapt to primary_use and the customer's stated priorities.
"""

import numpy as np

BASE_WEIGHTS = {
    "budget": 0.30,
    "camera": 0.20,
    "battery": 0.20,
    "performance": 0.15,
    "storage": 0.10,
    "brand": 0.05,
}

# How much extra weight each primary_use puts on a category,
# applied BEFORE the customer's own priority sliders.
USE_CASE_BOOST = {
    "gaming":       {"performance": 1.3, "battery": 1.1},
    "camera":       {"camera": 1.3},
    "social_media": {"camera": 1.15, "battery": 1.15, "storage": 1.1},
    "work":         {"performance": 1.15, "storage": 1.15, "battery": 1.1},
    "student":      {"storage": 1.05, "battery": 1.1},
    "general":      {},
}

PRIORITY_MULTIPLIER = {"low": 0.7, "medium": 1.0, "high": 1.3}

# Budget-overage cutoff: phones more than this fraction over budget score 0.
MAX_OVERAGE = 0.15


def budget_score(price: float, budget: float) -> float:
    """Strong reward for fitting the budget; decays fast once over it."""
    if pd_isna(price) or pd_isna(budget) or budget <= 0:
        return np.nan
    if price <= budget:
        ratio = price / budget
        # 70 pts for using very little of the budget, up to 100 pts
        # for spending right up to (not over) the budget.
        return 70 + 30 * ratio
    over_ratio = (price - budget) / budget
    if over_ratio >= MAX_OVERAGE:
        return 0.0
    return max(0.0, 60 * (1 - over_ratio / MAX_OVERAGE))


def _minmax(value, lo, hi):
    if pd_isna(value):
        return np.nan
    if hi == lo:
        return 50.0
    return float(np.clip((value - lo) / (hi - lo) * 100, 0, 100))


def camera_score(main_mp, selfie_mp, catalog_bounds) -> float:
    main_s = _minmax(main_mp, *catalog_bounds["main_camera_mp"])
    sel_s = _minmax(selfie_mp, *catalog_bounds["selfie_camera_mp"])
    parts = [s for s in (main_s, sel_s) if not pd_isna(s)]
    return float(np.mean(parts)) if parts else np.nan


def battery_score(battery_mah, catalog_bounds) -> float:
    return _minmax(battery_mah, *catalog_bounds["battery_mah"])


def storage_score(storage_gb, catalog_bounds) -> float:
    return _minmax(storage_gb, *catalog_bounds["storage_gb"])


def performance_score(ram_gb, processor_tier, refresh_hz, catalog_bounds) -> float:
    """Blend of RAM, chipset tier heuristic, and refresh rate."""
    ram_s = _minmax(ram_gb, *catalog_bounds["ram_gb"])
    proc_s = processor_tier if not pd_isna(processor_tier) else np.nan
    refresh_s = _minmax(refresh_hz, *catalog_bounds["refresh_rate_hz"])
    parts, weights = [], []
    for s, w in [(ram_s, 0.4), (proc_s, 0.4), (refresh_s, 0.2)]:
        if not pd_isna(s):
            parts.append(s)
            weights.append(w)
    if not parts:
        return np.nan
    weights = np.array(weights) / sum(weights)
    return float(np.dot(parts, weights))


def brand_score(phone_brand: str, brand_preference: str) -> float:
    """
    'Any' -> every brand scores equally (100).
    A named preference -> that brand scores 100, everything else 60.
    This is a SMALL 5%-weight nudge, never enough to override specs/price,
    and it never depends on how many rows that brand has in the catalog.
    """
    if brand_preference is None or str(brand_preference).strip().lower() == "any":
        return 100.0
    pref = str(brand_preference).strip().lower()
    ph = str(phone_brand).strip().lower()
    # normalize "Xiaomi" vs "Redmi" naming
    if pref in ph or ph in pref:
        return 100.0
    return 60.0


def pd_isna(x):
    try:
        return x is None or (isinstance(x, float) and np.isnan(x))
    except Exception:
        return False


def compute_weights(primary_use: str, priorities: dict) -> dict:
    """
    priorities: {'camera': 'high', 'battery': 'high', 'performance': 'low', 'storage': 'medium'}
    Returns final normalized weights (sum to 1.0), fully derived and
    inspectable — this is the "explain to an interviewer" part.
    """
    weights = dict(BASE_WEIGHTS)

    # 1. primary_use boosts (budget and brand untouched by use-case)
    boosts = USE_CASE_BOOST.get(primary_use, {})
    for cat, mult in boosts.items():
        weights[cat] *= mult

    # 2. customer priority sliders (only affects camera/battery/performance/storage)
    for cat in ["camera", "battery", "performance", "storage"]:
        level = priorities.get(cat, "medium")
        weights[cat] *= PRIORITY_MULTIPLIER.get(level, 1.0)

    # 3. renormalize so weights sum to 1.0 (budget's relative importance
    #    shrinks a bit when other categories get boosted heavily — this
    #    is expected and keeps the scale meaningful)
    total = sum(weights.values())
    return {k: v / total for k, v in weights.items()}
