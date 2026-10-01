// Home — the shop's front door (Stage 2).
//
// It is a SERVER component so the "popular phones" strip is real HTML rather
// than a loading spinner. Only the header's cart count and the add-to-cart
// buttons need to be client components, and those are handled inside the
// components they belong to.
//
// If the backend is not running the page still renders: it falls back to the
// hero alone rather than showing an error page, so the shop is never a blank
// screen while the backend is down.

import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../lib/api";

export const dynamic = "force-dynamic";

async function loadPopular() {
  try {
    // The upper-middle of the catalog is the most useful thing to show a
    // first-time visitor: too cheap looks unserious, flagship looks unaffordable.
    const { products } = await fetchProducts({
      minPrice: 150000,
      maxPrice: 1000000,
    });
    // A deterministic slice, not a random one, so the page does not shuffle on
    // every refresh and confuse someone comparing it to a screenshot.
    return products.slice(0, 8);
  } catch {
    return [];
  }
}

export default async function Home() {
  const popular = await loadPopular();

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero. D18/D20: the model is the main call to action, not browsing. */}
        <section className="border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-12 text-center">
            <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              Not sure which phone to buy?
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-zinc-600">
              Answer 5 quick questions. Our model looks at every phone in stock and
              picks the ones that fit your budget and what you actually need.
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/find"
                className="w-full rounded-lg bg-zinc-900 px-6 py-3 text-center text-sm font-medium text-white hover:bg-zinc-700 sm:w-auto"
              >
                Find my phone
              </Link>
              <Link
                href="/phones"
                className="w-full rounded-lg border border-zinc-300 px-6 py-3 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50 sm:w-auto"
              >
                Browse all phones
              </Link>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Takes about 30 seconds. We never ask for personal details.
            </p>
          </div>
        </section>

        {/* Popular phones. */}
        <section className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-zinc-900">Popular phones</h2>
            <Link href="/phones" className="text-sm text-zinc-600 underline hover:text-zinc-900">
              See all
            </Link>
          </div>

          {popular.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-600">
              We could not load the catalog just now. Please refresh in a moment.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {popular.map((product) => (
                <ProductCard key={product.product_id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
