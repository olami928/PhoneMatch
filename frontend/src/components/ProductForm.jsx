"use client";

// ProductForm — add or edit one phone (Stage 7).
//
// The data and rules live in productFormState.js; this file is the JSX. The
// confirmation for a zero-stock save is here because it is about how a person
// feels when they click, not about the payload.

import { SPEC_FIELDS } from "./productFormState";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";

export default function ProductForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  saving,
  editingId,
  confirmZero,
}) {
  const set = (key, value) => onChange({ ...form, [key]: value });

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-slate-200 p-4">
      <h2 className="font-semibold text-slate-900">
        {editingId ? "Edit product" : "Add a product"}
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Name" id="name">
          <input
            id="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Brand" id="brand">
          <input
            id="brand"
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Price (naira)" id="price_ngn">
          <input
            id="price_ngn"
            type="number"
            min="1"
            step="1"
            value={form.price_ngn}
            onChange={(e) => set("price_ngn", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Stock" id="stock">
          <input
            id="stock"
            type="number"
            min="0"
            step="1"
            value={form.stock}
            onChange={(e) => set("stock", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {SPEC_FIELDS.map((field) => (
          <Field key={field.key} label={field.label} id={field.key}>
            <input
              id={field.key}
              type={field.text ? "text" : "number"}
              step={field.text ? undefined : "any"}
              value={form[field.key]}
              onChange={(e) => set(field.key, e.target.value)}
              className={inputClass}
            />
          </Field>
        ))}
      </div>

      <div className="mt-3">
        <Field label="Description" id="description">
          <input
            id="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Leave blank and one is built from the specs above"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          On sale
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.five_g}
            onChange={(e) => set("five_g", e.target.checked)}
          />
          5G
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : editingId ? "Save changes" : "Add product"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Confirmation for the one edit that takes a phone off sale. */}
      {confirmZero && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Setting stock to 0 takes this phone off sale AND out of what the model
          recommends. Press Save again to confirm.
        </p>
      )}
    </form>
  );
}

// A labelled input wrapper. The label is associated with the control by id, which
// is what makes the form usable with a screen reader and by clicking the label.
function Field({ label, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}