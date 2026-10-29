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
  await new Promise((r) => server.listen(4192, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const go = (route) => page.goto("http://127.0.0.1:4192/" + route);
    const button = (name) => page.getByRole("button", { name, exact: true });
    const field = (name, value) =>
      page.getByLabel(name, { exact: true }).fill(value);
    await go("finance");
    await button("简易贷款").click();
    await field("名称", "验收车贷");
    await field("每月还款（元）", "100");
    await field("剩余本金（元）", "1000");
    await field("总期数", "12");
    await field("免息期数", "3");
    await button("保存").click();
    await page.getByText("验收车贷 · 简易贷款", { exact: true }).waitFor();
    await button("记录还款").click();
    await field("本次到账总额（元，含利息／费用）", "100");
    await button("保存").click();
    await page.getByText(/已还期数 1\/12/).waitFor();
    await button("校准本金").click();
    await field("银行显示本金（元）", "850");
    await button("保存").click();
    await page.getByText("¥850.00", { exact: true }).waitFor();
    await button("押金").click();
    await field("名称", "验收押金");
    await field("金额", "300");
    await button("保存").click();
    await button("结束押金并退款").click();
    await field("实际退回金额（元）", "250");
    await button("保存").click();
    await page.getByText("已结清／结束", { exact: true }).waitFor();
    await button("租房快捷设置").click();
    await field("名称", "验收房租");
    await field("月租（元）", "3000");
    await field("日期", "2026-11-01");
    await button("保存").click();
    await button("编辑整组分摊").click();
    await field("金额", "10000");
    await button("保存").click();
    await page
      .getByText("贷款与租房", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "tmp/final-finance.png" });
    await button("删除整组分摊").click({ trial: true });
    page.once("dialog", (d) => d.accept());
    await button("删除整组分摊").click();
    await button("编辑整组分摊").waitFor({ state: "detached" });
    await go("sync");
    if (
      (await page
        .getByLabel("WebDAV 根地址（HTTPS）", { exact: true })
        .inputValue()) !== "https://dav.jianguoyun.com/dav/"
    )
      throw new Error("default WebDAV missing");
    await button("加入已有家庭").click();
    await field("粘贴配对信息", "invalid");
    await button("应用配对信息").click();
    await page
      .getByText("同步日志无效，未修改本机账本", { exact: true })
      .waitFor();
    await field(
      "粘贴配对信息",
      JSON.stringify({
        version: 1,
        url: "https://dav.example.test/dav/",
        ledgerId: "test-pair",
        keyHex: "01".repeat(32),
      }),
    );
    await button("应用配对信息").click();
    if (
      (await page.getByLabel("家庭账本编号", { exact: true }).inputValue()) !==
      "test-pair"
    )
      throw new Error("pair missing");
    await page.getByText("家庭同步", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "tmp/final-sync.png" });
    await button("创建家庭同步").click();
    await field("WebDAV 账号", "test-only");
    await field("WebDAV 应用密码", "test-only-password");
    await page.route("https://dav.example.test/**", (route) =>
      route.fulfill({
        status: route.request().method() === "OPTIONS" ? 204 : 401,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "MKCOL,PROPFIND,GET,PUT,MOVE,OPTIONS",
          "access-control-allow-headers":
            "authorization,content-type,depth,destination,overwrite",
        },
        body: "",
      }),
    );
    await button("保存同步设置").click();
    await button("停止本机同步").waitFor();
    await page.getByText("WebDAV MKCOL 401", { exact: true }).first().waitFor();
    page.once("dialog", (d) => d.accept());
    await button("停止本机同步").click();
    await button("停止本机同步").waitFor({ state: "detached" });
    await go("vault");
    await page
      .getByText("网页预览不提供设备身份验证。请在 iPhone 上使用小金库。", {
        exact: true,
      })
      .waitFor();
    if (await button("新增私有账户").count()) throw new Error("vault exposed");
    await go("stats");
    await button("贷款本金计入本页支出").click();
    await button("我").click();
    await page
      .getByText("统计", { exact: true })
      .first()
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "tmp/final-stats.png" });
    await go("assets");
    await page.screenshot({ path: "tmp/final-assets.png", fullPage: true });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
    )
      throw new Error("horizontal overflow");
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      "PASS 390x844: loan create/pay/calibrate; deposit refund; rent create/edit/delete; pairing validation; vault stays locked; no page errors.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
