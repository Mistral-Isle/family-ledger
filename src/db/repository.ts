import { validatePlanData } from "../domain/finance";
import { accountBalance } from "../domain/selectors";
import { today } from "../domain/date";
import {
  nextDue,
  addMonths,
  validateLoan,
  splitPrepayment,
  rentSchedule,
  type LoanData,
} from "../domain/finance";
import { exportBackup, parseBackup, restoreBackup } from "./backup";
import {
  categoryDeletionImpact,
  type CategoryDeletion,
  type CategoryDeletionHistory,
} from "../domain/categoryDeletion";
import type {
  Budget,
  FinancialPlan,
  Account,
  AccountKind,
  BaseRecord,
  Category,
  CategoryKind,
  Member,
  Operation,
  Preferences,
  Snapshot,
  Txn,
  TxnType,
} from "../domain/types";
import { assertMoney } from "../domain/money";
import { validDate } from "../domain/date";
import { zh } from "../i18n/zh";

type Value = string | number | null;
export interface SqlDriver {
  runSync(sql: string, ...params: Value[]): unknown;
  getAllSync<T>(sql: string, ...params: Value[]): T[];
  withTransactionSync(fn: () => void): void;
}
type Entity = Operation["entity"];
type RecordType = Account | Category | Txn | Member | FinancialPlan | Budget;
type Raw = Record<string, Value>;
const keys: Record<string, string> = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  initialBalance: "initial_balance",
  ownerMemberId: "owner_member_id",
  parentId: "parent_id",
  icon: "sf_symbol",
  mergedInto: "merged_into",
  deleteAction: "delete_action",
  accountId: "account_id",
  toAccountId: "to_account_id",
  categoryId: "category_id",
  occurredAt: "occurred_at",
  recorderMemberId: "recorder_member_id",
  forWhom: "for_whom",
  refundOfId: "refund_of_id",
  refundIncome: "refund_income",
  refundIncomeCategoryId: "refund_income_category_id",
};
const reverseKeys = Object.fromEntries(
  Object.entries(keys).map(([a, b]) => [b, a]),
);
const booleans = new Set(["deleted", "archived", "hidden", "discarded"]);
function decode<T>(row: Raw): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      reverseKeys[key] ?? key,
      booleans.has(key) ? !!value : value,
    ]),
  ) as T;
}
const emptyPrefs = (): Preferences => ({
  pinned: [],
  lastAccount: {},
  recentCategories: [],
  mode: "standard",
  favorites: [],
});
const nameCheck = (name: string) => {
  if (!name.trim() || name.trim().length > 30) throw new Error(zh.errors.name);
  return name.trim();
};

export class LedgerRepository {
  constructor(
    private db: SqlDriver,
    private uuid: () => string,
    private now = () => new Date().toISOString(),
  ) {}
  exportBackup() {
    return exportBackup(this.db);
  }
  inspectBackup(text: string) {
    return parseBackup(this.db, text);
  }
  restoreBackup(text: string) {
    restoreBackup(this.db, text);
  }
  monthBudget(month: string): number | null {
    const record = this.all<Budget>("budget")
      .filter((b) => b.month === month)
      .sort((a, b) => b.hlc.localeCompare(a.hlc))[0];
    return record
      ? record.deleted
        ? null
        : record.amount
      : (this.pref<Record<string, number>>("monthBudgets", {})[month] ?? null);
  }
  setMonthBudget(month: string, amount: number | null) {
    validDate(month + "-01");
    if (amount !== null && assertMoney(amount) <= 0)
      throw new Error(zh.errors.amount);
    this.db.withTransactionSync(() => {
      const previous = this.all<Budget>("budget")
        .filter((b) => b.month === month)
        .sort((a, b) => b.hlc.localeCompare(a.hlc))[0];
      this.write("budget", {
        ...this.stamp(previous),
        scope: "family",
        month,
        amount: amount ?? 0,
        deleted: amount === null,
      });
    });
  }
  remindersEnabled(): boolean {
    return this.pref("remindersEnabled", false);
  }
  setRemindersEnabled(value: boolean) {
    this.db.withTransactionSync(() => this.setPref("remindersEnabled", value));
  }
  getTheme(): "system" | "light" | "dark" {
    return this.pref("theme", "system");
  }
  setTheme(theme: "system" | "light" | "dark") {
    this.db.withTransactionSync(() => this.setPref("theme", theme));
  }
  private pref<T>(key: string, fallback: T): T {
    const raw = this.db.getAllSync<{ value: string }>(
      "SELECT value FROM local_pref WHERE key = ?",
      key,
    )[0];
    return raw ? (JSON.parse(raw.value) as T) : fallback;
  }
  private setPref(key: string, value: unknown) {
    this.db.runSync(
      "INSERT INTO local_pref (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      JSON.stringify(value),
    );
  }
  private all<T>(entity: Entity): T[] {
    return this.db
      .getAllSync<Raw>(`SELECT * FROM ${entity}`)
      .map((row) => decode<T>(row));
  }
  private stamp(previous?: BaseRecord): BaseRecord {
    const now = this.now();
    const deviceId = this.pref<string>("deviceId", "");
    const last = this.pref<[number, number]>("hlc", [0, 0]);
    const wall = Math.max(Date.parse(now), last[0]);
    const counter = wall === last[0] ? last[1] + 1 : 0;
    this.setPref("hlc", [wall, counter]);
    return {
      id: previous?.id ?? this.uuid(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      hlc: `${String(wall).padStart(15, "0")}:${String(counter).padStart(8, "0")}:${deviceId}`,
      deleted: false,
    };
  }
  // The only entity-write entry point. Callers always hold a database transaction.
  private write(entity: Entity, record: RecordType, enqueue = true) {
    const fields = Object.entries(record);
    const columns = fields.map(([key]) => keys[key] ?? key);
    const values = fields.map(([, value]) =>
      typeof value === "boolean" ? Number(value) : value,
    ) as Value[];
    this.db.runSync(
      `INSERT INTO ${entity} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${columns
        .filter((c) => c !== "id")
        .map((c) => `${c}=excluded.${c}`)
        .join(",")}`,
      ...values,
    );
    if ("scope" in record && record.scope === "private") return;
    if (enqueue) this.enqueue(entity, record);
  }
  private enqueue(entity: Entity, record: RecordType) {
    if ("scope" in record && record.scope !== "family")
      throw new Error(zh.errors.scope);
    const seq = this.pref<number>("seq", 0) + 1;
    const op: Operation = {
      opId: this.uuid(),
      deviceId: this.pref("deviceId", ""),
      seq,
      hlc: record.hlc,
      entity,
      entityId: record.id,
      action: record.deleted ? "delete" : "upsert",
      record,
    };
    this.db.runSync(
      "INSERT INTO outbox(op_json,uploaded) VALUES (?,0)",
      JSON.stringify(op),
    );
    this.setPref("seq", seq);
  }
  initialize() {
    this.db.withTransactionSync(() => {
      if (this.pref("initialized", false)) {
        for (const [month, amount] of Object.entries(
          this.pref<Record<string, number>>("monthBudgets", {}),
        ))
          if (!this.all<Budget>("budget").some((b) => b.month === month))
            this.write("budget", {
              ...this.stamp(),
              scope: "family",
              month,
              amount,
            });
        this.setPref("monthBudgets", {});
        return;
      }
      this.setPref("deviceId", this.uuid());
      const me: Member = { ...this.stamp(), name: zh.me, color: "#648BD2" };
      this.write("member", me);
      this.setPref("meId", me.id);
      const pinned: string[] = [];
      for (const [name, kind] of [
        [zh.defaultAccounts.bank, "bank"],
        [zh.defaultAccounts.wechat, "wechat"],
        [zh.defaultAccounts.cash, "cash"],
      ] as const) {
        const account: Account = {
          ...this.stamp(),
          name,
          kind,
          scope: "family",
          initialBalance: 0,
          ownerMemberId: me.id,
          last4: "",
          sort: pinned.length,
          archived: false,
        };
        this.write("account", account);
        pinned.push(account.id);
      }
      zh.defaultCategories.forEach((group, i) => {
        const kind = i === 7 ? "income" : "expense";
        const root: Category = {
          ...this.stamp(),
          parentId: null,
          kind,
          name: group.name,
          icon: group.icon,
          color: group.color,
          sort: i,
          hidden: false,
          mergedInto: null,
          deleteAction: null,
        };
        this.write("category", root);
        group.children.forEach(([name, icon], sort) =>
          this.write("category", {
            ...this.stamp(),
            parentId: root.id,
            kind,
            name,
            icon,
            color: group.color,
            sort,
            hidden: false,
            mergedInto: null,
            deleteAction: null,
          }),
        );
      });
      this.setPref("preferences", { ...emptyPrefs(), pinned });
      this.setPref("initialized", true);
    });
  }
  snapshot(): Snapshot {
    const accounts = this.all<Account>("account"),
      txns = this.all<Txn>("txn");
    // Progress is derived from immutable repayment rows, so two offline
    // repayments both count even when their plan metadata uses LWW.
    const plans = this.all<FinancialPlan>("plan").map((p) => {
      if (p.kind !== "loan") return p;
      const d: LoanData = JSON.parse(p.data);
      if (d.initialPaidPeriods === undefined || !d.initialNextDueDate) return p;
      const count = txns.filter(
        (t) =>
          !t.deleted && t.type === "repayment" && t.toAccountId === d.accountId,
      ).length;
      d.paidPeriods = Math.min(d.totalPeriods, d.initialPaidPeriods + count);
      d.nextDueDate = addMonths(d.initialNextDueDate, count, d.dueDay);
      d.settlePeriod = Math.max(d.settlePeriod, d.paidPeriods);
      const account = accounts.find((a) => a.id === d.accountId);
      if (account) d.closed = accountBalance(account, txns) >= 0;
      return { ...p, data: JSON.stringify(d) };
    });
    return {
      budgets: this.all<Budget>("budget"),
      plans,
      members: this.all<Member>("member"),
      accounts,
      categories: this.all<Category>("category"),
      txns,
      preferences: this.pref("preferences", emptyPrefs()),
      pending:
        this.db.getAllSync<{ count: number }>(
          "SELECT COUNT(*) AS count FROM outbox WHERE uploaded = 0",
        )[0]?.count ?? 0,
      meId: this.pref("meId", ""),
    };
  }
  pendingOperations(): Operation[] {
    return this.db
      .getAllSync<{ op_json: string }>(
        "SELECT op_json FROM outbox WHERE uploaded=0 ORDER BY seq",
      )
      .map((row) => JSON.parse(row.op_json) as Operation);
  }
  updatePreferences(update: Partial<Preferences>) {
    this.db.withTransactionSync(() => {
      this.setPref("preferences", {
        ...this.pref("preferences", emptyPrefs()),
        ...update,
      });
    });
  }
  saveAccount(input: {
    id?: string;
    name: string;
    kind: AccountKind;
    initialBalance: number;
    scope?: "family" | "private";
    ownerMemberId?: string;
    last4?: string;
    archived?: boolean;
  }) {
    this.db.withTransactionSync(() => {
      const snapshot = this.snapshot();
      const previous = snapshot.accounts.find(
        (a) => a.id === input.id && !a.deleted,
      );
      if (input.id && !previous) throw new Error(zh.errors.missing);
      if (
        previous &&
        snapshot.plans.some(
          (p) => !p.deleted && JSON.parse(p.data).accountId === previous.id,
        ) &&
        (input.initialBalance !== previous.initialBalance ||
          input.kind !== previous.kind ||
          (input.archived !== undefined &&
            input.archived !== previous.archived))
      )
        throw new Error(zh.finance.managed);
      if (input.scope && !["family", "private"].includes(input.scope))
        throw new Error(zh.errors.scope);
      if (input.last4 && !/^\d{4}$/.test(input.last4))
        throw new Error(zh.errors.last4);
      if (
        input.ownerMemberId &&
        !snapshot.members.some(
          (m) => m.id === input.ownerMemberId && !m.deleted,
        )
      )
        throw new Error(zh.errors.missing);
      const record: Account = {
        ...this.stamp(previous),
        scope: previous?.scope ?? input.scope ?? "family",
        name: nameCheck(input.name),
        kind: input.kind,
        initialBalance: assertMoney(input.initialBalance),
        last4: input.last4 ?? "",
        ownerMemberId:
          input.ownerMemberId ?? previous?.ownerMemberId ?? snapshot.meId,
        sort: previous?.sort ?? snapshot.accounts.length,
        archived: input.archived ?? previous?.archived ?? false,
      };
      this.write("account", record);
      if (
        !previous &&
        record.scope === "family" &&
        snapshot.preferences.pinned.length < 4
      )
        this.setPref("preferences", {
          ...snapshot.preferences,
          pinned: [...snapshot.preferences.pinned, record.id],
        });
    });
  }
  togglePin(id: string) {
    const { preferences, accounts } = this.snapshot();
    if (!accounts.some((a) => a.id === id && !a.deleted && !a.archived))
      throw new Error(zh.errors.account);
    if (preferences.pinned.includes(id))
      this.updatePreferences({
        pinned: preferences.pinned.filter((p) => p !== id),
      });
    else {
      if (preferences.pinned.length >= 4)
        throw new Error(zh.errors.pinnedLimit);
      this.updatePreferences({ pinned: [...preferences.pinned, id] });
    }
  }
  saveCategory(input: {
    id?: string;
    name: string;
    kind: CategoryKind;
    parentId: string | null;
    icon: string;
    color: string;
    hidden?: boolean;
    sort?: number;
  }) {
    this.db.withTransactionSync(() => {
      const { categories } = this.snapshot();
      const previous = categories.find((c) => c.id === input.id && !c.deleted);
      if (input.id && !previous) throw new Error(zh.errors.missing);
      if (previous && previous.kind !== input.kind)
        throw new Error(zh.errors.parent);
      if (input.parentId) {
        const parent = categories.find(
          (c) =>
            c.id === input.parentId &&
            !c.deleted &&
            c.kind === input.kind &&
            !c.parentId,
        );
        if (
          !parent ||
          parent.id === input.id ||
          categories.some((c) => c.parentId === input.id && !c.deleted)
        )
          throw new Error(zh.errors.parent);
      }
      const record: Category = {
        ...this.stamp(previous),
        name: nameCheck(input.name),
        kind: input.kind,
        parentId: input.parentId,
        icon: input.icon,
        color: input.color,
        hidden: input.hidden ?? previous?.hidden ?? false,
        sort: input.sort ?? previous?.sort ?? categories.length,
        mergedInto: null,
        deleteAction: null,
      };
      if (
        record.hidden &&
        !record.parentId &&
        !categories.some(
          (c) =>
            c.id !== record.id &&
            c.kind === record.kind &&
            !c.parentId &&
            !c.hidden &&
            !c.deleted,
        )
      )
        throw new Error(zh.errors.hiddenLast);
      this.write("category", record);
    });
  }
  categoryDeletionHistory(): CategoryDeletionHistory[] {
    return this.pref("categoryDeletionHistory", []);
  }
  deleteCategory(id: string, choice: CategoryDeletion) {
    this.db.withTransactionSync(() => {
      const s = this.snapshot();
      const impact = categoryDeletionImpact(s, id);
      const ids = new Set(impact.categories.map((c) => c.id));
      let target: Category | undefined;
      if (choice.action === "migrate") {
        target = s.categories.find(
          (c) =>
            c.id === choice.targetId &&
            !c.deleted &&
            !ids.has(c.id) &&
            c.kind === impact.source.kind,
        );
        if (!target) throw new Error("请选择同类型且不在删除范围内的接收分类");
      } else if (choice.action === "create") {
        target = {
          ...impact.source,
          ...this.stamp(),
          name: nameCheck(choice.name),
          parentId: null,
          hidden: false,
          mergedInto: null,
          deleteAction: null,
          sort: s.categories.length,
        };
        this.write("category", target);
      } else if (choice.action !== "discard") {
        throw new Error("无效的删除方式");
      }
      if (
        !target &&
        !s.categories.some(
          (c) =>
            !c.deleted &&
            !c.hidden &&
            !c.parentId &&
            c.kind === impact.source.kind &&
            !ids.has(c.id),
        )
      )
        throw new Error("请保留至少一个可用的一级分类，或新建分类接收");
      const history: CategoryDeletionHistory = {
        id: this.uuid(),
        name: impact.source.name,
        createdAt: this.now(),
        action: choice.action,
        categories: impact.categories,
        txns: impact.txns,
        versions: {},
      };
      for (const c of impact.categories) {
        const next = {
          ...c,
          ...this.stamp(c),
          deleted: true,
          mergedInto: target?.id ?? null,
          deleteAction: target ? ("migrate" as const) : ("discard" as const),
        };
        this.write("category", next);
        history.versions[c.id] = next.hlc;
      }
      for (const t of impact.txns) {
        const next = {
          ...t,
          ...this.stamp(t),
          categoryId:
            target && ids.has(t.categoryId ?? "") ? target.id : t.categoryId,
          refundIncomeCategoryId:
            target && ids.has(t.refundIncomeCategoryId ?? "")
              ? target.id
              : t.refundIncomeCategoryId,
          discarded: target ? t.discarded : true,
        };
        this.write("txn", next);
        history.versions[t.id] = next.hlc;
      }
      history.favoritesBefore = s.preferences.favorites;
      history.favoritesAfter = s.preferences.favorites.flatMap((f) =>
        !ids.has(f.categoryId)
          ? [f]
          : target
            ? [{ ...f, categoryId: target.id }]
            : [],
      );
      this.setPref("preferences", {
        ...s.preferences,
        favorites: history.favoritesAfter,
      });
      this.setPref("categoryDeletionHistory", [
        ...this.categoryDeletionHistory(),
        history,
      ]);
    });
  }
  restoreCategoryDeletion(id: string) {
    this.db.withTransactionSync(() => {
      const history = this.categoryDeletionHistory();
      const item = history.find((h) => h.id === id);
      if (!item) throw new Error("恢复记录不存在");
      const s = this.snapshot();
      for (const record of [...item.categories, ...item.txns]) {
        const current = [...s.categories, ...s.txns].find(
          (r) => r.id === record.id,
        );
        if (!current || current.hlc !== item.versions[record.id])
          throw new Error(
            "相关分类或流水已发生变化，无法直接恢复；请先处理后续修改",
          );
      }
      // A newly added refund must not keep the migrated category while its
      // original expense is restored to a different category.
      if (
        s.txns.some(
          (t) =>
            !t.deleted &&
            t.refundOfId &&
            !item.txns.some((old) => old.id === t.id) &&
            item.txns.some(
              (old) =>
                old.id === t.refundOfId && old.categoryId !== t.categoryId,
            ),
        )
      )
        throw new Error("原支出新增了关联退款，无法直接恢复；请先处理新增退款");
      for (const c of item.categories) {
        if (
          c.parentId &&
          !item.categories.some((p) => p.id === c.parentId) &&
          !s.categories.some((p) => p.id === c.parentId && !p.deleted)
        )
          throw new Error("请先恢复上级分类");
      }
      if (
        item.favoritesBefore &&
        JSON.stringify(s.preferences.favorites) ===
          JSON.stringify(item.favoritesAfter)
      )
        this.setPref("preferences", {
          ...s.preferences,
          favorites: item.favoritesBefore,
        });
      for (const c of item.categories)
        this.write("category", { ...c, ...this.stamp(c) });
      for (const t of item.txns) this.write("txn", { ...t, ...this.stamp(t) });
      this.setPref(
        "categoryDeletionHistory",
        history.filter((h) => h.id !== id),
      );
    });
  }
  reorderCategories(ids: string[]) {
    this.db.withTransactionSync(() => {
      const categories = this.snapshot().categories;
      ids.forEach((id, sort) => {
        const c = categories.find((x) => x.id === id && !x.deleted);
        if (c && c.sort !== sort)
          this.write("category", { ...c, ...this.stamp(c), sort });
      });
    });
  }
  saveTxn(input: {
    id?: string;
    type: TxnType;
    amount: number;
    accountId: string;
    toAccountId?: string | null;
    categoryId?: string | null;
    occurredAt: string;
    note: string;
    forWhom: Txn["forWhom"];
    refundOfId?: string | null;
  }) {
    this.db.withTransactionSync(() => {
      const s = this.snapshot();
      const previous = s.txns.find((t) => t.id === input.id && !t.deleted);
      if (input.id && !previous) throw new Error(zh.errors.missing);
      if (!["expense", "income", "transfer", "refund"].includes(input.type))
        throw new Error(zh.errors.future);
      if (previous && previous.type !== "refund" && input.type === "refund")
        throw new Error(zh.errors.refundSource);
      if (previous?.type === "scope_in" || previous?.type === "scope_out")
        throw new Error(zh.vault.editInVault);
      const refunds = s.txns.filter(
        (t) =>
          !t.deleted && t.refundOfId === previous?.id && t.type === "refund",
      );
      if (
        refunds.length &&
        (input.type !== "expense" ||
          input.amount <
            refunds.reduce(
              (sum, t) => sum + (t.amount - (t.refundIncome ?? 0)),
              0,
            ) ||
          input.categoryId !== previous?.categoryId ||
          refunds.some((t) => t.occurredAt < input.occurredAt))
      )
        throw new Error(zh.errors.refundConflict);
      if (
        previous?.type === "refund" &&
        (input.type !== "refund" || input.refundOfId !== previous.refundOfId)
      )
        throw new Error(zh.errors.refundSource);
      if (assertMoney(input.amount) <= 0) throw new Error(zh.errors.amount);
      validDate(input.occurredAt);
      const account = s.accounts.find(
        (a) =>
          a.id === input.accountId &&
          !a.deleted &&
          (!a.archived || previous?.accountId === a.id),
      );
      if (!account) throw new Error(zh.errors.account);
      let toAccountId: string | null = null;
      let categoryId: string | null = null;
      let refundIncome = 0;
      let refundIncomeCategoryId: string | null = null;
      if (input.type === "transfer") {
        const to = s.accounts.find(
          (a) =>
            a.id === input.toAccountId &&
            !a.deleted &&
            (!a.archived || previous?.toAccountId === a.id),
        );
        if (!to) throw new Error(zh.errors.account);
        if (to.id === account.id) throw new Error(zh.errors.destination);
        if (to.scope !== account.scope) throw new Error(zh.errors.scope);
        toAccountId = to.id;
      } else if (input.type === "refund") {
        const source = s.txns.find(
          (t) =>
            t.id === input.refundOfId &&
            !t.deleted &&
            !t.discarded &&
            t.type === "expense",
        );
        if (!source || source.scope !== account.scope)
          throw new Error(zh.errors.refundSource);
        const refunded = s.txns
          .filter(
            (t) =>
              !t.deleted &&
              t.type === "refund" &&
              t.refundOfId === source.id &&
              t.id !== previous?.id,
          )
          .reduce((sum, t) => sum + (t.amount - (t.refundIncome ?? 0)), 0);
        // Keep a saved allocation stable on note/date/account edits. Changing
        // the amount reallocates this receipt against the other saved refunds.
        refundIncome =
          previous?.amount === input.amount
            ? (previous.refundIncome ?? 0)
            : Math.max(0, input.amount - Math.max(0, source.amount - refunded));
        if (input.occurredAt < source.occurredAt)
          throw new Error(zh.errors.refundDate);
        categoryId = source.categoryId;
        if (refundIncome > 0) {
          let incomeCategory =
            s.categories.find(
              (c) =>
                c.id === previous?.refundIncomeCategoryId &&
                !c.deleted &&
                c.kind === "income",
            ) ??
            s.categories.find(
              (c) =>
                c.name === zh.refundExcess && c.kind === "income" && !c.deleted,
            );
          if (!incomeCategory && account.scope === "private")
            incomeCategory = s.categories.find(
              (c) => c.kind === "income" && !c.deleted,
            );
          if (!incomeCategory && account.scope === "private")
            throw new Error(zh.errors.category);
          if (!incomeCategory) {
            incomeCategory = {
              ...this.stamp(),
              name: zh.refundExcess,
              kind: "income",
              parentId: null,
              icon: "banknote.fill",
              color: "#6F9C80",
              sort: s.categories.length,
              hidden: false,
              mergedInto: null,
              deleteAction: null,
            };
            this.write("category", incomeCategory);
          }
          refundIncomeCategoryId = incomeCategory.id;
        }
      } else {
        const category = s.categories.find(
          (c) =>
            c.id === input.categoryId && c.kind === input.type && !c.deleted,
        );
        if (!category) throw new Error(zh.errors.category);
        categoryId = category.id;
      }
      if (
        previous &&
        s.plans.some(
          (p) =>
            !p.deleted &&
            (JSON.parse(p.data).txnIds ?? []).includes(previous.id),
        )
      )
        throw new Error(zh.finance.managed);
      if (previous && previous.scope !== account.scope)
        throw new Error(zh.errors.scope);
      const record: Txn = {
        ...this.stamp(previous),
        scope: account.scope,
        type: input.type,
        amount: input.amount,
        accountId: account.id,
        toAccountId,
        categoryId,
        occurredAt: input.occurredAt,
        note: input.note.trim().slice(0, 500),
        recorderMemberId: previous?.recorderMemberId ?? s.meId,
        forWhom: input.forWhom,
        discarded: previous?.discarded ?? false,
        refundOfId: input.type === "refund" ? input.refundOfId! : null,
        refundIncome,
        refundIncomeCategoryId,
      };
      this.write("txn", record);
      if (categoryId && input.type !== "refund" && account.scope === "family")
        this.setPref("preferences", {
          ...s.preferences,
          lastAccount: {
            ...s.preferences.lastAccount,
            [categoryId]: account.id,
          },
          recentCategories: [
            categoryId,
            ...s.preferences.recentCategories.filter((c) => c !== categoryId),
          ].slice(0, 50),
        });
    });
  }
  private financialAccount(
    name: string,
    kind: AccountKind,
    initialBalance = 0,
  ): Account {
    const s = this.snapshot();
    const record: Account = {
      ...this.stamp(),
      scope: "family",
      name: nameCheck(name),
      kind,
      initialBalance: assertMoney(initialBalance),
      ownerMemberId: s.meId,
      last4: "",
      sort: s.accounts.length,
      archived: false,
    };
    this.write("account", record);
    return record;
  }
  private financialTxn(
    input: Pick<Txn, "type" | "amount" | "accountId" | "occurredAt"> &
      Partial<Pick<Txn, "toAccountId" | "categoryId" | "note">>,
  ): Txn {
    validDate(input.occurredAt);
    assertMoney(input.amount);
    const record: Txn = {
      ...this.stamp(),
      scope: "family",
      type: input.type,
      amount: input.amount,
      accountId: input.accountId,
      toAccountId: input.toAccountId ?? null,
      categoryId: input.categoryId ?? null,
      occurredAt: input.occurredAt,
      note: input.note ?? "",
      recorderMemberId: this.snapshot().meId,
      forWhom: "both",
      discarded: false,
      refundOfId: null,
      refundIncome: 0,
      refundIncomeCategoryId: null,
    };
    this.write("txn", record);
    return record;
  }
  private paymentAccount(id: string) {
    const a = this.snapshot().accounts.find(
      (a) =>
        a.id === id &&
        a.scope === "family" &&
        !a.deleted &&
        !a.archived &&
        !["loan", "deposit", "prepaid"].includes(a.kind),
    );
    if (!a) throw new Error(zh.errors.account);
    return a;
  }
  private expenseCategory(id: string) {
    if (
      !this.snapshot().categories.some(
        (c) => c.id === id && c.kind === "expense" && !c.deleted,
      )
    )
      throw new Error(zh.errors.category);
  }
  private putPlan(
    kind: FinancialPlan["kind"],
    name: string,
    data: unknown,
    previous?: FinancialPlan,
  ) {
    const record: FinancialPlan = {
      ...this.stamp(previous),
      scope: "family",
      kind,
      name: nameCheck(name),
      data: JSON.stringify(data),
    };
    this.write("plan", record);
    return record;
  }
  createLoan(
    input: Omit<LoanData, "accountId" | "nextDueDate" | "closed"> & {
      name: string;
      principal: number;
      nextDueDate?: string;
    },
  ) {
    this.db.withTransactionSync(() => {
      this.paymentAccount(input.paymentAccountId);
      if (assertMoney(input.principal) <= 0) throw new Error(zh.errors.amount);
      const data: LoanData = {
        accountId: "",
        paymentAccountId: input.paymentAccountId,
        monthlyPayment: input.monthlyPayment,
        dueDay: input.dueDay,
        totalPeriods: input.totalPeriods,
        paidPeriods: input.paidPeriods,
        initialPaidPeriods: input.paidPeriods,
        initialNextDueDate: input.nextDueDate ?? nextDue(input.dueDay),
        interestFreePeriods: input.interestFreePeriods,
        settlePeriod: input.settlePeriod,
        nextDueDate: input.nextDueDate ?? nextDue(input.dueDay),
        closed: false,
        txnIds: [],
      };
      validateLoan(data);
      data.accountId = this.financialAccount(
        input.name,
        "loan",
        -input.principal,
      ).id;
      this.putPlan("loan", input.name, data);
    });
  }
  payLoan(
    id: string,
    input: {
      amount: number;
      interest: number;
      date: string;
      categoryId: string;
      paymentAccountId?: string;
      settle?: boolean;
    },
  ) {
    this.db.withTransactionSync(() => {
      const s = this.snapshot(),
        plan = s.plans.find(
          (p) => p.id === id && !p.deleted && p.kind === "loan",
        );
      if (!plan) throw new Error(zh.errors.missing);
      const data: LoanData = JSON.parse(plan.data);
      if (data.closed) throw new Error(zh.finance.closed);
      if (input.paymentAccountId)
        data.paymentAccountId = input.paymentAccountId;
      this.paymentAccount(data.paymentAccountId);
      const account = s.accounts.find((a) => a.id === data.accountId)!;
      const remaining = -accountBalance(account, s.txns);
      validDate(input.date);
      if (input.date > today()) throw new Error(zh.finance.futurePayment);
      if (
        s.txns.some(
          (t) =>
            !t.deleted &&
            (t.accountId === account.id || t.toAccountId === account.id) &&
            t.occurredAt > input.date,
        )
      )
        throw new Error(zh.finance.order);
      const interest = assertMoney(input.interest),
        amount = assertMoney(input.amount);
      if (interest < 0 || amount <= 0 || interest >= amount)
        throw new Error(zh.errors.amount);
      if (
        !input.settle &&
        data.paidPeriods < data.interestFreePeriods &&
        interest
      )
        throw new Error(zh.finance.freeInterest);
      const principal = amount - interest;
      if (principal > remaining || (input.settle && principal !== remaining))
        throw new Error(zh.finance.principal);
      if (interest) this.expenseCategory(input.categoryId);
      data.txnIds ??= [];
      data.txnIds.push(
        this.financialTxn({
          type: "repayment",
          amount: principal,
          accountId: data.paymentAccountId,
          toAccountId: data.accountId,
          occurredAt: input.date,
          note: plan.name,
        }).id,
      );
      if (interest)
        data.txnIds.push(
          this.financialTxn({
            type: "expense",
            amount: interest,
            accountId: data.paymentAccountId,
            categoryId: input.categoryId,
            occurredAt: input.date,
            note: plan.name + " · " + zh.finance.interest,
          }).id,
        );
      data.closed = principal === remaining;
      data.paidPeriods = Math.min(data.totalPeriods, data.paidPeriods + 1);
      data.nextDueDate = addMonths(data.nextDueDate, 1, data.dueDay);
      data.settlePeriod = Math.max(data.settlePeriod, data.paidPeriods);
      if (data.closed)
        this.write("account", {
          ...account,
          ...this.stamp(account),
          archived: true,
        });
      this.putPlan("loan", plan.name, data, plan);
    });
  }
  calibrateLoan(id: string, principal: number, date: string) {
    this.db.withTransactionSync(() => {
      if (assertMoney(principal) < 0) throw new Error(zh.errors.amount);
      validDate(date);
      if (date > today()) throw new Error(zh.finance.futurePayment);
      const s = this.snapshot(),
        plan = s.plans.find(
          (p) => p.id === id && !p.deleted && p.kind === "loan",
        );
      if (!plan) throw new Error(zh.errors.missing);
      const d: LoanData = JSON.parse(plan.data),
        a = s.accounts.find((a) => a.id === d.accountId)!;
      if (
        s.txns.some(
          (t) =>
            !t.deleted &&
            (t.accountId === a.id || t.toAccountId === a.id) &&
            t.occurredAt > date,
        )
      )
        throw new Error(zh.finance.order);
      const delta = assertMoney(-principal - accountBalance(a, s.txns));
      if (delta) {
        d.txnIds ??= [];
        d.txnIds.push(
          this.financialTxn({
            type: "adjust",
            amount: delta,
            accountId: a.id,
            occurredAt: date,
            note: zh.finance.calibrate,
          }).id,
        );
      }
      d.closed = principal === 0;
      this.write("account", { ...a, ...this.stamp(a), archived: d.closed });
      this.putPlan("loan", plan.name, d, plan);
    });
  }
  private depositRecords(input: {
    expectedReturn?: string;
    name: string;
    amount: number;
    paymentAccountId: string;
    date: string;
  }) {
    this.paymentAccount(input.paymentAccountId);
    if (assertMoney(input.amount) <= 0) throw new Error(zh.errors.amount);
    validDate(input.date);
    if (input.expectedReturn) {
      validDate(input.expectedReturn);
      if (input.expectedReturn < input.date) throw new Error(zh.errors.date);
    }
    const a = this.financialAccount(input.name, "deposit");
    const txn = this.financialTxn({
      type: "transfer",
      amount: input.amount,
      accountId: input.paymentAccountId,
      toAccountId: a.id,
      occurredAt: input.date,
      note: input.name,
    });
    return this.putPlan("deposit", input.name, {
      expectedReturn: input.expectedReturn || null,
      accountId: a.id,
      paymentAccountId: input.paymentAccountId,
      amount: input.amount,
      date: input.date,
      closed: false,
      txnIds: [txn.id],
    });
  }
  createDeposit(input: {
    expectedReturn?: string;
    name: string;
    amount: number;
    paymentAccountId: string;
    date: string;
  }) {
    this.db.withTransactionSync(() => {
      this.depositRecords(input);
    });
  }
  closeDeposit(
    id: string,
    amount: number,
    accountId: string,
    categoryId: string,
    date: string,
  ) {
    this.db.withTransactionSync(() => {
      const s = this.snapshot(),
        plan = s.plans.find(
          (p) => p.id === id && !p.deleted && p.kind === "deposit",
        );
      if (!plan) throw new Error(zh.errors.missing);
      const d = JSON.parse(plan.data);
      if (d.closed) throw new Error(zh.finance.closed);
      this.paymentAccount(accountId);
      validDate(date);
      if (date < d.date) throw new Error(zh.finance.order);
      const a = s.accounts.find((a) => a.id === d.accountId)!,
        balance = accountBalance(a, s.txns);
      if (assertMoney(amount) < 0 || amount > balance)
        throw new Error(zh.errors.amount);
      if (amount < balance) this.expenseCategory(categoryId);
      if (amount)
        d.txnIds.push(
          this.financialTxn({
            type: "transfer",
            amount,
            accountId: a.id,
            toAccountId: accountId,
            occurredAt: date,
            note: plan.name,
          }).id,
        );
      if (amount < balance)
        d.txnIds.push(
          this.financialTxn({
            type: "expense",
            amount: balance - amount,
            accountId: a.id,
            categoryId,
            occurredAt: date,
            note: zh.finance.depositLoss,
          }).id,
        );
      d.closed = true;
      this.write("account", { ...a, ...this.stamp(a), archived: true });
      this.putPlan("deposit", plan.name, d, plan);
    });
  }
  private prepaymentRecords(
    input: {
      name: string;
      amount: number;
      paymentAccountId: string;
      categoryId: string;
      date: string;
      startMonth: string;
      months: number;
      day: number;
    },
    previous?: FinancialPlan,
  ) {
    this.paymentAccount(input.paymentAccountId);
    this.expenseCategory(input.categoryId);
    validDate(input.date);
    const parts = splitPrepayment(
      input.amount,
      input.months,
      input.startMonth,
      input.day,
    );
    if (parts[0]!.date < input.date) throw new Error(zh.finance.prepayDate);
    let a: Account;
    if (previous) {
      a = this.snapshot().accounts.find(
        (a) => a.id === JSON.parse(previous.data).accountId,
      )!;
    } else {
      a = this.financialAccount(input.name, "prepaid");
    }
    const payment = this.financialTxn({
      type: "transfer",
      amount: input.amount,
      accountId: input.paymentAccountId,
      toAccountId: a.id,
      occurredAt: input.date,
      note: input.name,
    });
    const ids = [
      payment.id,
      ...parts.map(
        (part, i) =>
          this.financialTxn({
            type: "expense",
            amount: part.amount,
            accountId: a.id,
            categoryId: input.categoryId,
            occurredAt: part.date,
            note: input.name + " " + (i + 1) + "/" + parts.length,
          }).id,
      ),
    ];
    return this.putPlan(
      "prepaid",
      input.name,
      { ...input, accountId: a.id, txnIds: ids, closed: false },
      previous,
    );
  }
  savePrepayment(input: {
    id?: string;
    name: string;
    amount: number;
    paymentAccountId: string;
    categoryId: string;
    date: string;
    startMonth: string;
    months: number;
    day: number;
  }) {
    this.db.withTransactionSync(() => {
      const previous = input.id
        ? this.snapshot().plans.find(
            (p) => p.id === input.id && !p.deleted && p.kind === "prepaid",
          )
        : undefined;
      if (input.id && !previous) throw new Error(zh.errors.missing);
      if (previous) this.removePlanTxns(previous);
      this.prepaymentRecords(input, previous);
    });
  }
  private removePlanTxns(plan: FinancialPlan) {
    const d = JSON.parse(plan.data),
      s = this.snapshot();
    if (
      s.txns.some(
        (t) => !t.deleted && t.refundOfId && d.txnIds.includes(t.refundOfId),
      )
    )
      throw new Error(zh.errors.deleteRefundSource);
    for (const id of d.txnIds) {
      const row = s.txns.find((t) => t.id === id && !t.deleted);
      if (!row) throw new Error(zh.errors.missing);
      this.write("txn", { ...row, ...this.stamp(row), deleted: true });
    }
  }
  deletePrepayment(id: string) {
    this.db.withTransactionSync(() => {
      const s = this.snapshot(),
        p = s.plans.find(
          (p) => p.id === id && !p.deleted && p.kind === "prepaid",
        );
      if (!p) throw new Error(zh.errors.missing);
      this.removePlanTxns(p);
      const a = s.accounts.find((a) => a.id === JSON.parse(p.data).accountId)!;
      this.write("account", { ...a, ...this.stamp(a), archived: true });
      this.write("plan", { ...p, ...this.stamp(p), deleted: true });
    });
  }
  createRent(input: {
    name: string;
    monthlyRent: number;
    depositMonths: number;
    prepayMonths: number;
    start: string;
    paymentAccountId: string;
    categoryId: string;
  }) {
    this.db.withTransactionSync(() => {
      const plan = rentSchedule(
        input.monthlyRent,
        input.depositMonths,
        input.prepayMonths,
        input.start,
      );
      if (plan.deposit)
        this.depositRecords({
          name: input.name + " · " + zh.finance.deposit,
          amount: plan.deposit,
          paymentAccountId: input.paymentAccountId,
          date: input.start,
        });
      this.prepaymentRecords({
        name: input.name,
        amount: plan.prepaid,
        paymentAccountId: input.paymentAccountId,
        categoryId: input.categoryId,
        date: input.start,
        startMonth: input.start.slice(0, 7),
        months: input.prepayMonths,
        day: Number(input.start.slice(-2)),
      });
    });
  }

  familySnapshotOperations(): Operation[] {
    return (
      ["member", "account", "category", "txn", "plan", "budget"] as const
    ).flatMap((entity) =>
      this.all<RecordType>(entity)
        .filter((r) => !("scope" in r) || r.scope === "family")
        .map((record) => ({
          opId: "snapshot:" + entity + ":" + record.id + ":" + record.hlc,
          deviceId: record.hlc.split(":")[2]!,
          seq: 1,
          hlc: record.hlc,
          entity,
          entityId: record.id,
          action: record.deleted ? ("delete" as const) : ("upsert" as const),
          record,
        })),
    );
  }
  resetSyncUploads() {
    this.db.withTransactionSync(() => {
      this.db.runSync("UPDATE outbox SET uploaded=0");
      this.setPref("syncFiles", []);
    });
  }
  syncDeviceId(): string {
    return this.pref("deviceId", "");
  }
  syncFiles(): string[] {
    return this.pref("syncFiles", []);
  }
  markSyncFile(path: string) {
    this.db.withTransactionSync(() =>
      this.setPref("syncFiles", [...new Set([...this.syncFiles(), path])]),
    );
  }
  ackOperations(ids: string[]) {
    this.db.withTransactionSync(() => {
      const set = new Set(ids);
      for (const row of this.db.getAllSync<{ seq: number; op_json: string }>(
        "SELECT seq,op_json FROM outbox WHERE uploaded=0",
      ))
        if (set.has((JSON.parse(row.op_json) as Operation).opId))
          this.db.runSync("UPDATE outbox SET uploaded=1 WHERE seq=?", row.seq);
    });
  }
  renameMe(name: string) {
    this.db.withTransactionSync(() => {
      const s = this.snapshot(),
        me = s.members.find((m) => m.id === s.meId)!;
      this.write("member", { ...me, ...this.stamp(me), name: nameCheck(name) });
    });
  }
  canJoinFamily() {
    const s = this.snapshot();
    return (
      !s.txns.length &&
      !s.plans.length &&
      !s.accounts.some((a) => a.scope === "private")
    );
  }
  prepareJoin(name: string) {
    this.db.withTransactionSync(() => {
      if (!this.canJoinFamily()) throw new Error(zh.sync.joinNotEmpty);
      const s = this.snapshot(),
        me = s.members.find((m) => m.id === s.meId)!;
      for (const table of ["category", "account", "member", "budget", "outbox"])
        this.db.runSync(`DELETE FROM ${table}`);
      this.setPref("preferences", emptyPrefs());
      this.setPref("categoryDeletionHistory", []);
      this.setPref("monthBudgets", {});
      this.setPref("syncFiles", []);
      this.setPref("seenOps", []);
      this.setPref("planTxnHistory", {});
      this.write("member", {
        ...me,
        ...this.stamp(me),
        name: nameCheck(name),
        color: "#d77d66",
      });
    });
  }
  mergeOperations(ops: Operation[]) {
    if (!Array.isArray(ops) || ops.length > 10000)
      throw new Error(zh.sync.invalid);
    this.db.withTransactionSync(() => {
      const seen = new Set(this.pref<string[]>("seenOps", []));
      const planHistory = this.pref<Record<string, string[]>>(
        "planTxnHistory",
        {},
      );
      for (const op of ops) {
        if (
          !op ||
          !["member", "account", "category", "txn", "plan", "budget"].includes(
            op.entity,
          ) ||
          typeof op.opId !== "string" ||
          typeof op.deviceId !== "string" ||
          !Number.isSafeInteger(op.seq) ||
          op.seq < 1 ||
          !op.record ||
          op.entityId !== op.record.id ||
          op.hlc !== op.record.hlc ||
          !/^[0-9]{15}:[0-9]{8}:[a-zA-Z0-9-]+$/.test(op.hlc) ||
          op.action !== (op.record.deleted ? "delete" : "upsert")
        )
          throw new Error(zh.sync.invalid);
        const record = op.record as RecordType;
        if ("scope" in record && record.scope !== "family")
          throw new Error(zh.errors.scope);
        const columns = this.db.getAllSync<{
          name: string;
          type: string;
          notnull: number;
        }>(`PRAGMA table_info(${op.entity})`);
        const expected = columns.map((c) => reverseKeys[c.name] ?? c.name);
        if (Object.keys(record).sort().join() !== expected.sort().join())
          throw new Error(zh.sync.invalid);
        for (const c of columns) {
          const value = (record as unknown as Record<string, unknown>)[
            reverseKeys[c.name] ?? c.name
          ];
          if (value === null && !c.notnull) continue;
          if (
            booleans.has(c.name)
              ? typeof value !== "boolean"
              : c.type.toUpperCase() === "INTEGER"
                ? !Number.isSafeInteger(value)
                : typeof value !== "string"
          )
            throw new Error(zh.sync.invalid);
        }
        if (
          typeof record.id !== "string" ||
          !record.id ||
          !Number.isFinite(Date.parse(record.createdAt)) ||
          !Number.isFinite(Date.parse(record.updatedAt))
        )
          throw new Error(zh.sync.invalid);
        const previous = this.all<RecordType>(op.entity).find(
          (r) => r.id === record.id,
        );
        if (previous && "scope" in previous && previous.scope === "private")
          throw new Error(zh.errors.scope);
        if (
          op.entity === "account" &&
          ![
            "bank",
            "wechat",
            "alipay",
            "cash",
            "credit",
            "loan",
            "deposit",
            "prepaid",
          ].includes((record as Account).kind)
        )
          throw new Error(zh.sync.invalid);
        if (
          op.entity === "category" &&
          (!["expense", "income"].includes((record as Category).kind) ||
            (record as Category).parentId === record.id)
        )
          throw new Error(zh.sync.invalid);
        if (op.entity === "budget") {
          const b = record as Budget;
          validDate(b.month + "-01");
          if (b.amount < 0 || (!b.deleted && b.amount === 0))
            throw new Error(zh.sync.invalid);
        }
        if (op.entity === "txn") {
          const t = record as Txn;
          validDate(t.occurredAt);
          if (
            ![
              "expense",
              "income",
              "transfer",
              "refund",
              "repayment",
              "adjust",
              "scope_in",
              "scope_out",
            ].includes(t.type) ||
            !["me", "partner", "both"].includes(t.forWhom) ||
            (t.type !== "adjust" && t.amount <= 0) ||
            (t.refundIncome ?? 0) < 0 ||
            (t.type === "refund" && (t.refundIncome ?? 0) > t.amount)
          )
            throw new Error(zh.sync.invalid);
          const accounts = this.all<Account>("account");
          if (
            accounts.some(
              (a) =>
                a.scope === "private" &&
                (a.id === t.accountId || a.id === t.toAccountId),
            )
          )
            throw new Error(zh.errors.scope);
          if (
            (t.type === "scope_in" || t.type === "scope_out") &&
            (t.note !== "" || t.toAccountId !== null || t.categoryId !== null)
          )
            throw new Error(zh.sync.invalid);
        }
        if (op.entity === "plan") {
          const plan = record as FinancialPlan;
          if (!["loan", "deposit", "prepaid"].includes(plan.kind))
            throw new Error(zh.sync.invalid);
          let d;
          try {
            d = JSON.parse(plan.data);
          } catch {
            throw new Error(zh.sync.invalid);
          }
          if (
            !d ||
            typeof d.accountId !== "string" ||
            typeof d.paymentAccountId !== "string"
          )
            throw new Error(zh.sync.invalid);
          if (
            this.all<Account>("account").some(
              (a) =>
                a.scope === "private" &&
                [d.accountId, d.paymentAccountId].includes(a.id),
            )
          )
            throw new Error(zh.errors.scope);
          validatePlanData(plan.kind, d);
          if (plan.kind === "loan") {
            validateLoan(d);
            if (previous) {
              const old = JSON.parse((previous as FinancialPlan).data);
              const ids = [
                ...new Set([...(old.txnIds ?? []), ...(d.txnIds ?? [])]),
              ].sort();
              if (previous.hlc < record.hlc)
                plan.data = JSON.stringify({ ...d, txnIds: ids });
              else
                this.write(
                  "plan",
                  {
                    ...previous,
                    data: JSON.stringify({ ...old, txnIds: ids }),
                  } as FinancialPlan,
                  false,
                );
            }
          } else {
            if (
              !Array.isArray(d.txnIds) ||
              !d.txnIds.every((id: unknown) => typeof id === "string") ||
              typeof d.closed !== "boolean" ||
              !Number.isSafeInteger(d.amount) ||
              d.amount <= 0
            )
              throw new Error(zh.sync.invalid);
            validDate(d.date);
            if (plan.kind === "prepaid")
              splitPrepayment(d.amount, d.months, d.startMonth, d.day);
          }
        }
        if (op.entity === "plan" && (record as FinancialPlan).kind !== "loan") {
          const incoming = JSON.parse((record as FinancialPlan).data),
            old = previous ? JSON.parse((previous as FinancialPlan).data) : {};
          planHistory[record.id] = [
            ...new Set([
              ...(planHistory[record.id] ?? []),
              ...(old.txnIds ?? []),
              ...incoming.txnIds,
            ]),
          ];
        }
        if (!seen.has(op.opId) && (!previous || previous.hlc < record.hlc)) {
          this.write(op.entity, record, false);
          if (op.entity === "txn") {
            const t = record as Txn,
              pair = this.scopeTransfers().find((p) => p.familyId === t.id);
            if (pair) {
              const privateRow = this.all<Txn>("txn").find(
                (t) => t.id === pair.privateId,
              );
              if (
                !privateRow ||
                !["scope_in", "scope_out"].includes(t.type) ||
                t.type === privateRow.type
              )
                throw new Error(zh.sync.invalid);
              this.write(
                "txn",
                {
                  ...privateRow,
                  amount: t.amount,
                  occurredAt: t.occurredAt,
                  deleted: t.deleted,
                  hlc: t.hlc,
                  updatedAt: t.updatedAt,
                },
                false,
              );
            }
          }
        }
        seen.add(op.opId);
        const [wall, counter] = op.hlc.split(":").map(Number),
          last = this.pref<[number, number]>("hlc", [0, 0]);
        if (wall! > last[0] || (wall === last[0] && counter! > last[1]))
          this.setPref("hlc", [wall, counter]);
      }
      // Only the winning group version remains active after concurrent edits.
      // Keep candidate ids so reversed batches (plan before child rows) converge.
      const groupedTxns = new Map(this.all<Txn>("txn").map((t) => [t.id, t]));
      for (const plan of this.all<FinancialPlan>("plan").filter(
        (p) => p.kind !== "loan",
      )) {
        const d = JSON.parse(plan.data),
          live = new Set<string>(plan.deleted ? [] : d.txnIds);
        for (const id of planHistory[plan.id] ?? []) {
          if (live.has(id)) continue;
          const t = groupedTxns.get(id);
          if (
            t &&
            t.scope === "family" &&
            (t.accountId === d.accountId || t.toAccountId === d.accountId) &&
            t.hlc < plan.hlc
          )
            this.write(
              "txn",
              { ...t, deleted: true, hlc: plan.hlc, updatedAt: plan.updatedAt },
              false,
            );
        }
      }
      this.setPref("planTxnHistory", planHistory);
      // Shared category changes apply to local private records without publishing them.
      const categories = this.all<Category>("category");
      const resolve = (id: string | null) => {
        let current = id,
          discard = false;
        const visited = new Set<string>();
        while (current) {
          if (visited.has(current)) throw new Error(zh.sync.invalid);
          visited.add(current);
          const c = categories.find((c) => c.id === current);
          if (!c?.deleted) break;
          if (c.deleteAction !== "migrate" || !c.mergedInto) {
            discard = true;
            break;
          }
          current = c.mergedInto;
        }
        return { id: current, discard };
      };
      for (const t of this.all<Txn>("txn").filter(
        (t) => t.scope === "private" && !t.deleted,
      )) {
        const c = resolve(t.categoryId),
          income = resolve(t.refundIncomeCategoryId ?? null);
        const discarded = t.discarded || c.discard || income.discard;
        if (
          c.id !== t.categoryId ||
          income.id !== (t.refundIncomeCategoryId ?? null) ||
          discarded !== t.discarded
        )
          this.write(
            "txn",
            {
              ...t,
              ...this.stamp(t),
              categoryId: c.id,
              refundIncomeCategoryId: income.id,
              discarded,
            },
            false,
          );
      }
      const prefs = this.pref("preferences", emptyPrefs());
      this.setPref("preferences", {
        ...prefs,
        favorites: prefs.favorites.flatMap((f) => {
          const c = resolve(f.categoryId);
          return c.discard ? [] : [{ ...f, categoryId: c.id! }];
        }),
      });
      this.setPref("seenOps", [...seen]);
    });
  }

  scopeTransfers(): { id: string; familyId: string; privateId: string }[] {
    return this.pref("scopeTransfers", []);
  }
  transferScopes(input: {
    fromId: string;
    toId: string;
    amount: number;
    occurredAt: string;
    note: string;
  }) {
    this.db.withTransactionSync(() => {
      const s = this.snapshot();
      validDate(input.occurredAt);
      if (assertMoney(input.amount) <= 0) throw new Error(zh.errors.amount);
      const from = s.accounts.find(
          (a) => a.id === input.fromId && !a.deleted && !a.archived,
        ),
        to = s.accounts.find(
          (a) => a.id === input.toId && !a.deleted && !a.archived,
        );
      if (!from || !to || from.scope === to.scope)
        throw new Error(zh.errors.scope);
      const make = (account: Account, incoming: boolean): Txn => ({
        ...this.stamp(),
        scope: account.scope,
        type: incoming ? "scope_in" : "scope_out",
        amount: input.amount,
        accountId: account.id,
        toAccountId: null,
        categoryId: null,
        occurredAt: input.occurredAt,
        note:
          account.scope === "private" ? input.note.trim().slice(0, 500) : "",
        recorderMemberId: s.meId,
        forWhom: "me",
        discarded: false,
        refundOfId: null,
        refundIncome: 0,
        refundIncomeCategoryId: null,
      });
      const outgoing = make(from, false),
        incoming = make(to, true);
      this.write("txn", outgoing);
      this.write("txn", incoming);
      this.setPref("scopeTransfers", [
        ...this.scopeTransfers(),
        {
          id: this.uuid(),
          familyId: from.scope === "family" ? outgoing.id : incoming.id,
          privateId: from.scope === "private" ? outgoing.id : incoming.id,
        },
      ]);
    });
  }
  editScopeShell(id: string, amount: number, occurredAt: string) {
    this.db.withTransactionSync(() => {
      if (assertMoney(amount) <= 0) throw new Error(zh.errors.amount);
      validDate(occurredAt);
      const s = this.snapshot(),
        row = s.txns.find(
          (t) =>
            t.id === id &&
            !t.deleted &&
            t.scope === "family" &&
            ["scope_in", "scope_out"].includes(t.type),
        );
      if (!row) throw new Error(zh.errors.missing);
      const next = { ...row, ...this.stamp(row), amount, occurredAt };
      this.write("txn", next);
      const pair = this.scopeTransfers().find((p) => p.familyId === id),
        privateRow = s.txns.find((t) => t.id === pair?.privateId);
      if (privateRow)
        this.write(
          "txn",
          {
            ...privateRow,
            amount,
            occurredAt,
            hlc: next.hlc,
            updatedAt: next.updatedAt,
          },
          false,
        );
    });
  }
  deleteScopeTransfer(id: string) {
    this.db.withTransactionSync(() => {
      const pairs = this.scopeTransfers(),
        pair = pairs.find((p) => p.id === id);
      if (!pair) throw new Error(zh.errors.missing);
      const s = this.snapshot();
      for (const txnId of [pair.familyId, pair.privateId]) {
        const row = s.txns.find((t) => t.id === txnId && !t.deleted);
        if (!row) throw new Error(zh.errors.missing);
        this.write("txn", { ...row, ...this.stamp(row), deleted: true });
      }
      // Retain the local pair for concurrent winning family edits.
    });
  }
  restoreDiscardedTxn(
    id: string,
    categoryId: string,
    incomeCategoryId?: string,
  ) {
    this.db.withTransactionSync(() => {
      const s = this.snapshot();
      const row = s.txns.find((t) => t.id === id && !t.deleted && t.discarded);
      if (!row) throw new Error(zh.errors.missing);
      const source =
        row.type === "refund"
          ? s.txns.find(
              (t) => t.id === row.refundOfId && !t.deleted && !t.discarded,
            )
          : undefined;
      if (row.type === "refund" && !source)
        throw new Error(zh.discarded.restoreSource);
      const kind = row.type === "income" ? "income" : "expense";
      if (
        !s.categories.some(
          (c) => c.id === categoryId && !c.deleted && c.kind === kind,
        )
      )
        throw new Error(zh.errors.category);
      if (source && source.categoryId !== categoryId)
        throw new Error(zh.discarded.sameCategory);
      const related =
        row.type === "expense"
          ? s.txns.filter((t) => !t.deleted && t.refundOfId === row.id)
          : [];
      for (const record of [row, ...related]) {
        let incomeId = record.refundIncomeCategoryId;
        if (
          record.refundIncome &&
          !s.categories.some(
            (c) => c.id === incomeId && !c.deleted && c.kind === "income",
          )
        ) {
          if (
            !s.categories.some(
              (c) =>
                c.id === incomeCategoryId && !c.deleted && c.kind === "income",
            )
          )
            throw new Error(zh.discarded.chooseIncome);
          incomeId = incomeCategoryId;
        }
        this.write("txn", {
          ...record,
          ...this.stamp(record),
          discarded: false,
          categoryId,
          refundIncomeCategoryId: incomeId,
        });
      }
    });
  }
  deleteTxn(id: string) {
    this.deleteTxns([id]);
  }
  deleteTxns(ids: string[]) {
    this.db.withTransactionSync(() => {
      const unique = new Set(ids);
      const plans = this.snapshot().plans.filter((p) => !p.deleted);
      if (
        this.snapshot().txns.some(
          (t) =>
            unique.has(t.id) &&
            (t.type === "repayment" ||
              (t.type === "adjust" &&
                plans.some(
                  (p) => JSON.parse(p.data).accountId === t.accountId,
                )) ||
              plans.some((p) =>
                (JSON.parse(p.data).txnIds ?? []).includes(t.id),
              )),
        )
      )
        throw new Error(zh.finance.managed);
      const txns = this.snapshot().txns.filter((t) => !t.deleted);
      const records = txns.filter((t) => unique.has(t.id));
      if (!unique.size || records.length !== unique.size)
        throw new Error(zh.errors.missing);
      if (
        txns.some(
          (t) => t.refundOfId && unique.has(t.refundOfId) && !unique.has(t.id),
        )
      )
        throw new Error(zh.errors.deleteRefundSource);
      if (
        records.some(
          (t) =>
            t.scope === "private" &&
            (t.type === "scope_in" || t.type === "scope_out"),
        )
      )
        throw new Error(zh.vault.editInVault);
      for (const record of records) {
        const next = { ...record, ...this.stamp(record), deleted: true };
        this.write("txn", next);
        const pair = this.scopeTransfers().find(
            (p) => p.familyId === record.id,
          ),
          privateRow = txns.find((t) => t.id === pair?.privateId);
        if (privateRow)
          this.write(
            "txn",
            {
              ...privateRow,
              deleted: true,
              hlc: next.hlc,
              updatedAt: next.updatedAt,
            },
            false,
          );
      }
    });
  }
  saveFavorite(input: Omit<Preferences["favorites"][number], "id">) {
    const { preferences, categories, accounts } = this.snapshot();
    if (preferences.favorites.length >= 12) throw new Error(zh.favoriteLimit);
    if (!categories.some((c) => c.id === input.categoryId && !c.deleted))
      throw new Error(zh.errors.category);
    if (
      !accounts.some(
        (a) =>
          a.id === input.accountId &&
          a.scope === "family" &&
          !a.deleted &&
          !a.archived,
      )
    )
      throw new Error(zh.errors.account);
    if (input.amount !== undefined && assertMoney(input.amount) <= 0)
      throw new Error(zh.errors.amount);
    this.updatePreferences({
      favorites: [
        ...preferences.favorites,
        { ...input, label: nameCheck(input.label), id: this.uuid() },
      ],
    });
  }
}
