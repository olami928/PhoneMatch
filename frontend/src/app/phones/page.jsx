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

  let products = [];
  let count = 0;
  try {
    ({ products, count } = await fetchProducts({ minPrice, maxPrice, brand }));
  } catch {
    products = [];
    count = 0;
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-sm shadow-slate-200/50">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
            Shop catalog
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Shop all phones</h1>
          <p className="mt-2 text-sm text-slate-600">
            Not sure where to start? Use our model and answer 5 quick questions.
          </p>
        </div>

        <nav aria-label="Filter by price" className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Link
            href="/phones"
            className={
              !params.min_price && !params.max_price
                ? "min-w-0 whitespace-nowrap rounded-full bg-slate-900 px-2.5 py-2 text-center text-xs font-medium text-white shadow-sm sm:px-3 sm:py-1.5 sm:text-sm"
                : "min-w-0 whitespace-nowrap rounded-full border border-slate-300 bg-white px-2.5 py-2 text-center text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 sm:px-3 sm:py-1.5 sm:text-sm"
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
                    ? "min-w-0 whitespace-nowrap rounded-full bg-brand px-2.5 py-2 text-center text-xs font-medium text-white shadow-sm shadow-emerald-900/10 sm:px-3 sm:py-1.5 sm:text-sm"
                    : "min-w-0 whitespace-nowrap rounded-full border border-slate-300 bg-white px-2.5 py-2 text-center text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 sm:px-3 sm:py-1.5 sm:text-sm"
                }
              >
                {band.label}
              </Link>
            );
          })}
        </nav>

        <p className="mt-4 text-sm text-slate-600" aria-live="polite">
          {count} {count === 1 ? "phone" : "phones"}
        </p>

        {products.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-white/85 p-6 text-center shadow-sm">
            <p className="font-semibold text-slate-900">
              {count === 0 && !process.env.NEXT_PUBLIC_API_URL
                ? "The catalog is temporarily unavailable"
                : "No phones in this price range"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {count === 0 && !process.env.NEXT_PUBLIC_API_URL
                ? "The backend is not running locally yet, so the catalog is temporarily unavailable. Start the backend and refresh this page."
                : "Try a wider range, or let our model pick from everything in stock."}
            </p>
            <Link
              href="/phones"
              className="mt-4 inline-block rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              Clear the filter
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.product_id} product={product} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
