// /phones/[id] — one phone's detail page (Stage 2).

import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import AddToCartButton from "../../../components/AddToCartButton";
import { fetchProduct } from "../../../lib/api";
import { formatNaira } from "../../../lib/format";

export const dynamic = "force-dynamic";

export default async function PhoneDetailPage({ params }) {
  const { id } = await params;
  const product = await fetchProduct(id);

  // A phone the backend does not know about should 404, not render an empty
  // shell. notFound() gives the real 404 status and lets Next render not-found.
  if (!product) notFound();

  const outOfStock = !product.active || product.stock <= 0;

  const specs = [
    ["Display", product.display_inches ? `${product.display_inches}"` : null],
    ["Processor", product.processor],
    ["Rear camera", product.main_camera_mp ? `${product.main_camera_mp} MP` : null],
    ["Front camera", product.selfie_camera_mp ? `${product.selfie_camera_mp} MP` : null],
    ["Battery", product.battery_mah ? `${product.battery_mah} mAh` : null],
    ["Refresh rate", product.refresh_rate_hz ? `${product.refresh_rate_hz} Hz` : null],
    ["5G", product.five_g ? "Yes" : "No"],
    ["Released", product.release_year],
  ].filter(([, value]) => value);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Link href="/phones" className="text-sm text-zinc-600 hover:underline">
          Back to all phones
        </Link>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="flex aspect-4/3 items-center justify-center rounded-xl bg-zinc-100 text-6xl font-semibold text-zinc-300">
            {product.brand?.charAt(0)}
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{product.name}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {product.brand} · {product.condition}
            </p>

            <p className="mt-4 text-3xl font-semibold text-zinc-900">
              {formatNaira(product.price_ngn)}
            </p>

            <div className="mt-4">
              <AddToCartButton product={product} outOfStock={outOfStock} />
              {product.stock > 0 && product.stock <= 5 && !outOfStock && (
                <p className="mt-2 text-sm text-amber-700">
                  Only {product.stock} left in stock
                </p>
              )}
            </div>

            <dl className="mt-6 divide-y divide-zinc-100 border-t border-zinc-100">
              {specs.map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 text-sm">
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="font-medium text-zinc-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </main>
    </>
  );
}
