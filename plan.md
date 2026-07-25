# Medication safety app — Product requirements & backend specification

## 1. Problem statement

Many people take a mix of **NHS prescriptions**, **over-the-counter (OTC)** medicines, and **online-purchased** products (including supplements and peptides). Harmful **drug–drug** and **drug–supplement** interactions are often unknown to the patient until a clinician notices them.

This product helps users build an accurate personal medicine list from **official NHS dm+d** identifiers (via packaging barcodes), surfaces **interaction warnings** with plain-language summaries, and gives GPs a **quick handoff** via QR code to a structured PDF summary—including medicines the user no longer takes but used to.

## 2. Target users

| Persona | Need |
|---------|------|
| Patient / carer | Scan packs, log dose and timing, see warnings |
| GP / pharmacist | Scan patient QR, read current and historical meds without relying on patient memory |

## 3. Product journeys

### 3.1 Add a medicine

1. User scans barcode (GTIN or dm+d-related code on pack).
2. App resolves product via **NHS dm+d** (local database built from TRUD).
3. User enters dosage, time(s) taken, start date, and category: `nhs_prescription`, `otc`, or `online`.
4. Medicine is stored in the personal cabinet.

### 3.2 Interaction warning

1. When the cabinet changes (or on demand), the system compares **active** medicines pairwise.
2. Evidence is gathered from **MedData** (primary), **[Supp.AI](https://supp.ai/)** (supplements / gap-fill), and **OpenFDA** label text.
3. A **deterministic summary**, severity, and stable `interaction_id` are stored for a “read more” view.
4. Full detail page includes source excerpts and: **Discuss with a medical professional.**

### 3.3 GP visit

1. User generates a **time-limited share token** and QR code pointing to a PDF URL.
2. Clinician scans QR and receives a PDF: active meds (dose, schedule, category, start date), **archived** meds (start/end), optional interaction highlights, disclaimers.

## 4. Safety and compliance posture (hackathon)

- All API responses and PDFs include: *This information is for awareness only and is not medical advice. Discuss with a pharmacist or GP.*
- Not a medical device; not for emergency decisions.
- US FDA label evidence may not match UK products exactly—surface that limitation in interaction detail.

## 5. Scope

### In scope (backend v1)

- FastAPI REST API
- TRUD dm+d ingest → SQLite lookup by GTIN / pack / product codes
- Medicine cabinet CRUD with archive
- Interaction check + persisted detail records
- GP token + PDF generation
- Dev pages: camera barcode scan, GP QR preview

### Out of scope (v1)

- Production auth (demo `X-User-Id` header)
- Main consumer frontend (separate team)
- Medscape or other paid interaction APIs
- NHS Terminology Server FHIR (future cross-check only)

## 6. Backend architecture

```
juno-hackathon/
  plan.md
  backend/
    app/           # FastAPI application
    scripts/       # ingest, sample DB builder
    data/          # SQLite files (gitignored except sample)
    tests/
```

**Data stores**

- `dmd.sqlite` — read-only dm+d from TRUD
- `app.sqlite` — users’ medicines, interaction records, GP tokens

**External services**

- TRUD (dm+d release download)
- [MedData](https://meddata.anthesia.io) unified interaction checks (RxNorm / FDA / NIH ODS)
- [Supp.AI](https://supp.ai/) literature evidence for supplement–drug pairs (Semantic Scholar dataset license)
- OpenFDA drug label API

See [backend/README.md](backend/README.md) for setup, environment variables, and curl examples.

## 7. API summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| POST | `/lookup/barcode` | Resolve GTIN / pack / product code |
| POST | `/medications` | Add medicine |
| GET | `/medications` | List (active / archived / all) |
| PATCH | `/medications/{id}` | Update or archive |
| DELETE | `/medications/{id}` | Remove |
| POST | `/interactions/check` | Run interaction check |
| GET | `/interactions/{id}` | Full interaction detail |
| POST | `/gp/share-token` | Create GP share token + QR URL |
| POST | `/gp/demo-share` | Seed demo cabinet + share token (`X-User-Id: demo` only) |
| GET | `/gp/summary/{token}.pdf` | PDF for clinician |
| GET | `/gp/summary/{token}` | JSON summary (debug) |
| GET | `/dev/scan` | Dev barcode scanner page |
| GET | `/dev/qr` | Dev GP QR page |

**Headers:** `X-User-Id` (default `demo`) for cabinet-scoped routes.

## 8. Known limitations

| Limitation | Mitigation |
|------------|------------|
| TRUD registration delay | Bundled `dmd.sample.sqlite` for demos |
| UK vs US drug naming | Label interaction evidence flagged as US-sourced |
| Stale supplement corpora | Supp.AI used as secondary evidence; disclaimers on every output |

## 9. Implementation phases

1. Scaffold + dm+d lookup  
2. Medicine cabinet  
3. Interactions (MedData + Supp.AI + OpenFDA)  
4. GP PDF + QR  
5. Dev harness  

Detailed task tracking lives in the project plan file (Cursor); this document is the stakeholder-facing PRD.
