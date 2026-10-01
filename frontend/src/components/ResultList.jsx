"use client";

// ResultList shows the ranked phones with a reason and ratings, and lets the
// shopper add one to the cart.
//
// DESIGN RULES FROM AGENTS.md SECTION 10:
//  - a reason line plus 2 to 3 rating labels, and NO match percentage. A
//    percentage would imply a precision the model does not have (D24), so the
//    score from the model is deliberately not displayed.
//  - "Add to cart" on every pick, because the ranked list is a real buying path.
//
// The model version is kept in the DOM as small print. It is not decoration: it
// is what makes a recommendation traceable later (D23), so a support question
// about a pick can be tied to the exact model that produced it.

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./CartProvider";
import { formatNaira } from "../lib/format";

function RatingPills({ ratings }) {
  const order = ["camera", "battery", "performance"];
  const labels = { camera: "Camera", battery: "Battery", performance: "Performance" };
  const present = order.filter((key) => ratings && ratings[key]);
  if (present.length === 0) return null;

  return (
    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
      {present.map((key) => (
        <span key={key}>
          {labels[key]}: <span className="font-medium text-zinc-800">{ratings[key]}</span>
        </span>
      ))}
    </p>
  );
}

export default function ResultList({ result }) {
  const { addItem } = useCart();
  const [addedId, setAddedId] = useState(null);

  if (!result) return null;

  const picks = result.recommendations || [];

  if (picks.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="font-medium text-amber-900">No phone matches every answer</p>
        <p className="mt-1 text-sm text-amber-800">
          {result.message ||
            "Try a wider budget or ask for less storage, and we will look again."}
        </p>
        <Link href="/find" className="mt-3 inline-block text-sm font-medium text-amber-900 underline">
          Change my answers
        </Link>
      </div>
    );
  }

  function handleAdd(pick) {
    addItem(
      {
        product_id: pick.product_id,
        name: `${pick.brand} ${pick.model}`,
        price_ngn: pick.price_ngn,
        stock: null,
      },
      1
    );
    setAddedId(pick.product_id);
    setTimeout(() => setAddedId(null), 1500);
  }

  return (
    <div className="mt-6">
      {result.message && (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 shadow-sm">
          {result.message}
        </p>
      )}

      <ol className="space-y-4">
        {picks.map((pick) => (
          <li
            key={pick.product_id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-sm font-bold text-blue-700">
                {pick.rank}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/phones/${pick.product_id}`}
                    className="text-lg font-semibold text-slate-900 hover:text-blue-700"
                  >
                    {pick.brand} {pick.model}
                  </Link>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
                    Top {pick.rank}
                  </span>
                </div>

                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatNaira(pick.price_ngn)}
                </p>

                {pick.reasons && pick.reasons.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {pick.reasons.map((reason) => (
                      <li key={reason} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <RatingPills ratings={pick.ratings} />

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAdd(pick)}
                    className="rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    {addedId === pick.product_id ? "Added to cart" : "Add to cart"}
                  </button>
                  <Link
                    href={`/phones/${pick.product_id}`}
                    className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    View details
                  </Link>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {result.model_version && (
        <p className="mt-4 text-xs text-slate-500">
          Ranked by our model, version {result.model_version}.
        </p>
      )}
    </div>
  );
}
