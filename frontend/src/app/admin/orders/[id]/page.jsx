"use client";

// /admin/orders/[id] — one order in full (Stage 8).
//
// Shows what the customer actually ordered, where it is going, and the full
// status history. The status control and its stock warning are the same ones
// the list uses, imported from there, so the two screens cannot disagree about
// what cancelling does.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchAdminOrder, setOrderStatus, fetchOrderStatuses } from "../../../../lib/api";
import { useAuth } from "../../../../components/AuthProvider";
import { formatNaira } from "../../../../lib/format";
import {
  shortRef,
  formatWhen,
  needsStatusConfirmation,
} from "../../../../components/orderStatusState";
import { StatusPill, ConfirmStatusChange } from "../page";

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading, isAdmin, accessToken } = useAuth();

  const [detail, setDetail] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [chosen, setChosen] = useState("");
  const [pendingChange, setPendingChange] = useState(null);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminOrder(accessToken, id);
      setDetail(result);
      setChosen(result.order.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    if (authLoading) return;
    if (user && isAdmin) load();
  }, [authLoading, user, isAdmin, load]);

  // The status list is not sensitive, so it is fetched once and does not wait
  // for the admin check. Same source as the list page, so the two cannot drift.
  useEffect(() => {
    fetchOrderStatuses()
      .then((r) => setStatuses(r.statuses || []))
      .catch(() => setStatuses([]));
  }, []);

  async function applyChange(to) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await setOrderStatus(accessToken, id, to);
      if (!result.changed) {
        setNotice(`This order was already ${to}. Nothing was changed or emailed.`);
      } else {
        const bits = [`Order is now ${result.order.status}.`];
        if (result.restocked?.length) {
          const returned = result.restocked[0].direction === "returned";
          bits.push(
            returned
              ? `${result.restocked.length} phone line(s) put back into stock.`
              : `${result.restocked.length} phone line(s) taken out of stock again.`
          );
        }
        bits.push(
          result.email?.sent
            ? "The customer was emailed."
            : `No email to the customer (${result.email?.reason || "unknown"}).`
        );
        setNotice(bits.join(" "));
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setPendingChange(null);
    }
  }

  function requestChange() {
    if (!chosen || chosen === detail?.order.status) return;
    if (needsStatusConfirmation(detail.order.status, chosen)) {
      setPendingChange({ from: detail.order.status, to: chosen });
      return;
    }
    applyChange(chosen);
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-slate-600">Checking your access...</p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Order</h1>
        <p className="mt-2 text-sm text-slate-600">
          {user
            ? "This area is for shop administrators."
            : "Please sign in to continue."}
        </p>
        <Link href="/admin/orders" className="mt-4 inline-block text-sm font-medium text-slate-900 underline">
          Back to orders
        </Link>
      </main>
    );
  }
  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-slate-600">Loading order...</p>
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Order</h1>
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error || "That order could not be found."}
        </p>
        <Link href="/admin/orders" className="mt-4 inline-block text-sm font-medium text-slate-900 underline">
          Back to orders
        </Link>
      </main>
    );
  }

  const { order, items, history } = detail;
  const delivery = Number(order.delivery_ngn) || 0;
  const subtotal = (Number(order.total_ngn) || 0) - delivery;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/admin/orders" className="text-sm text-slate-600 underline">
        All orders
      </Link>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Order {shortRef(order.id)}
        </h1>
        <StatusPill status={order.status} />
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Placed {formatWhen(order.created_at)}
      </p>

      {notice && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Change status</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor="status-select" className="sr-only">
            New status
          </label>
          <select
            id="status-select"
            value={chosen}
            onChange={(e) => setChosen(e.target.value)}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={requestChange}
            disabled={saving || chosen === order.status}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Update status"}
          </button>
        </div>
        <ConfirmStatusChange
          change={pendingChange}
          busy={saving}
          onConfirm={() => applyChange(pendingChange.to)}
          onCancel={() => {
            setPendingChange(null);
            setChosen(order.status);
          }}
        />
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
        <p className="mt-1 text-sm text-slate-700">{order.full_name}</p>
        <p className="text-sm text-slate-600">{order.email}</p>
        {order.phone && <p className="text-sm text-slate-600">{order.phone}</p>}
        <p className="mt-2 text-sm text-slate-700">{order.address_line}</p>
        <p className="text-sm text-slate-600">
          {order.city}, {order.state}
        </p>
        {order.notes && (
          <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
            {order.notes}
          </p>
        )}
      </section>
      <section className="mt-4 rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Items</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1 pr-3">Phone</th>
              <th className="py-1 pr-3">Qty</th>
              <th className="py-1 pr-3">Price</th>
              <th className="py-1 text-right">Line</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id || item.product_id} className="border-b border-slate-100">
                <td className="py-1 pr-3">{item.name}</td>
                <td className="py-1 pr-3 tabular-nums">{item.quantity}</td>
                <td className="py-1 pr-3 tabular-nums">
                  {formatNaira(item.price_ngn)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatNaira(item.price_ngn * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="tabular-nums text-slate-900">{formatNaira(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Delivery</dt>
            <dd className="tabular-nums text-slate-900">{formatNaira(delivery)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatNaira(order.total_ngn)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">History</h2>
        {history.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">
            No status changes recorded yet.
          </p>
        ) : (
          <ol className="mt-2 space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline gap-2">
                <StatusPill status={h.status} />
                <span className="text-xs text-slate-500">
                  {formatWhen(h.changed_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
