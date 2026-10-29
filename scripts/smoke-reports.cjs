const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("http"),
  fs = require("fs"),
  path = require("path"),
  XLSX = require("xlsx");
const root = path.resolve(process.argv[2] || "tmp/final-build");
const server = http.createServer((req, res) => {
  let f = path.join(root, new URL(req.url, "http://localhost").pathname);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory())
    f = path.join(root, "index.html");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html",
      ".js": "application/javascript",
      ".wasm": "application/wasm",
      ".ttf": "font/ttf",
    }[path.extname(f)] || "application/octet-stream",
  );
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(4191, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4191/backup");
    const pick = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "选择备份文件", exact: true })
      .click();
    await (await pick).setFiles(path.resolve("tmp/stage2-seed.json"));
    await page
      .getByRole("button", { name: "确认替换本机账本", exact: true })
      .waitFor();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "确认替换本机账本", exact: true })
      .click();
    await page.getByText("恢复完成", { exact: true }).waitFor();
    await page.goto("http://127.0.0.1:4191/stats");
    await page.getByLabel("预算金额（元，留空取消）").fill("80");
    await page.getByRole("button", { name: "保存预算", exact: true }).click();
    await page.getByText("已超预算 · ¥20.00", { exact: true }).waitFor();
    await page.getByRole("button", { name: "2026-10-01", exact: true }).click();
    const dl = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "导出 Excel（五张表）", exact: true })
      .click();
    await (await dl).saveAs("tmp/ui-stage2.xlsx");
    const book = XLSX.readFile("tmp/ui-stage2.xlsx");
    if (book.SheetNames.length !== 5 || book.Sheets["明细"]["!ref"] !== "A1:L3")
      throw new Error("bad workbook");
    await page.getByRole("button", { name: "自定义", exact: true }).click();
    await page.getByLabel("开始日期", { exact: true }).fill("2026-10-02");
    await page.getByLabel("结束日期", { exact: true }).fill("2026-10-02");
    await page.getByRole("button", { name: "应用日期", exact: true }).click();
    await page
      .getByText("2026-10-02 — 2026-10-02 · 1 天", { exact: true })
      .waitFor();
    await page.screenshot({ path: "tmp/stage2-stats.png", fullPage: true });
    await page.getByLabel("结束日期", { exact: true }).fill("2026-09-01");
    await page.getByRole("button", { name: "应用日期", exact: true }).click();
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      "PASS budget overrun, calendar, five-sheet Excel download/readback, custom range and invalid range; no page errors",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
