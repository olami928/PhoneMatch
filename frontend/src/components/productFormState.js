"use client";

// productFormState.js — the form's data and rules, kept out of the component so
// both can be read (and tested) without wading through JSX (Stage 7).
//
// TWO THINGS THIS FORM IS CAREFUL ABOUT:
//
// 1. STOCK IS THE DANGEROUS FIELD. Setting it to 0 removes a phone from the shop
//    AND from what the model can recommend, immediately. So a zero-stock save asks
//    for a second click to confirm. The backend allows stock 0 (it is a
//    legitimate state); this only makes a human look at it.
// 2. EMPTY BOXES DO NOT CLEAR DATA. Optional fields are omitted from the payload
//    when blank, so clearing one field in a half-filled form cannot wipe a real
//    value that was not even on screen.

// The spec fields the model reads. Kept in one place so the form and the
// "missing specs" warning talk about the same nine things.
export const SPEC_FIELDS = [
  { key: "ram_gb", label: "RAM (GB)" },
  { key: "storage_gb", label: "Storage (GB)" },
  { key: "battery_mah", label: "Battery (mAh)" },
  { key: "main_camera_mp", label: "Rear camera (MP)" },
  { key: "selfie_camera_mp", label: "Front camera (MP)" },
  { key: "refresh_rate_hz", label: "Refresh rate (Hz)" },
  { key: "display_inches", label: "Screen (inches)" },
  { key: "release_year", label: "Year" },
  { key: "processor", label: "Processor", text: true },
];

export const EMPTY_FORM = {
  name: "",
  brand: "",
  price_ngn: "",
  stock: "0",
  description: "",
  ram_gb: "",
  storage_gb: "",
  battery_mah: "",
  main_camera_mp: "",
  selfie_camera_mp: "",
  refresh_rate_hz: "",
  display_inches: "",
  release_year: "",
  processor: "",
  five_g: false,
  active: true,
};

/** Turns a stored product row into form values. */
export function productToForm(product) {
  return {
    name: product.name || "",
    brand: product.brand || "",
    price_ngn: String(product.price_ngn ?? ""),
    stock: String(product.stock ?? 0),
    description: product.description || "",
    active: product.active !== false,
    five_g: product.five_g === true,
    ...Object.fromEntries(
      SPEC_FIELDS.map((f) => [
        f.key,
        product[f.key] === null || product[f.key] === undefined
          ? ""
          : String(product[f.key]),
      ])
    ),
  };
}

/** Builds the API payload, omitting blank optional fields. */
export function formToPayload(form) {
  const payload = {
    name: form.name.trim(),
    brand: form.brand.trim(),
    // Blank means 0, not "unknown": an uncounted phone must not be sellable.
    stock: form.stock === "" ? 0 : Number(form.stock),
    active: form.active,
    five_g: form.five_g,
  };
  if (form.price_ngn !== "") payload.price_ngn = form.price_ngn;
  if (form.description.trim()) payload.description = form.description.trim();
  for (const field of SPEC_FIELDS) {
    const value = form[field.key];
    if (value === "" || value === null || value === undefined) continue;
    payload[field.key] = field.text ? value.trim() : value;
  }
  return payload;
}

/**
 * Whether a save needs the second confirming click.
 *
 * Only asks when the phone is going FROM for sale TO zero. Setting a phone that
 * is already at 0 to 0 again is not a destructive change, and asking every time
 * would train the admin to click through the warning without reading it.
 */
export function needsZeroConfirmation({ form, previousStock }) {
  if (Number(form.stock) !== 0) return false;
  return Number(previousStock ?? 0) > 0;
}