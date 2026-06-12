# Horizon capture — manual QA checklist

Plain-text checklist for developers verifying horizon photo capture end-to-end.
Run from the canonical project root: `C:\Users\areil\Documents\skywindow`.

Prerequisites: a test Supabase account (email/password), a valid `ANTHROPIC_API_KEY`, and at least one sample horizon JPEG (panorama or wide landscape, ideally under ~5 MB).

---

## 1. Dev environment setup

### 1.1 Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where used |
|----------|------------|
| `VITE_SUPABASE_URL` | Browser Supabase client |
| `VITE_SUPABASE_ANON_KEY` | Browser Supabase client |
| `ANTHROPIC_API_KEY` | Server only — `/api/analyze-horizon` → Claude Vision |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — verifies `Authorization: Bearer <access_token>` |

Never prefix secrets with `VITE_` except the two Supabase public keys. Do not commit `.env.local`.

### 1.2 Start the app (recommended)

Local dev does **not** require running `vercel dev` and `vite` at the same time. Vite serves the UI and implements `/api/analyze-horizon` via a dev middleware plugin (`vite.config.js` → `server/analyzeHorizon.mjs`).

```bash
cd C:\Users\areil\Documents\skywindow
npm install
npm run dev
```

- Open the URL Vite prints (default `http://localhost:5173`).
- Confirm `.env.local` is loaded: a missing `ANTHROPIC_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` yields HTTP 500 from `/api/analyze-horizon` with a clear JSON `error` message.

### 1.3 Production-like API (optional)

To exercise the Vercel serverless handler (`api/analyze-horizon.js`) instead of the Vite middleware:

```bash
npx vercel dev
```

Use the URL Vercel prints. Still rely on the same `.env.local` values (pull from Vercel with `npx vercel env pull` if the project is linked). Do **not** run `npm run dev` on the same port at the same time.

### 1.4 Smoke-check the API route

While signed in, open DevTools → Network. After uploading a photo (section 3), confirm:

- Request: `POST /api/analyze-horizon`
- Request headers include `Authorization: Bearer <jwt>`
- Request body JSON: `{ "base64": "...", "mediaType": "image/jpeg" }` (client downscales wide images before send)
- Success: HTTP 200, body `{ "points": [ { "azimuth", "altitude" }, ... ] }`

---

## 2. Auth

### 2.1 UI when not logged in

1. Sign out (or use a private window with no session).
2. Navigate to `/sky-profiles`.

**Expected:** redirect to `/login`. Horizon capture is not available without a session.

### 2.2 Client guard (no session)

If you force the analyze call without a Supabase session (e.g. stale test harness), `analyzeHorizonPhoto` in `src/lib/anthropic.js` throws before `fetch`:

**Expected message:** `You must be signed in to analyze a horizon photo.`

### 2.3 API route returns 401

With the dev server running, call the API directly (replace host/port as needed):

```bash
curl -s -o - -w "\nHTTP %{http_code}\n" -X POST http://localhost:5173/api/analyze-horizon \
  -H "Content-Type: application/json" \
  -d "{\"base64\":\"$(node -e "console.log('a'.repeat(200))")\",\"mediaType\":\"image/jpeg\"}"
```

(No `Authorization` header.)

**Expected:** HTTP **401**, JSON like `{ "error": "Missing or invalid authorization." }`.

Repeat with an invalid token:

```bash
curl -s -o - -w "\nHTTP %{http_code}\n" -X POST http://localhost:5173/api/analyze-horizon \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token" \
  -d "{\"base64\":\"$(node -e "console.log('a'.repeat(200))")\",\"mediaType\":\"image/jpeg\"}"
```

**Expected:** HTTP **401**, JSON like `{ "error": "Invalid or expired session." }`.

### 2.4 Signed-in happy path uses Bearer token

Sign in, upload a photo on `/sky-profiles`, and inspect the analyze request in Network.

**Expected:** `Authorization: Bearer <access_token>` present; not 401.

---

## 3. Happy path

All steps on `/sky-profiles` while signed in.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set label (e.g. `QA test site`) | Input accepts text; default is `Home site` |
| 2 | Under **Upload photo**, choose a JPEG panorama | Thumbnail preview appears |
| 3 | Wait for analysis | Message: **Tracing horizon with Claude… this takes ~10 seconds.** Upload / **Take photo** disabled while busy |
| 4 | Analysis completes | **Save sky profile** button appears; no red error |
| 5 | Verify point count | UI does not show a numeric count. In Network → analyze response: `points` is an array with **length ≥ 3** (model prompt targets ~36–72 points) |
| 6 | Click **Save sky profile** | Button shows **Saving…** then navigates to `/sky-profiles` |
| 7 | Toast | Brief toast: **Home site saved** (or your label if wired differently) |
| 8 | Profile list | New row with your label; badge **Horizon data**; **HorizonSilhouette** preview under the row |
| 9 | `/tonight` | Open `/tonight` → **Sky profile** `<select>` includes your label; selecting it shows horizon silhouette preview above equipment |

---

## 4. Error paths

### 4.1 Non-image file

1. Choose a non-image (e.g. `.txt` renamed to `.jpg`, or `.pdf`) via **Upload photo**.

**Expected (typical):** analysis fails after read/decode or at the API/model step; red `role="alert"` error; **Try again** visible. No **Save sky profile** until a successful analysis.

Note: `accept="image/*"` may block some file types in the picker; use a file that the browser still offers if testing strictly “wrong content.”

### 4.2 Very large file (~20 MB)

1. Upload a JPEG at or above ~20 MB (generate or use a large panorama).

**Expected:** client attempts downscale via `createImageBitmap` + canvas (max edge 2400px). If the POST still fails or times out, user-facing error similar to: **Could not reach the horizon service (photo may be too large, or the dev server needs a restart). Try again with a slightly smaller image.** No crash; **Try again** available.

Record in notes: HTTP status if the request reaches the server (502/500 vs failed fetch).

### 4.3 Simulated network failure

1. Start analysis with a valid JPEG.
2. In DevTools → Network, enable **Offline** (or block `analyze-horizon`) before/during the request.

**Expected:** error about not reaching the horizon service / network; **Try again** enabled when `lastFile` is set.

### 4.4 Simulated Anthropic 429 (rate limit)

The server maps Anthropic HTTP errors to **502** on `/api/analyze-horizon` (body `error` may include Anthropic’s response text).

**Option A — DevTools mock (deterministic):**

1. DevTools → Network → right-click `analyze-horizon` → **Block request URL** or use **Local overrides** / request mocking if available.
2. Or use a browser extension to return HTTP 502 with body `{ "error": "rate_limit_error" }` for `POST /api/analyze-horizon`.

**Option B — real rate limit:** exhaust API quota on a test key (not recommended on production keys).

**Expected:** non-200 response; UI shows the JSON `error` string (or `Horizon analysis failed (HTTP 502).`); **Try again** visible; preview image unchanged.

---

## 5. Mobile (iOS Safari)

Requires the dev app reachable from the phone (same LAN + `npm run dev -- --host`, or a deployed preview with env vars set).

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open app URL in **Safari** on iPhone | App loads; sign in |
| 2 | Go to `/sky-profiles` | Capture panel visible |
| 3 | Tap **Take photo** | System camera opens (rear/environment via `capture="environment"`) |
| 4 | Capture a horizon/skyline photo | Returns to app; preview thumbnail |
| 5 | Wait | **Tracing horizon with Claude…** then **Save sky profile** on success |

If analyze fails only on mobile, compare request payload size in Network vs desktop.

---

## 6. Re-try after error

1. Trigger any analysis error (sections 4.1–4.4).
2. Confirm preview image is still shown and error text is visible.
3. Click **Try again** without re-picking a file.

**Expected:**

- Same preview (same blob URL until a new file is chosen).
- Busy state and tracing message again.
- No file picker opens.
- `lastFile` is reused (`handleFileChosen(lastFile)`).

4. Fix the underlying issue (network on, valid mock, smaller file) and **Try again** again.

**Expected:** successful analysis → **Save sky profile**.

---

## 7. Quick regression matrix

| Area | Pass? | Notes |
|------|-------|-------|
| Env + `npm run dev` | ☐ | |
| 401 without / bad Bearer | ☐ | |
| JPEG happy path + save | ☐ | |
| List on `/sky-profiles` | ☐ | |
| Selector on `/tonight` | ☐ | |
| Non-image / 20 MB / offline / 429 | ☐ | |
| iOS **Take photo** | ☐ | |
| **Try again** reuses file | ☐ | |

---

## Reference

- UI: `src/components/HorizonCapture.jsx`
- Client API: `src/lib/anthropic.js`
- Server: `server/analyzeHorizon.mjs`, `api/analyze-horizon.js`
- Capture page: `/sky-profiles` (`src/pages/SkyProfiles.jsx`)
- Consumer: `/tonight` sky profile `<select>` (`src/pages/Tonight.jsx`)
