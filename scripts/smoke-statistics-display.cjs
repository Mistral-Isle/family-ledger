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
    const base = process.env.DEMO_URL || "http://127.0.0.1:4175";
    const button = (name) => page.getByRole("button", { name, exact: true });
    const tab = (name) => page.getByRole("tab", { name, exact: true });
    const text = (name) => page.getByText(name, { exact: true });
    const calendar = () => text("收支日历");
    const chart = page.getByTestId("category-breakdown");
    fs.mkdirSync("docs/acceptance", { recursive: true });
    await page.goto(base + "/stats");
    await calendar().waitFor();
    await button("统计显示设置").click();
    await page
      .getByRole("switch", { name: "显示收支日历", exact: true })
      .uncheck();
    await page.keyboard.press("Escape");
    assert.equal(await calendar().count(), 0);
    await page.reload();
    await text("支出分类详情").waitFor();
    assert.equal(await calendar().count(), 0);
    await chart.getByText("¥6,800.00", { exact: true }).waitFor();
    await button("展开固定支出").click();
    await text("1 笔 · 占本类 90%").waitFor();
    await chart.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: "docs/acceptance/stats-donut-expanded.png" });
    await button("环比显示方式").click();
    await tab("比例").click();
    await text("较上期新增").first().waitFor();
    await button("分类层级与筛选").click();
    await tab("二级分类").click();
    await chart.getByText("房租", { exact: true }).first().waitFor();
    await page.setViewportSize({ width: 375, height: 667 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await chart.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: "docs/acceptance/stats-donut-small.png" });
    await tab("收入").click();
    await text("收入分类详情").waitFor();
    await chart.getByText("¥15,000.00", { exact: true }).first().waitFor();
    assert.equal(await text("支出分类详情").count(), 0);
    await button("统计显示设置").click();
    await page
      .getByRole("switch", { name: "显示收支日历", exact: true })
      .check();
    await page.keyboard.press("Escape");
    await calendar().waitFor();
    await tab("周").click();
    assert.equal(await calendar().count(), 0);
    await tab("月").click();
    await calendar().waitFor();
    await page.reload();
    await calendar().waitFor();
    await page.goto(base + "/");
    await button("筛选交易").click();
    await text("当前：全部类型").waitFor();
    assert.equal(await button("重置类型筛选").count(), 0);
    await button("支出").click();
    await text("当前：支出").waitFor();
    await button("完成").click();
    await page.getByLabel("搜索备注、分类或账户", { exact: true }).fill("房租");
    await text("1 种类型 · 1 笔").waitFor();
    await button("筛选交易").click();
    await button("重置类型筛选").click();
    await text("当前：全部类型").waitFor();
    assert.equal(await button("重置类型筛选").count(), 0);
    await page.screenshot({ path: "docs/acceptance/stats-type-reset.png" });
    await button("完成").click();
    assert.equal(
      await page
        .getByLabel("搜索备注、分类或账户", { exact: true })
        .inputValue(),
      "房租",
    );
    await text("房租").waitFor();
    await page.goto(base + "/appearance");
    await button("深色").first().click();
    await page.goto(base + "/stats");
    await button("统计显示设置").click();
    await page
      .getByRole("switch", { name: "显示收支日历", exact: true })
      .uncheck();
    await page.keyboard.press("Escape");
    await button("分类层级与筛选").click();
    await tab("二级分类").click();
    await chart.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: "docs/acceptance/stats-donut-dark.png" });
    await button("下个月").click();
    await text("所选时间暂无支出记录").waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: calendar default/persistence/month gating; root/child donut and counts; comparison; income/expense consistency; empty month; 375px light/dark; reset filter preserves search; zero runtime errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
