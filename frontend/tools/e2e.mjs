// End-to-end check: add a medication via the real form, confirm it persists and reaches Home.
import puppeteer from 'puppeteer';
const BASE = 'http://localhost:5173';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 402, height: 874, deviceScaleFactor: 2 });

// start clean
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());

// go to Add
await page.goto(BASE + '/add', { waitUntil: 'networkidle0' });

// type into the first two text inputs (medication name, brand) + dose
const inputs = await page.$$('input.text-input, input[type="text"], input:not([type])');
async function typeInto(placeholderIncludes, value) {
  const handles = await page.$$('input');
  for (const h of handles) {
    const ph = await (await h.getProperty('placeholder')).jsonValue();
    if (ph && String(ph).toLowerCase().includes(placeholderIncludes)) { await h.click({ clickCount: 3 }); await h.type(value); return true; }
  }
  return false;
}
const okName = await typeInto('atorvastatin', 'Paracetamol'); // MEDICATION NAME placeholder "e.g. Atorvastatin"
const okBrand = await typeInto('lipitor', 'Panadol');          // BRAND NAME placeholder "Lipitor"
const okDose = await typeInto('mg', '500 mg');                 // Dose placeholder "mg"

// click Save medication
await new Promise(r => setTimeout(r, 200));
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /save medication/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
await new Promise(r => setTimeout(r, 700));
const urlAfterSave = page.url();

// read persisted state
const persisted = await page.evaluate(() => localStorage.getItem('piyp:state:v2'));
const hasParacetamol = persisted ? persisted.includes('Paracetamol') : false;

// reload to prove persistence, then check Home renders it
await page.goto(BASE + '/home', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 300));
const onHome = await page.evaluate(() => document.body.innerText.includes('Paracetamol'));

console.log(JSON.stringify({ okName, okBrand, okDose, clicked, urlAfterSave, hasParacetamol, onHomeAfterReload: onHome }, null, 2));
await browser.close();
