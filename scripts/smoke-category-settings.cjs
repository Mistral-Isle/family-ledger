const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(process.argv[2] || "tmp/family-build");
const server = http.createServer((req, res) => {
  let file = path.join(root, new URL(req.url, "http://localhost").pathname);
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
    }[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(4201, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const b = (n) => page.getByRole("button", { name: n, exact: true }),
      input = (n) => page.getByLabel(n, { exact: true }),
      go = (p) => page.goto("http://127.0.0.1:4201" + p);
    await go("/appearance");
    await b("暖白").click();
    await go("/entry");
    await b("分类设置").waitFor();
    await b("更多设置").click();
    await b("其他操作").click();
    assert.equal(await b("分类管理").count(), 0);
    await b("完成设置").click();
    await input("金额").fill("18");
    await input("备注").fill("明细精简检查");
    await b("分类设置").click();
    await b("新增分类").click();
    await input("分类名称").fill("排序新增");
    await b("保存分类").click();
    await b("排序新增").click();
    await input("分类名称").fill("排序修改");
    await b("保存分类").click();
    await b("排序修改").waitFor();
    async function order() {
      return page.getByRole("listitem").allTextContents();
    }
    async function dragShopping() {
      const from = await b("拖动排序购物").boundingBox(),
        to = await b("拖动排序餐饮").boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
        steps: 8,
      });
      await page.mouse.up();
      assert.deepEqual((await order()).slice(0, 2), ["购物", "餐饮"]);
    }
    await b("调整顺序").click();
    await dragShopping();
    await page.screenshot({ path: "tmp/category-reorder-390.png" });
    await b("取消分类排序").click();
    await b("调整顺序").click();
    assert.deepEqual((await order()).slice(0, 2), ["餐饮", "购物"]);
    await dragShopping();
    await b("保存分类顺序").click();
    await b("餐饮子分类排序").click();
    const childBefore = await order();
    await b("拖动排序" + childBefore[0]).press("ArrowDown");
    assert.equal((await order())[1], childBefore[0]);
    await b("保存分类顺序").click();
    await b("关闭").click();
    await page.waitForURL("**/entry");
    assert.equal(await input("金额").inputValue(), "18");
    assert.equal(await input("备注").inputValue(), "明细精简检查");
    const grid = await page
      .getByRole("button")
      .evaluateAll((els) =>
        els
          .map((el) => el.getAttribute("aria-label"))
          .filter((n) => ["餐饮", "购物"].includes(n)),
      );
    assert.deepEqual(grid, ["购物", "餐饮"]);
    await page.screenshot({ path: "tmp/category-gear-entry.png" });
    await b("餐饮").click();
    await b("日常用餐").click();
    await b("关闭二级分类").waitFor({ state: "hidden" });
    await b("完成记账").click();
    await page.waitForURL("http://127.0.0.1:4201/");
    await page.getByText(/明细精简检查/).waitFor();
    const body = await page.locator("body").innerText();
    assert(!body.includes("我付款"));
    assert(!body.includes("我记录"));
    await page.screenshot({ path: "tmp/details-compact.png" });
    await go("/budget");
    await b("分类预算开关说明").waitFor();
    const tip =
      "开关即时保存，适用于所有月份。关闭一级分类会一并排除子分类，重新开启后保留子分类选择。";
    assert.equal(await page.getByText(tip, { exact: true }).count(), 0);
    await b("分类预算开关说明").click();
    await page.getByText(tip, { exact: true }).waitFor();
    await b("关闭气泡").click({ position: { x: 8, y: 8 } });
    await b("关闭气泡").waitFor({ state: "hidden" });
    await b("明细预算范围说明").click();
    await page
      .getByText("当前包含全部支出分类。可在预算设置中调整明细页的显示范围。", {
        exact: true,
      })
      .waitFor();
    assert(!(await page.locator("body").innerText()).includes("包含："));
    await page.screenshot({ path: "tmp/budget-help-compact.png" });
    await b("关闭气泡").click({ position: { x: 8, y: 8 } });
    await b("关闭气泡").waitFor({ state: "hidden" });
    await page
      .getByRole("switch", { name: "餐饮计入明细预算", exact: true })
      .click();
    await b("明细预算范围说明").click();
    await page
      .getByText(
        "按已开启的分类计算预算与支出。可在预算设置中调整范围，不影响账单和完整预算。",
        { exact: true },
      )
      .waitFor();
    await b("关闭气泡").click({ position: { x: 8, y: 8 } });
    await b("关闭气泡").waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 375, height: 667 });
    await go("/categories");
    await b("调整顺序").click();
    await page.screenshot({ path: "tmp/category-reorder-375.png" });
    assert((await b("保存分类顺序").boundingBox()).y < 667);
    await b("取消分类排序").click();
    await go("/backup");
    const pending = page.waitForEvent("download");
    await b("导出完整备份").click();
    const download = await pending,
      chunks = [];
    for await (const chunk of await download.createReadStream())
      chunks.push(chunk);
    const data = JSON.parse(
        JSON.parse(Buffer.concat(chunks).toString()).payload,
      ),
      roots = data.tables.category
        .filter((c) => !c.deleted && !c.parent_id && c.kind === "expense")
        .sort((a, b) => a.sort - b.sort);
    assert.deepEqual(
      roots.slice(0, 2).map((c) => c.name),
      ["购物", "餐饮"],
    );
    const meal = roots.find((c) => c.name === "餐饮");
    assert.deepEqual(
      data.tables.category
        .filter((c) => c.parent_id === meal.id)
        .sort((a, b) => a.sort - b.sort)
        .slice(0, 2)
        .map((c) => c.name),
      [childBefore[1], childBefore[0]],
    );
    assert(data.tables.txn[0].payer_member_id);
    assert(data.tables.txn[0].recorder_member_id);
    assert.deepEqual(errors, []);
    console.log(
      "PASS gear/category settings, add/edit, pointer and keyboard reorder, cancel/save, child isolation, entry draft, concise metadata and budget help, 390/375 layouts.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
