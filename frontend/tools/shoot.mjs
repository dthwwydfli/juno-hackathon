// Screenshot the running dev server at phone width, light + dark.
// Usage: node tools/shoot.mjs <route> <outBaseName> [theme=both] [baseUrl]
//   node tools/shoot.mjs /home home            -> shots/home-light.png + home-dark.png
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
const themes = themeArg === 'both' ? ['light', 'dark'] : [themeArg];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
try {
  for (const theme of themes) {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
    await page.setViewport({ width: 402, height: 874, deviceScaleFactor: 2 });
    await page.goto(baseUrl + route, { waitUntil: 'networkidle0' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await new Promise((r) => setTimeout(r, 350));
    const out = `${OUT_DIR}/${base}-${theme}.png`;
    await page.screenshot({ path: out });
    console.log('wrote', out);
    await page.close();
  }
} finally {
  await browser.close();
}
