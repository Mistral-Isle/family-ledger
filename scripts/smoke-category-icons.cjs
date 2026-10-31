const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const origin = process.argv[2] || "http://localhost:4173";
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const b = (name) => page.getByRole("button", { name, exact: true });
    const paths = async (name) =>
      b(name)
        .locator("svg path")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("d")));
    await page.goto(origin + "/appearance");
    await b("暖白").click();
    await page.goto(origin + "/entry");
    await b("汽车").waitFor();
    assert(
      (await paths("汽车")).join(" ").includes("C4.8 9.5"),
      "rounded side car is rendered",
    );
    await page.screenshot({ path: "tmp/category-icons-primary.png" });
    await b("餐饮").click();
    await b("买菜食材").waitFor();
    assert(
      (await paths("买菜食材")).join(" ").includes("M2.27 21.7"),
      "groceries use a carrot",
    );
    await page.screenshot({ path: "tmp/category-icons-dining.png" });
    await b("关闭二级分类").click();
    await b("购物").click();
    await b("美妆").waitFor();
    assert(
      (await paths("美妆")).join(" ").includes("M8 11h8v9"),
      "makeup uses lipstick",
    );
    await page.screenshot({ path: "tmp/category-icons-shopping.png" });
    await b("关闭二级分类").click();
    await page.getByRole("tab", { name: "收入", exact: true }).click();
    const names = [
      "工资奖金",
      "副业收入",
      "福利补贴",
      "公积金",
      "红包礼金",
      "二手出售",
      "其他收入",
    ];
    const shapes = await Promise.all(names.map(paths));
    assert.equal(new Set(shapes.map(JSON.stringify)).size, 7);
    for (const name of names) {
      const box = await b(name).boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 391);
    }
    await page.screenshot({ path: "tmp/category-icons-income.png" });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(origin + "/appearance");
    await b("深色").click();
    await page.goto(origin + "/entry");
    await page.getByRole("tab", { name: "收入", exact: true }).click();
    await b("公积金").waitFor();
    await page.screenshot({ path: "tmp/category-icons-income-dark.png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS approved rounded car, lipstick, groceries, seven distinct income icons, light/dark small screens; no runtime errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
