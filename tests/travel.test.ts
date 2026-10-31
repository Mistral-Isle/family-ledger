import { fixture } from "./sqlite";
import { accountBalance } from "../src/domain/selectors";
import {
  tripSummary,
  duplicatePairs,
  duplicateCandidates,
} from "../src/domain/travel";
import {
  tripExportSheets,
  excelBytes,
  csvText,
  exportSheets,
} from "../src/domain/export";
import { reportingSnapshot } from "../src/domain/reports";
import * as XLSX from "xlsx";

function setup() {
  const f = fixture(),
    s = f.repo.snapshot();
  const account = s.accounts[0]!,
    category = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
  const trip = f.repo.saveTrip({
    name: "杭州周末游",
    startDate: "2026-10-30",
    endDate: "2026-11-01",
    ended: false,
  });
  const input = {
    type: "expense" as const,
    amount: 10000,
    accountId: account.id,
    categoryId: category.id,
    occurredAt: "2026-10-29",
    occurredTime: "12:30",
    note: "酒店预订",
    forWhom: "both" as const,
    tripId: trip,
  };
  return { ...f, account, category, trip, input };
}
test("new defaults are exact and old customized categories survive initialization and explicit installation", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    expect(
      s.categories.filter((c) => !c.parentId && c.kind === "expense"),
    ).toHaveLength(14);
    expect(
      s.categories.some(
        (c) => c.name === "公积金" && c.kind === "income" && !c.parentId,
      ),
    ).toBe(true);
    const gift = s.categories.find((c) => c.name === "宠你")!;
    expect(s.categories.some((c) => c.parentId === gift.id)).toBe(false);
    f.repo.saveCategory({ ...gift, name: "我的礼物" });
    f.repo.initialize();
    expect(
      f.repo.snapshot().categories.find((c) => c.id === gift.id)?.name,
    ).toBe("我的礼物");
    f.repo.installDefaultCategories();
    const n = f.repo.snapshot().categories.length;
    f.repo.installDefaultCategories();
    expect(f.repo.snapshot().categories).toHaveLength(n);
  } finally {
    f.sqlite.close();
  }
});
test("trip and payer metadata never change account effects; refunds follow original trip and payer", () => {
  const f = setup();
  try {
    const id = f.repo.saveTxn(f.input),
      original = f.repo.snapshot().txns.find((t) => t.id === id)!;
    expect(original.payerMemberId).toBe(f.account.ownerMemberId);
    const recorder = original.recorderMemberId;
    f.repo.saveTxn({
      type: "refund",
      amount: 12000,
      accountId: f.account.id,
      refundOfId: id,
      occurredAt: "2026-10-30",
      note: "退款",
      forWhom: "both",
    });
    expect(tripSummary(f.repo.snapshot(), f.trip).total).toBe(0);
    const other = f.repo.saveTrip({
      name: "改期",
      startDate: null,
      endDate: null,
      ended: true,
    });
    f.repo.saveTxn({ ...f.input, id, tripId: other, payerMemberId: null });
    const s = f.repo.snapshot();
    expect(tripSummary(s, f.trip).rows).toHaveLength(0);
    expect(tripSummary(s, other).members).toEqual([["", 0]]);
    expect(s.txns.find((t) => t.id === id)?.recorderMemberId).toBe(recorder);
    expect(accountBalance(f.account, s.txns)).toBe(2000);
    f.repo.deleteTrip(other);
    expect(tripSummary(f.repo.snapshot(), other).rows).toHaveLength(0);
    expect(accountBalance(f.account, f.repo.snapshot().txns)).toBe(2000);
  } finally {
    f.sqlite.close();
  }
});
test("current trip stays local and stopping a trip prevents automatic association", () => {
  const f = setup(),
    peer = fixture();
  try {
    peer.repo.prepareJoin("另一半");
    peer.repo.mergeOperations(f.repo.pendingOperations());
    f.repo.setCurrentTrip(f.trip);
    expect(peer.repo.currentTripId()).toBeNull();
    peer.repo.saveTrip({ ...peer.repo.snapshot().trips![0]!, ended: true });
    f.repo.mergeOperations(peer.repo.pendingOperations());
    expect(f.repo.currentTripId()).toBeNull();
  } finally {
    f.sqlite.close();
    peer.sqlite.close();
  }
});
test("duplicate matching uses actual time, weak date-only hints, and excludes other accounts and private data", () => {
  const f = setup();
  try {
    f.repo.saveTxn(f.input);
    const s = f.repo.snapshot();
    expect(
      duplicateCandidates(s, { ...f.input, occurredTime: "12:39" })[0]?.strong,
    ).toBe(true);
    expect(
      duplicateCandidates(s, { ...f.input, occurredTime: "12:41" }),
    ).toHaveLength(0);
    expect(
      duplicateCandidates(s, { ...f.input, occurredTime: null })[0]?.strong,
    ).toBe(false);
    expect(
      duplicateCandidates(s, { ...f.input, accountId: "other" }),
    ).toHaveLength(0);
    expect(
      duplicateCandidates(s, { ...f.input, scope: "private" }),
    ).toHaveLength(0);
  } finally {
    f.sqlite.close();
  }
});
test("offline independent entries survive syncing, distinct decisions sync and changed facts become candidates again", () => {
  const f = setup(),
    peer = fixture();
  try {
    peer.repo.prepareJoin("另一半");
    peer.repo.mergeOperations(f.repo.pendingOperations());
    const a = f.repo.saveTxn(f.input),
      b = peer.repo.saveTxn(f.input);
    const batch = peer.repo.pendingOperations();
    f.repo.mergeOperations(batch);
    f.repo.mergeOperations(batch);
    expect(f.repo.snapshot().txns.filter((t) => !t.deleted)).toHaveLength(2);
    expect(duplicatePairs(f.repo.snapshot())).toHaveLength(1);
    f.repo.confirmDistinct(a, b);
    peer.repo.mergeOperations(f.repo.pendingOperations());
    expect(duplicatePairs(peer.repo.snapshot())).toHaveLength(0);
    peer.repo.saveTxn({ ...f.input, id: b, occurredTime: "12:31" });
    expect(duplicatePairs(peer.repo.snapshot())).toHaveLength(1);
    peer.repo.deleteTxn(b);
    f.repo.mergeOperations(peer.repo.pendingOperations());
    expect(duplicatePairs(f.repo.snapshot())).toHaveLength(0);
    expect(accountBalance(f.account, f.repo.snapshot().txns)).toBe(-10000);
  } finally {
    f.sqlite.close();
    peer.sqlite.close();
  }
});
test("v5 backup roundtrips trips, payer, decisions and current preference; v4 restores unknown payer", () => {
  const f = setup();
  try {
    const a = f.repo.saveTxn(f.input),
      b = f.repo.saveTxn(f.input);
    f.repo.confirmDistinct(a, b);
    f.repo.setCurrentTrip(f.trip);
    const text = f.repo.exportBackup();
    f.repo.restoreBackup(text);
    expect(f.repo.currentTripId()).toBe(f.trip);
    expect(f.repo.duplicatePairs()).toHaveLength(0);
    expect(tripSummary(f.repo.snapshot(), f.trip).total).toBe(20000);
    const legacy = JSON.parse(text);
    legacy.version = 4;
    delete legacy.tables.trip;
    delete legacy.tables.duplicate;
    for (const row of legacy.tables.txn) {
      delete row.payer_member_id;
      delete row.trip_id;
    }
    legacy.tables.local_pref = legacy.tables.local_pref.filter(
      (r: any) => r.key !== "currentTripId",
    );
    f.repo.restoreBackup(JSON.stringify(legacy));
    expect(
      f.repo
        .snapshot()
        .txns.every((t) => t.payerMemberId === null && t.tripId === null),
    ).toBe(true);
  } finally {
    f.sqlite.close();
  }
});

test("partner account can be recorded by me without changing payer on later edits or sync", () => {
  const f = setup(),
    peer = fixture();
  try {
    peer.repo.prepareJoin("另一半");
    peer.repo.mergeOperations(f.repo.pendingOperations());
    f.repo.mergeOperations(peer.repo.pendingOperations());
    const partner = peer.repo.snapshot().meId;
    f.repo.saveAccount({
      name: "另一半微信",
      kind: "wechat",
      initialBalance: 0,
      ownerMemberId: partner,
    });
    const account = f.repo
      .snapshot()
      .accounts.find((a) => a.name === "另一半微信")!;
    const id = f.repo.saveTxn({ ...f.input, accountId: account.id });
    f.repo.saveTxn({ ...f.input, id, accountId: account.id, note: "补充备注" });
    peer.repo.mergeOperations(f.repo.pendingOperations());
    const s = peer.repo.snapshot(),
      txn = s.txns.find((t) => t.id === id)!;
    expect(txn.payerMemberId).toBe(partner);
    expect(txn.recorderMemberId).toBe(f.repo.snapshot().meId);
    expect(accountBalance(account, s.txns)).toBe(-10000);
    expect(
      reportingSnapshot(s, partner, false, "payer").txns.map((t) => t.id),
    ).toContain(id);
    expect(reportingSnapshot(s, partner, false, "recorder").txns).toHaveLength(
      0,
    );
  } finally {
    f.sqlite.close();
    peer.sqlite.close();
  }
});
test("trip Excel/CSV reconcile categories, payer and net refunds and retain formula-looking notes as text", () => {
  const f = setup();
  try {
    const id = f.repo.saveTxn({ ...f.input, note: "=SUM(A1:A2)" });
    f.repo.saveTxn({
      type: "refund",
      amount: 3000,
      accountId: f.account.id,
      refundOfId: id,
      occurredAt: "2026-10-30",
      note: "部分退款",
      forWhom: "both",
    });
    const s = f.repo.snapshot(),
      sheets = tripExportSheets(s, f.trip);
    expect(sheets[1]!.rows.at(-1)).toEqual(["合计", 70]);
    expect(sheets[2]!.rows.at(-1)).toEqual(["合计", 70]);
    expect(csvText(sheets[0]!)).toContain("'=SUM(A1:A2)");
    const book = XLSX.read(excelBytes(sheets), { type: "array" });
    expect(book.SheetNames).toHaveLength(3);
    expect(book.Sheets[book.SheetNames[0]!]!["H3"].v).toBe(100);
    expect(book.Sheets[book.SheetNames[0]!]!["L3"].f).toBeUndefined();
    const full = exportSheets(s, {
      start: "2026-10-01",
      end: "2026-10-31",
    })[0]!;
    expect(full.rows[0]!.slice(-4, -2)).toEqual(["付款人", "行程"]);
  } finally {
    f.sqlite.close();
  }
});
test("old classification installation is explicit, preserves balance and converges when both devices install concurrently", () => {
  const f = setup(),
    peer = fixture();
  try {
    f.repo.saveTxn(f.input);
    const old = f.repo.snapshot().categories.find((c) => c.name === "宠你")!;
    f.repo.saveCategory({ ...old, name: "旧礼物" });
    peer.repo.prepareJoin("另一半");
    peer.repo.mergeOperations(f.repo.pendingOperations());
    const before = accountBalance(f.account, f.repo.snapshot().txns);
    f.repo.installDefaultCategories();
    peer.repo.installDefaultCategories();
    f.repo.mergeOperations(peer.repo.pendingOperations());
    peer.repo.mergeOperations(f.repo.pendingOperations());
    for (const repo of [f.repo, peer.repo]) {
      expect(
        repo
          .snapshot()
          .categories.filter((c) => !c.deleted && c.name === "宠你"),
      ).toHaveLength(1);
      expect(
        repo.snapshot().categories.find((c) => c.id === old.id)?.name,
      ).toBe("旧礼物");
      expect(accountBalance(f.account, repo.snapshot().txns)).toBe(before);
    }
  } finally {
    f.sqlite.close();
    peer.sqlite.close();
  }
});

test("default category order upgrades once and preserves custom ordering and transaction data", () => {
  const f = setup();
  try {
    const readRoots = () =>
      f.repo
        .snapshot()
        .categories.filter(
          (c) => !c.deleted && !c.parentId && c.kind === "expense",
        )
        .sort((a, b) => a.sort - b.sort);
    expect(
      readRoots()
        .slice(0, 6)
        .map((c) => c.name),
    ).toEqual(["餐饮", "购物", "汽车", "数字服务", "交通", "娱乐"]);
    const oldOrder = [
      "餐饮",
      "购物",
      "居住",
      "数字服务",
      "汽车",
      "交通",
      "娱乐",
      "宠你",
      "人情往来",
      "医疗健康",
      "宠物",
      "学习",
      "大额支出",
      "其他",
    ];
    const roots = readRoots();
    f.repo.reorderCategories(
      oldOrder.map((name) => roots.find((c) => c.name === name)!.id),
    );
    const id = f.repo.saveTxn(f.input);
    const original = f.repo.snapshot().txns.find((t) => t.id === id);
    f.sqlite.exec(
      "DELETE FROM local_pref WHERE key = 'defaultCategoryOrderV2'",
    );
    f.repo.initialize();
    expect(
      readRoots()
        .slice(0, 6)
        .map((c) => c.name),
    ).toEqual(["餐饮", "购物", "汽车", "数字服务", "交通", "娱乐"]);
    expect(f.repo.snapshot().txns.find((t) => t.id === id)).toEqual(original);
    const custom = readRoots()
      .reverse()
      .map((c) => c.id);
    f.repo.reorderCategories(custom);
    f.sqlite.exec(
      "DELETE FROM local_pref WHERE key = 'defaultCategoryOrderV2'",
    );
    f.repo.initialize();
    expect(readRoots().map((c) => c.id)).toEqual(custom);
    f.repo.initialize();
    expect(readRoots().map((c) => c.id)).toEqual(custom);
  } finally {
    f.sqlite.close();
  }
});
