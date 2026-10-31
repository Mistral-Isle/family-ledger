const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    async function snapshot() {
      await page.goto('http://localhost:4173/backup');
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
      const chunks = [];
      for await (const chunk of await (await pending).createReadStream()) chunks.push(chunk);
      return JSON.parse(JSON.parse(Buffer.concat(chunks).toString()).payload).tables;
    }
    const first = await snapshot();
    await page.evaluate(() => localStorage.setItem('ledger-preview-catalog', 'obsolete-test-catalog'));
    const reset = await snapshot();
    assert.notEqual(first.category[0].id, reset.category[0].id, 'existing test database is recreated');
    assert.equal(reset.category.filter(c => !c.deleted).length, 73);
    assert.equal(reset.txn.length, 8);
    const retained = await snapshot();
    assert.deepEqual(retained.category, reset.category, 'same revision is not reset on refresh');
    assert.deepEqual(retained.txn, reset.txn, 'sample transactions are not duplicated');
    await page.goto('http://localhost:4173/entry');
    await page.getByRole('tab', { name: '收入', exact: true }).click();
    await page.getByRole('button', { name: '红包礼金', exact: true }).waitFor();
    await page.screenshot({ path: 'tmp/tall-red-envelope.png' });
    assert.deepEqual(errors, []);
    console.log('PASS stale preview resets to 73 categories and eight samples; refresh retains IDs and does not duplicate samples; no runtime errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
