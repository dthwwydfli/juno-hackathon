# Deploy frontend (Vercel) + laptop API for phone barcode scan

The scanner runs entirely in the browser (`getUserMedia` + ZXing). Vercel hosts the **HTTPS** frontend; the **FastAPI** backend stays on your laptop (or any host) with a URL your phone can reach.

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
- **Any network:** expose port 8000 with [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or [ngrok](https://ngrok.com/) and use the `https://…` URL for `PUBLIC_BASE_URL`, `VITE_API_BASE_URL`, and `VITE_PUBLIC_PDF_ORIGIN`.

**This repo’s production frontend:** https://pocketary.vercel.app (add `https://pocketary.vercel.app` to backend `CORS_ORIGINS`).

Quick tunnel (ngrok):

```bash
ngrok http 8000
```

## 2. Vercel frontend

1. Import the repo in Vercel; set **Root Directory** to `frontend`.
2. **Environment variables** (Production + Preview):

   | Name | Value |
   |------|--------|
   | `VITE_API_BASE_URL` | Same reachable API URL as above (no trailing slash) |
   | `VITE_PUBLIC_PDF_ORIGIN` | Same as API URL if GP QR should open PDFs from the API host |
   | `VITE_USER_ID` | `demo` (or your demo user) |

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

Optional: **Add to Home Screen** for standalone PWA (see `vite.config.ts` manifest).

## 4. Scanner UX (app)

- Rear camera is the default (`facingMode: environment`).
- On the scan screen, the header shows **Rear** or **Front**; **Switch camera** appears only when the device exposes more than one camera. **Torch** when supported.
