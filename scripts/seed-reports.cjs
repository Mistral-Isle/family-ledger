const fs = require("fs"),
  ts = require("typescript");
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
const f = require("../tests/sqlite.ts").fixture();
const s = f.repo.snapshot();
const c = s.categories.find((c) => c.kind === "expense" && c.parentId);
f.repo.saveTxn({
  type: "expense",
  amount: 10000,
  accountId: s.accounts[0].id,
  categoryId: c.id,
  occurredAt: "2026-10-01",
  note: "网页阶段二验收",
  forWhom: "both",
});
f.repo.saveTxn({
  type: "income",
  amount: 50000,
  accountId: s.accounts[0].id,
  categoryId: s.categories.find((c) => c.kind === "income").id,
  occurredAt: "2026-10-02",
  note: "验收收入",
  forWhom: "me",
});
const payload = f.repo.exportBackup();
fs.writeFileSync(
  "tmp/stage2-seed.json",
  JSON.stringify({
    format: "family-ledger-backup",
    version: 1,
    payload,
    checksum: require("crypto")
      .createHash("sha256")
      .update(payload)
      .digest("hex"),
  }),
);
f.sqlite.close();
