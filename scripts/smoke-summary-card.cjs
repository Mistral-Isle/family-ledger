// Disposable SQLite fixture and isolated browser; never opens the user's ledger.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
const f = require("../tests/sqlite.ts").fixture();
const initial = f.repo.snapshot();
const meal = initial.categories.find(
  (c) => c.kind === "expense" && c.parentId && !c.deleted,
);
const parent = initial.categories.find((c) => c.id === meal.parentId);
const common = {
  accountId: initial.accounts[0].id,
  occurredAt: "2026-10-10",
  note: "卡片验收",
  forWhom: "both",
};
f.repo.saveTxn({
  ...common,
  type: "expense",
  amount: 400000,
  categoryId: meal.id,
});
const original = f.repo.snapshot().txns[0];
f.repo.saveTxn({
  ...common,
  type: "refund",
  amount: 33000,
  refundOfId: original.id,
});
f.repo.saveTxn({
  ...common,
  type: "income",
  amount: 800000,
  categoryId: initial.categories.find((c) => c.kind === "income").id,
});
f.repo.setMonthBudget("2026-10", 500000, {
  [parent.id]: 200000,
  [meal.id]: 100000,
});
f.repo.setMonthBudget("2026-11", 0);
f.repo.setMonthBudget("2026-09", 500000);
f.repo.setAppearance("warm");
f.repo.setTheme("light");
const payload = f.repo.exportBackup();
f.sqlite.close();
const backup = Buffer.from(
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
const build = path.resolve(process.env.SUMMARY_BUILD || "tmp/summary-web");
const server = http.createServer((request, response) => {
  let file = path.resolve(
    build,
    "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname),
  );
  if (file !== build && !file.startsWith(build + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = path.join(build, "index.html");
  response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader(
    "Content-Type",
    {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript",
      ".wasm": "application/wasm",
      ".ttf": "font/ttf",
      ".png": "image/png",
    }[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(response);
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      locale: "zh-CN",
      hasTouch: true,
      timezoneId: "Asia/Shanghai",
    });
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00+08:00"));
    page.setDefaultTimeout(12000);
    page.on("dialog", (dialog) => dialog.accept());
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const button = (name) => page.getByRole("button", { name, exact: true });
    const tab = (name) => page.getByRole("tab", { name, exact: true });
    const base = `http://127.0.0.1:${server.address().port}`;
    const card = page.getByTestId("monthly-summary-card");
    const cash = page.getByTestId("cashflow-summary");
    const budget = page.getByTestId("detail-budget-summary");
    const shot = async (name) => {
      await page.waitForTimeout(250);
      await page.screenshot({ path: `docs/acceptance/summary-${name}.png` });
    };
    const contains = async (locator, text) =>
      assert(
        (await locator.innerText()).includes(text),
        `Missing ${text} in ${await locator.innerText()}`,
      );
    const choose = async (group, label) => {
      await button(`切换${group}主数字`).click();
      await button(`主数字显示${label}`).click();
    };
    const selectMonth = async (label) => {
      await button("选择月份").click();
      await button(label).click();
    };
    await page.goto(base + "/backup");
    const picker = page.waitForEvent("filechooser");
    await button("选择备份文件").click();
    await (
      await picker
    ).setFiles({
      name: "summary-test.json",
      mimeType: "application/json",
      buffer: backup,
    });
    await button("确认替换本机账本").click();
    await page.getByText("恢复完成", { exact: true }).waitFor();
    await page.goto(base + "/");
    await card.waitFor();
    await contains(button("查看支出统计"), "¥3,670.00");
    assert.equal(await card.locator("select").count(), 0);
    const transactionButtons = page.getByRole("button", {
      name: /¥(?:4,000|330|8,000)\.00$/,
    });
    assert.equal(await transactionButtons.count(), 3);
    const rowBounds = await transactionButtons.evaluateAll((elements) =>
      elements
        .map((element) => {
          const { y, height } = element.getBoundingClientRect();
          return { y, height };
        })
        .sort((a, b) => a.y - b.y),
    );
    for (let i = 0; i < rowBounds.length; i++) {
      assert(
        Math.abs(rowBounds[i].height - rowBounds[0].height) < 1,
        "Rows with the same amount of text have equal height",
      );
      if (i)
        assert(
          Math.abs(
            rowBounds[i].y - rowBounds[i - 1].y - rowBounds[i - 1].height - 1,
          ) < 1,
          "Only the separator sits between transaction rows, without an extra card gap",
        );
    }
    await transactionButtons
      .first()
      .locator("xpath=../../../../..")
      .screenshot({
        path: "docs/acceptance/summary-transaction-spacing.png",
      });
    console.log("Transaction row measurements:", rowBounds);
    await shot("cashflow-390");
    const height = (await card.boundingBox()).height;
    assert(height < 290, `Card too tall: ${height}`);
    await button("切换收支主数字").click();
    await shot("metric-menu");
    await page.keyboard.press("Escape");
    assert.equal(await button("主数字显示本月收入").count(), 0);
    await choose("收支", "本月收入");
    await contains(button("查看收入统计"), "¥8,000.00");
    await choose("收支", "本月结余");
    await contains(button("查看结余统计"), "¥4,330.00");
    const swipe = async (direction) => {
      const bounds = await page.getByTestId("summary-pager").boundingBox();
      const start = direction === "left" ? 0.85 : 0.15;
      const end = direction === "left" ? 0.15 : 0.85;
      await page.mouse.move(
        bounds.x + bounds.width * start,
        bounds.y + bounds.height * 0.6,
      );
      await page.mouse.down();
      await page.mouse.move(
        bounds.x + bounds.width * end,
        bounds.y + bounds.height * 0.6,
        { steps: 15 },
      );
      await page.mouse.up();
      await page.waitForTimeout(450);
      assert.equal(
        await tab(direction === "left" ? "预算概览" : "收支概览").getAttribute(
          "aria-selected",
        ),
        "true",
      );
      assert(
        new URL(page.url()).pathname === "/",
        "Dragging a number must not navigate",
      );
    };
    await swipe("left");
    await contains(button("查看预算详情"), "¥1,330.00");
    assert.equal((await card.boundingBox()).height, height);
    await shot("budget-390");
    await choose("预算", "预算总额");
    await contains(button("查看预算详情"), "¥5,000.00");
    await contains(budget, "¥3,670.00");
    await page.reload();
    await button("切换预算主数字").waitFor();
    assert.equal(await tab("预算概览").getAttribute("aria-selected"), "true");
    await contains(button("切换预算主数字"), "预算总额");
    await swipe("right");
    await contains(button("切换收支主数字"), "本月结余");
    await button("查看收入统计").click();
    await page
      .getByRole("tab", { name: "收入", exact: true, selected: true })
      .waitFor();
    await tab("明细").click();
    await tab("预算概览").click();
    await choose("预算", "预算剩余");
    await button("预算日均剩余说明").click();
    await page.getByText("再除以本月剩余天数", { exact: false }).waitFor();
    await page.keyboard.press("Escape");
    await button("明细预算设置").click();
    await button("编辑预算").click();
    await page.getByLabel("总预算", { exact: true }).fill("3000");
    await button("保存预算").click();
    await button("返回").click();
    await contains(button("查看预算详情"), "¥-670.00");
    await contains(budget, "已超支");
    await contains(budget, "¥-670.00");
    await shot("overspent");
    await selectMonth("2026年11月");
    await contains(button("查看预算详情"), "¥0.00");
    assert.equal(
      await budget.getByText("预算未设置", { exact: true }).count(),
      0,
    );
    await selectMonth("2026年12月");
    await contains(button("查看预算详情"), "预算未设置");
    await contains(button("明细预算设置"), "设置预算");
    await shot("unset");
    await selectMonth("2026年9月");
    await contains(budget, "已结束");
    await selectMonth("2026年10月");
    await button("明细预算设置").click();
    await button("编辑预算").click();
    await page.getByLabel("总预算", { exact: true }).fill("5000");
    await button("保存预算").click();
    await button("修改明细预算名称").click();
    await page.getByLabel("预算名称", { exact: true }).fill("生活开销");
    await button("保存名称").click();
    await page
      .getByRole("switch", { name: `${parent.name}计入明细预算`, exact: true })
      .uncheck();
    await button("返回").click();
    await contains(budget, "生活开销");
    await contains(button("查看预算详情"), "¥3,000.00");
    await tab("收支概览").click();
    await choose("收支", "本月支出");
    await contains(button("查看支出统计"), "¥3,670.00");
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await tab("预算概览").click();
      await page.waitForTimeout(350);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        await page
          .getByTestId("summary-pager")
          .evaluate(
            (element) => Math.abs(element.scrollLeft - element.clientWidth) < 2,
          ),
        true,
      );
      await shot(`budget-${width}`);
      await button("切换预算主数字").click();
      await button("主数字显示预算剩余").waitFor();
      await page.keyboard.press("Escape");
      await tab("收支概览").click();
      await shot(`cashflow-${width}`);
    }
    await tab("我的").click();
    await button("外观").click();
    await button("深色").first().click();
    await button("返回").click();
    await tab("明细").click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await tab("预算概览").click();
    await shot("dark");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 1,
    });
    const bounds = await page.getByTestId("summary-pager").boundingBox();
    const y = bounds.y + bounds.height * 0.6;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: bounds.x + bounds.width * 0.15, y }],
    });
    for (let step = 1; step <= 12; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: bounds.x + bounds.width * (0.15 + (0.7 * step) / 12), y },
        ],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(450);
    assert.equal(
      await tab("收支概览").getAttribute("aria-selected"),
      "true",
      "Touch swipe changes pages",
    );
    await button("切换收支主数字").tap();
    await button("主数字显示本月收入").tap();
    await contains(button("查看收入统计"), "¥8,000.00");
    await cdp.detach();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real totals/refunds; both swipes; menus; persistent page and metrics; statistics navigation; editable, zero, missing, overspent and past budgets; category exclusions; 320/375/390px; dark/reduced motion; zero page errors.",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
