"use client";

// /admin/orders — the order list and status changes (Stage 8, feature 21).
//
// IT IS NOT THE SECURITY. Every call goes through the backend, which checks the
// admin role on the route itself, so removing anything here gains an attacker
// nothing. This page only decides what to SHOW and what to ask the human twice.
//
// The status list is fetched from the backend rather than typed in here, so a
// status added to the database cannot drift from what the admin can pick.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminOrders,
  fetchOrderStatuses,
  setOrderStatus,
} from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { formatNaira } from "../../../lib/format";
import {
  STATUS_TONE,
  shortRef,
  formatWhen,
  needsStatusConfirmation,
  describeStatusChange,
} from "../../../components/orderStatusState";

export default function AdminOrdersPage() {
  const { user, loading: authLoading, isAdmin, accessToken } = useAuth();

  const [data, setData] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [savingId, setSavingId] = useState(null);
  // { id, from, to } while the admin has been warned and has not confirmed.
  const [pendingChange, setPendingChange] = useState(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setData(
        await fetchAdminOrders(accessToken, {
          status: status || undefined,
          search: search.trim() || undefined,
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, status, search]);

  useEffect(() => {
    // The status list is not sensitive, so it is fetched once and does not wait
    // for the admin check.
    fetchOrderStatuses()
      .then((r) => setStatuses(r.statuses || []))
      .catch(() => setStatuses([]));
  }, []);

  useEffect(() => {
    // Only fetch once we know who this is. Calling the admin API as a guest
    // would produce a confusing 401 instead of a clear "sign in" message.
    if (authLoading) return;
    if (user && isAdmin) load();
  }, [authLoading, user, isAdmin, load]);

  async function applyChange(orderId, from, to) {
    setSavingId(orderId);
    setError(null);
    setNotice(null);
    try {
      const result = await setOrderStatus(accessToken, orderId, to);
      if (!result.changed) {
        setNotice(`That order was already ${to}. Nothing was changed or emailed.`);
      } else {
        // Say what happened, including stock and email. A status change that
        // silently failed to email the customer is the trap Stage 9 warns about.
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
      setSavingId(null);
      setPendingChange(null);
    }
  }

  function requestChange(order) {
    const select = document.getElementById(`status-${order.id}`);
    const to = select?.value;
    if (!to || to === order.status) return;
    if (needsStatusConfirmation(order.status, to)) {
      setPendingChange({ id: order.id, from: order.status, to });
      return;
    }
    applyChange(order.id, order.status, to);
  }
  if (authLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-slate-600">Checking your access...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
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

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
        <p className="mt-2 text-sm text-slate-600">
          This area is for shop administrators. Your account does not have admin
          access.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-slate-900 underline">
          Back to the shop
        </Link>
      </main>
    );
  }

  const orders = data?.orders || [];
  const counts = data?.counts || {};

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
      <p className="mt-1 text-sm text-slate-600">
        Change a status to update the order and email the customer.
      </p>

      {/* Filter tabs. Every status shows even at zero, so a missing tab can
          never be mistaken for "no such status exists". */}
      <div className="mt-4 flex flex-wrap gap-2">
        <TabButton active={status === ""} onClick={() => setStatus("")}>
          All
        </TabButton>
        {statuses.map((s) => (
          <TabButton
            key={s}
            active={status === s}
            onClick={() => setStatus(status === s ? "" : s)}
          >
            {s} ({counts[s] ?? 0})
          </TabButton>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mt-4 flex gap-2"
      >
        <label htmlFor="order-search" className="sr-only">
          Search orders by name, email or reference
        </label>
        <input
          id="order-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or reference"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Search
        </button>
      </form>
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

      {loading ? (
        <p className="mt-6 text-sm text-slate-600">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600">No orders match this filter.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-900">
                    {order.full_name}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    {shortRef(order.id)}
                  </span>
                </div>
                <span className="tabular-nums text-sm font-semibold text-slate-900">
                  {formatNaira(order.total_ngn)}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                {order.email}
                {order.phone ? ` · ${order.phone}` : ""}
                {order.city ? ` · ${order.city}, ${order.state}` : ""}
                {" · "}
                {formatWhen(order.created_at)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill status={order.status} />
                <label htmlFor={`status-${order.id}`} className="sr-only">
                  Change status for order {shortRef(order.id)}
                </label>
                <select
                  id={`status-${order.id}`}
                  defaultValue={order.status}
                  disabled={savingId === order.id}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => requestChange(order)}
                  disabled={savingId === order.id}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {savingId === order.id ? "Saving..." : "Update"}
                </button>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Details
                </Link>
              </div>

              <ConfirmStatusChange
                change={pendingChange?.id === order.id ? pendingChange : null}
                busy={savingId === order.id}
                onConfirm={() =>
                  applyChange(pendingChange.id, pendingChange.from, pendingChange.to)
                }
                onCancel={() => setPendingChange(null)}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
          : "rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      }
    >
      {children}
    </button>
  );
}

export function StatusPill({ status }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_TONE[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

// The second click for a stock-moving status change. Exported so the detail page
// uses the identical warning rather than a second, slightly different one.
export function ConfirmStatusChange({ change, onConfirm, onCancel, busy }) {
  if (!change) return null;
  return (
    <div
      role="alert"
      className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p className="font-medium">
        Change {change.from} to {change.to}?
      </p>
      <p className="mt-1">{describeStatusChange(change.from, change.to)}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {busy ? "Saving..." : `Yes, set it to ${change.to}`}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Keep it {change.from}
        </button>
      </div>
    </div>
  );
}

