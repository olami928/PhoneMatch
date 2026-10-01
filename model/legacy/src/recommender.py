"""
recommender.py
Scores every phone in the catalog against one customer profile,
returns the top 3 with remaining-budget, explanations, and a
light diversity check (per spec section 9: don't force diversity,
but don't hand back 3 near-identical same-brand phones either).
"""

import numpy as np
import pandas as pd
from scoring import (
    budget_score, camera_score, battery_score, storage_score,
    performance_score, brand_score, compute_weights, pd_isna,
)

DIVERSITY_SCORE_GAP = 3.0  # if an alt-brand phone is within this many
                           # points of a same-brand pick, prefer the alt


def _catalog_bounds(df: pd.DataFrame) -> dict:
    cols = ["main_camera_mp", "selfie_camera_mp", "battery_mah",
            "storage_gb", "ram_gb", "refresh_rate_hz"]
    return {c: (df[c].min(skipna=True), df[c].max(skipna=True)) for c in cols}


def score_catalog(df: pd.DataFrame, customer: dict) -> pd.DataFrame:
    bounds = _catalog_bounds(df)
    weights = compute_weights(customer["primary_use"], {
        "camera": customer["camera_priority"],
        "battery": customer["battery_priority"],
        "performance": customer["performance_priority"],
        "storage": customer["storage_priority"],
    })

    rows = []
    for _, r in df.iterrows():
        b_score = budget_score(r["price_ngn"], customer["budget_ngn"])
        if pd_isna(b_score) or b_score == 0:
            continue  # far outside budget — excluded per spec section 5

        c_score = camera_score(r["main_camera_mp"], r["selfie_camera_mp"], bounds)
        bat_score = battery_score(r["battery_mah"], bounds)
        s_score = storage_score(r["storage_gb"], bounds)
        p_score = performance_score(r["ram_gb"], r["processor_tier"], r["refresh_rate_hz"], bounds)
        br_score = brand_score(r["brand"], customer["brand_preference"])

        component_scores = {
            "budget": b_score, "camera": c_score, "battery": bat_score,
            "performance": p_score, "storage": s_score, "brand": br_score,
        }

        # If a component has no data (NaN spec), drop it from this phone's
        # blend and renormalize weights over the remaining components —
        # never invent a value, and never let missing data auto-fail a phone.
        available = {k: v for k, v in component_scores.items() if not pd_isna(v)}
        if not available:
            continue
        local_weights = {k: weights[k] for k in available}
        wsum = sum(local_weights.values())
        local_weights = {k: v / wsum for k, v in local_weights.items()}
        final = sum(available[k] * local_weights[k] for k in available)

        rows.append({
            "brand": r["brand"], "model": r["model"], "price_ngn": r["price_ngn"],
            "final_score": round(final, 1),
            "remaining_budget": customer["budget_ngn"] - r["price_ngn"],
            **{f"{k}_score": (round(v, 1) if not pd_isna(v) else None)
               for k, v in component_scores.items()},
            "ram_gb": r["ram_gb"], "storage_gb": r["storage_gb"],
            "battery_mah": r["battery_mah"], "main_camera_mp": r["main_camera_mp"],
            "five_g": r["five_g"],
        })

    return pd.DataFrame(rows).sort_values("final_score", ascending=False).reset_index(drop=True)


def _explain(row, customer_brand_pref=None) -> list:
    reasons = []
    if row["remaining_budget"] >= 0:
        reasons.append("Fits within your budget")
    if not pd_isna(row["battery_score"]) and row["battery_score"] >= 65:
        reasons.append("Strong battery")
    if not pd_isna(row["storage_score"]) and row["storage_score"] >= 60:
        reasons.append("Good storage for your needs")
    if not pd_isna(row["camera_score"]) and row["camera_score"] >= 60:
        reasons.append("Good camera for your priorities")
    if not pd_isna(row["performance_score"]) and row["performance_score"] >= 65:
        reasons.append("Solid day-to-day performance")
    if (customer_brand_pref and str(customer_brand_pref).strip().lower() != "any"
            and not pd_isna(row["brand_score"]) and row["brand_score"] == 100):
        reasons.append("Matches your brand preference")
    if not reasons:
        reasons.append("Best overall match within your constraints")
    return reasons


def top_recommendations(df: pd.DataFrame, customer: dict, n: int = 3) -> list:
    scored = score_catalog(df, customer)
    if scored.empty:
        return []

    picks = [scored.iloc[0]]
    used_brands = {picks[0]["brand"]}

    for _, candidate in scored.iloc[1:].iterrows():
        if len(picks) == n:
            break
        if candidate["brand"] in used_brands:
            # Only skip a same-brand phone if a close alt-brand option
            # exists further down (spec 9: don't FORCE diversity).
            same_brand_score = candidate["final_score"]
            alt_exists = (
                (scored["brand"] != candidate["brand"])
                & (~scored["model"].isin([p["model"] for p in picks]))
                & (scored["final_score"] >= same_brand_score - DIVERSITY_SCORE_GAP)
            ).any()
            if alt_exists:
                continue
        picks.append(candidate)
        used_brands.add(candidate["brand"])

    # If diversity filtering left us short of n, backfill with next-best regardless of brand
    if len(picks) < n:
        remaining = scored[~scored["model"].isin([p["model"] for p in picks])]
        for _, r in remaining.iterrows():
            picks.append(r)
            if len(picks) == n:
                break

    results = []
    for p in picks[:n]:
        results.append({
            "brand": p["brand"], "model": p["model"], "price_ngn": p["price_ngn"],
            "match_score": p["final_score"], "remaining_budget": p["remaining_budget"],
            "specs": {
                "ram_gb": p["ram_gb"], "storage_gb": p["storage_gb"],
                "battery_mah": p["battery_mah"], "main_camera_mp": p["main_camera_mp"],
                "five_g": p["five_g"],
            },
            "why": _explain(p, customer.get("brand_preference")),
        })
    return results
