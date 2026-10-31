const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(process.argv[2] || "tmp/entry-followup-web");
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
  await new Promise((r) => server.listen(4197, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const go = (p) => page.goto("http://127.0.0.1:4197" + p),
      b = (n) => page.getByRole("button", { name: n, exact: true }),
      input = (n) => page.getByLabel(n, { exact: true });
    const defaults = ["餐饮", "购物", "汽车", "数字服务", "交通", "娱乐"];
    async function order() {
      const current = await page
        .getByRole("button")
        .evaluateAll((els) =>
          els
            .map((el) => el.getAttribute("aria-label"))
            .filter((n) =>
              [
                "餐饮",
                "购物",
                "汽车",
                "数字服务",
                "交通",
                "娱乐",
                "居住",
              ].includes(n),
            ),
        );
      assert.deepEqual(current.slice(0, 6), defaults);
    }
    async function fits() {
      for (const el of [
        input("金额"),
        b("日期与时间"),
        b("更多设置"),
        b("关联行程"),
        b("完成记账"),
      ]) {
        const box = await el.boundingBox();
        assert(
          box &&
            box.y >= 0 &&
            box.y + box.height <= page.viewportSize().height + 1,
          "field outside viewport " + JSON.stringify(box),
        );
      }
    }
    async function backup() {
      await go("/backup");
      const pending = page.waitForEvent("download");
      await b("导出完整备份").click();
      const d = await pending;
      const chunks = [];
      for await (const x of await d.createReadStream()) chunks.push(x);
      return JSON.parse(JSON.parse(Buffer.concat(chunks).toString()).payload);
    }
    await go("/entry");
    await b("餐饮").waitFor();
    await order();
    await b("关闭").click();
    await page.waitForURL("http://127.0.0.1:4197/");
    await b("记下第一笔").waitFor();
    await b("记下第一笔").click();
    await b("餐饮").waitFor();
    await b("关闭").click();
    await page.waitForURL("http://127.0.0.1:4197/");
    await go("/appearance");
    await b("暖白").click();
    await go("/entry");
    await b("更多设置").waitFor();
    await fits();
    assert.equal(
      await page
        .getByRole("checkbox", { name: "不计入预算", exact: true })
        .count(),
      0,
    );
    assert.equal(await b("关联行程").count(), 1);
    await page.screenshot({ path: "tmp/entry-followup-390.png" });
    await b("娱乐").click();
    await b("游戏").click();
    await b("关闭二级分类").waitFor({ state: "hidden" });
    await input("金额").fill("28.50");
    await input("备注").fill("设置与排序回归");
    await b("更多设置").click();
    await page
      .getByRole("checkbox", { name: "不计入预算", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "不计入收支", exact: true })
      .click();
    await page.screenshot({ path: "tmp/entry-followup-options.png" });
    assert.equal(
      await b("关联行程").count(),
      1,
      "settings do not duplicate the trip entry",
    );
    await b("完成设置").click();
    await b("关联行程").click();
    await b("创建行程").click();
    await input("行程名称").fill("周末行程");
    await input("开始日期（可选）").fill("2026-10-30");
    const clearDate = b("清除日期").first();
    const clearBox = await clearDate.boundingBox();
    const dateBox = await input("开始日期（可选）").boundingBox();
    assert(
      clearBox.width < dateBox.width / 2,
      "clear date only occupies its button",
    );
    await page.mouse.click(
      dateBox.x + dateBox.width - 8,
      clearBox.y + clearBox.height / 2,
    );
    assert.equal(await input("开始日期（可选）").inputValue(), "2026-10-30");
    await clearDate.click();
    assert.equal(await input("开始日期（可选）").inputValue(), "");
    await b("创建并关联").click();
    await b("关联行程").waitFor();
    await page.getByText("周末行程", { exact: true }).waitFor();
    assert.equal(await b("完成设置").count(), 0);
    assert((await b("关联行程").innerText()).includes("周末行程"));
    const tripBox = await b("关联行程").boundingBox();
    const settingsBox = await b("更多设置").boundingBox();
    assert(
      Math.abs(tripBox.y - settingsBox.y) < 5,
      "trip is on the account/settings row",
    );
    await b("日期与时间").click();
    await b("调整时间").click();
    await input("选择时间").fill("08:05");
    await b("取消").click();
    assert(!(await b("日期与时间").innerText()).includes("08:05"));
    await b("日期与时间").click();
    await b("调整时间").click();
    await input("选择时间").fill("20:34");
    await b("确定").click();
    assert((await b("日期与时间").innerText()).includes("20:34"));
    assert.equal(await input("金额").inputValue(), "28.50");
    assert.equal(await input("备注").inputValue(), "设置与排序回归");
    await b("保存再记").click();
    await page.getByText("已保存", { exact: true }).waitFor();
    await order();
    await page.setViewportSize({ width: 375, height: 667 });
    await fits();
    await page.screenshot({ path: "tmp/entry-followup-375.png" });
    const data = await backup();
    const txns = data.tables.txn.filter((t) => !t.deleted);
    assert.equal(txns.length, 1);
    assert.equal(txns[0].exclude_budget, 1);
    assert.equal(txns[0].exclude_totals, 1);
    assert.equal(txns[0].occurred_time, "20:34");
    assert.equal(txns[0].amount, 2850);
    assert.equal(
      data.tables.trip.find((t) => t.id === txns[0].trip_id).name,
      "周末行程",
    );
    await go("/entry");
    await b("餐饮").waitFor();
    await order();
    await b("餐饮").click();
    await b("日常用餐").click();
    await b("关闭二级分类").waitFor({ state: "hidden" });
    await input("金额").fill("12");
    await b("完成记账").click();
    await page.waitForURL("http://127.0.0.1:4197/");
    await go("/entry?id=" + encodeURIComponent(txns[0].id));
    await b("更多设置").waitFor();
    await b("更多设置").click();
    await b("其他操作").click();
    await b("删除").click();
    await page.waitForURL("http://127.0.0.1:4197/");
    await go("/categories");
    await b("购物").waitFor();
    await b("调整顺序").click();
    await b("拖动排序购物").press("ArrowUp");
    await b("保存分类顺序").click();
    await go("/entry");
    await b("购物").waitFor();
    const customOrder = await page
      .getByRole("button")
      .evaluateAll((els) =>
        els
          .map((el) => el.getAttribute("aria-label"))
          .filter((n) => ["餐饮", "购物", "汽车"].includes(n)),
      );
    assert.deepEqual(customOrder, ["购物", "餐饮", "汽车"]);
    await page.reload();
    await b("关闭").click();
    await page.waitForURL("http://127.0.0.1:4197/");
    assert.deepEqual(errors, []);
    await go("/finance?kind=rent");
    await input("租赁名称").fill("账户隐藏验收房租");
    await input("按季租金（元／期）").fill("10500");
    await input("押金（元，无押金填 0）").fill("3500");
    await b("保存并记录首期付款").click();
    await input("租赁名称").waitFor({ state: "hidden" });
    const rentData = await backup();
    assert.equal(
      rentData.tables.account.filter(
        (a) => !a.deleted && a.name.startsWith("账户隐藏验收房租"),
      ).length,
      2,
    );
    await go("/assets");
    await page.getByText("家庭净资产", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("账户隐藏验收房租", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByText("账户隐藏验收房租 · 押金", { exact: true }).count(),
      0,
    );
    await b("显示已归档").click();
    assert.equal(
      await page.getByText("账户隐藏验收房租", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByText("账户隐藏验收房租 · 押金", { exact: true }).count(),
      0,
    );
    await page.screenshot({
      path: "tmp/entry-followup-assets.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS rental accounts hidden and retained, direct trip selection, clear-date hit area, close/save/delete, category order, settings persistence, time cancel/confirm, 390x844 and 375x667.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
