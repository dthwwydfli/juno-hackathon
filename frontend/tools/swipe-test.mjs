// Verify WhatsApp-style swipe-to-archive on a Private/OTC med row.
import puppeteer from 'puppeteer';

// Must match STORAGE_KEY in src/data/store.tsx — a stale key silently made every
// persistence assertion below vacuously pass.
const STORAGE_KEY = 'piyp:state:v4';
const BASE = 'http://localhost:5173';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 402, height: 874, deviceScaleFactor: 2 });

await page.goto(BASE + '/home', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '/home', { waitUntil: 'networkidle0' });

// switch to the Private tab (Vitamin D)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.segment button')].find(b => /Private/.test(b.textContent || ''));
  btn?.click();
});
await new Promise(r => setTimeout(r, 200));

const beforeText = await page.evaluate(() => document.querySelector('.home-list')?.textContent || '');

// drag the row left to reveal Archive
const box = await page.evaluate(() => {
  const el = document.querySelector('.swipe-front');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
if (!box) { console.log(JSON.stringify({ error: 'no .swipe-front (Private row not swipeable?)' })); await browser.close(); process.exit(1); }

const startX = box.x + box.w - 40, y = box.y + box.h / 2;
await page.mouse.move(startX, y);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(startX - i * 10, y);
await page.mouse.up();
await new Promise(r => setTimeout(r, 300));

const actionVisible = await page.evaluate(() => {
  const a = document.querySelector('.swipe-action');
  if (!a) return false;
  const r = a.getBoundingClientRect();
  const front = document.querySelector('.swipe-front');
  const fr = front.getBoundingClientRect();
  // action is "revealed" if the front has shifted left past it
  return fr.right < r.right + 5 && /Archive/.test(a.textContent || '');
});

await page.screenshot({ path: 'shots/v2-swipe-open.png' });

// click Archive
await page.evaluate(() => document.querySelector('.swipe-action')?.click());
await new Promise(r => setTimeout(r, 300));

const afterText = await page.evaluate(() => document.querySelector('.home-list')?.textContent || '');
const persisted = await page.evaluate((k) => localStorage.getItem(k) || '', STORAGE_KEY);
const vitaminArchived = /"id":"vitamin-d"[^}]*"status":"archived"|"status":"archived"[^}]*"id":"vitamin-d"/.test(persisted.replace(/\s/g, ''));

console.log(JSON.stringify({
  hadVitaminBefore: /Vitamin D/.test(beforeText),
  actionRevealedOnSwipe: actionVisible,
  vitaminGoneAfterArchive: !/Vitamin D/.test(afterText),
  // The strict pairing, not `/vitamin-d/ && /archived/` — that loose form
  // passes whenever *any* medication in the store is archived.
  vitaminArchivedInStore: vitaminArchived,
}, null, 2));
await browser.close();
