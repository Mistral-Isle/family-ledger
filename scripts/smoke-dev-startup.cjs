// Read-only UI verification on the actual development URL.
// A fresh non-persistent context is independent of the user's browser profile.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const url = process.env.PREVIEW_URL || "http://localhost:8085/";
    const response = await page.goto(url);
    assert.equal(
      response.headers()["cross-origin-opener-policy"],
      "same-origin",
    );
    assert.equal(
      response.headers()["cross-origin-embedder-policy"],
      "credentialless",
    );
    assert.equal(
      await page.evaluate(
        () => crossOriginIsolated && typeof SharedArrayBuffer === "function",
      ),
      true,
    );
    const ready = () =>
      page.getByRole("button", { name: "查看支出统计", exact: true }).waitFor();
    await ready();
    const before = await page
      .getByRole("button", { name: "查看支出统计", exact: true })
      .innerText();
    await page.reload();
    await ready();
    assert.equal(
      await page
        .getByRole("button", { name: "查看支出统计", exact: true })
        .innerText(),
      before,
    );
    const second = await context.newPage();
    second.on("pageerror", (e) => errors.push(e.message));
    await second.goto(url);
    await second
      .getByText("账本已在另一个标签页打开", { exact: true })
      .waitFor();
    await page.close();
    await second
      .getByRole("button", { name: "查看支出统计", exact: true })
      .waitFor();
    assert.equal(
      await second
        .getByRole("button", { name: "查看支出统计", exact: true })
        .innerText(),
      before,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS actual dev URL: isolation headers, SQLite startup, reload, waiting tab and lock handoff; no transaction writes, no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
