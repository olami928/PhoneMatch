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

from shop_recommender import (  # noqa: E402
    MODEL_VERSION, apply_available_ids, load_phones, recommend,
)

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

    # The product ids the shop can sell right now (active, stock > 0), read by the
    # backend from its `products` table. Added in Stage 3: the catalog CSV's stock
    # column is set at build time and never changes when an order is placed, so
    # without this the model would keep recommending a sold-out phone.
    #
    # This is a RESTRICTION, never an expansion. `apply_available_ids` intersects
    # it with the catalog, so naming a phone that is out of stock, inactive or
    # over budget cannot get it recommended — the hard filters still run after
    # this and still have the final say.
    #
    # `None` means "the caller does not know" and the catalog's own stock column
    # is used. An empty list means "nothing is sellable" and returns no picks,
    # which is why the backend omits the field entirely rather than sending [].
    available_ids: list[str] | None = Field(
        None,
        description="Product ids currently sellable. Restricts, never expands, the candidates.",
    )


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

    `available_ids` is optional and only ever REMOVES candidates (see
    RecommendRequest). The service trusts the catalog for everything else: the
    hard filters inside `recommend()` decide budget, storage, stock and active,
    and they run after this restriction, so a caller cannot smuggle an
    out-of-stock or over-budget phone past them by naming it.
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
        # A failure here must NOT fail the recommendation. The catalog's own
        # stock column is stale but always non-empty, so falling back to it
        # degrades gracefully; returning an error would take the results page
        # down entirely because of an optional extra signal.
        sellable = apply_available_ids(catalog, req.available_ids)
        result = recommend(answers, df=sellable, n=max(1, min(top_n, 10)))
    except Exception as exc:
        # Bad input must be a clear 400, not a 500 that looks like a server fault.
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 1)
    # Whether the shop's live stock was actually applied. The backend logs a
    # warning when this is False, so a broken restriction is visible rather than
    # silently showing stale picks.
    result["live_stock_applied"] = req.available_ids is not None
    return result
