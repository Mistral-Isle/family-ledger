const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(process.argv[2] || "tmp/inline-v2-web");
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
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const b = (name) => page.getByRole("button", { name, exact: true });
    const tab = (name) => page.getByRole("tab", { name, exact: true });
    const go = (p) => page.goto("http://127.0.0.1:4216" + p);
    async function swipe(row, dx) {
      await row.evaluate((e) => e.scrollIntoView({ block: "center" }));
      const r = await row.boundingBox();
      const x = dx > 0 ? r.x + 20 : r.x + r.width - 20,
        y = r.y + r.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y, { steps: 15 });
      await page.mouse.up();
    }
    async function drag(from, to) {
      await b(from).evaluate((e) => e.scrollIntoView({ block: "center" }));
      const a = await b(from).boundingBox(),
        z = await b(to).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(550);
      await page.mouse.move(z.x + z.width / 2, z.y + z.height / 2, {
        steps: 12,
      });
      await page.mouse.up();
    }
    await go("/");
    await b("记一笔").waitFor();
    for (const [pattern, name] of [
      [/^日常用餐 /, "早餐"],
      [/^日用 /, "日用品"],
      [/^工资奖金 /, "月薪"],
    ]) {
      await swipe(page.getByRole("button", { name: pattern }), -180);
      await b("存为常用").click();
      await page.getByLabel("常用项名称", { exact: true }).fill(name);
      await b("保存常用项").click();
    }
    await go("/entry");
    await b("切换常用").click();
    await b("早餐").waitFor();
    assert.equal(await b("月薪").count(), 0);
    assert.equal(await page.getByRole("button", { name: /^拖动/ }).count(), 0);
    await drag("日用品", "早餐");
    assert.match(
      (await page.getByRole("listitem").allTextContents())[0],
      /日用品/,
    );
    assert.equal(
      await page.getByLabel("金额", { exact: true }).inputValue(),
      "",
    );
    await b("日用品").click();
    await page.waitForTimeout(100);
    assert.equal(await b("日用品").getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.getByLabel("金额", { exact: true }).inputValue(),
      "400.00",
    );
    assert((await b("日用品").boundingBox()).height <= 70);
    await page.screenshot({ path: "tmp/inline-v2-expense.png" });
    await tab("收入").click();
    await b("切换常用").waitFor();
    await b("切换常用").click();
    await b("月薪").waitFor();
    assert.equal(await b("早餐").count(), 0);
    await b("月薪").click();
    await page.screenshot({ path: "tmp/inline-v2-income.png" });
    await b("全部分类").click();
    await tab("支出").click();
    await b("早餐").waitFor();
    await b("添加常用").click();

    await b("餐饮").click();
    await b("日常用餐").click();
    await page.getByLabel("常用项名称", { exact: true }).fill("新早餐");
    await b("存为常用").click();
    await b("新早餐").waitFor();
    assert.equal(await b("新早餐").getAttribute("aria-pressed"), "true");
    await page.reload();
    await b("新早餐").waitFor();
    await go("/assets");
    await b("银行卡").waitFor();
    await drag("微信", "银行卡");
    assert.match(
      (await page.getByRole("listitem").allTextContents())[0],
      /微信/,
    );
    assert(!page.url().includes("account-detail"));
    await b("微信").click();
    await page.getByText("账户详情", { exact: true }).waitFor();
    await go("/");
    await b("筛选交易").click();
    await page.getByRole("switch", { name: "不显示未来账单" }).click();
    await b("完成").click();
    assert.equal(
      await page.getByRole("button", { name: /^日常用餐 / }).count(),
      0,
    );
    await page.reload();
    await page.getByText("截至现在的明细", { exact: true }).waitFor();
    await page.screenshot({ path: "tmp/inline-v2-future-filter.png" });
    await go("/assets");
    await swipe(b("微信"), 150);
    await b("调整余额").click();
    await page.getByLabel("实际余额", { exact: true }).fill("100");
    await page.getByRole("switch", { name: "差额计入收支" }).click();
    await b("收入分类").click();

    await b("工资奖金").click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "tmp/inline-v2-balance-income.png" });
    await b("确认调整余额").click();
    await go("/assets");
    await swipe(b("微信"), 150);
    await b("调整余额").click();
    await page.getByLabel("实际余额", { exact: true }).fill("80");
    await b("确认调整余额").click();
    await go("/");
    await page.getByRole("button", { name: /^余额调整 / }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS v2: whole-row hold drag, no tap after drag, compact selected category favorites, independent income/expense, add returns to favorites, future hiding persists, optional income/balance-only correction",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
