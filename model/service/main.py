"""
main.py — the model service (step M7).

A thin FastAPI wrapper around `model/src/shop_recommender.recommend()`. All the
recommendation logic is already written and tested by `test_personas.py`; this
file only turns it into an HTTP service. Nothing is re-implemented here on
purpose, so there is no second copy of the rules to drift out of sync.

WHY A SEPARATE SERVICE AT ALL (D35):
the Random Forest artifact is 41 MB and takes ~5.5s to load cold. A Netlify
serverless function has a hard execution limit and no warm state, so it would
time out or be far too slow. This service must run as a long-lived process
(Render/Railway/container) that loads the model ONCE at startup and keeps it in
memory. That is why the catalog and the model are loaded at import time below,
not per request.

ENDPOINTS
  GET  /health    liveness, plus whether the model finished loading
  GET  /version   model version, for the admin model page (D23)
  POST /recommend ranked phones with reasons and ratings

Run locally:
  uvicorn main:app --port 8000
"""

from __future__ import annotations

import os
import sys
import time
from typing import Any

# The service lives in model/service/ but needs the modules in model/src/ and
# model/legacy/src/. Resolve paths from this file so it works no matter what the
# current working directory is.
SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.dirname(SERVICE_DIR)
for path in (os.path.join(MODEL_DIR, "src"), os.path.join(MODEL_DIR, "legacy", "src")):
    if path not in sys.path:
        sys.path.insert(0, path)

from fastapi import FastAPI, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from shop_recommender import MODEL_VERSION, load_phones, recommend  # noqa: E402

app = FastAPI(
    title="PhoneMatch model service",
    version=MODEL_VERSION,
    description="Ranks phones from the shop catalog against questionnaire answers.",
)

# --- load the catalog once at startup ---------------------------------------
# Loading per request would add ~1s to every call. Loading once is what makes
# this a warm service (D35).
_CATALOG = None
_LOAD_ERROR: str | None = None


def _catalog():
    global _CATALOG, _LOAD_ERROR
    if _CATALOG is None and _LOAD_ERROR is None:
        try:
            _CATALOG = load_phones()
        except Exception as exc:  # pragma: no cover - startup failure path
            _LOAD_ERROR = f"{type(exc).__name__}: {exc}"
            raise
    return _CATALOG


class RecommendRequest(BaseModel):
    """The five questionnaire answers, using the exact labels the shop shows.

    Labels come from model/config/questionnaire_v1.json, NOT typed by hand here,
    so rewording a question in the config cannot silently break the service.
    """

    budget: str = Field(..., description="Budget range label, e.g. 'NGN 300,000 - 500,000'")
    main_use: str = Field(..., description="Main use label")
    top_priority: str = Field(..., description="Top priority label")
    storage: str = Field(..., description="Storage label")
    brand_preference: str | None = Field(None, description="Optional brand, or null")


@app.get("/health")
def health() -> dict[str, Any]:
    """Liveness. `model_loaded` is the field that matters: a process can be up
    while still failing to load the 41 MB artifact."""
    loaded = _CATALOG is not None
    return {
        "status": "ok" if loaded else "starting",
        "model_version": MODEL_VERSION,
        "catalog_phones": int(len(_CATALOG)) if loaded else 0,
        "model_loaded": loaded,
        "load_error": _LOAD_ERROR,
    }


@app.get("/version")
def version() -> dict[str, Any]:
    """Model version, for logging with every session and for the admin page."""
    return {"model_version": MODEL_VERSION, "engine": "random_forest"}


@app.post("/recommend")
def post_recommend(req: RecommendRequest, top_n: int = 5) -> dict[str, Any]:
    """Rank phones for one shopper.

    `candidate_ids` is deliberately NOT accepted: the shop sends answers, and the
    hard filters inside `recommend()` decide which phones may be considered. The
    service trusts the catalog, not the caller, so a caller cannot smuggle an
    out-of-stock or over-budget phone past the filters by naming it.
    """
    started = time.perf_counter()
    try:
        catalog = _catalog()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"catalog failed to load: {exc}") from exc

    answers = {
        "budget": req.budget,
        "main_use": req.main_use,
        "top_priority": req.top_priority,
        "storage": req.storage,
        "brand_preference": req.brand_preference,
    }
    try:
        result = recommend(answers, df=catalog, n=max(1, min(top_n, 10)))
    except Exception as exc:
        # Bad input must be a clear 400, not a 500 that looks like a server fault.
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 1)
    return result
