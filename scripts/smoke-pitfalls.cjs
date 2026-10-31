const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(process.argv[2] || "tmp/pitfall-build");
const server = http.createServer((req, res) => {
  let file = path.join(root, new URL(req.url, "http://localhost").pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = path.join(root, "index.html");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html",
      ".js": "application/javascript",
      ".wasm": "application/wasm",
      ".ttf": "font/ttf",
    }[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((resolve) => server.listen(4197, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 375, height: 667 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const b = (name) => page.getByRole("button", { name, exact: true });
    const input = (name) => page.getByLabel(name, { exact: true });
    const go = (route) => page.goto("http://127.0.0.1:4197" + route);
    const doubleTap = (locator) =>
      locator.evaluate((el) => {
        el.click();
        el.click();
      });
    async function backup() {
      await go("/backup");
      const pending = page.waitForEvent("download");
      await b("导出完整备份").click();
      const download = await pending;
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      return JSON.parse(JSON.parse(Buffer.concat(chunks).toString()).payload);
    }
    await go("/entry");
    await b("新增分类").click();
    await input("分类名称").fill("审计分类");
    await doubleTap(b("保存分类"));
    await input("金额").fill("10");
    await input("备注").fill("快速保存第一笔");
    await b("微信").click();
    await doubleTap(b("保存再记"));
    await page.getByText("已保存", { exact: true }).waitFor();
    await input("金额").fill("10");
    await input("备注").fill("主动再记第二笔");
    await doubleTap(b("完成记账"));
    let data = await backup();
    assert.equal(
      data.tables.category.filter((c) => c.name === "审计分类").length,
      1,
    );
    const live = data.tables.txn.filter((t) => !t.deleted);
    assert.equal(live.length, 2, "rapid taps must not create extra entries");
    const first = live.find((t) => t.note === "快速保存第一笔");
    const originalAccount = first.account_id;
    assert.equal(
      data.tables.account.find((a) => a.id === originalAccount).name,
      "微信",
    );

    await go("/entry?id=" + first.id);
    await b("日常").click();
    await b("三餐").click();
    await doubleTap(b("完成记账"));
    data = await backup();
    const edited = data.tables.txn.find((t) => t.id === first.id);
    assert.equal(
      edited.account_id,
      originalAccount,
      "changing a category must preserve the existing account",
    );
    assert.equal(
      data.tables.category.find((c) => c.id === edited.category_id).name,
      "三餐",
    );
    assert.equal(data.tables.txn.filter((t) => !t.deleted).length, 2);

    // Failure unlocks the same form, so correcting an invalid amount remains usable.
    await go("/entry");
    await b("审计分类").click();
    await input("金额").fill("0");
    await b("保存再记").click();
    await input("金额").fill("1.23");
    await input("备注").fill("修正后保存");
    await doubleTap(b("保存再记"));
    data = await backup();
    assert.equal(data.tables.txn.filter((t) => !t.deleted).length, 3);
    assert.equal(
      data.tables.txn.find((t) => t.note === "修正后保存").amount,
      123,
    );

    await go("/refund?sourceId=" + first.id);
    await input("退款到账总额").fill("3");
    await doubleTap(b("保存"));
    data = await backup();
    assert.equal(
      data.tables.txn.filter((t) => !t.deleted && t.type === "refund").length,
      1,
    );
    assert.equal(data.tables.txn.find((t) => t.type === "refund").amount, 300);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: rapid category/entry saves, intentional save-again, account preserved on category edit, invalid amount retry, persisted backup verification.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
