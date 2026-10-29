const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("http"),
  fs = require("fs"),
  path = require("path"),
  XLSX = require("xlsx");
const root = path.resolve(process.argv[2] || "tmp/layout-build");
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
  await new Promise((r) => server.listen(4193, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const b = (name) => page.getByRole("button", { name, exact: true }),
      input = (name) => page.getByLabel(name, { exact: true });
    await page.goto("http://127.0.0.1:4193/entry");
    await b("新增分类").waitFor();
    async function fits() {
      for (const locator of [
        input("金额"),
        input("日期"),
        input("备注"),
        b("完成记账"),
        b("1"),
      ]) {
        const box = await locator.boundingBox();
        if (
          !box ||
          box.y < 0 ||
          box.y + box.height > page.viewportSize().height + 1
        )
          throw new Error(
            "basic field outside viewport: " + JSON.stringify(box),
          );
      }
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error("horizontal overflow");
    }
    await fits();
    await b("日常").click();
    await b("三餐").click();
    await b("1").click();
    await b("0").click();
    await b("0").click();
    await b("加").click();
    await b("2").click();
    await b("0").click();
    await b("除").click();
    await b("2").click();
    await input("备注").fill("单屏验收午餐");
    await input("日期").fill("2026-10-30");
    await b("共同").click();
    await page.screenshot({ path: "tmp/entry-single-screen.png" });
    await b("保存再记").click();
    await page.getByText("已保存", { exact: true }).waitFor();
    await b("新增分类").click();
    await input("分类名称").fill("宠物零食");
    await input("搜索图标").fill("宠物");
    await b("图标 宠物").click();
    await b("颜色 #E88766").click();
    await input("搜索图标").fill("");
    await page.screenshot({ path: "tmp/category-editor.png" });
    await b("保存分类").click();
    await input("金额").fill("25");
    await input("备注").fill("自选图标名称");
    await b("保存再记").click();
    await page.getByText("已保存", { exact: true }).waitFor();
    await b("日常").click();
    await b("新增二级分类").click();
    await input("分类名称").fill("工作午餐");
    await input("搜索图标").fill("米饭");
    await b("图标 米饭").click();
    await b("保存分类").click();
    await input("金额").fill("18");
    await b("保存再记").click();
    await page.setViewportSize({ width: 375, height: 667 });
    await fits();
    await page.screenshot({ path: "tmp/entry-small.png" });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({ path: "tmp/entry-dark.png" });
    await page.getByRole("tab", { name: "转账", exact: true }).click();
    await fits();
    await page.screenshot({ path: "tmp/entry-transfer.png" });
    await page.goto("http://127.0.0.1:4193/backup");
    const dl = page.waitForEvent("download");
    await b("导出完整备份").click();
    const download = await dl;
    await download.saveAs("tmp/entry-acceptance.json");
    const envelope = JSON.parse(
        fs.readFileSync("tmp/entry-acceptance.json", "utf8"),
      ),
      data = JSON.parse(envelope.payload);
    const txns = data.tables.txn.filter((t) => !t.deleted);
    if (
      txns.length !== 3 ||
      txns[0].amount !== 11000 ||
      txns[1].amount !== 2500 ||
      txns[2].amount !== 1800
    )
      throw new Error("saved amounts mismatch");
    const category = data.tables.category.find((c) => c.name === "宠物零食");
    if (category.sf_symbol !== "category:pet" || category.color !== "#E88766")
      throw new Error("custom icon not persisted");
    const child = data.tables.category.find((c) => c.name === "工作午餐");
    if (!child.parent_id) throw new Error("child parent missing");
    await page.goto("http://127.0.0.1:4193/categories");
    await b("宠物零食").click();
    await input("分类名称").fill("宠物零食改");
    await b("保存分类").click();
    await page.reload();
    await b("宠物零食改").waitFor();
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      "PASS single-screen fields at 390x844/375x667, child picker, arithmetic, save again, root/child custom names/icons/colors persisted, transfer, dark layout.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
