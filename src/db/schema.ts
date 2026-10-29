import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
const base = () => ({
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  hlc: text("hlc").notNull(),
  deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
});
export const members = sqliteTable("member", {
  ...base(),
  name: text("name").notNull(),
  color: text("color").notNull(),
});
export const accounts = sqliteTable("account", {
  ...base(),
  scope: text("scope", { enum: ["family", "private"] }).notNull(),
  name: text("name").notNull(),
  kind: text("kind", {
    enum: [
      "bank",
      "wechat",
      "alipay",
      "cash",
      "credit",
      "loan",
      "deposit",
      "prepaid",
    ],
  }).notNull(),
  initialBalance: integer("initial_balance").notNull(),
  ownerMemberId: text("owner_member_id").notNull(),
  last4: text("last4").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});
export const categories = sqliteTable("category", {
  ...base(),
  parentId: text("parent_id"),
  kind: text("kind", { enum: ["expense", "income"] }).notNull(),
  name: text("name").notNull(),
  icon: text("sf_symbol").notNull(),
  color: text("color").notNull(),
  sort: integer("sort").notNull().default(0),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  mergedInto: text("merged_into"),
  deleteAction: text("delete_action", { enum: ["migrate", "discard"] }),
});
export const txns = sqliteTable(
  "txn",
  {
    ...base(),
    scope: text("scope", { enum: ["family", "private"] }).notNull(),
    type: text("type", {
      enum: [
        "expense",
        "income",
        "transfer",
        "refund",
        "repayment",
        "adjust",
        "scope_in",
        "scope_out",
      ],
    }).notNull(),
    amount: integer("amount").notNull(),
    accountId: text("account_id").notNull(),
    toAccountId: text("to_account_id"),
    categoryId: text("category_id"),
    occurredAt: text("occurred_at").notNull(),
    note: text("note").notNull().default(""),
    recorderMemberId: text("recorder_member_id").notNull(),
    forWhom: text("for_whom", { enum: ["me", "partner", "both"] }).notNull(),
    discarded: integer("discarded", { mode: "boolean" })
      .notNull()
      .default(false),
    refundOfId: text("refund_of_id"),
    refundIncome: integer("refund_income").notNull().default(0),
    refundIncomeCategoryId: text("refund_income_category_id"),
  },
  (t) => [
    index("txn_date_idx").on(t.occurredAt),
    index("txn_account_idx").on(t.accountId),
  ],
);
export const outbox = sqliteTable("outbox", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  opJson: text("op_json").notNull(),
  uploaded: integer("uploaded", { mode: "boolean" }).notNull().default(false),
});
export const localPrefs = sqliteTable("local_pref", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const plans = sqliteTable("plan", {
  ...base(),
  scope: text("scope", { enum: ["family"] }).notNull(),
  kind: text("kind", { enum: ["loan", "deposit", "prepaid"] }).notNull(),
  name: text("name").notNull(),
  data: text("data").notNull(),
});

export const budgets = sqliteTable("budget", {
  ...base(),
  scope: text("scope", { enum: ["family"] }).notNull(),
  month: text("month").notNull(),
  amount: integer("amount").notNull(),
});
