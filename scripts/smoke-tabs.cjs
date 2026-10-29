const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("http"),
  fs = require("fs"),
  path = require("path"),
  XLSX = require("xlsx");
const root = path.resolve(process.argv[2] || "tmp/vfs-build");
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
  await new Promise((r) => server.listen(4194, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    let owner = await context.newPage();
    const errors = [];
    context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
    const url = "http://127.0.0.1:4194";
    await owner.goto(url + "/entry");
    await owner
      .getByRole("button", { name: "完成记账", exact: true })
      .waitFor();
    await owner.getByRole("button", { name: "日常", exact: true }).click();
    await owner.getByRole("button", { name: "三餐", exact: true }).click();
    await owner.getByLabel("金额", { exact: true }).fill("12.34");
    await owner.getByLabel("备注", { exact: true }).fill("多标签保留验收");
    await owner.getByRole("button", { name: "保存再记", exact: true }).click();
    await owner.getByText("已保存", { exact: true }).waitFor();
    for (let i = 0; i < 3; i++) {
      const next = await context.newPage();
      await next.goto(url + "/entry");
      await next
        .getByText("账本已在另一个标签页打开", { exact: true })
        .waitFor();
      if (await next.getByText(/Invalid VFS|Error:/).count())
        throw new Error("raw database error");
      if (i === 0) await next.screenshot({ path: "tmp/database-tab-wait.png" });
      await owner.close();
      await next
        .getByRole("button", { name: "完成记账", exact: true })
        .waitFor();
      owner = next;
    }
    await owner.reload();
    await owner
      .getByRole("button", { name: "完成记账", exact: true })
      .waitFor();
    await owner.goto(url + "/backup");
    const dl = owner.waitForEvent("download");
    await owner
      .getByRole("button", { name: "导出完整备份", exact: true })
      .click();
    await (await dl).saveAs("tmp/database-tab-backup.json");
    const data = JSON.parse(
      JSON.parse(fs.readFileSync("tmp/database-tab-backup.json", "utf8"))
        .payload,
    );
    const rows = data.tables.txn.filter((t) => !t.deleted);
    if (
      rows.length !== 1 ||
      rows[0].amount !== 1234 ||
      rows[0].note !== "多标签保留验收"
    )
      throw new Error("data not preserved");
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      "PASS: second tab waits; closing owner transfers access three times; reload works; saved record remains unchanged.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
