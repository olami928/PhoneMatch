"""
train_model.py
Trains a Random Forest regressor to predict match_score from
customer+phone features, using the rule-based-scorer-generated training
table as ground truth (distillation, not real user behavior -- see
build_training_data.py docstring).

Why this is still a legitimate ML step and not just "reimplementing the
rules": the forest is not given the weight formula. It only sees raw
customer/phone features and the resulting scores, and has to learn the
interactions (e.g. that camera_priority matters more when primary_use is
"camera") from data alone. This also means it can pick up nonlinearities
and interactions the linear weighted formula can't express, and it will
be the natural place to plug in REAL interaction data later (spec
section 14) without changing the rest of the pipeline.
"""

import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, GroupKFold
from sklearn.metrics import mean_absolute_error, r2_score

FEATURES_NUMERIC = [
    "budget_ngn", "camera_priority", "battery_priority", "performance_priority",
    "storage_priority", "wants_specific_brand", "brand_matches_pref",
    "price_ngn", "price_to_budget_ratio", "ram_gb", "storage_gb", "battery_mah",
    "main_camera_mp", "selfie_camera_mp", "processor_tier", "refresh_rate_hz", "five_g",
]
FEATURES_CATEGORICAL = ["primary_use", "brand"]


def prepare_features(df: pd.DataFrame):
    X = pd.get_dummies(df[FEATURES_NUMERIC + FEATURES_CATEGORICAL],
                        columns=FEATURES_CATEGORICAL, drop_first=False)
    return X


def main():
    project_dir = Path(__file__).resolve().parents[1]
    df = pd.read_csv(project_dir / "data" / "training_data.csv")
    X = prepare_features(df)
    y = df["target_score"]

    # Group split by customer_id -- prevents the same customer's rows from
    # leaking between train/test, which would inflate the score.
    groups = df["customer_id"]
    gkf = GroupKFold(n_splits=5)
    train_idx, test_idx = next(gkf.split(X, y, groups))
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    model = RandomForestRegressor(
        n_estimators=300, max_depth=14, min_samples_leaf=5,
        random_state=42, n_jobs=-1,
    )
    model.fit(X_train, y_train)

    pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, pred)
    r2 = r2_score(y_test, pred)
    print(f"Held-out customers (never seen in training): {X_test.shape[0]:,} rows")
    print(f"MAE:  {mae:.2f} points (target scale is roughly 0-100)")
    print(f"R^2:  {r2:.3f}")

    # Feature importance -- sanity check that the model learned sensible things
    importances = pd.Series(model.feature_importances_, index=X.columns).sort_values(ascending=False)
    print("\nTop 10 feature importances:")
    print(importances.head(10).round(3))

    model_path = project_dir / "src" / "ml_model.joblib"
    joblib.dump({"model": model, "columns": list(X.columns)}, model_path)
    print(f"\nSaved trained model -> {model_path}")


if __name__ == "__main__":
    main()
