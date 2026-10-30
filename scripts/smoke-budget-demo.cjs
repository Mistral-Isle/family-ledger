// Run against `node scripts/preview.cjs --demo`; uses an isolated browser context.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
    });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const button = (name) => page.getByRole("button", { name, exact: true });
    const toggle = (name) => page.getByRole("switch", { name, exact: true });
    const base = process.env.DEMO_URL || "http://127.0.0.1:4175";
    const summary = page.getByTestId("budget-display-preview");
    const full = page.getByTestId("full-budget-summary");
    const checkAmounts = async (locator, amounts) => {
      for (const amount of amounts)
        await locator.getByText(amount, { exact: true }).waitFor();
    };
    fs.mkdirSync("docs/acceptance", { recursive: true });
    const shot = (name) =>
      page.screenshot({ path: `docs/acceptance/budget-demo-${name}.png` });
    await page.goto(base + "/budget");
    await page.getByText("示例账本 · 可放心体验", { exact: true }).waitFor();
    await checkAmounts(summary, ["¥10,000.00", "¥6,800.00", "¥3,200.00"]);
    await shot("all");
    await toggle("固定支出计入明细预算").uncheck();
    await checkAmounts(summary, ["¥4,000.00", "¥1,800.00", "¥2,200.00"]);
    await checkAmounts(full, ["¥10,000.00", "¥6,800.00", "¥3,200.00"]);
    await summary.scrollIntoViewIfNeeded();
    await shot("excluded");
    await button("展开固定支出预算").click();
    assert.equal(
      await toggle("固定支出 / 房租计入明细预算").isEnabled(),
      false,
    );
    await toggle("固定支出计入明细预算").check();
    await toggle("固定支出 / 房租计入明细预算").uncheck();
    await toggle("固定支出计入明细预算").uncheck();
    await toggle("固定支出计入明细预算").check();
    assert.equal(
      await toggle("固定支出 / 房租计入明细预算").isChecked(),
      false,
    );
    await toggle("固定支出 / 房租计入明细预算").check();
    await toggle("固定支出计入明细预算").uncheck();
    await button("编辑预算").click();
    await page.getByLabel("固定支出预算", { exact: true }).fill("6100");
    assert.equal(await button("保存预算").isEnabled(), false);
    await button("取消金额编辑").click();
    assert.equal(await toggle("固定支出计入明细预算").isChecked(), false);
    await button("修改明细预算名称").click();
    await page.getByLabel("预算名称", { exact: true }).fill("日常预算");
    await button("保存名称").click();
    await page.reload();
    await page.getByText("日常预算", { exact: true }).waitFor();
    await checkAmounts(summary, ["¥4,000.00", "¥1,800.00", "¥2,200.00"]);
    await page.goto(base + "/");
    await checkAmounts(page.getByTestId("detail-budget-summary"), [
      "¥4,000.00",
      "¥1,800.00",
      "¥2,200.00",
    ]);
    assert((await button("查看支出统计").innerText()).includes("¥6,800.00"));
    await page.getByText("房租", { exact: true }).waitFor();
    await shot("details");
    await button("查看支出统计").click();
    await page.getByText("¥6,800.00", { exact: true }).first().waitFor();
    await page.goto(base + "/budget");
    await button("恢复全部分类与默认名称").click();
    await checkAmounts(summary, ["¥10,000.00", "¥6,800.00", "¥3,200.00"]);
    await page.setViewportSize({ width: 375, height: 667 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await button("编辑预算").click();
    await page.getByLabel("固定支出预算", { exact: true }).fill("5900");
    await button("展开固定支出预算").click();
    await page
      .getByLabel("固定支出 / 水电燃气预算", { exact: true })
      .fill("900");
    await button("保存预算").click();
    await toggle("固定支出计入明细预算").uncheck();
    await checkAmounts(summary, ["¥4,100.00", "¥1,800.00", "¥2,300.00"]);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: seeded demo; parent/child switches next to allocations; immediate totals; amount validation/save/cancel; title and switch persistence; full ledger/statistics unchanged; 375px layout; zero runtime errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
