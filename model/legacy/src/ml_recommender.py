"""
ml_recommender.py
Same interface as recommender.py, but ranking comes from the trained
Random Forest instead of the hand-written weighted formula.
Explanations are still generated from the transparent component scores
(scoring.py) -- ranking and explanation are deliberately decoupled, so
swapping the ranking model never breaks the "why it matches" text.
"""

import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from scoring import (
    budget_score, camera_score, battery_score, storage_score,
    performance_score, brand_score, pd_isna,
)
from train_model import prepare_features, FEATURES_NUMERIC, FEATURES_CATEGORICAL
from recommender import _explain, _catalog_bounds, DIVERSITY_SCORE_GAP

PRIORITY_ORDINAL = {"low": 0, "medium": 1, "high": 2}

MODEL_PATH = Path(__file__).resolve().parent / "ml_model.joblib"
_bundle = joblib.load(MODEL_PATH)
MODEL = _bundle["model"]
MODEL_COLUMNS = _bundle["columns"]


def score_catalog_ml(df: pd.DataFrame, customer: dict) -> pd.DataFrame:
    bounds = _catalog_bounds(df)

    feature_rows = []
    explain_rows = []

    for _, r in df.iterrows():
        b_score = budget_score(r["price_ngn"], customer["budget_ngn"])
        if pd_isna(b_score) or b_score == 0:
            continue

        c_score = camera_score(r["main_camera_mp"], r["selfie_camera_mp"], bounds)
        bat_score = battery_score(r["battery_mah"], bounds)
        s_score = storage_score(r["storage_gb"], bounds)
        p_score = performance_score(r["ram_gb"], r["processor_tier"], r["refresh_rate_hz"], bounds)
        br_score = brand_score(r["brand"], customer["brand_preference"])

        feature_rows.append({
            "budget_ngn": customer["budget_ngn"],
            "primary_use": customer["primary_use"],
            "camera_priority": PRIORITY_ORDINAL[customer["camera_priority"]],
            "battery_priority": PRIORITY_ORDINAL[customer["battery_priority"]],
            "performance_priority": PRIORITY_ORDINAL[customer["performance_priority"]],
            "storage_priority": PRIORITY_ORDINAL[customer["storage_priority"]],
            "wants_specific_brand": int(customer["brand_preference"] != "Any"),
            "brand_matches_pref": int(br_score == 100 and customer["brand_preference"] != "Any"),
            "price_ngn": r["price_ngn"],
            "price_to_budget_ratio": r["price_ngn"] / customer["budget_ngn"],
            "ram_gb": r["ram_gb"], "storage_gb": r["storage_gb"],
            "battery_mah": r["battery_mah"], "main_camera_mp": r["main_camera_mp"],
            "selfie_camera_mp": r["selfie_camera_mp"], "processor_tier": r["processor_tier"],
            "refresh_rate_hz": r["refresh_rate_hz"],
            "five_g": int(str(r["five_g"]).strip().lower() == "yes"),
            "brand": r["brand"],
        })
        explain_rows.append({
            "brand": r["brand"], "model": r["model"], "price_ngn": r["price_ngn"],
            "remaining_budget": customer["budget_ngn"] - r["price_ngn"],
            "budget_score": b_score, "camera_score": c_score, "battery_score": bat_score,
            "performance_score": p_score, "storage_score": s_score, "brand_score": br_score,
            "ram_gb": r["ram_gb"], "storage_gb": r["storage_gb"],
            "battery_mah": r["battery_mah"], "main_camera_mp": r["main_camera_mp"],
            "five_g": r["five_g"],
        })

    if not feature_rows:
        return pd.DataFrame()

    X = pd.DataFrame(feature_rows)
    X_enc = pd.get_dummies(X, columns=FEATURES_CATEGORICAL, drop_first=False)
    # align columns to what the model was trained on (missing dummy cols -> 0)
    X_enc = X_enc.reindex(columns=MODEL_COLUMNS, fill_value=0)

    predicted = MODEL.predict(X_enc)

    result = pd.DataFrame(explain_rows)
    result["final_score"] = np.round(predicted, 1)
    return result.sort_values("final_score", ascending=False).reset_index(drop=True)


def top_recommendations_ml(df: pd.DataFrame, customer: dict, n: int = 3) -> list:
    scored = score_catalog_ml(df, customer)
    if scored.empty:
        return []

    picks = [scored.iloc[0]]
    used_brands = {picks[0]["brand"]}
    for _, candidate in scored.iloc[1:].iterrows():
        if len(picks) == n:
            break
        if candidate["brand"] in used_brands:
            alt_exists = (
                (scored["brand"] != candidate["brand"])
                & (~scored["model"].isin([p["model"] for p in picks]))
                & (scored["final_score"] >= candidate["final_score"] - DIVERSITY_SCORE_GAP)
            ).any()
            if alt_exists:
                continue
        picks.append(candidate)
        used_brands.add(candidate["brand"])

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
