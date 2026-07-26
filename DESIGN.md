# DESIGN.md — Pocketary

Marketing landing and in-app UI share one token system ([`frontend/src/styles/tokens.css`](frontend/src/styles/tokens.css)). This document describes **look, feel, and landing patterns** for AI agents and contributors. It follows the [DESIGN.md / Stitch](https://github.com/voltagent/awesome-design-md) shape.

---

## 1. Visual theme and atmosphere

**Mood:** NHS-adjacent consumer health — calm, plain English, trustworthy. The product helps people organise medicines and spot possible interactions; it does not diagnose or replace a pharmacist or GP.

**Philosophy:** Warm paper surfaces (subtle grain via [`texture.css`](frontend/src/styles/texture.css)), teal accents with accessible contrast, soft depth on cards. Marketing is **light-only** on `/`. In-app screens follow user theme.

**Avoid on marketing:** Alarmist red hero bands, dense clinical tables, emoji as icons, “AI purple” gradients, promises of medical certainty.

---

## 2. Color palette and roles

Use semantic CSS variables — do not hard-code hex in components.

| Role | Token | Use |
|------|--------|-----|
| Page background | `--app-bg` | Landing body, hero backdrop |
| Elevated surface | `--surface` | Cards, ghost buttons, FAQ panels |
| Sunk surface | `--surface-sunk` | Hover on ghost controls |
| Primary text | `--text` | Headlines, titles |
| Secondary text | `--muted` | Body, descriptions |
| Tertiary | `--faint` | Trust lines, captions |
| CTA fill | `--accent-solid` | Primary buttons (white text via `--on-accent`) |
| Links / ink accent | `--accent-ink`, `--brand-deep` | Eyebrow text, icons on tint |
| Tint | `--accent-tint` | Eyebrow pill, icon wells |
| Borders | `--hairline` | Cards, phone bezel |
| Shadows | `--elev-1`, `--elev-2` | Cards, primary CTAs |

**Contrast:** Never use `--accent` alone as a fill behind white text; use `--accent-solid` or darker (see tokens header comment).

---

## 3. Typography

| Level | Font | Landing scale |
|-------|------|----------------|
| Display / H1 | Lexend variable | `clamp(34px, 6.5vw, 52px)`, weight 700, `--lsp-display` |
| Section H2 | Lexend | ~22–26px, weight 700 |
| Card H3 | Lexend | 16px, weight 700 |
| Body | Lexend | 15–19px, line-height ~1.5–1.55 |
| Trust / caption | Lexend | 13–13.5px, `--faint` or `--muted` |

Accessible body copy may use Atkinson Hyperlegible where the app already does; landing defaults to Lexend for marketing cohesion.

---

## 4. Component styling (landing)

### Header
- Logo mark: 38px square, `--r-sm`, `--accent-solid` fill, capsule icon.
- Nav links: 15px, `--muted`, hover → `--text`.
- Header CTA: same as primary button, compact padding.

### Eyebrow pill
- Inline-flex, `--accent-tint` background, `--brand-deep` text, `--r-pill`, shield icon.

### Buttons
- **Primary:** `--accent-solid`, `--on-accent`, `--r-md`, `--elev-2`; hover darken ~12%; active scale 0.97.
- **Ghost:** `--surface`, `--hairline` border; hover `--surface-sunk`.
- All clickable controls: `cursor: pointer`; `:focus-visible` ring (see motion.css).

### Phone mock (scroll story)

- Scaled phone chrome (~320–360px wide), **one sticky device on desktop**; screenshot crossfades driven by **scroll chapter** (`IntersectionObserver`), not auto-timers.
- **Do not** add a separate horizontal “Inside the app” preview strip — the story phone is the only screenshot carousel.
- Decorative medic-themed float chips + soft background blobs; parallax via `--landing-parallax` (disabled when `prefers-reduced-motion`).
- Mobile: inline phone snapshot under each chapter; no sticky column.

### Privacy chapter

- Final scroll chapter at `#privacy`; condensed bullets + hackathon disclaimer (no long FAQ accordion on landing).

### Footer
- Small links, `--faint` / `--muted`; top border `--hairline`.

---

## 5. Layout principles

- Header max-width **1160px**; story grid **1160px** on wide screens.
- Horizontal padding: `clamp(20px, 5vw, 56px)` (header) / `44px` (main).
- **Scroll story from ~900px:** narrative column + **sticky phone**; chapters `min-height ~85vh`; stack on small screens.
- Spacing scale: `--s1` … `--s7` from tokens.

---

## 6. Depth and elevation

- Cards and phone: `--elev-1` default, `--elev-2` on hover or primary CTAs.
- Floating decor chips: lower opacity, `--elev-2`, slight blur optional; must not harm text contrast.

---

## 7. Do's and don'ts

**Do**
- Use [`Icon`](frontend/src/components/Icon.tsx) (SVG), not emoji.
- Keep copy honest about demo/hackathon scope in the **privacy chapter** and footer.
- Respect `prefers-reduced-motion` (disable parallax, instant screen swaps, no smooth scroll from dots).
- Repeat primary CTA in header and bottom band.

**Don't**
- Claim diagnosis or guaranteed safety outcomes.
- Introduce a second accent palette on landing.
- Force dark mode on the marketing page.

---

## 8. Responsive behavior

| Breakpoint | Behavior |
|------------|----------|
| 375px | Single column; full-width CTAs; nav text links hidden; inline phone under each chapter |
| 900px+ | Sticky phone + scroll-linked screen changes |

Touch targets: minimum ~44px height on primary actions.

---

## 9. Agent prompt guide

> Build or extend the **landing page only** at `/` using this DESIGN.md and `frontend/src/styles/tokens.css`. Keep existing hero headline and feature copy unless asked. Use light theme on landing. Pattern: **one scroll story** — intro with CTAs, chapters (NHS connect → cabinet → interactions → share → privacy), sticky phone whose screen follows the active chapter, subtle parallax blobs, CTA band, footer. No duplicate screenshot carousels or FAQ wall. Healthcare trust tone — calm teal, plain English, accessible contrast, SVG icons, visible focus rings, no medical overclaims.

**Quick colors:** background `#F7F7F4`, CTA `#028090`, text `#1A1A17`, muted `#5C5C56`.
