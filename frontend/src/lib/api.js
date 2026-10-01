// Talking to the backend.
//
// One place for the base URL so no screen has to know where the backend lives.
// Locally that is localhost:4000 (frontend/.env.local). Once the backend is on
// Netlify this becomes the Netlify site's /api path, set in Vercel's
// environment settings. Nothing else in the app should change at deploy time.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export { API_URL };

// Fetches JSON and turns any failure into a readable Error.
//
// The backend returns { "error": "..." } for failures (see API_CONTRACT.md), so
// we surface that message instead of "failed to fetch", which tells a shopper
// nothing.
//
// `authToken` is the shopper's Supabase access token, passed in by the caller
// (AuthProvider has it). It is sent as a Bearer token so the backend can verify
// WHO is calling and check the admin role server-side (AGENTS.md section 11).
// Guests send nothing and the backend treats them as guests, which is allowed
// (D12). The token is read from the argument rather than from a global so this
// module stays usable from a server component, where no React context exists.
export async function apiFetch(path, options = {}) {
  const { authToken, headers: extraHeaders, ...rest } = options;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        // Only set when there is a token: sending `Bearer null` would make the
        // backend treat a signed-in shopper as having a broken token.
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...extraHeaders,
      },
    });
  } catch {
    throw new Error(
      `Could not reach the shop backend at ${API_URL}. Is it running?`
    );
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON body usually means the wrong URL is being called.
  }

  if (!response.ok) {
    throw new Error(
      (body && body.error) || `The backend answered with status ${response.status}.`
    );
  }
  return body;
}

// Asks the backend who the caller is. Used by the auth provider; the result is
// deliberately not cached here, because the role can change (an admin promotion)
// while the page stays open.
export async function fetchMe(authToken) {
  return apiFetch("/auth/me", { authToken });
}

// Builds a /products query string, skipping empty values so we never send
// "brand=&min_price=" and have to guess how the backend should read it.
export function productsQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== null && value !== undefined) {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// The price bands the filter shows. These are the same six bands the
// questionnaire uses (model/config/questionnaire_v1.json), so a shopper who
// filters by "NGN 150k - 300k" sees exactly the phones the model would consider
// for that budget. Keeping one set of numbers in both places is what stops the
// shop and the model from disagreeing about what a budget means.
export const PRICE_BANDS = [
  { label: "Under ₦150k", min: 0, max: 150000 },
  { label: "₦150k – ₦300k", min: 150000, max: 300000 },
  { label: "₦300k – ₦500k", min: 300000, max: 500000 },
  { label: "₦500k – ₦1m", min: 500000, max: 1000000 },
  { label: "₦1m – ₦2m", min: 1000000, max: 2000000 },
  { label: "₦2m+", min: 2000000, max: 3000000 },
];

// Fetches the product list. Runs on the server so the phones are in the HTML.
export async function fetchProducts({ minPrice, maxPrice, brand } = {}) {
  const query = productsQuery({
    min_price: minPrice,
    max_price: maxPrice,
    brand,
  });
  const data = await apiFetch(`/products${query}`);
  return {
    products: (data.products || []).map(normaliseProduct),
    count: data.count ?? (data.products || []).length,
  };
}

// Fetches one phone, or null if the backend does not know the id.
export async function fetchProduct(id) {
  try {
    const data = await apiFetch(`/products/${encodeURIComponent(id)}`);
    return data.product ? normaliseProduct(data.product) : null;
  } catch (error) {
    // 404 is an expected outcome for a stale link, not a crash: the page turns
    // it into a proper 404. Any other failure should still surface.
    if (/status 404|not found/i.test(error.message)) return null;
    throw error;
  }
}

// Turns the backend's snake_case row into the shape the screens use.
//
// The backend joins brand and model into `name` (the shop should never show
// "TECNO" and "Camon 40 Pro 5G" as two separate fields), and numeric fields
// must be numbers so the cart total cannot be wrong because one price came back
// as a string.
function normaliseProduct(row) {
  return {
    ...row,
    product_id: row.product_id || row.id,
    name: row.name || [row.brand, row.model].filter(Boolean).join(" "),
    price_ngn: Number(row.price_ngn ?? row.price ?? 0),
    stock: Number(row.stock ?? 0),
    active: row.active !== false,
    ram_gb: Number(row.ram_gb ?? 0) || null,
    storage_gb: Number(row.storage_gb ?? 0) || null,
    battery_mah: Number(row.battery_mah ?? 0) || null,
    main_camera_mp: Number(row.main_camera_mp ?? 0) || null,
    selfie_camera_mp: Number(row.selfie_camera_mp ?? 0) || null,
    refresh_rate_hz: Number(row.refresh_rate_hz ?? 0) || null,
    display_inches: Number(row.display_inches ?? 0) || null,
    release_year: Number(row.release_year ?? 0) || null,
    five_g: row.five_g === true || row.five_g === "true" || row.five_g === "Yes",
  };
}

// Fetches the five questions from the backend, which reads the frozen config.
// Throws with a readable message so the questionnaire page can show something
// useful instead of a blank screen.
export async function fetchQuestionnaire() {
  return apiFetch("/questionnaire");
}

// Asks the backend to rank phones for these questionnaire answers.
//
// The answers go to the BACKEND, never straight to the model service: only the
// backend holds the model's shared key (AGENTS.md section 11). The backend
// forwards them unchanged, so the rules that decide which phones are allowed
// exist in exactly one place.
export async function postRecommend(answers) {
  return apiFetch("/recommend", {
    method: "POST",
    body: JSON.stringify(answers),
  });
}
