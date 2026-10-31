// Isolated browser context + disposable SQLite fixture; never touches the user's ledger.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  ts = require("typescript");
require.extensions[".ts"] = (m, file) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
const { formatMoney } = require("../src/domain/money.ts");
const { totals } = require("../src/domain/selectors.ts");
const { fixture } = require("../tests/sqlite.ts");
const f = fixture(),
  s = f.repo.snapshot();
const meal = s.categories.find((c) => c.name === "三餐" && c.parentId);
const bank = s.accounts[0],
  target = s.accounts[1];
f.repo.saveAccount({ ...bank, initialBalance: 2000000 });
const add = (type, amount, categoryId, note, date = "2026-10-30", extra = {}) =>
  f.repo.saveTxn({
    type,
    amount,
    categoryId,
    note,
    occurredAt: date,
    accountId: bank.id,
    forWhom: "both",
    ...extra,
  });
add("expense", 18600, meal.id, "周末一起吃饭");
const purchase = f.repo.snapshot().txns[0];
add("refund", 3000, null, "优惠退款", "2026-10-30", {
  refundOfId: purchase.id,
});
add(
  "income",
  1200000,
  s.categories.find((c) => c.kind === "income").id,
  "十月收入",
  "2026-10-28",
);
add("transfer", 200000, null, "转入零钱", "2026-10-29", {
  toAccountId: target.id,
});
f.repo.createLoan({
  name: "验收贷款",
  principal: 1000000,
  paymentAccountId: bank.id,
  monthlyPayment: 100000,
  dueDay: 30,
  totalPeriods: 12,
  paidPeriods: 0,
  interestFreePeriods: 0,
  settlePeriod: 0,
});
f.repo.payLoan(f.repo.snapshot().plans[0].id, {
  amount: 100000,
  interest: 1000,
  date: "2026-10-30",
  categoryId: meal.id,
});
f.repo.setMonthBudget("2026-10", 300000, {
  [meal.parentId]: 15000,
  [meal.id]: 10000,
});
const expected = totals(f.repo.snapshot().txns);
const payload = f.repo.exportBackup();
f.sqlite.close();
fs.mkdirSync("tmp", { recursive: true });
fs.mkdirSync("docs/acceptance", { recursive: true });
const backup = path.resolve("tmp/experience-seed.json");
fs.writeFileSync(
  backup,
  JSON.stringify({
    format: "family-ledger-backup",
    version: 1,
    payload,
    checksum: require("node:crypto")
      .createHash("sha256")
      .update(payload)
      .digest("hex"),
  }),
);
const root = path.resolve("tmp/ui-build");
const server = http.createServer((req, res) => {
  let file = path.resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
  );
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403);
    res.end();
    return;
  }
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
      ".png": "image/png",
    }[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((resolve) => server.listen(4196, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
    });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const button = (name) => page.getByRole("button", { name, exact: true });
    const tab = (name) => page.getByRole("tab", { name, exact: true });
    const text = (name) => page.getByText(name, { exact: true });
    const shot = async (name) => {
      await page.waitForTimeout(350);
      return page.screenshot({
        path: `docs/acceptance/experience-${name}.png`,
      });
    };
    const noOverflow = async () =>
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "horizontal overflow",
      );
    await page.goto("http://127.0.0.1:4196/backup");
    await button("选择备份文件").waitFor();
    assert.equal(await text("示例账本 · 可放心体验").count(), 0);
    const chooser = page.waitForEvent("filechooser");
    await button("选择备份文件").click();
    await (await chooser).setFiles(backup);
    await button("确认替换本机账本").waitFor();
    page.once("dialog", (d) => d.accept());
    await button("确认替换本机账本").click();
    await text("恢复完成").waitFor();
    await page.goto("http://127.0.0.1:4196/");
    await button("选择月份").click();
    await button("2026年10月").click();
    await button("查看支出统计").waitFor();
    assert(
      (await button("查看支出统计").innerText()).includes(
        formatMoney(expected.expense),
      ),
    );
    await button("选择月份").click();
    await shot("month-picker");
    await button("上一年").click();
    await button("2025年12月").click();
    await button("下个月").click();
    assert((await button("选择月份").innerText()).includes("2026年1月"));
    await button("选择月份").click();
    await button("2026年10月").click();
    await shot("details");
    await noOverflow();
    await button("下个月").click();
    assert.equal((await button("选择月份").innerText()).trim(), "2026年11月");
    await button("上个月").click();
    await button("筛选交易").click();
    await button("支出").click();
    await button("退款").click();
    await button("完成").click();
    await text("2 种类型 · 3 笔").waitFor();
    // Search also matches the parent category; types remain multi-selected.
    await page.getByLabel("搜索备注、分类或账户", { exact: true }).fill("日常");
    await text("2 种类型 · 3 笔").waitFor();
    await page
      .getByLabel("搜索备注、分类或账户", { exact: true })
      .fill("不存在的分类");
    await text("2 种类型 · 0 笔").waitFor();
    await page.getByLabel("搜索备注、分类或账户", { exact: true }).fill("");
    await button("筛选交易").click();
    await button("重置类型筛选").click();
    await button("完成").click();
    await button("预算日均剩余说明").click();
    await page.getByText("再除以本月剩余天数", { exact: false }).waitFor();
    await shot("help");
    await button("关闭气泡").click({ position: { x: 2, y: 2 } });
    await button("明细预算设置").click();
    await button("分类预算与显示设置").click();
    await text("超支 ¥16.00").waitFor();
    await button("展开日常预算").click();
    await text("超支 ¥66.00").waitFor();
    await shot("budget");
    await button("编辑预算").click();
    await page.getByLabel("总预算", { exact: true }).fill("4000");
    await page.getByLabel("日常预算", { exact: true }).fill("2000");
    await page.getByLabel("日常 / 三餐预算", { exact: true }).fill("2500");
    assert.equal(await button("保存预算").isEnabled(), false);
    await page.getByLabel("日常 / 三餐预算", { exact: true }).fill("1000");
    await button("保存预算").click();
    await text("剩余 ¥1,834.00").waitFor();
    // Display preferences are independent of full allocations and transactions.
    await button("修改明细预算名称").click();
    await page.getByLabel("预算名称", { exact: true }).fill("生活开销");
    await button("保存名称").click();
    await page
      .getByRole("switch", { name: "日常 / 三餐计入明细预算", exact: true })
      .uncheck();
    await page
      .getByRole("switch", { name: "日常计入明细预算", exact: true })
      .uncheck();
    assert.equal(
      await page
        .getByRole("switch", { name: "日常 / 三餐计入明细预算", exact: true })
        .isEnabled(),
      false,
    );
    await page
      .getByRole("switch", { name: "日常计入明细预算", exact: true })
      .check();
    assert.equal(
      await page
        .getByRole("switch", { name: "日常 / 三餐计入明细预算", exact: true })
        .isChecked(),
      false,
    );
    await button("返回").click();
    await text("生活开销").waitFor();
    await page
      .getByTestId("detail-budget-summary")
      .getByText("¥3,000.00", { exact: true })
      .first()
      .waitFor();
    await page
      .getByTestId("detail-budget-summary")
      .getByText("¥0.00", { exact: true })
      .waitFor();
    assert(
      (await button("查看支出统计").innerText()).includes(
        formatMoney(expected.expense),
      ),
    );
    await button("明细预算范围说明").click();
    await page.getByText("按已开启的分类计算预算与支出", { exact: false }).waitFor();
    await shot("budget-scope");
    await page.keyboard.press("Escape");
    await page.reload();
    await text("生活开销").waitFor();
    await page
      .getByTestId("detail-budget-summary")
      .getByText("¥0.00", { exact: true })
      .waitFor();
    await shot("selected-budget");
    await button("明细预算设置").click();
    await button("分类预算与显示设置").click();
    await button("修改明细预算名称").click();
    assert.equal(
      await page.getByLabel("预算名称", { exact: true }).inputValue(),
      "生活开销",
    );
    await shot("budget-preferences");
    await page.keyboard.press("Escape");
    await button("恢复全部分类与默认名称").click();
    await button("返回").click();
    await text("本月预算").waitFor();
    await button("查看收入统计").click();
    await text("本月收入").first().waitFor();
    await shot("income-navigation");
    await page
      .getByRole("tab", { name: "收入", exact: true, selected: true })
      .waitFor();
    await tab("明细").click();
    await button("查看结余统计").click();
    await text("结余构成").waitFor();
    await tab("明细").click();
    await button("查看支出统计").click();
    await text("本月支出").first().waitFor();
    await button("支出统计选项").click();
    await button("统计口径").click();
    await button("计入还款本金说明").click();
    await page
      .getByText("开启后，统计本月归还本金所付出的金额", { exact: false })
      .waitFor();
    await page.keyboard.press("Escape");
    // Escape closes nested popovers; reopen the scope menu if needed.
    if (!(await page.getByRole("switch", { name: "计入还款本金" }).isVisible()))
      await button("支出统计选项").click();
    await page.getByRole("switch", { name: "计入还款本金" }).check();
    await page.keyboard.press("Escape");
    await text("本月流出").waitFor();
    await text("含还款本金").waitFor();
    await text(formatMoney(expected.expense + 99000))
      .first()
      .waitFor();
    await shot("stats");
    await page.reload();
    await text("本月流出").waitFor();
    await button("支出统计选项").click();
    await button("统计口径").click();
    await page.getByRole("switch", { name: "计入还款本金" }).uncheck();
    await page.keyboard.press("Escape");
    await text("本月支出").first().waitFor();
    await text(formatMoney(expected.expense)).first().waitFor();
    // Time ranges share segmented controls and immediate previous/next actions.
    await tab("周").click();
    const weekBefore = await button("选择统计周").innerText();
    await button("上一周").click();
    assert.notEqual(await button("选择统计周").innerText(), weekBefore);
    await button("下一周").click();
    assert.equal(await button("选择统计周").innerText(), weekBefore);
    await button("选择统计周").click();
    await page.getByLabel("选择周内日期", { exact: true }).fill("2026-01-01");
    assert((await button("选择统计周").innerText()).includes("2025.12.29"));
    await tab("年").click();
    await button("选择统计年份").click();
    await button("2026年").click();
    await button("下一年").click();
    assert((await button("选择统计年份").innerText()).includes("2027年"));
    await button("上一年").click();
    await tab("全部").click();
    await text("全部时间").waitFor();
    await tab("范围").click();
    await button("选择统计范围").click();
    await page.getByLabel("开始日期", { exact: true }).fill("2026-10-31");
    await page.getByLabel("结束日期", { exact: true }).fill("2026-10-01");
    await button("应用范围").click();
    assert(await button("应用范围").isVisible());
    await page.getByLabel("开始日期", { exact: true }).fill("2026-10-01");
    await page.getByLabel("结束日期", { exact: true }).fill("2026-10-31");
    await shot("range-picker");
    await button("应用范围").click();
    await text(formatMoney(expected.expense)).first().waitFor();
    await tab("月").click();
    await page.reload();
    await text("本月支出").first().waitFor();
    await button("下个月").click();
    await tab("明细").click();
    assert.equal((await button("选择月份").innerText()).trim(), "2026年11月");
    await button("上个月").click();
    assert(
      (await button("查看支出统计").innerText()).includes(
        formatMoney(expected.expense),
      ),
    );
    await button("进入我的").click();
    await button("外观").waitFor();
    await shot("me");
    await button("预算设置").click();
    await text("剩余 ¥1,834.00").waitFor();
    await button("返回").click();
    await button("外观").click();
    await button("暖白").click();
    await button("返回").click();
    await tab("明细").click();
    await shot("warm");
    await tab("我的").click();
    await button("外观").click();
    await button("深色").first().click();
    await page.reload();
    assert.equal(
      await button("深色").first().getAttribute("aria-selected"),
      "true",
    );
    await button("返回").click();
    await tab("明细").click();
    await page.setViewportSize({ width: 375, height: 667 });
    await noOverflow();
    await shot("dark-small");
    await button("选择月份").click();
    await noOverflow();
    await shot("month-picker-dark-small");
    await button("取消选择月份").click();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: month popup and year rollover; week/year/all/custom ranges; category budget exclusions and title persistence; full ledger unchanged; multi-select + search; budget allocation; principal reporting; 375px dark popup; zero page errors.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
