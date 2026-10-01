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
      {/* A thin catalog is a real, measured condition (M3 found the 2m+ band has
          only 2 phones), so say it rather than showing 2 results as if they
          were the full answer. */}
      {result.message && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {result.message}
        </p>
      )}

      <ol className="space-y-3">
        {picks.map((pick) => (
          <li
            key={pick.product_id}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              {/* Rank number. Not a score, just the position. */}
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
                {pick.rank}
              </span>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/phones/${pick.product_id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {pick.brand} {pick.model}
                </Link>
                <p className="text-sm font-semibold text-zinc-900">
                  {formatNaira(pick.price_ngn)}
                </p>

                {pick.reasons && pick.reasons.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {pick.reasons.map((reason) => (
                      <li key={reason} className="text-sm text-zinc-700">
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}

                <RatingPills ratings={pick.ratings} />

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleAdd(pick)}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    {addedId === pick.product_id ? "Added to cart" : "Add to cart"}
                  </button>
                  <Link
                    href={`/phones/${pick.product_id}`}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
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
        <p className="mt-4 text-xs text-zinc-400">
          Ranked by our model, version {result.model_version}.
        </p>
      )}
    </div>
  );
}
