// usage: node capture.cjs <prototype dir containing index.html> <out dir>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const [, , protoDir, outDir] = process.argv;
const url = 'file://' + path.resolve(protoDir, 'index.html');
fs.mkdirSync(outDir, { recursive: true });

const SCREENS = ['home', 'input', 'summary', 'lab', 'detail', 'history', 'guide'];
const LABEL = { home: '01-home', input: '02-input', summary: '03-summary', lab: '04-lab', detail: '05-detail', history: '06-history', guide: '07-guide' };

const FULL_CSS = '.top{position:static!important}.bottom{position:static!important;transform:none!important;margin:0 auto}';
async function full(page, file) { const h = await page.addStyleTag({ content: FULL_CSS }); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: file, fullPage: true }); await h.evaluate((n) => n.remove()); }
async function show(page, id) {
  await page.evaluate((id) => { window.show(id); }, id);
  await page.waitForTimeout(150);
}

// 画面内の計測：横はみ出し、12px未満の文字、44px未満の操作要素、コントラスト
async function measure(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const active = document.querySelector('.screen.active');
    const scope = [active, document.querySelector('.top'), document.querySelector('.bottom'), document.querySelector('.foot')].filter(Boolean);
    const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const all = scope.flatMap((s) => [s, ...s.querySelectorAll('*')]).filter(visible);
    const overflow = all.filter((el) => el.getBoundingClientRect().right > vw + 0.5).map((el) => el.tagName + '.' + el.className + ' right=' + Math.round(el.getBoundingClientRect().right));
    const textNodes = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const small = textNodes.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12).map((el) => getComputedStyle(el).fontSize + ' ' + el.textContent.trim().slice(0, 24));
    const interactive = all.filter((el) => el.matches('button, a, input, select, summary'));
    const tapSmall = interactive.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((el) => { const r = el.getBoundingClientRect(); return `${el.tagName} ${Math.round(r.width)}x${Math.round(r.height)} ${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20)}`; });
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none' && e.classList.contains('hero')) return 'image'; const c = parse(cs.backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
    const lowContrast = [];
    for (const el of textNodes) {
      const cs = getComputedStyle(el); const fg = parse(cs.color); const bg = bgOf(el);
      if (!fg || bg === 'image') continue;
      const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight) >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      if (ratio < need) lowContrast.push(`${ratio.toFixed(2)} (<${need}) ${size}px ${el.textContent.trim().slice(0, 24)}`);
    }
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw, horizontalScroll: document.documentElement.scrollWidth > vw, overflow, small, tapSmall, lowContrast };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const report = { url, widths: {}, flow: [], focus: [], console: [] };

  // 390px：全画面と主要状態
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ja-JP' });
  const page = await ctx.newPage();
  page.on('console', (m) => report.console.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => report.console.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => report.console.push('requestfailed: ' + r.url()));
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  report.widths[390] = {};
  for (const s of SCREENS) {
    await show(page, s);
    await full(page, `${outDir}/${LABEL[s]}-390.png`);
    report.widths[390][s] = await measure(page);
  }
  // ファーストビュー（スクロールなし）
  for (const s of ['home', 'summary', 'lab']) {
    await show(page, s);
    await page.screenshot({ path: `${outDir}/${LABEL[s]}-390-firstview.png` });
  }

  // 操作の通し：クリックで遷移できるか
  const step = async (name, fn, expect) => {
    try { await fn(); await page.waitForTimeout(150); const id = await page.evaluate(() => document.querySelector('.screen.active')?.id); const nav = await page.evaluate(() => document.querySelector('.navbtn.on')?.dataset.target || null); report.flow.push({ name, ok: id === expect, active: id, navHighlighted: nav }); } catch (e) { report.flow.push({ name, ok: false, error: e.message }); }
  };
  await show(page, 'home');
  await step('ホームのCTA → 条件入力', () => page.locator('#home .btn').first().click(), 'input');
  await page.locator('#input .choice', { hasText: '単身' }).click();
  await full(page, `${outDir}/02-input-390-state-selected.png`);
  await step('条件入力「戻る」→ ホーム', () => page.locator('#input .btn.secondary').click(), 'home');
  await show(page, 'input');
  await step('条件入力「次へ」→ サマリー', () => page.locator('#input .btn').last().click(), 'summary');
  await step('サマリー → もしもラボ', () => page.locator('#summary .btn.secondary').click(), 'lab');
  const slider = page.locator('#lab input[type=range]');
  await slider.fill('50');
  await full(page, `${outDir}/04-lab-390-state-age50.png`);
  report.sliderAge50 = await page.evaluate(() => ({ label: document.getElementById('ageout')?.textContent, amount: document.getElementById('labAmount')?.textContent, valuetext: document.getElementById('ageSlider')?.getAttribute('aria-valuetext') }));
  const rows = page.locator('#scenarioList > *');
  const n = await rows.count();
  report.scenarioRows = n;
  for (let i = 0; i < n; i++) {
    await show(page, 'lab');
    await step(`シナリオ${i + 1} → 詳細`, () => rows.nth(i).click(), 'detail');
    if (i === 0 || i === n - 1) {
      await full(page, `${outDir}/05-detail-390-scenario${i + 1}.png`);
    }
    if (i === 0) {
      const d = page.locator('#detail details').first();
      if (await d.count()) { await d.locator('summary').click(); await full(page, `${outDir}/05-detail-390-state-premises-open.png`); }
    }
  }
  const death = page.locator('#lab [data-death-detail]');
  if (await death.count()) {
    await show(page, 'lab');
    await step('死亡保障 → 詳細', () => death.first().click(), 'detail');
    await full(page, `${outDir}/05-detail-390-death.png`);
  }
  await step('詳細「戻る」→ もしもラボ', () => page.locator('#detail .btn.secondary').last().click(), 'lab');
  await step('ヘッダー右のボタン', () => page.locator('.top button').click(), 'guide');
  for (const t of ['home', 'input', 'lab', 'history', 'guide']) {
    await step(`下部ナビ → ${t}`, () => page.locator(`.navbtn[data-target=${t}]`).click(), t);
  }
  await show(page, 'guide');
  await page.locator('#guide details summary').first().click();
  await full(page, `${outDir}/07-guide-390-state-faq-open.png`);

  // キーボード：Tab でたどり、フォーカス表示の有無
  await show(page, 'lab');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.mouse.click(5, 300);
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const cs = getComputedStyle(el); return { el: el.tagName + '.' + el.className, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor : 'none', boxShadow: cs.boxShadow }; });
    report.focus.push(f);
    if (i === 3) await page.screenshot({ path: `${outDir}/04-lab-390-state-focus.png` });
  }
  await ctx.close();

  // ほかの幅
  for (const w of [320, 375, 430, 1280]) {
    const c = await browser.newContext({ viewport: { width: w, height: w === 1280 ? 900 : 800 }, deviceScaleFactor: w === 1280 ? 1 : 2, locale: 'ja-JP' });
    const p = await c.newPage();
    await p.goto(url);
    report.widths[w] = {};
    for (const s of SCREENS) {
      await show(p, s);
      report.widths[w][s] = await measure(p);
      if (w === 320 || w === 1280 || (w !== 390 && ['home', 'lab'].includes(s))) await full(p, `${outDir}/${LABEL[s]}-${w}.png`);
    }
    await c.close();
  }
  await browser.close();
  fs.writeFileSync(`${outDir}/metrics.json`, JSON.stringify(report, null, 2));
  console.log('done', outDir);
})();
