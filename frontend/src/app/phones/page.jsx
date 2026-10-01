// /phones — the product list (Stage 2).
//
// Two deliberate choices here:
//
// 1. The list is a SERVER component. The catalog does not change per visitor,
//    so it is fetched on the server and the HTML already contains the phones.
//    That keeps the page fast and works even before JavaScript loads.
//
// 2. The price filter is applied on the SERVER, by reading searchParams. So the
//    filter is a real URL (?min_price=&max_price=) that can be shared,
//    bookmarked, and used with the back button. A client-side filter would
//    fetch every phone and then hide half of them, which is wasteful and makes
//    the URL meaningless.

import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import ProductCard from "../../components/ProductCard";
import { fetchProducts, PRICE_BANDS } from "../../lib/api";

export const dynamic = "force-dynamic"; // prices and stock change; never cache

function parseNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default async function PhonesPage({ searchParams }) {
  // Next.js may hand us a promise here depending on version.
  const params = (await searchParams) || {};

  const minPrice = parseNumber(params.min_price);
  const maxPrice = parseNumber(params.max_price);
  const brand = params.brand || "";

  const { products, count } = await fetchProducts({ minPrice, maxPrice, brand });

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Shop all phones</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Not sure where to start? Use our model and answer 5 quick questions.
        </p>

        {/* Price filter. Each band is a link, so it works without JavaScript. */}
        <nav aria-label="Filter by price" className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/phones"
            className={
              !params.min_price && !params.max_price
                ? "rounded-full bg-zinc-900 px-3 py-1.5 text-sm text-white"
                : "rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
            }
          >
            All
          </Link>
          {PRICE_BANDS.map((band) => {
            const active =
              String(params.min_price ?? "") === String(band.min) &&
              String(params.max_price ?? "") === String(band.max);
            return (
              <Link
                key={band.label}
                href={`/phones?min_price=${band.min}&max_price=${band.max}`}
                className={
                  active
                    ? "rounded-full bg-zinc-900 px-3 py-1.5 text-sm text-white"
                    : "rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
                }
              >
                {band.label}
              </Link>
            );
          })}
        </nav>

        <p className="mt-4 text-sm text-zinc-600" aria-live="polite">
          {count} {count === 1 ? "phone" : "phones"}
        </p>

        {products.length === 0 ? (
          <div className="mt-6 rounded-lg border border-zinc-200 p-6 text-center">
            <p className="font-medium text-zinc-900">No phones in this price range</p>
            <p className="mt-1 text-sm text-zinc-600">
              Try a wider range, or let our model pick from everything in stock.
            </p>
            <Link
              href="/phones"
              className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Clear the filter
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.product_id} product={product} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
