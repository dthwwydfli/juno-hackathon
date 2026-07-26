# Deploy frontend (Vercel) + laptop API for phone barcode scan

The scanner runs entirely in the browser (`getUserMedia` + ZXing). Vercel hosts the **HTTPS** frontend; the **FastAPI** backend stays on your laptop (or any host) with a URL your phone can reach.

**Default hackathon path — no Supabase.** For hosting choices (laptop + tunnel vs cloud API on Render/Fly/Railway), see [hosting-and-data.md](hosting-and-data.md).

## 1. Backend on your laptop

From `backend/`:

```bash
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir .
```

Update `.env`:

| Variable | Example |
|----------|---------|
| `PUBLIC_BASE_URL` | `https://abc123.ngrok-free.app` or `http://192.168.1.42:8000` |
| `CORS_ORIGINS` | `http://localhost:5173,https://your-app.vercel.app` |

**Phone cannot use `localhost`.** Pick one:

- **Same Wi‑Fi, no Vercel:** run `npm run dev -- --host` and open `http://<laptop-LAN-IP>:5173` on the phone with `VITE_API_BASE_URL=http://<laptop-LAN-IP>:8000` in `frontend/.env` (both HTTP — OK on LAN).
- **Vercel (HTTPS) + laptop API:** browsers **block** `fetch()` from `https://*.vercel.app` to `http://192.168.x.x` (mixed content). Use an **HTTPS** tunnel and set `VITE_API_BASE_URL` to that URL in Vercel → Settings → Environment Variables, then redeploy.
- **Any network:** expose port 8000 with [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or [ngrok](https://ngrok.com/) and use the `https://…` URL for `PUBLIC_BASE_URL` and `VITE_API_BASE_URL`.

**GP share QR:** encodes `https://your-app.vercel.app/gp/<token>`. That page loads the PDF from `VITE_API_BASE_URL`. `VITE_PUBLIC_PDF_ORIGIN` is optional (direct API PDF download in the patient app only).

`/?gp=<token>` still works — an inline script in `index.html` rewrites it to `/gp/<token>` — but it is a legacy fallback for links already handed out. Do not go back to generating it: `/` is answered from the service worker's precache, so a phone holding an older bundle renders the landing page instead of the summary. `/gp/` is on the `navigateFallbackDenylist` in `frontend/vite.config.ts` and always resolves over the network.

**This repo’s production frontend:** https://pocketary.vercel.app (add `https://pocketary.vercel.app` to backend `CORS_ORIGINS`).

### HTTPS tunnel choice

| Tool | Use for Vercel demo? |
|------|----------------------|
| **ngrok** or **Cloudflare Tunnel** | **Yes** — stable URL, no browser gate on API `fetch()` |
| **localtunnel** (`*.loca.lt`) | **Dev only** — may return HTTP **511** (“Network Authentication Required”) until each user unlocks the tunnel in a browser tab. The app sends `Bypass-Tunnel-Reminder` automatically, but judges on new networks may still hit limits. Prefer ngrok for demos. |

Quick tunnel (**recommended for demos** — ngrok):

```bash
ngrok http 8000
```

Copy the `https://….ngrok-free.app` URL into `VITE_API_BASE_URL`, `PUBLIC_BASE_URL`, and redeploy Vercel.

localtunnel (quick hack, not for demos):

```bash
./scripts/run_https_tunnel.sh
```

After the URL prints, update Vercel env vars and redeploy. If you see **511** errors on pocketary.vercel.app, open `https://<your-subdomain>.loca.lt/health` once in a browser on that device, or switch to ngrok.

Remove duplicate ngrok section below if any — I replaced the old block.


## 2. Vercel frontend

1. Import the repo in Vercel; set **Root Directory** to `frontend`.
2. **Environment variables** (Production + Preview):

   | Name | Value |
   |------|--------|
   | `VITE_API_BASE_URL` | Same reachable API URL as above (no trailing slash) |
   | `VITE_USER_ID` | `demo` (or your demo user) |
   | `VITE_PUBLIC_APP_ORIGIN` | Optional; `https://pocketary.vercel.app` if you need prod QR links from local dev |
   | `VITE_PUBLIC_PDF_ORIGIN` | Optional; same as API URL if you want explicit PDF download host |

3. Deploy. After changing `VITE_*` vars, trigger a **redeploy** (they are baked in at build time).

CLI (optional):

```bash
cd frontend
npx vercel --prod
```

## 3. Phone smoke test

1. On the phone, open `https://<API>/health` — expect JSON with `"status":"ok"` and `"dmd_ready":true`.
2. Open your Vercel app URL in **Safari** or **Chrome** (not an in-app browser).
3. **Add** → **Camera** → **Request camera access** → point at a pack **barcode** (EAN/GTIN).
4. If lookup fails, use **Manual** → enter GTIN → **Lookup**.
5. **Share** → QR: scan should open `https://your-app.vercel.app/gp/…` (then GP summary; API + tunnel must be running).

Optional: **Add to Home Screen** for standalone PWA (see `vite.config.ts` manifest).

## 4. Scanner UX (app)

- Rear camera is the default (`facingMode: environment`).
- On the scan screen, the header shows **Rear** or **Front**; **Switch camera** appears only when the device exposes more than one camera. **Torch** when supported.
- The on-screen **frame is visual guidance only** — ZXing scans the **full camera view**, same as backend [`/dev/scan`](/dev/scan). The bottom card shows **API connection** (`GET /health` on open) and **dm+d** readiness before a barcode is read; after decode it calls `POST /lookup/barcode`.
- **API smoke test without camera:** **Add** → **Manual** → enter a GTIN → **Lookup** (same API as scan). If that works but live scan stays on “Scanning…”, fix lighting/focus/camera — not the tunnel.

### End-to-end smoke (Vercel + tunnel)

1. Phone: open `https://<tunnel>/health` — `"status":"ok"`, `"dmd_ready":true`.
2. Open the Vercel app → **Add** → scan screen: bottom card should show the API host under “Scanning…” (or a reachability error if the tunnel is down).
3. **Manual** GTIN **Lookup** on the same app URL.
4. **Camera** scan on a real pack barcode → **Looking up…** → **Match found**.

### Scan feels slow?

Two phases use different systems:

| Bottom card | Phase | If this is slow |
|-------------|--------|------------------|
| **Scanning…** (spinner) | Camera + ZXing decode | Lighting, focus, rear camera; not the API |
| **Looking up…** | `POST /lookup/barcode` via tunnel | Tunnel RTT (ngrok/Cloudflare vs localtunnel), laptop awake, `VITE_API_BASE_URL` |

**Manual Lookup** (no camera) measures lookup/tunnel only. If manual is fast but **Scanning…** is slow, tune the camera/barcode; if **Looking up…** is slow, tune the tunnel/hosting. Backend [`/dev/scan`](/dev/scan) on localhost feels instant because lookup skips the tunnel.
