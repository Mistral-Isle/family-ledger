import { validateBudgetAllocation } from "../domain/budgets";
import type { Category } from "../domain/types";
import { validateLoan, validatePlanData } from "../domain/finance";
import type { SqlDriver } from "./repository";
import { zh } from "../i18n/zh";

const tables = [
  "member",
  "account",
  "category",
  "txn",
  "plan",
  "budget",
  "outbox",
  "local_pref",
] as const;
type Table = (typeof tables)[number];
type Row = Record<string, string | number | null>;
export type BackupData = {
  format: "family-ledger";
  version: 4;
  createdAt: string;
  tables: Record<Table, Row[]>;
};
const fail = (): never => {
  throw new Error(zh.backup.invalid);
};
export function exportBackup(db: SqlDriver): string {
  let result = "";
  db.withTransactionSync(() => {
    const data = Object.fromEntries(
      tables.map((t) => [t, db.getAllSync<Row>(`SELECT * FROM ${t}`)]),
    );
    result = JSON.stringify({
      format: "family-ledger",
      version: 4,
      createdAt: new Date().toISOString(),
      tables: data,
    });
  });
  return result;
}
export function parseBackup(db: SqlDriver, text: string): BackupData {
  if (text.length > 20 * 1024 * 1024) throw new Error(zh.backup.tooLarge);
  let value: BackupData;
  try {
    value = JSON.parse(text);
  } catch {
    return fail();
  }
  if (!value || value.format !== "family-ledger") return fail();
  if (
    Number(value.version) === 1 &&
    value.tables &&
    (value.tables as Partial<BackupData["tables"]>).plan === undefined
  ) {
    value.tables.plan = [];
    value.version = 2 as 4;
  }
  if (
    Number(value.version) === 2 &&
    value.tables &&
    (value.tables as Partial<BackupData["tables"]>).budget === undefined
  ) {
    value.tables.budget = [];
    value.version = 3 as 4;
  }
  if (Number(value.version) === 3) {
    for (const row of value.tables.txn ?? [])
      row.occurred_time = row.occurred_time ?? null;
    for (const row of value.tables.budget ?? [])
      row.allocations = row.allocations ?? "{}";
    value.version = 4;
  }
  if (value.version !== 4) throw new Error(zh.backup.version);
  if (
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !value.tables ||
    Object.keys(value.tables).sort().join() !== [...tables].sort().join()
  )
    return fail();
  for (const table of tables) {
    const rows = value.tables[table];
    if (!Array.isArray(rows)) return fail();
    const columns = db.getAllSync<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>(`PRAGMA table_info(${table})`);
    const seen = new Set();
    for (const row of rows) {
      if (table === "txn" && row && row.occurred_time === undefined)
        row.occurred_time = null;
      if (
        !row ||
        typeof row !== "object" ||
        Object.keys(row).sort().join() !==
          columns
            .map((c) => c.name)
            .sort()
            .join()
      )
        return fail();
      for (const c of columns) {
        const v = row[c.name];
        if (v === null && !c.notnull && !c.pk) continue;
        if (
          c.type === "INTEGER"
            ? !Number.isSafeInteger(v)
            : typeof v !== "string"
        )
          return fail();
        if (
          ["deleted", "hidden", "archived", "discarded", "uploaded"].includes(
            c.name,
          ) &&
          v !== 0 &&
          v !== 1
        )
          return fail();
        if (c.pk) {
          if (seen.has(v) || v === "") return fail();
          seen.add(v);
        }
      }
    }
  }
  const { member, account, category, txn, outbox, local_pref } = value.tables;
  const has = (rows: Row[], id: unknown) => rows.some((r) => r.id === id);
  for (const a of account)
    if (
      !has(member, a.owner_member_id) ||
      !["family", "private"].includes(String(a.scope)) ||
      ![
        "bank",
        "wechat",
        "alipay",
        "cash",
        "credit",
        "loan",
        "deposit",
        "prepaid",
      ].includes(String(a.kind))
    )
      return fail();
  for (const c of category) {
    if (!["income", "expense"].includes(String(c.kind))) return fail();
    if (
      c.parent_id &&
      !category.some(
        (p) =>
          p.id === c.parent_id &&
          p.id !== c.id &&
          !p.parent_id &&
          p.kind === c.kind,
      )
    )
      return fail();
    if (
      c.merged_into &&
      !category.some(
        (p) => p.id === c.merged_into && p.id !== c.id && p.kind === c.kind,
      )
    )
      return fail();
  }
  for (const t of txn) {
    const a = account.find((a) => a.id === t.account_id);
    if (
      !a ||
      a.scope !== t.scope ||
      !has(member, t.recorder_member_id) ||
      ![
        "expense",
        "income",
        "transfer",
        "refund",
        "repayment",
        "adjust",
        "scope_in",
        "scope_out",
      ].includes(String(t.type)) ||
      !["me", "partner", "both"].includes(String(t.for_whom))
    )
      return fail();
    if (
      t.occurred_time != null &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t.occurred_time))
    )
      return fail();
    const date = String(t.occurred_at);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      return fail();
    if (t.type !== "adjust" && Number(t.amount) <= 0) return fail();
    if (
      t.to_account_id &&
      !account.some(
        (a) =>
          a.id === t.to_account_id &&
          a.scope === t.scope &&
          a.id !== t.account_id,
      )
    )
      return fail();
    if (["transfer", "repayment"].includes(String(t.type)) && !t.to_account_id)
      return fail();
    if (
      ["income", "expense", "refund"].includes(String(t.type)) &&
      !category.some(
        (c) =>
          c.id === t.category_id &&
          c.kind === (t.type === "income" ? "income" : "expense"),
      )
    )
      return fail();
    if (
      Number(t.refund_income) < 0 ||
      (t.type === "refund" && Number(t.refund_income) > Number(t.amount))
    )
      return fail();
    if (
      t.refund_income &&
      !category.some(
        (c) => c.id === t.refund_income_category_id && c.kind === "income",
      )
    )
      return fail();
    if (
      t.type === "refund" &&
      !txn.some(
        (s) =>
          s.id === t.refund_of_id &&
          s.type === "expense" &&
          s.scope === t.scope,
      )
    )
      return fail();
  }
  let prefs: Record<string, any>;
  try {
    prefs = Object.fromEntries(
      local_pref.map((p) => [String(p.key), JSON.parse(String(p.value))]),
    );
  } catch {
    return fail();
  }
  if (
    prefs.monthBudgets !== undefined &&
    (!prefs.monthBudgets ||
      typeof prefs.monthBudgets !== "object" ||
      Array.isArray(prefs.monthBudgets) ||
      !Object.entries(prefs.monthBudgets).every(
        ([month, amount]) =>
          /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
          Number.isSafeInteger(amount) &&
          Number(amount) > 0,
      ))
  )
    return fail();
  if (
    prefs.scopeTransfers !== undefined &&
    (!Array.isArray(prefs.scopeTransfers) ||
      !prefs.scopeTransfers.every(
        (p: any) =>
          p &&
          typeof p.id === "string" &&
          txn.some(
            (t) =>
              t.id === p.familyId &&
              t.scope === "family" &&
              ["scope_in", "scope_out"].includes(String(t.type)),
          ) &&
          txn.some(
            (t) =>
              t.id === p.privateId &&
              t.scope === "private" &&
              ["scope_in", "scope_out"].includes(String(t.type)),
          ),
      ))
  )
    return fail();
  const p = prefs.preferences;
  if (
    prefs.initialized !== true ||
    typeof prefs.deviceId !== "string" ||
    !prefs.deviceId ||
    !has(member, prefs.meId) ||
    !Number.isSafeInteger(prefs.seq) ||
    prefs.seq < 0 ||
    !Array.isArray(prefs.hlc) ||
    prefs.hlc.length !== 2 ||
    !prefs.hlc.every((v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0)
  )
    return fail();
  if (
    !p ||
    !Array.isArray(p.pinned) ||
    !p.pinned.every((id: unknown) => has(account, id)) ||
    !Array.isArray(p.recentCategories) ||
    !p.recentCategories.every((id: unknown) => has(category, id)) ||
    !p.lastAccount ||
    typeof p.lastAccount !== "object" ||
    !Object.entries(p.lastAccount).every(
      ([id, a]) => has(category, id) && has(account, a),
    ) ||
    !["standard", "daily"].includes(p.mode) ||
    !Array.isArray(p.favorites) ||
    p.favorites.length > 12
  )
    return fail();
  for (const f of p.favorites)
    if (
      !f ||
      typeof f.id !== "string" ||
      typeof f.label !== "string" ||
      typeof f.note !== "string" ||
      !has(category, f.categoryId) ||
      !has(account, f.accountId) ||
      (f.amount !== undefined &&
        (!Number.isSafeInteger(f.amount) || f.amount <= 0))
    )
      return fail();
  if (
    prefs.theme !== undefined &&
    !["system", "light", "dark"].includes(prefs.theme)
  )
    return fail();
  if (
    prefs.categoryDeletionHistory !== undefined &&
    (!Array.isArray(prefs.categoryDeletionHistory) ||
      !prefs.categoryDeletionHistory.every(
        (h: any) =>
          h &&
          typeof h.id === "string" &&
          typeof h.name === "string" &&
          Array.isArray(h.categories) &&
          Array.isArray(h.txns) &&
          [h.favoritesBefore, h.favoritesAfter].every(
            (list) =>
              list === undefined ||
              (Array.isArray(list) &&
                list.length <= 12 &&
                list.every(
                  (f) =>
                    f &&
                    typeof f.id === "string" &&
                    typeof f.label === "string" &&
                    typeof f.note === "string" &&
                    has(category, f.categoryId) &&
                    has(account, f.accountId) &&
                    (f.amount === undefined ||
                      (Number.isSafeInteger(f.amount) && f.amount > 0)),
                )),
          ) &&
          h.versions &&
          [...h.categories, ...h.txns].every(
            (r) =>
              r &&
              typeof r.id === "string" &&
              typeof h.versions[r.id] === "string",
          ),
      ))
  )
    return fail();
  for (const h of prefs.categoryDeletionHistory ?? []) {
    // Validate historical entities too: these become writable records on undo.
    const historical = JSON.parse(JSON.stringify(value)) as BackupData;
    historical.tables.local_pref = historical.tables.local_pref.filter(
      (p) => p.key !== "categoryDeletionHistory",
    );
    for (const [table, records] of [
      ["category", h.categories],
      ["txn", h.txns],
    ] as const) {
      for (const record of records) {
        if (!has(value.tables[table], record.id)) return fail();
        const row = Object.fromEntries(
          Object.entries(record).map(([key, v]) => [
            key === "icon"
              ? "sf_symbol"
              : key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()),
            typeof v === "boolean" ? Number(v) : v,
          ]),
        ) as Row;
        historical.tables[table] = historical.tables[table].map((old) =>
          old.id === row.id ? row : old,
        );
      }
    }
    parseBackup(db, JSON.stringify(historical));
  }
  for (const row of value.tables.budget) {
    try {
      const allocations = JSON.parse(String(row.allocations));
      if (
        !allocations ||
        Array.isArray(allocations) ||
        typeof allocations !== "object"
      )
        return fail();
      const cats = category.map((c) => ({
        ...c,
        parentId: c.parent_id,
        deleted: !!c.deleted,
      })) as unknown as Category[];
      const active = Object.fromEntries(
        Object.entries(allocations).filter(([id]) =>
          cats.some((c) => c.id === id && !c.deleted),
        ),
      ) as Record<string, number>;
      if (!row.deleted)
        validateBudgetAllocation(Number(row.amount), active, cats);
    } catch {
      return fail();
    }

    if (
      row.scope !== "family" ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(row.month)) ||
      Number(row.amount) < 0
    )
      return fail();
  }
  if (
    prefs.planTxnHistory !== undefined &&
    (!prefs.planTxnHistory ||
      Array.isArray(prefs.planTxnHistory) ||
      typeof prefs.planTxnHistory !== "object" ||
      !Object.values(prefs.planTxnHistory).every(
        (v) => Array.isArray(v) && v.every((id) => typeof id === "string"),
      ))
  )
    return fail();
  for (const key of ["syncFiles", "seenOps"])
    if (
      prefs[key] !== undefined &&
      (!Array.isArray(prefs[key]) ||
        !prefs[key].every((v: unknown) => typeof v === "string"))
    )
      return fail();
  if (
    prefs.remindersEnabled !== undefined &&
    typeof prefs.remindersEnabled !== "boolean"
  )
    return fail();
  for (const row of value.tables.plan) {
    if (
      row.scope !== "family" ||
      !["loan", "deposit", "prepaid"].includes(String(row.kind))
    )
      return fail();
    let d;
    try {
      d = JSON.parse(String(row.data));
    } catch {
      return fail();
    }
    if (
      !d ||
      !account.some((a) => a.id === d.accountId && a.scope === "family") ||
      !account.some((a) => a.id === d.paymentAccountId && a.scope === "family")
    )
      return fail();
    try {
      validatePlanData(row.kind as "loan" | "deposit" | "prepaid", d);
    } catch {
      return fail();
    }
    if (row.kind === "loan") {
      try {
        validateLoan(d);
      } catch {
        return fail();
      }
    }
    if (
      row.kind !== "loan" &&
      (!Array.isArray(d.txnIds) ||
        !d.txnIds.every((id: unknown) => has(txn, id)))
    )
      return fail();
  }
  for (const row of outbox) {
    let op;
    try {
      op = JSON.parse(String(row.op_json));
    } catch {
      return fail();
    }
    if (
      !op ||
      !["member", "account", "category", "txn", "plan", "budget"].includes(
        op.entity,
      ) ||
      !op.record ||
      op.record.id !== op.entityId ||
      typeof op.opId !== "string" ||
      typeof op.deviceId !== "string" ||
      !Number.isSafeInteger(op.seq) ||
      op.seq < 1 ||
      typeof op.hlc !== "string" ||
      !["upsert", "delete"].includes(op.action) ||
      op.record.scope === "private" ||
      (op.deviceId === prefs.deviceId && op.seq > prefs.seq)
    )
      return fail();
  }
  return value;
}
export function restoreBackup(db: SqlDriver, text: string) {
  const backup = parseBackup(db, text);
  db.withTransactionSync(() => {
    for (const table of [...tables].reverse())
      db.runSync(`DELETE FROM ${table}`);
    for (const table of tables)
      for (const row of backup.tables[table]) {
        const columns = Object.keys(row);
        db.runSync(
          `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
          ...columns.map((c) => row[c]!),
        );
      }
  });
}
