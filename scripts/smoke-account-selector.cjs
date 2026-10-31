const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const button = name => page.getByRole('button', { name, exact: true });
    await page.goto('http://localhost:4173/entry');
    await button('选择账户').click();
    await button('现金').click();
    assert.match(await button('选择账户').innerText(), /现金/);
    await button('选择账户').click();
    assert.equal(await button('现金').getAttribute('aria-pressed'), 'true');
    const style = await button('现金').evaluate(e => ({ border: getComputedStyle(e).borderWidth, bg: getComputedStyle(e).backgroundColor }));
    assert.equal(style.border, '0px');
    await page.screenshot({ path: 'tmp/account-selector-sheet.png' });
    await button('微信').click();
    assert.match(await button('选择账户').innerText(), /微信/);
    for (const name of ['选择账户', '关联行程', '更多设置']) {
      const box = await button(name).boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 375);
    }
    await page.screenshot({ path: 'tmp/account-selector-light.png' });
    await page.goto('http://localhost:4173/appearance');
    await button('深色').click();
    await page.goto('http://localhost:4173/entry');
    await button('选择账户').waitFor();
    await page.setViewportSize({ width: 320, height: 740 });
    await page.screenshot({ path: 'tmp/account-selector-dark.png' });
    for (const name of ['选择账户', '关联行程', '更多设置']) {
      const box = await button(name).boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 320);
    }
    assert.deepEqual(errors, []);
    console.log('PASS account selection, solid selected fill without border, light/dark and 320px layout.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
