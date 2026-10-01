# Legacy model (the owner's original version)

This is the recommender the owner built before the shop. It is kept here for the record.
It is **not** what the shop ships in v1. See the M1 audit in `AGENTS.md` section 8 for the
full write-up and the decisions (D31, D32).

## What is here

| File | What it does |
|---|---|
| `src/data_processing.py` | Loads the catalog CSV, drops phones with no verified price, adds a `processor_tier` heuristic (0-100). |
| `src/scoring.py` | The transparent weighted scorer. Every component is 0-100. No ML. |
| `src/generate_customers.py` | Makes 600 **synthetic** customers (seed 42). Not real people. |
| `src/build_training_data.py` | Scores every (customer x in-budget phone) pair with `scoring.py`. This creates the training labels. |
| `src/train_model.py` | Trains a Random Forest on that table and saves `src/ml_model.joblib`. |
| `src/recommender.py` | Rule-based ranking: score the catalog, drop far-over-budget phones, return the top N with "why" lines. |
| `src/ml_recommender.py` | Same output, but ranking comes from the Random Forest. |

Data lives in `data/`:
`phone_catalog_ng.csv` (71 phones, 63 priced), `synthetic_customer_preferences.csv` (600 customers),
`training_data.csv` (13,993 scored pairs).

## The one thing to understand

`training_data.csv` is **produced by `scoring.py`**, and then the Random Forest is trained on it.
So the model learns to copy the rules. That is why the numbers look so good (MAE 1.19, R^2 0.969)
and why it recommends the same phones in the same order as the rules. It is distillation, not
learning from real shoppers. `build_training_data.py` says this in its own docstring.

There is no real labeled data in this repo. v1 of the shop uses the transparent scorer
(`scoring.py`) instead. The Random Forest may come back at step M5, once the shop has real
feedback and orders.

## Run it

```bash
# from the repo root, using the project venv
/home/dimeji/venv/bin/pip install -r model/legacy/requirements.txt

cd model/legacy
/home/dimeji/venv/bin/python -c "
import sys; sys.path.insert(0,'src')
from data_processing import load_catalog
from recommender import top_recommendations
cat = load_catalog()
p = dict(budget_ngn=500000, primary_use='camera', camera_priority='high',
         battery_priority='medium', performance_priority='low',
         storage_priority='medium', brand_preference='Any')
for r in top_recommendations(cat, p, 3): print(r)
"

# retrain the forest (writes src/ml_model.joblib, ~42 MB, git-ignored)
/home/dimeji/venv/bin/python src/train_model.py
```

`ml_model.joblib` is git-ignored on purpose. It is 42 MB and can be rebuilt from the scripts.

## Known weak spots (to fix in the shop baseline)

- A "camera" persona at NGN300k gets a #1 pick with no camera reason. Reasons use fixed
  thresholds instead of the top contributing feature.
- `budget_score` gives every in-budget phone a floor of 70 points, which flattens differences.
- No `product_id`, no stock, no `active` flag, and no `model_version` in the output.
- The catalog has missing specs (see the audit, change 10).
