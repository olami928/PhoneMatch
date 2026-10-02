"""
export_trees.py — flatten the trained Random Forest into plain JSON.

WHY THIS EXISTS: free hosting has no long-running Python service that never
sleeps, so the alternative is to run the model inside the Netlify function, which
is Node. This script produces the exact numbers a JavaScript scorer needs, with
no Python at request time.

It exports the forest VERBATIM. Nothing is approximated, averaged or pruned: the
same nodes, thresholds and split features scikit-learn fitted. The JS scorer
therefore reproduces sklearn's predict() exactly, and that equality is checked by
tests before it is relied on.

Per tree, four parallel arrays:
  left, right  int32    child indices, -1 for a leaf
  feature      int32    column index to test, -2 for a leaf
  threshold    float64  split value: go left when value <= threshold
  value        float64  leaf prediction, 0 for internal nodes
"""
import json
import sys
from pathlib import Path

import joblib
import numpy as np

HERE = Path(__file__).resolve().parent
# The trained artifact lives in model/legacy/src/ (ml_recommender.py loads it from
# there). model/src/ only holds the shop-side recommender.
SRC = HERE.parent / "legacy" / "src"

def main() -> int:
    bundle = joblib.load(SRC / "ml_model.joblib")
    model = bundle["model"]
    columns = list(bundle["columns"])

    trees = []
    for est in model.estimators_:
        t = est.tree_
        trees.append({
            # sklearn uses -1 for leaves on both sides; -2 marks "no feature",
            # which is distinct from a valid feature index of 0.
            "left": t.children_left.astype(np.int32).tolist(),
            "right": t.children_right.astype(np.int32).tolist(),
            "feature": t.feature.astype(np.int32).tolist(),
            "threshold": t.threshold.astype(np.float64).tolist(),
            "value": t.value.reshape(-1).astype(np.float64).tolist(),
        })

    payload = {"columns": columns, "trees": trees, "n_trees": len(trees)}

    out = HERE / "forest.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    size_mb = out.stat().st_size / (1024 * 1024)
    nodes = sum(len(t["left"]) for t in trees)
    print(f"Wrote {out} ({size_mb:.2f} MB)")
    print(f"  trees={len(trees)}  total nodes={nodes:,}  features={len(columns)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())