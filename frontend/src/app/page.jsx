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
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-white/70">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-r from-brand-soft via-white to-accent-soft" />
          <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-medium tracking-[0.12em] text-brand-strong uppercase">
                Smart picks, not guesswork
              </span>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Find the right phone for your budget and your day.
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
                Answer five quick questions and our model narrows the catalog to the phones that fit your needs, your spending range, and what matters most to you.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/find"
                  className="w-full rounded-full bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800 sm:w-auto"
                >
                  Find my phone
                </Link>
                <Link
                  href="/phones"
                  className="w-full rounded-full border border-slate-300 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
                >
                  Browse all phones
                </Link>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Takes about 30 seconds. No personal details required.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { title: "Budget-aware", body: "Only phones within your range are considered." },
                { title: "Use-case based", body: "Camera, battery, gaming, work and everyday use each get a fair look." },
                { title: "Easy to buy", body: "Add the winner straight to your cart and checkout in minutes." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-lg font-semibold text-brand-strong">✓</div>
                  <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-strong">Popular picks</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Trending phones right now</h2>
            </div>
            <Link href="/phones" className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">
              See all
            </Link>
          </div>

          {popular.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-6 text-center text-sm text-slate-600 shadow-sm">
              We could not load the catalog just now. Please refresh in a moment.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
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
