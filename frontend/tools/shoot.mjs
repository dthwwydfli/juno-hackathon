// Screenshot the running dev server at phone width, light + dark.
// Usage: node tools/shoot.mjs <route> <outBaseName> [theme=both] [baseUrl] [width] [height]
//   node tools/shoot.mjs /home home            -> shots/home-light.png + home-dark.png
//   node tools/shoot.mjs /home mobile375 both http://localhost:5173 375 812
// Landing marketing PNGs: shoot key routes as v5-*-light (captures .phone only), then:
//   cp shots/v5-home-light.png shots/v5-ix-light.png shots/v5-share-light.png \
//      shots/v5-nhs-light.png shots/v5-add-light.png public/landing/
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../shots');
mkdirSync(OUT_DIR, { recursive: true });

const route = process.argv[2] || '/';
const base = process.argv[3] || 'shot';
const themeArg = process.argv[4] || 'both';
const baseUrl = process.argv[5] || 'http://localhost:5173';
const vpW = Number(process.argv[6]) || 402;
const vpH = Number(process.argv[7]) || 874;
const themes = themeArg === 'both' ? ['light', 'dark'] : [themeArg];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
try {
  for (const theme of themes) {
    const page = await browser.newPage();
    // Reduced motion is what makes these shots deterministic now that Motion is
    // involved. document.getAnimations() only sees WAAPI animations — Motion's
    // layout projection and MotionValue-driven styles run on the JS thread and
    // are invisible to it, so finish() alone would leave them mid-flight.
    // With MotionConfig reducedMotion="user" in main.tsx, this resolves every
    // transform instantly, and the CSS guard already zeroes the CSS side.
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: theme },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);
    await page.setViewport({ width: vpW, height: vpH, deviceScaleFactor: 2 });
    await page.goto(baseUrl + route, { waitUntil: 'networkidle0' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    // Wait for the self-hosted webfonts, otherwise the two themes can be shot
    // with different faces (system stack vs Lexend) and look falsely different.
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 350));
    // Entry animations are staggered up to ~400ms; jump them all to their end
    // state so a shot is never caught mid-blur.
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
    await new Promise((r) => setTimeout(r, 80));
    // Above --layout-mobile-max (480px) the frame is a fixed 390×844 device; below
    // that, .phone goes full-bleed to the viewport — wrong for landing mockups.
    let phone = await page.$('.phone');
    if (phone && vpW <= 480) {
      await page.setViewport({ width: 520, height: vpH, deviceScaleFactor: 2 });
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.evaluate(() => document.fonts.ready);
      await new Promise((r) => setTimeout(r, 200));
      await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
      await new Promise((r) => setTimeout(r, 80));
      phone = await page.$('.phone');
    }
    const out = `${OUT_DIR}/${base}-${theme}.png`;
    if (phone) {
      await phone.screenshot({ path: out });
    } else {
      await page.screenshot({ path: out });
    }
    console.log('wrote', out, phone ? '(.phone)' : '(viewport)');
    await page.close();
  }
} finally {
  await browser.close();
}
