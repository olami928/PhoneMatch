"""
data_processing.py
Loads the phone catalog and prepares it for scoring.
No fabrication: missing specs stay missing (NaN) and are handled
explicitly in scoring rather than being silently imputed.
"""

import pandas as pd
import numpy as np
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "phone_catalog_ng.csv"


def load_catalog(path: str | Path = CATALOG_PATH) -> pd.DataFrame:
    df = pd.read_csv(path)

    # Drop phones with no verified price — can't score budget fit without one.
    before = len(df)
    df = df[df["price_ngn"].notna()].copy()
    dropped = before - len(df)
    if dropped:
        print(f"[data_processing] Dropped {dropped} phones with no verified price.")

    # Normalize brand names for matching against customer brand_preference
    df["brand_norm"] = df["brand"].str.strip()

    # Simple processor tier heuristic (rough, transparent, explainable).
    # Used only as one input into performance_score, not a hidden black box.
    df["processor_tier"] = df["processor"].apply(_processor_tier)

    return df.reset_index(drop=True)


def _processor_tier(proc: str) -> float:
    """
    Rough 0-100 tier score for common chipset families seen in the
    Nigerian market catalog. This is a coarse, documented heuristic —
    not a benchmark score — used only as one of several performance
    signals (alongside RAM and refresh rate).
    """
    if pd.isna(proc):
        return np.nan
    p = proc.lower()

    tiers = [
        (["snapdragon 8 elite", "dimensity 9000", "tensor g5", "a19", "a18", "a17"], 95),
        (["snapdragon 7s gen 4", "dimensity 8400", "dimensity 7400", "exynos 2600", "a16", "a15"], 80),
        (["dimensity 7300", "helio g200", "exynos 1680", "exynos 1580", "snapdragon 6", "a14"], 65),
        (["helio g100", "dimensity 6300", "exynos 1480", "exynos 1380", "snapdragon 685"], 50),
        (["helio g99", "helio g96", "helio g91", "helio g85", "unisoc t7300"], 40),
        (["helio g81", "helio g36", "unisoc t7250", "unisoc t7100"], 25),
    ]
    for keywords, score in tiers:
        if any(k in p for k in keywords):
            return score
    return 35  # unknown/unlisted chipset — assume modest mid-low tier


if __name__ == "__main__":
    df = load_catalog()
    print(f"Loaded {len(df)} priced phones across {df['brand'].nunique()} brands.")
    print(df[["brand", "model", "price_ngn", "processor_tier"]].head(10))
