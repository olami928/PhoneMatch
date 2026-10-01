"""
build_phones_csv.py  (M3)

Builds `model/data/phones.csv` — the launch catalog and single source of truth
for both the model and the shop's `products` table (D28/D30).

It takes the 71-row scraped catalog and produces 63 rows with:
  - a stable `product_id` that never changes, so model rows and Supabase
    `products` rows always match (the catalog-mismatch risk in AGENTS.md)
  - every model feature present, with NO missing values
  - `stock` and `active` columns, which the legacy catalog had none of, so
    `apply_hard_filters` can enforce them
  - `*_imputed` flag columns recording which values we filled in, so no guess
    is ever silently presented as measured fact

MISSING VALUES — THE HONEST RULE
We do not invent specs. Where a value is missing we impute the MEDIAN of the
same brand within the same price tier, and we record that we did it in the
`*_imputed` columns plus `imputed_fields`. A phone whose battery is filled in
is visibly a phone whose battery we guessed. Admin (Stage 7) can then go and
fix the real number.

Run:  python model/src/build_phones_csv.py
"""

import re
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE.parent
LEGACY_CSV = MODEL_DIR / "legacy" / "data" / "phone_catalog_ng.csv"
OUT_CSV = MODEL_DIR / "data" / "phones.csv"

# Features the model needs. These are the imputation targets.
IMPUTE_TARGETS = [
    "ram_gb", "storage_gb", "battery_mah", "main_camera_mp",
    "selfie_camera_mp", "refresh_rate_hz", "display_inches", "release_year",
]

# Price tiers used to group rows when imputing. Median-within-tier is much more
# honest than a global median: a budget phone should not inherit a flagship's
# battery capacity.
PRICE_TIERS = [
    (0, 150_000, "budget"),
    (150_000, 300_000, "entry"),
    (300_000, 500_000, "mid"),
    (500_000, 1_000_000, "upper"),
    (1_000_000, float("inf"), "flagship"),
]


def slugify(brand: str, model: str) -> str:
    """Stable, readable, filesystem-safe product id.

    NOTE: a naive slug strips '+', which collides 'Galaxy S26' and 'Galaxy S26+'
    onto the same id. We map '+' to 'plus' first so both stay distinct.
    """
    s = f"{brand} {model}".lower()
    s = s.replace("+", " plus ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def price_tier(price: float) -> str:
    for lo, hi, name in PRICE_TIERS:
        if lo <= price < hi:
            return name
    return "flagship"


def build() -> pd.DataFrame:
    raw = pd.read_csv(LEGACY_CSV)

    # Phones with no verified price cannot be sold or recommended (a price cap
    # is meaningless without one). We drop them and report the count.
    unpriced = raw[raw.price_ngn.isna()]
    df = raw[raw.price_ngn.notna()].copy()

    # --- stable ids, with collision protection ------------------------------
    df["product_id"] = [slugify(b, m) for b, m in zip(df.brand, df.model)]
    # If a slug still repeats (two genuinely identical names), suffix in a
    # stable order so the id is reproducible run to run.
    if df.product_id.duplicated().any():
        dupes = df.product_id[df.product_id.duplicated()].unique()
        df = df.sort_values(["product_id", "brand", "model"], kind="mergesort")
        seen = {}
        ids = []
        for pid in df.product_id:
            seen[pid] = seen.get(pid, 0) + 1
            ids.append(pid if seen[pid] == 1 else f"{pid}-{seen[pid]}")
        df["product_id"] = ids
        print(f"  WARNING: slug collisions needed a suffix for: {sorted(dupes)}")

    assert df.product_id.is_unique, "product_id must be unique"
    df["price_tier"] = df.price_ngn.map(price_tier)

    # --- impute missing specs from brand + tier medians ---------------------
    # Keyed by the real index label, NOT position: `df` above was filtered, so
    # its index is sparse and position i does not match label i.
    imputed_fields = {}
    for col in IMPUTE_TARGETS:
        flag = f"{col}_imputed"
        df[flag] = False

        # Global fallback, used only when a brand+tier group has no data at all.
        global_median = df[col].median()

        for i, row in df.iterrows():
            if pd.notna(row[col]):
                continue
            group = df[
                (df.brand == row.brand)
                & (df.price_tier == row.price_tier)
                & df[col].notna()
            ]
            value = group[col].median() if len(group) else global_median
            if pd.isna(value):          # whole column empty, shouldn't happen
                value = 0.0
            df.at[i, col] = value
            df.at[i, flag] = True
            imputed_fields.setdefault(i, []).append(col)

    # `processor` is TEXT, so the numeric median path does not apply. Use the
    # most common processor within brand+tier instead (the mode), and fall back
    # to "Unknown" rather than inventing a chipset name.
    if "processor" in df.columns:
        df["processor_imputed"] = False
        for i, row in df.iterrows():
            if pd.notna(row.processor):
                continue
            group = df[
                (df.brand == row.brand)
                & (df.price_tier == row.price_tier)
                & df.processor.notna()
            ]
            value = group.processor.mode()
            value = value.iloc[0] if len(value) else "Unknown"
            df.at[i, "processor"] = value
            df.at[i, "processor_imputed"] = True
            imputed_fields.setdefault(i, []).append("processor")

    df["imputed_fields"] = [
        ",".join(imputed_fields.get(i, [])) or "none" for i in df.index
    ]
    df["imputed_any"] = df.imputed_fields != "none"

    # --- shop fields that did not exist in the legacy CSV -------------------
    # Default every phone to in stock and active so the launch catalog is usable.
    # The owner changes these in admin at Stage 7.
    df["stock"] = 10
    df["active"] = True

    # --- final column order --------------------------------------------------
    cols = (
        ["product_id", "brand", "model", "price_ngn", "price_tier", "condition"]
        + IMPUTE_TARGETS
        + ["processor", "five_g"]
        + ["stock", "active"]
        + ["price_verified_date", "price_source"]
        + ["imputed_any", "imputed_fields"]
        + [f"{c}_imputed" for c in IMPUTE_TARGETS if c != "release_year"]
        + ["processor_imputed"]
    )
    # processor is text; derive a clean boolean for the model
    df["five_g"] = df.five_g.astype(str).str.strip().str.lower().eq("yes")
    df["condition"] = df.condition.astype(str).str.strip().str.lower()

    out = df[cols].sort_values(["price_ngn", "product_id"]).reset_index(drop=True)
    return out, unpriced


def main() -> int:
    print("Building phones.csv from the legacy catalog...")
    df, unpriced = build()

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    # Fill the empty imputed_fields with an explicit sentinel. An empty string
    # is read back by pandas as NaN, which would make "no missing values" a lie
    # the moment the shop loads this file.
    df["imputed_fields"] = df.imputed_fields.replace("", "none")
    df.to_csv(OUT_CSV, index=False)

    print(f"\n  wrote {len(df)} phones -> {OUT_CSV}")
    print(f"  dropped {len(unpriced)} phones with no verified price (unbuyable)")
    for _, r in unpriced.iterrows():
        print(f"    - {r.brand} {r.model}")

    n_imp = int(df.imputed_any.sum())
    print(f"\n  {n_imp} of {len(df)} phones have at least one imputed spec")
    if n_imp:
        print("  per-field imputed counts:")
        for col in IMPUTE_TARGETS:
            flag = f"{col}_imputed"
            if flag in df.columns and df[flag].any():
                print(f"    {flag:<26} {int(df[flag].sum())}")
        print("  these are ESTIMATES, not measured. Fix them in admin at Stage 7.")

    # --- hard checks ---------------------------------------------------------
    problems = []
    if not df.product_id.is_unique:
        problems.append("product_id is not unique")
    missing = df.isna().sum()
    for col, n in missing.items():
        if n:
            problems.append(f"{col} has {n} missing values")
    if (df.price_ngn <= 0).any():
        problems.append("a price is zero or negative")
    if (df.stock < 0).any():
        problems.append("a stock value is negative")
    if not df.active.all():
        problems.append("a phone is inactive at launch")

    print("\n  checks:")
    if problems:
        for p in problems:
            print(f"    FAIL {p}")
        return 1
    print("    OK  product_id unique")
    print("    OK  zero missing values")
    print("    OK  every price > 0")
    print("    OK  all phones in stock and active at launch")
    return 0


if __name__ == "__main__":
    sys.exit(main())