"""
build_training_data.py
Scores every (synthetic customer x catalog phone) pair using the existing
rule-based scoring engine, and encodes customer+phone features into a flat
numeric table. This IS distillation -- the ML model below learns to
reproduce (and generalize) the transparent scoring logic, not real user
behavior. Documented explicitly for the interview narrative.
"""

import sys
sys.path.insert(0, "src")

import pandas as pd
from pathlib import Path
import numpy as np
from data_processing import load_catalog
from scoring import (
    budget_score, camera_score, battery_score, storage_score,
    performance_score, brand_score, compute_weights, pd_isna,
)

PRIORITY_ORDINAL = {"low": 0, "medium": 1, "high": 2}


def _catalog_bounds(df):
    cols = ["main_camera_mp", "selfie_camera_mp", "battery_mah",
            "storage_gb", "ram_gb", "refresh_rate_hz"]
    return {c: (df[c].min(skipna=True), df[c].max(skipna=True)) for c in cols}


def build_training_table(catalog: pd.DataFrame, customers: pd.DataFrame) -> pd.DataFrame:
    bounds = _catalog_bounds(catalog)
    rows = []

    for _, cust in customers.iterrows():
        weights = compute_weights(cust["primary_use"], {
            "camera": cust["camera_priority"], "battery": cust["battery_priority"],
            "performance": cust["performance_priority"], "storage": cust["storage_priority"],
        })

        for _, phone in catalog.iterrows():
            b_score = budget_score(phone["price_ngn"], cust["budget_ngn"])
            if pd_isna(b_score) or b_score == 0:
                continue  # out-of-budget pairs are never training targets

            c_score = camera_score(phone["main_camera_mp"], phone["selfie_camera_mp"], bounds)
            bat_score = battery_score(phone["battery_mah"], bounds)
            s_score = storage_score(phone["storage_gb"], bounds)
            p_score = performance_score(phone["ram_gb"], phone["processor_tier"], phone["refresh_rate_hz"], bounds)
            br_score = brand_score(phone["brand"], cust["brand_preference"])

            comp = {"budget": b_score, "camera": c_score, "battery": bat_score,
                    "performance": p_score, "storage": s_score, "brand": br_score}
            available = {k: v for k, v in comp.items() if not pd_isna(v)}
            if not available:
                continue
            local_w = {k: weights[k] for k in available}
            wsum = sum(local_w.values())
            local_w = {k: v / wsum for k, v in local_w.items()}
            target_score = sum(available[k] * local_w[k] for k in available)

            rows.append({
                # --- customer features ---
                "budget_ngn": cust["budget_ngn"],
                "primary_use": cust["primary_use"],
                "camera_priority": PRIORITY_ORDINAL[cust["camera_priority"]],
                "battery_priority": PRIORITY_ORDINAL[cust["battery_priority"]],
                "performance_priority": PRIORITY_ORDINAL[cust["performance_priority"]],
                "storage_priority": PRIORITY_ORDINAL[cust["storage_priority"]],
                "wants_specific_brand": int(cust["brand_preference"] != "Any"),
                "brand_matches_pref": int(br_score == 100 and cust["brand_preference"] != "Any"),
                # --- phone features ---
                "price_ngn": phone["price_ngn"],
                "price_to_budget_ratio": phone["price_ngn"] / cust["budget_ngn"],
                "ram_gb": phone["ram_gb"],
                "storage_gb": phone["storage_gb"],
                "battery_mah": phone["battery_mah"],
                "main_camera_mp": phone["main_camera_mp"],
                "selfie_camera_mp": phone["selfie_camera_mp"],
                "processor_tier": phone["processor_tier"],
                "refresh_rate_hz": phone["refresh_rate_hz"],
                "five_g": int(str(phone["five_g"]).strip().lower() == "yes"),
                "brand": phone["brand"],
                # --- identifiers (not used as features) ---
                "customer_id": cust["customer_id"],
                "model": phone["model"],
                # --- training target ---
                "target_score": target_score,
            })

    return pd.DataFrame(rows)


if __name__ == "__main__":
    catalog = load_catalog()
    project_dir = Path(__file__).resolve().parents[1]
    customers = pd.read_csv(project_dir / "data" / "synthetic_customer_preferences.csv")
    table = build_training_table(catalog, customers)
    table.to_csv(project_dir / "data" / "training_data.csv", index=False)
    print(f"Built {len(table):,} training rows from {len(customers)} customers x "
          f"{len(catalog)} phones (in-budget pairs only).")
    print(table[["budget_ngn", "price_ngn", "target_score"]].describe())
