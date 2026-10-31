const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(process.argv[2] || "tmp/family-build");
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
  await new Promise((r) => server.listen(4196, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
        viewport: { width: 375, height: 667 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const go = (p) => page.goto("http://127.0.0.1:4196" + p),
      b = (n) => page.getByRole("button", { name: n, exact: true }),
      input = (n) => page.getByLabel(n, { exact: true });
    async function download(button) {
      const pending = page.waitForEvent("download");
      await b(button).click();
      const d = await pending;
      const chunks = [];
      for await (const x of await d.createReadStream()) chunks.push(x);
      return Buffer.concat(chunks);
    }
    async function backup() {
      await go("/backup");
      const raw = await download("导出完整备份");
      return JSON.parse(JSON.parse(raw.toString()).payload);
    }
    async function openTrip() {
      await b("关联行程").click();
    }
    async function expectNoTrip() {
      assert.equal((await b("关联行程").innerText()).trim(), "关联行程");
    }
    await go("/entry");
    await b("餐饮").waitFor();
    const categoryNames = await page.getByRole("button").allTextContents();
    const expected = ["餐饮", "购物", "汽车", "数字服务", "交通", "娱乐"];
    const indices = expected.map((n) =>
      categoryNames.findIndex((x) => x.trim() === n),
    );
    assert(indices.every((v, i) => v >= 0 && (!i || v > indices[i - 1])));
    await openTrip();
    assert.equal(await page.getByText("付款人", { exact: true }).count(), 0);
    assert.equal(await page.getByText("为谁", { exact: true }).count(), 0);
    await b("创建行程").click();
    await b("创建并关联").click();
    await input("行程名称").waitFor();
    assert.equal(await b("创建并关联").count(), 1, "invalid form stays open");
    await input("行程名称").fill("杭州周末游");
    assert.equal(await input("开始日期（可选）").getAttribute("type"), "date");
    await input("开始日期（可选）").fill("2026-10-30");
    await input("结束日期（可选）").fill("2026-11-01");
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "tmp/family-create-trip-375.png",
      fullPage: true,
    });
    await b("创建并关联").click();
    await b("关联行程").waitFor();
    await openTrip();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "tmp/family-trip-sheet-375.png",
      fullPage: true,
    });
    await b("关闭记账选项").click({ position: { x: 10, y: 10 } });
    await b("更多设置").waitFor();
    await go("/entry");
    await b("餐饮").click();
    await b("日常用餐").click();
    await input("金额").fill("28");
    await input("备注").fill("旅行午餐");
    await openTrip();
    await b("杭州周末游").click();
    await b("关联行程").waitFor();
    await openTrip();
    await b("不关联行程").click();
    await b("关联行程").waitFor();
    await expectNoTrip();
    await openTrip();
    await b("杭州周末游").click();
    await b("关联行程").waitFor();
    assert.equal(await input("金额").inputValue(), "28");
    assert.equal(await input("备注").inputValue(), "旅行午餐");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "tmp/family-entry-375.png", fullPage: true });
    const saveBox = await b("完成记账").boundingBox();
    assert(
      saveBox.y + saveBox.height <= 667,
      "save stays visible on small phone",
    );
    await b("完成记账").click();
    let data = await backup();
    assert.equal(data.version, 6);
    assert.equal(data.tables.txn.length, 1);
    const original = data.tables.txn[0],
      trip = data.tables.trip[0];
    assert.equal(original.trip_id, trip.id);
    assert(original.payer_member_id);
    await go("/entry");
    await b("餐饮").click();
    await b("日常用餐").click();
    await input("金额").fill("28");
    await b("完成记账").click();
    await page.getByText("这笔消费可能已经记过了", { exact: true }).waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "tmp/family-duplicate-375.png",
      fullPage: true,
    });
    await b("查看已有账单").click();
    await input("备注").fill("午餐补充备注");
    await b("完成记账").click();
    data = await backup();
    assert.equal(
      data.tables.txn.length,
      1,
      "view/edit existing does not create a second entry",
    );
    await go("/entry");
    await b("餐饮").click();
    await b("日常用餐").click();
    await input("金额").fill("28");
    await input("备注").fill("真实第二笔");
    await b("完成记账").click();
    await b("仍新增一笔").click();
    data = await backup();
    assert.equal(data.tables.txn.length, 2);
    assert.equal(data.tables.duplicate.length, 1);
    await go("/duplicates");
    await page.getByText("暂无需要核对的相似账单", { exact: true }).waitFor();
    await go("/trips?id=" + trip.id);
    await page.getByText("¥56.00", { exact: true }).first().waitFor();
    const csv = (await download("导出行程 CSV")).toString();
    assert(
      csv.includes("杭州周末游") &&
        csv.includes("付款人") &&
        csv.includes("午餐补充备注"),
    );
    const xlsx = await download("导出行程 Excel");
    assert(xlsx.length > 1000);
    await page.screenshot({ path: "tmp/family-trip-375.png", fullPage: true });
    await b("编辑行程").click();
    assert.equal(await input("开始日期（可选）").getAttribute("type"), "date");
    await b("取消").click();
    await go("/entry");
    await openTrip();
    await b("结束行程").click();
    await b("关联行程").waitFor();
    await openTrip();
    await b("杭州周末游 · 已结束").click();
    await b("关联行程").waitFor();
    await go("/entry");
    await expectNoTrip();
    await go("/category-defaults");
    await page.getByText("默认分类已齐全", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await go("/trips?id=" + trip.id);
    await b("重新开启").waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "tmp/family-trip-dark-390.png",
      fullPage: true,
    });
    await b("删除行程").click();
    data = await backup();
    assert.equal(data.tables.txn.filter((t) => !t.deleted).length, 2);
    assert.equal(data.tables.trip[0].deleted, 1);
    await go("/stats");
    await b("选择统计成员").click();
    await b("全部付款人").waitFor();
    assert.equal(await b("按付款人").count(), 0);
    assert.equal(await b("按记录人").count(), 0);
    assert.equal(await b("未确认").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "Family smoke passed: trip defaults/end/delete, payer, duplicate view/override, exports, small-screen save, stats basis; no page errors.",
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
