import type {
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
type RecordType = Account | Category | Txn | Member;
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
  private write(entity: Entity, record: RecordType) {
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
    this.enqueue(entity, record);
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
      if (this.pref("initialized", false)) return;
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
    return {
      members: this.all<Member>("member"),
      accounts: this.all<Account>("account"),
      categories: this.all<Category>("category"),
      txns: this.all<Txn>("txn"),
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
    last4?: string;
    archived?: boolean;
  }) {
    this.db.withTransactionSync(() => {
      const snapshot = this.snapshot();
      const previous = snapshot.accounts.find(
        (a) => a.id === input.id && !a.deleted,
      );
      if (input.id && !previous) throw new Error(zh.errors.missing);
      if (input.last4 && !/^\d{4}$/.test(input.last4))
        throw new Error(zh.errors.last4);
      const record: Account = {
        ...this.stamp(previous),
        scope: previous?.scope ?? "family",
        name: nameCheck(input.name),
        kind: input.kind,
        initialBalance: assertMoney(input.initialBalance),
        last4: input.last4 ?? "",
        ownerMemberId: previous?.ownerMemberId ?? snapshot.meId,
        sort: previous?.sort ?? snapshot.accounts.length,
        archived: input.archived ?? previous?.archived ?? false,
      };
      this.write("account", record);
      if (!previous && snapshot.preferences.pinned.length < 4)
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
  }) {
    this.db.withTransactionSync(() => {
      const s = this.snapshot();
      const previous = s.txns.find((t) => t.id === input.id && !t.deleted);
      if (input.id && !previous) throw new Error(zh.errors.missing);
      if (!["expense", "income", "transfer"].includes(input.type))
        throw new Error(zh.errors.future);
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
      } else {
        const category = s.categories.find(
          (c) =>
            c.id === input.categoryId && c.kind === input.type && !c.deleted,
        );
        if (!category) throw new Error(zh.errors.category);
        categoryId = category.id;
      }
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
        refundOfId: null,
      };
      this.write("txn", record);
      if (categoryId)
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
  deleteTxn(id: string) {
    this.db.withTransactionSync(() => {
      const record = this.snapshot().txns.find(
        (t) => t.id === id && !t.deleted,
      );
      if (!record) throw new Error(zh.errors.missing);
      this.write("txn", { ...record, ...this.stamp(record), deleted: true });
    });
  }
  saveFavorite(input: Omit<Preferences["favorites"][number], "id">) {
    const { preferences, categories, accounts } = this.snapshot();
    if (preferences.favorites.length >= 12) throw new Error(zh.favoriteLimit);
    if (!categories.some((c) => c.id === input.categoryId && !c.deleted))
      throw new Error(zh.errors.category);
    if (
      !accounts.some(
        (a) => a.id === input.accountId && !a.deleted && !a.archived,
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
