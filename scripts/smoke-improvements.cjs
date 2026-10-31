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
  await new Promise((r) => server.listen(4198, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
        viewport: { width: 375, height: 667 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const go = (p) => page.goto("http://127.0.0.1:4198" + p),
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

    await go("/entry");
    await b("餐饮").waitFor();
    await b("餐饮").click();
    assert.equal(
      await b("餐饮").count(),
      1,
      "only background parent exists, no duplicate selectable parent in child picker",
    );
    await page.screenshot({ path: "tmp/improved-picker.png" });
    await b("日常用餐").click();
    await b("关闭二级分类").waitFor({ state: "hidden" });
    await b("更多设置").click();
    await page
      .getByRole("checkbox", { name: "不计入预算", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "不计入收支", exact: true })
      .click();
    await b("完成设置").click();
    await input("金额").fill("35");
    await page.screenshot({ path: "tmp/improved-entry.png" });
    await b("完成记账").click();
    await go("/finance?kind=prepaid");
    await page.getByLabel("名称", { exact: true }).fill("季度分摊");
    await input("金额").fill("400");
    await input("每月分摊日（1–31）").fill("31");
    await page
      .getByText("每月 ¥133.33，末月 ¥133.34", { exact: true })
      .waitFor();
    await page.screenshot({ path: "tmp/improved-finance.png", fullPage: true });
    await go("/entry");
    await page.getByRole("tab", { name: "转账", exact: true }).click();
    await page.getByText("转出账户", { exact: true }).waitFor();
    await b("选择转入账户").click();
    await b("我的隐私账户").click();
    await b("完成账户选择").waitFor({ state: "hidden" });
    await page.screenshot({
      path: "tmp/improved-transfer.png",
      animations: "disabled",
    });
    await go("/stats");
    await b("选择统计成员").waitFor();
    await page
      .getByRole("checkbox", { name: "账户余额", exact: true })
      .waitFor();
    await b("取消全选").click();
    await page.getByRole("checkbox", { name: "明细", exact: true }).click();
    await page.getByRole("checkbox", { name: "账户余额", exact: true }).click();
    await page.getByText("已选 2 项", { exact: true }).waitFor();
    await page.screenshot({ path: "tmp/improved-export.png" });
    const workbook = require("xlsx").read(await download("导出所选 Excel"), {
      type: "buffer",
    });
    assert.deepEqual(workbook.SheetNames, ["明细", "账户余额"]);
    await go("/appearance");
    await b("暖白").click();
    await go("/assets");
    await b("财务计划").waitFor();
    await page.screenshot({ path: "tmp/improved-assets.png" });
    await go("/");
    await page.screenshot({ path: "tmp/improved-details-warm.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await go("/finance?kind=prepaid");
    await input("名称").fill("季度分摊");
    await input("金额").fill("400");
    await input("每月分摊日（1–31）").fill("31");
    await page.screenshot({ path: "tmp/improved-finance-390.png" });
    await go("/appearance");
    await page.getByLabel("深色", { exact: true }).click();
    await go("/assets");
    await b("财务计划").waitFor();
    await page.screenshot({ path: "tmp/improved-assets-dark.png" });
    assert.deepEqual(errors, []);
    console.log(
      "SMOKE PASS: entry flags, category picker, 400/3 preview, transfer, report selection, assets; 375x667",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
