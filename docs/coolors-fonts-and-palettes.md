# Coolors fonts and palettes for Juno

Curated typography and color recommendations for the medication safety app ([plan.md](../plan.md)). Sourced from [Coolors Fonts](https://coolors.co/fonts) and [Coolors Trending Palettes](https://coolors.co/palettes/trending), with teal/medical discovery on [Medical](https://coolors.co/palettes/popular/medical) and [Trending Teal](https://coolors.co/palettes/trending/teal).

**How to use this doc:** Reference for design decisions only. No code changes are required unless you pick a font or palette and ask to wire it into the frontend.

---

## Current Juno baseline

Values from [frontend/src/styles/tokens.css](../frontend/src/styles/tokens.css) and [frontend/src/styles/base.css](../frontend/src/styles/base.css).

| Role | Current value |
|------|---------------|
| Accent (teal) | `#12A594` |
| Accent ink | `#0B6E62` |
| Accent tint | `#E7F5F2` |
| App background | `#F7F7F4` |
| Page background | `#E8E7E2` |
| Text | `#1A1A17` |
| Muted / faint | `#6B6B63` / `#9A998F` |
| NHS blue | `#005EB8` |
| Interaction amber | `#C7791F` (single amber on interaction surfaces) |
| Warning red | `#E5544B` |
| Typography | `-apple-system`, `SF Pro Text`, `Segoe UI`, Roboto, … |

**Design goal:** Calm trust (not alarmist), high legibility for drug names and doses, usable across ages—from patients and carers to GPs scanning a summary—without feeling like a hospital chart or a wellness influencer brand.

---

## Top 3 fonts (Coolors catalog)

All fonts below are available on Coolors (Google Fonts, free for app use). Detail pages verified July 2026.

| Rank | Font | Coolors | One-line fit |
|------|------|---------|--------------|
| **1 (recommended)** | Lexend | [coolors.co/font/lexend](https://coolors.co/font/lexend) | Lower reading effort for long lists and interaction copy |
| **2** | Atkinson Hyperlegible | [coolors.co/font/atkinson-hyperlegible](https://coolors.co/font/atkinson-hyperlegible) | Clear letter shapes; fewer misreads on doses and similar names |
| **3** | DM Sans | [coolors.co/font/dm-sans](https://coolors.co/font/dm-sans) | Warm, competent UI sans for a branded but approachable feel |

### 1. Lexend (recommended)

**Psychology:** Lexend was developed to improve reading proficiency and reduce visual stress. Users perceive the app as **effortless to read**, which lowers anxiety when reviewing medications or warnings—not “marketing slick,” not “clinical cold.”

**Best in Juno:** Home cabinet lists, interaction summaries, Add flow labels, share/PDF-related UI copy.

**Trade-offs:** Slightly softer personality than pure system UI fonts; adds a webfont download (mitigate with `font-display: swap` and limited weights).

```css
font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

### 2. Atkinson Hyperlegible

**Psychology:** From the Braille Institute; emphasizes **distinct characters** (e.g. `I` / `l` / `1`, `O` / `0`). Signals care and inclusivity—important when misreading a dose has real consequences.

**Best in Juno:** Dosage fields, time pickers, GTIN/barcode rows, any dense alphanumeric strings.

**Trade-offs:** More “accessibility-forward” visually than Lexend; pair with Lexend for body if you want hierarchy (Atkinson for numeric-heavy rows only).

```css
font-family: "Atkinson Hyperlegible", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### 3. DM Sans

**Psychology:** Low-contrast geometric sans with gentle curves reads as **approachable and competent**—common in health and wellness products without triggering “hospital” or “pharma ad” associations.

**Best in Juno:** Full-app UI if you want a single branded face with less research-lab association than Lexend/Atkinson.

**Trade-offs:** Less optimized for reading science than Lexend; less character distinction than Atkinson.

```css
font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### Not in the top 3

- **Inter** — [coolors.co/font/inter](https://coolors.co/font/inter): Excellent UI font; your system stack already approximates it. Switching adds load for modest gain.
- **Source Sans 3** — [coolors.co/font/source-sans-3](https://coolors.co/font/source-sans-3): Strong for documents; feels more institutional than a pocket cabinet app needs.

---

## Top 3 palettes (Coolors trending / teal)

Current accent `#12A594` sits near **Turquoise Harmony** mid-teals (`#00A896`, `#02C39A`)—evolution, not a full rebrand.

| Rank | Palette | Coolors | Swatches |
|------|---------|---------|----------|
| **1 (recommended)** | Turquoise Harmony | [palette link](https://coolors.co/palette/05668d-028090-00a896-02c39a-f0f3bd) | `#05668D` `#028090` `#00A896` `#02C39A` `#F0F3BD` |
| **2** | Earthy Green | [palette link](https://coolors.co/palette/cad2c5-84a98c-52796f-354f52-2f3e46) | `#CAD2C5` `#84A98C` `#52796F` `#354F52` `#2F3E46` |
| **3** | Fresh Greens | [palette link](https://coolors.co/palette/386641-6a994e-a7c957-f2e8cf-bc4749) | `#386641` `#6A994E` `#A7C957` `#F2E8CF` `#BC4749` |

### 1. Turquoise Harmony (recommended)

**Mood:** Fresh, clean, “health without hospital beige”—trending teal family on Coolors (~22K saves).

**Keep your green, improve it**

| Token | Today | Suggested (minimal migration) | Notes |
|-------|-------|-------------------------------|--------|
| `--accent` | `#12A594` | `#12A594` *or* `#00A896` | Keep current if you love it; `#00A896` aligns with palette center |
| `--accent-ink` | `#0B6E62` | `#05668D` | Deeper teal improves contrast on white CTAs and links |
| `--accent-tint` | `#E7F5F2` | `#E7F5F2` *or* `#F0F3BD` | Optional warmer highlight wash from palette cream |
| `--app-bg` / `--page-bg` | warm neutrals | **unchanged** | Warm `#F7F7F4` / `#E8E7E2` balance cool teals |
| `--warn`, `--amber`, `--nhs` | fixed semantics | **unchanged** | Do not merge warning red into palette greens |

**Optional tile alignment:** `--tile-a` / `--tile-a-ink` can track `--accent-tint` / `--accent` as today.

### 2. Earthy Green

**Mood:** Sage and forest—calmer, more organic, less “fintech teal.”

**Juno mapping (if you want a softer cabinet)**

| Token | Suggested |
|-------|-----------|
| `--accent` | `#52796F` or `#84A98C` |
| `--accent-ink` | `#354F52` or `#2F3E46` |
| `--accent-tint` | `#CAD2C5` |
| `--app-bg` | Keep `#F7F7F4` (pairs well with sage) |

**Trade-off:** Less vibrant scan-success moments; may feel quieter on barcode/Add flows that rely on teal energy today.

### 3. Fresh Greens

**Mood:** Natural vitality; clearer **primary vs secondary** green steps.

**Juno mapping**

| Token | Suggested |
|-------|-----------|
| `--accent` | `#6A994E` |
| `--accent-ink` | `#386641` |
| `--accent-tint` | `#F2E8CF` (cream) or light tint of `#A7C957` |
| Highlights / secondary chips | `#A7C957` |
| `--warn` | Keep `#E5544B`; palette `#BC4749` is optional harmonized alternative only |

**Trade-off:** Moves away from teal toward “garden green”; still health-adjacent but less aligned with current `#12A594` identity.

### Alternate: NHS harmony (Ocean Breeze family)

If NHS connection screens should feel more “official blue” while the cabinet stays teal, use Coolors blues as **secondary** accents only (not replacing `--accent`):

- `#0077B6`, `#00B4D8`, `#90E0EF`, `#CAF0F8` (see trending blue-teal palettes on Coolors)

Keep `--nhs: #005EB8` for brand alignment with NHS UI where required.

---

## Combined recommendation (lowest migration risk)

| Choice | Pick |
|--------|------|
| **Font** | **Lexend** — best balance of reading ease for all users |
| **Palette** | **Turquoise Harmony** — refine `--accent-ink` to `#05668D`; optionally nudge `--accent` to `#00A896` |
| **Keep** | Warm app/page neutrals, system font fallbacks, existing warn/amber/NHS tokens |

Before changing tokens, run pairs through [Coolors Contrast Checker](https://coolors.co/contrast-checker):

- Body: `--text` (`#1A1A17`) on `--surface` (`#FFFFFF`)
- CTA: white on `--accent`
- Links: `--accent-ink` on `--surface`

---

## Optional next steps (implementation)

Only if you approve a direction:

1. **Font:** Add Google Fonts link in [frontend/index.html](../frontend/index.html); set `body` in [frontend/src/styles/base.css](../frontend/src/styles/base.css).
2. **Colors:** Update `:root` / `[data-theme]` blocks in [frontend/src/styles/tokens.css](../frontend/src/styles/tokens.css).
3. **PWA:** If accent shifts, align `theme_color` in [frontend/vite.config.ts](../frontend/vite.config.ts) (today includes `#12A594`).

Related UI references: [mobbin-inspirations.md](./mobbin-inspirations.md).
