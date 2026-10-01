# Legacy model (the owner's original version)

This is the recommender the owner built before the shop. It is kept here for the record.
**The Random Forest in here IS the v1 ranking engine** (owner decision, D34), but it is
wrapped by `model/src/shop_recommender.py` rather than called directly. See the M1 audit in
`AGENTS.md` section 8 for the full write-up and the decisions (D30 to D35).

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

There is no real labeled data in this repo. The forest ships as the v1 ranking engine (D34), but
its quality ceiling is the rule scorer, because that is what it was trained to reproduce. `scoring.py`
stays in the loop and is still required: it generates the reason lines and the ratings. M5 is when
real feedback and orders can raise that ceiling.

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

## If you have just cloned this repo

`ml_model.joblib` is git-ignored on purpose (42 MB, and it is fully regeneratable). **Nothing in
`model/src/` will run until you rebuild it**, because `shop_recommender.py` loads the forest.
Do this once after cloning:

```bash
/home/dimeji/venv/bin/pip install -r model/legacy/requirements.txt
/home/dimeji/venv/bin/python model/legacy/src/train_model.py

# then the acceptance check works:
/home/dimeji/venv/bin/python model/src/test_personas.py
```

`train_model.py` reads `data/training_data.csv`, which **is** committed, so the rebuild is
deterministic and needs no network. Verified from a clean clone: retrain, then 10/10 personas pass.

## Known weak spots (to fix in the shop baseline)

- A "camera" persona at NGN300k gets a #1 pick with no camera reason. Reasons use fixed
  thresholds instead of the top contributing feature.
- `budget_score` gives every in-budget phone a floor of 70 points, which flattens differences.
- No `product_id`, no stock, no `active` flag, and no `model_version` in the output.
- The catalog has missing specs (see the audit, change 10).
