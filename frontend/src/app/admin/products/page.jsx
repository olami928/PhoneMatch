"use client";

// /admin/products — manage the catalog and stock (Stage 7).
//
// IT IS NOT THE SECURITY. The backend checks the admin role on every call
// (requireAdmin), so editing this file to remove the check gains an attacker
// nothing. This page only decides what to SHOW. Feature 20: a phone with zero
// stock is not offered for sale. Feature 19: full spec fields are editable.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchAdminProducts, createProduct, updateProduct } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { formatNaira } from "../../../lib/format";
import ProductForm from "../../../components/ProductForm";
import {
  EMPTY_FORM,
  productToForm,
  formToPayload,
  needsZeroConfirmation,
} from "../../../components/productFormState";

export default function AdminProductsPage() {
  const { user, loading: authLoading, isAdmin, accessToken } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  // True while the admin has been warned and has not yet confirmed.
  const [confirmZero, setConfirmZero] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminProducts(accessToken));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // Only fetch once we know who this is. Calling the admin API as a guest
    // would just produce a confusing 401 instead of a clear "sign in" message.
    if (authLoading) return;
    if (user && isAdmin) load();
  }, [authLoading, user, isAdmin, load]);

  function startEdit(product) {
    setEditingId(product.id);
    setForm(productToForm(product));
    setNotice(null);
    setError(null);
    setConfirmZero(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setConfirmZero(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const previousStock = editingId
      ? (data?.products.find((p) => p.id === editingId)?.stock ?? 0)
      : 0;

    // The warning is raised once, on the first click. A second click confirms.
    if (!confirmZero && needsZeroConfirmation({ form, previousStock })) {
      setConfirmZero(true);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateProduct(accessToken, editingId, formToPayload(form));
        setNotice("Saved. The shop now shows the new price and stock.");
      } else {
        await createProduct(accessToken, formToPayload(form));
        setNotice("Product added. It is now listed in the shop.");
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setConfirmZero(false);
    }
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-slate-600">Checking your access...</p>
      </main>
    );
  }

  // Not signed in: send them to sign in rather than showing an empty admin area.
  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Admin</h1>
        <p className="mt-2 text-sm text-slate-600">Please sign in to continue.</p>
        <Link
          href="/signin"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </main>
    );
  }

  // Signed in but not an admin. The backend would refuse every call with 403, so
  // say so here rather than making them watch requests fail.
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Admin</h1>
        <p className="mt-2 text-sm text-slate-600">
          This area is for shop administrators. Your account does not have admin
          access.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-slate-900 underline"
        >
          Back to the shop
        </Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
        <Link href="/" className="text-sm text-slate-600 underline hover:text-slate-900">
          Back to the shop
        </Link>
      </div>

      {data && (
        <p className="mt-2 text-sm text-slate-600">
          {data.total} products · {data.in_stock} on sale ·{" "}
          <span className={data.out_of_stock ? "text-amber-700" : ""}>
            {data.out_of_stock} not for sale
          </span>
          {data.low_stock > 0 && (
            <span className="text-amber-700"> · {data.low_stock} low on stock</span>
          )}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <ProductForm
        form={form}
        onChange={setForm}
        onSubmit={handleSubmit}
        onCancel={cancelEdit}
        saving={saving}
        editingId={editingId}
        confirmZero={confirmZero}
      />

      {loading ? (
        <p className="mt-6 text-sm text-slate-600">Loading products...</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(data?.products || []).map((product) => (
                <tr key={product.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">
                    <span className="font-medium text-slate-900">{product.name}</span>
                    <span className="block text-xs text-slate-500">{product.id}</span>
                    {/* Feature 26: warn about missing model specs, do not block. */}
                    {product.missing_model_features?.length > 0 && (
                      <span className="mt-1 block text-xs text-amber-700">
                        Missing specs: {product.missing_model_features.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{formatNaira(product.price_ngn)}</td>
                  <td className="py-2 pr-3 tabular-nums">{product.stock}</td>
                  <td className="py-2 pr-3">
                    <StockStatus product={product} />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => startEdit(product)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

// Hidden and out-of-stock are different problems needing different actions, so
// they are worded differently rather than both saying "not for sale".
function StockStatus({ product }) {
  if (!product.active) {
    return <span className="text-xs text-slate-500">Hidden</span>;
  }
  if (product.stock <= 0) {
    return <span className="text-xs text-red-700">Out of stock</span>;
  }
  if (product.stock <= 5) {
    return <span className="text-xs text-amber-700">Low</span>;
  }
  return <span className="text-xs text-green-700">On sale</span>;
}
  }