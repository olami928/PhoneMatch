"""
questionnaire_mapper.py  (M2)

Translates the 5 shop questionnaire answers into the customer dict that
ml_recommender.py expects, and applies the HARD filters before the forest
scores anything.

WHY THIS FILE EXISTS
The model was trained on 4 separate low/medium/high priority sliders and a
single budget maximum. The shop asks ONE "what matters most" question and a
budget RANGE. This module is the bridge, and it is driven entirely by
config/questionnaire_v1.json so the team can retune it without touching code.

THE CRITICAL RULE (AGENTS.md D34)
A Random Forest regresses a score. It CANNOT enforce a constraint. It has no
concept of stock, active, or budget_min, and it WILL happily rank a phone the
shopper cannot buy. So we filter the CANDIDATE LIST FIRST and pass candidates
in, never scores out.

Usage:
    from questionnaire_mapper import map_answers, apply_hard_filters
    customer, filters = map_answers({
        "budget": "300000-500000", "main_use": "camera",
        "top_priority": "camera", "storage": "medium",
        "brand_preference": "Any",
    })
    candidates = apply_hard_filters(catalog_df, filters)
"""

import json
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "questionnaire_v1.json"

with open(CONFIG_PATH, encoding="utf-8") as f:
    CONFIG = json.load(f)

QUESTIONS = {q["id"]: q for q in CONFIG["questions"]}

STORAGE_TO_PRIORITY = {"light": "low", "medium": "medium", "heavy": "high"}

# Budget keys are "min-max" strings, so build a lookup.
BUDGET_BANDS = {}
for _opt in QUESTIONS["budget"]["options"]:
    BUDGET_BANDS[f'{_opt["min"]}-{_opt["max"]}'] = _opt

# Brand values the catalog actually contains, so the dropdown never offers
# a brand with zero phones.
VALID_BRANDS = {"Any"} | {o["value"] for o in QUESTIONS["brand_preference"]["options"]}


class MappingError(ValueError):
    """Raised when an answer is missing or not one of the frozen options."""



def map_answers(answers: dict):
    """Map the 5 questionnaire answers to (customer, filters).

    customer: exactly the 7 keys ml_recommender.py reads.
    filters:  the hard constraints to apply BEFORE the forest runs.
    """
    # --- Q1 budget: range -> one maximum, because the model has no budget_min
    # Accepts EITHER the internal band key ("300000-500000") or the visible label
    # ("NGN 300,000 - 500,000"). The frontend submits `option.label` for every
    # question, so budget must accept a label too, or the live questionnaire
    # payload is rejected. Found by running the real frontend payload through
    # this function rather than by reading it.
    band_raw = answers.get("budget")
    if band_raw in BUDGET_BANDS:
        band_opt = BUDGET_BANDS[band_raw]
    else:
        # Labels are matched case-insensitively via the shared helper, so a
        # reworded question in the config needs no code change here.
        band_opt = _find_option("budget", band_raw)
    budget_min, budget_max = band_opt["min"], band_opt["max"]

    # --- Q2 main use: validated so typos fail loudly instead of silently
    primary_use = _find_option("main_use", answers.get("main_use"))["value"]

    # --- Q3 top priority: ONE choice -> FOUR sliders
    top = _find_option("top_priority", answers.get("top_priority"))["value"]
    wants_lowest_price = top == "__price__"

    # --- Q4 storage: the GB floor is a HARD filter, the slider is a soft hint
    storage_opt = _find_option("storage", answers.get("storage"))
    storage_p = STORAGE_TO_PRIORITY[storage_opt["value"]]

    if wants_lowest_price:
        # The forest cannot express "cheapest". Neutralise all four sliders and
        # let the price filter do the real work instead.
        camera_p = battery_p = perf_p = storage_p = "low"
    else:
        camera_p = "high" if top == "camera" else "medium"
        battery_p = "high" if top == "battery" else "medium"
        perf_p = "high" if top == "performance" else "medium"
        # storage_p deliberately comes from the storage question only, and is
        # never overridden by top_priority.

    # --- Q5 brand: optional, skipped == no preference
    # Accepts the visible label ("No preference") or the raw value ("Any"), so
    # the frontend can send whichever it has to hand.
    brand_raw = answers.get("brand_preference") or "Any"
    try:
        brand = _find_option("brand_preference", brand_raw)["value"]
    except MappingError:
        # Also allow the raw value ("Any", "Samsung") to be sent directly.
        brand = brand_raw
    if brand not in VALID_BRANDS:
        raise MappingError(f"brand_preference must be one of {sorted(VALID_BRANDS)}")

    customer = {
        "budget_ngn": budget_max,
        "primary_use": primary_use,
        "camera_priority": camera_p,
        "battery_priority": battery_p,
        "performance_priority": perf_p,
        "storage_priority": storage_p,
        "brand_preference": brand,
    }

    # "Lowest price" is honoured here, because the forest has no budget_priority
    # input and its budget weight is fixed at 0.30 (see the config `why` note).
    price_cap = budget_max
    if wants_lowest_price:
        price_cap = min(
            price_cap,
            int(budget_max * CONFIG["hard_filters"]["lowest_price_extra_cap"]),
        )

    filters = {
        "price_max_ngn": price_cap,
        "storage_min_gb": storage_opt["min_gb"],
        "stock_gt": CONFIG["hard_filters"]["stock_gt"],
        "active_true": CONFIG["hard_filters"]["active_true"],
        "budget_min_ngn": budget_min,          # reporting only, NOT a filter
        "wants_lowest_price": wants_lowest_price,
    }
    return customer, filters


def apply_hard_filters(df, filters: dict):
    """Filter the candidate catalog BEFORE the forest scores anything.

    Columns that are absent are treated as 'nothing to filter on', so this works
    on the legacy catalog today and on the real `products` table at Stage 3.
    Never invents a value for a missing column.
    """
    out = df

    if "price_ngn" in out.columns:
        out = out[out["price_ngn"] <= filters["price_max_ngn"]]

    if "storage_gb" in out.columns:
        out = out[out["storage_gb"] >= filters["storage_min_gb"]]

    # Stock/active only apply once the shop table exists. The legacy CSV has
    # neither column, so we do NOT drop everything when they are missing.
    if "stock" in out.columns:
        out = out[out["stock"] > filters["stock_gt"]]
    if "active" in out.columns:
        out = out[out["active"] == filters["active_true"]]

    return out.reset_index(drop=True)


def reorder_for_lowest_price(results: list, filters: dict) -> list:
    """Sort cheapest-first when the shopper's top priority was price.

    MEASURED REASON THIS EXISTS: the forest ranks by match_score, not by price.
    With budget NGN 500k-1m and top_priority "lowest price", the forest returned
    Infinix Note 60 Pro 5G (NGN 556,000) as pick #1 while a NGN 98,100 Redmi 13C
    sat in the candidate set. The 75% price cap alone does NOT deliver "cheapest".

    The hard filters are done (every phone here already passes price_max and the
    storage floor). This only changes the ORDER, so it cannot smuggle in a phone
    that breaks a rule. Among the returned picks we sort by price ascending, then
    by score descending so a tied price still shows the better match.
    """
    if not filters.get("wants_lowest_price") or not results:
        return results
    return sorted(results, key=lambda r: (r["price_ngn"], -r["match_score"]))


def questionnaire_for_frontend():
    """Return question text and options, ready to send to the Next.js app.

    Strips the internal `why` / `alias_of` notes so the team can keep their
    reasoning in the config without it leaking into the UI payload.
    """
    out = []
    for q in CONFIG["questions"]:
        options = []
        for o in q["options"]:
            clean = {k: v for k, v in o.items() if k not in ("why", "alias_of")}
            if clean.get("value") == "__price__":
                clean["value"] = "price"
            options.append(clean)
        out.append({
            "id": q["id"], "number": q["number"], "question": q["question"],
            "help": q.get("help"), "required": q["required"],
            "skippable": q.get("skippable", False), "options": options,
        })
    return {"version": CONFIG["version"], "questions": out}

def _find_option(question_id: str, label):
    """Find an option by its visible label OR its internal value.

    Accepting both is deliberate. The frontend submits `option.label` for every
    question, while the model service API may be called with the config's
    internal `value` (e.g. "camera"). Both are legitimate, so both must work and
    neither should need the caller to know which one the config happens to use.
    """
    if label is None:
        raise MappingError(f"question {question_id!r} was not answered")
    for o in QUESTIONS[question_id]["options"]:
        if o["label"].lower() == str(label).lower():
            return o
    # Fall back to the internal value, case-insensitively.
    for o in QUESTIONS[question_id]["options"]:
        if str(o.get("value", "")).lower() == str(label).lower():
            return o
    valid = [o["label"] for o in QUESTIONS[question_id]["options"]]
    raise MappingError(f"{question_id} must be one of {valid}, got {label!r}")
