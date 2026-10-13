// Verify: placeholder hidden on loaded imgs, mobile cart, single fav button (temporary).
const puppeteer = require('puppeteer-core');
const SHOTS = 'C:\\Users\\Ahmed.Osama\\AppData\\Local\\Temp\\opencode\\audit4\\';
const fs = require('fs');
fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 150)));
  const go = async (url, wait = 2500) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, wait));
  };
  await page.goto('http://localhost:4400/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  // Placeholder must be hidden wherever the photo loaded.
  await go('http://localhost:4400/products/karkadeh-hibiscus');
  console.log('placeholder-hidden-on-loaded:',
    await page.evaluate(() => {
      const icon = document.querySelector('.main-frame > .img-fallback');
      const img = document.querySelector('.main-frame > img');
      if (!icon || !img) return 'missing-elements';
      const cs = getComputedStyle(icon);
      return `display=${cs.display} natural=${img.naturalWidth}`;
    }));
  // Register + favorite + cart for mobile cart shot.
  await go('http://localhost:4400/auth/register');
  const email = `mob${Date.now()}@example.com`;
  await page.type('#name', 'Mob User');
  await page.type('#email', email);
  await page.evaluate(() => {
    const pw = document.querySelectorAll('p-password input');
    const set = (el, v) => { el.focus(); document.execCommand('selectAll', false, null); document.execCommand('insertText', false, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    if (pw[0]) set(pw[0], 'secret12');
    if (pw[1]) set(pw[1], 'secret12');
  });
  await page.evaluate(() => document.querySelector('.auth-card p-button button')?.click());
  await new Promise((r) => setTimeout(r, 2500));
  await go('http://localhost:4400/products/argan-oil');
  await page.evaluate(() => [...document.querySelectorAll('app-product-card')].length);
  await page.evaluate(() => { const h = [...document.querySelectorAll('button.fav-btn')][0]; if (h) h.click(); });
  await new Promise((r) => setTimeout(r, 1000));
  await page.evaluate(() => { const b = [...document.querySelectorAll('.cta p-button button')][0]; if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 1200));
  // Favorites: exactly one add button per card now.
  await go('http://localhost:4400/favorites');
  console.log('fav-add-buttons-per-card:',
    await page.evaluate(() => [...document.querySelectorAll('.grid > *')].map((c) => c.querySelectorAll('p-button').length).join(',')));
  await page.setViewport({ width: 390, height: 844 });
  await go('http://localhost:4400/cart');
  await page.screenshot({ path: SHOTS + 'cart-mobile.png' });
  // AR mobile cart.
  await page.evaluate(() => localStorage.setItem('novamart.lang', 'ar'));
  await go('http://localhost:4400/cart');
  await page.screenshot({ path: SHOTS + 'cart-mobile-ar.png' });
  console.log('PAGEERRORS(' + errors.length + '):', errors.slice(0, 5).join(' || '));
  await browser.close();
})().catch((e) => { console.error('PROBE FAILED:', e.message); process.exit(1); });
