"""
generate_customers.py
Creates a synthetic Nigerian smartphone-buyer dataset per project spec section 3.
Explicitly synthetic -- NOT real survey data. Used only to give the ML model
a realistic distribution of budgets/priorities/brand preferences to learn from.
"""

import numpy as np
import pandas as pd
from pathlib import Path

np.random.seed(42)

N_CUSTOMERS = 600

PRIMARY_USES = ["general", "social_media", "camera", "gaming", "work", "student"]
PRIORITY_LEVELS = ["low", "medium", "high"]
BRANDS = ["Any", "TECNO", "Infinix", "Samsung", "itel", "Xiaomi", "Oppo", "Google Pixel", "Apple"]

# Budget distribution modeled on the Nigerian market structure from our own
# research (heavy concentration in the 100k-500k budget-to-midrange band,
# a smaller premium tail). This shape is a modeling choice, not a claim
# about real survey results.
BUDGET_BRACKETS = [
    (60000, 150000, 0.28),
    (150000, 300000, 0.30),
    (300000, 500000, 0.20),
    (500000, 800000, 0.12),
    (800000, 1500000, 0.07),
    (1500000, 2500000, 0.03),
]

# Rough use-case -> priority tendency, used only to make the synthetic
# population internally consistent (a "gaming" customer is more likely to
# rate performance "high"). Still randomized, not deterministic.
USE_TENDENCY = {
    "gaming":       {"performance": [0.1, 0.2, 0.7], "battery": [0.1, 0.3, 0.6]},
    "camera":       {"camera": [0.05, 0.15, 0.8]},
    "social_media": {"camera": [0.1, 0.3, 0.6], "battery": [0.1, 0.3, 0.6]},
    "work":         {"performance": [0.1, 0.3, 0.6], "storage": [0.1, 0.3, 0.6]},
    "student":      {"storage": [0.15, 0.4, 0.45], "battery": [0.15, 0.35, 0.5]},
    "general":      {},
}
DEFAULT_DIST = [0.3, 0.4, 0.3]  # low, medium, high


def sample_budget():
    ranges = [b[:2] for b in BUDGET_BRACKETS]
    weights = [b[2] for b in BUDGET_BRACKETS]
    lo, hi = ranges[np.random.choice(len(ranges), p=weights)]
    return int(np.random.uniform(lo, hi) // 1000 * 1000)


def sample_priority(use, category):
    dist = USE_TENDENCY.get(use, {}).get(category, DEFAULT_DIST)
    return np.random.choice(PRIORITY_LEVELS, p=dist)


def generate():
    rows = []
    for i in range(1, N_CUSTOMERS + 1):
        use = np.random.choice(PRIMARY_USES)
        # brand preference: 55% Any, rest weighted toward TECNO/Infinix (largest
        # market share per our own catalog research), matching real market skew
        brand = np.random.choice(
            BRANDS,
            p=[0.55, 0.14, 0.12, 0.08, 0.04, 0.03, 0.02, 0.01, 0.01],
        )
        rows.append({
            "customer_id": f"SYN-{i:04d}",
            "budget_ngn": sample_budget(),
            "primary_use": use,
            "camera_priority": sample_priority(use, "camera"),
            "battery_priority": sample_priority(use, "battery"),
            "performance_priority": sample_priority(use, "performance"),
            "storage_priority": sample_priority(use, "storage"),
            "brand_preference": brand,
            "data_source": "synthetic",  # explicit flag -- never confuse with real survey data
        })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = generate()
    output_path = Path(__file__).resolve().parents[1] / "data" / "synthetic_customer_preferences.csv"
    df.to_csv(output_path, index=False)
    print(f"Generated {len(df)} synthetic customers -> {output_path}")
    print(df.head())
    print("\nBudget distribution:")
    print(df["budget_ngn"].describe())
