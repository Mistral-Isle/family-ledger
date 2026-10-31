const fs = require("node:fs");
const ts = require("typescript");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    f,
  );
const fixture = require("../tests/sqlite.ts").fixture();
const repo = fixture.repo;
const accountId = repo.snapshot().accounts[0].id;
for (const [index, name, icon, amount, count] of [
  [0, "固定", "house.fill", 350000, 1],
  [1, "人情 / 礼物", "gift.fill", 15600, 5],
  [2, "日常", "fork.knife", 1400, 2],
]) {
  repo.saveCategory({
    name,
    kind: "expense",
    parentId: null,
    icon,
    color: index === 2 ? "#F2676B" : index === 1 ? "#E9BD42" : "#E8BC41",
    sort: index - 10,
  });
  const categoryId = repo.snapshot().categories.find((c) => c.name === name).id;
  for (let i = 0; i < count; i++)
    repo.saveTxn({
      type: "expense",
      amount: amount / count,
      categoryId,
      accountId,
      occurredAt: "2026-10-10",
      forWhom: "both",
      note: "饼图显示验收",
    });
}
repo.setShowIncomeCalendar(false);
repo.setAppearance("warm");
repo.setTheme("light");
const payload = repo.exportBackup();
fixture.sqlite.close();
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
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
    });
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00+08:00"));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const button = (name) => page.getByRole("button", { name, exact: true });
    const base = process.env.DEMO_URL || "http://127.0.0.1:4177";
    await page.goto(base + "/backup");
    const picker = page.waitForEvent("filechooser");
    await button("选择备份文件").click();
    await (
      await picker
    ).setFiles({
      name: "donut-test.json",
      mimeType: "application/json",
      buffer: backup,
    });
    await button("确认替换本机账本").click();
    await page.getByText("恢复完成", { exact: true }).waitFor();
    await page.goto(base + "/stats");
    const chart = page.getByTestId("category-donut");
    const section = page.getByTestId("category-breakdown");
    await chart.getByText("¥3,670.00", { exact: true }).waitFor();
    assert((await chart.getAttribute("aria-label")).includes("95.37%"));
    const colors = await chart
      .locator("polyline")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("stroke")));
    assert.equal(new Set(colors).size, 3);
    for (const width of [390, 375, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await section.evaluate((node) => node.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: `docs/acceptance/stats-donut-colors-${width}.png`,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert(
        await chart.getByText("¥3,670.00", { exact: true }).evaluate(
          (node) => node.scrollWidth <= node.clientWidth,
        ),
        "center amount is not clipped",
      );
      const labels = await chart.locator("svg text").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBBox();
          const svg = n.ownerSVGElement;
          return { x: r.x, end: r.x + r.width, width: svg.width.baseVal.value };
        }),
      );
      assert(
        labels.every((r) => r.x >= -1 && r.end <= r.width + 1),
        "labels fit within chart",
      );
    }
    await page.goto(base + "/appearance");
    await button("深色").first().click();
    await page.goto(base + "/stats");
    await chart.getByText("¥3,670.00", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await section.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: "docs/acceptance/stats-donut-colors-dark.png",
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: screenshot proportions; three distinct colors; labels fit 320/375/390px; warm and dark; no runtime errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
