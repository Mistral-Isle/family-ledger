const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(process.argv[2] || "tmp/shortcut-order-web");
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
  if (file.endsWith("index.html"))
    res.end(
      fs
        .readFileSync(file, "utf8")
        .replace(
          "<head>",
          '<head><meta name="ledger-preview" content="budget-demo">',
        ),
    );
  else fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(4216, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 375, height: 812 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const b = (name) => page.getByRole("button", { name, exact: true });
    const go = (p) => page.goto("http://127.0.0.1:4216" + p);
    const list = () => page.getByRole("listitem");
    async function swipe(row, dx) {
      await row.evaluate((e) => e.scrollIntoView({ block: "center" }));
      const r = await row.boundingBox();
      const x = dx > 0 ? r.x + 20 : r.x + r.width - 25,
        y = r.y + r.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y, { steps: 15 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    }
    async function drag(from, to) {
      await b("拖动" + from).evaluate((e) =>
        e.scrollIntoView({ block: "center" }),
      );
      const a = await b("拖动" + from).boundingBox(),
        z = await b("拖动" + to).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(z.x + z.width / 2, z.y + z.height / 2, {
        steps: 12,
      });
      await page.mouse.up();
    }
    async function backup() {
      await go("/backup");
      const pending = page.waitForEvent("download");
      await b("导出完整备份").click();
      const download = await pending,
        chunks = [];
      for await (const x of await download.createReadStream()) chunks.push(x);
      return JSON.parse(JSON.parse(Buffer.concat(chunks).toString()).payload);
    }
    await go("/");
    await b("记一笔").waitFor();
    const before = await backup();
    await go("/");
    const meals = page.getByRole("button", { name: /^日常用餐 / });
    await meals.scrollIntoViewIfNeeded();
    const r = await meals.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await b("退出多选").waitFor();
    assert.equal(await b("保存常用项").count(), 0);
    await page.getByText("已选 1 笔", { exact: true }).waitFor();
    await page.getByRole("button", { name: /^日用 / }).click();
    await page.getByText("已选 2 笔", { exact: true }).waitFor();
    await page.screenshot({ path: "tmp/inline-multiselect-375.png" });
    await b("退出多选").click();
    for (const [pattern, name] of [
      [/^日常用餐 /, "常用早餐"],
      [/^日用 /, "常用日用"],
    ]) {
      await swipe(page.getByRole("button", { name: pattern }), 220);

      await b("存为常用").click();
      await page.getByLabel("常用项名称", { exact: true }).fill(name);
      await b("保存常用项").click();
      assert.equal(await page.getByText(/已存为常用/).count(), 0);
    }
    await go("/entry");
    await b("切换常用").click();
    await b("常用早餐").waitFor();
    await drag("常用日用", "常用早餐");
    assert.match((await list().allTextContents())[0], /常用日用/);
    await page.reload();
    await b("常用日用").waitFor();
    assert.match((await list().allTextContents())[0], /常用日用/);
    await page.screenshot({ path: "tmp/inline-favorites-375.png" });
    await b("常用早餐").click();
    assert.equal(
      await page.getByLabel("金额", { exact: true }).inputValue(),
      "1200.00",
    );
    await go("/me");
    await b("常用项管理").click();
    await b("常用早餐").waitFor();
    assert(page.url().includes("favorites"));
    await go("/assets");
    await list().first().waitFor();
    const names = await page
      .getByRole("button", { name: /^拖动/ })
      .allTextContents();
    const handles = await page
      .getByRole("button", { name: /^拖动/ })
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute("aria-label").slice(2)),
      );
    assert(handles.length >= 2);
    await drag(handles[1], handles[0]);
    assert.match((await list().allTextContents())[0], new RegExp(handles[1]));
    await page.reload();
    await b(handles[1]).waitFor();
    assert.match((await list().allTextContents())[0], new RegExp(handles[1]));
    await b(handles[0]).click();
    await page.getByText("账户详情", { exact: true }).waitFor();
    await page.screenshot({ path: "tmp/inline-account-detail-375.png" });
    await go("/assets");
    await swipe(b(handles[0]), 180);
    await b("调整余额").click();
    await page.getByLabel("实际余额", { exact: true }).fill("88.88");
    await b("确认调整余额").click();
    await b(handles[0]).click();
    await page
      .getByText("¥88.88", { exact: true })
      .filter({ visible: true })
      .first()
      .waitFor();
    await go("/assets");
    await swipe(b(handles[0]), -180);
    await b("删除").click();
    await b("删除账户，保留账单记录").waitFor();
    await page.screenshot({ path: "tmp/inline-delete-account-375.png" });
    await b("取消").click();
    await go("/assets");
    await swipe(b(handles[0]), -180);
    await b("编辑").click();
    assert(page.url().includes("account?"));
    const after = await backup();
    assert.equal(
      after.tables.txn.length,
      before.tables.txn.length + 1,
      "only balance adjustment writes a transaction",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: multi-select long press; swipe favorite without toast; inline drag persistence; Me navigation; account detail/swipe edit/balance/delete options; 375px",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
