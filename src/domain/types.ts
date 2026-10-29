export type Scope = "family" | "private";
export type AccountKind =
  | "bank"
  | "wechat"
  | "alipay"
  | "cash"
  | "credit"
  | "loan"
  | "deposit"
  | "prepaid";
export type TxnType =
  "expense" | "income" | "transfer" | "refund" | "repayment" | "adjust";
export type CategoryKind = "expense" | "income";
export type Favorite = {
  id: string;
  categoryId: string;
  label: string;
  accountId: string;
  amount?: number;
  note: string;
};
export type Preferences = {
  pinned: string[];
  lastAccount: Record<string, string>;
  recentCategories: string[];
  mode: "standard" | "daily";
  favorites: Favorite[];
};
export type BaseRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  hlc: string;
  deleted: boolean;
};
export type Member = BaseRecord & { name: string; color: string };
export type Account = BaseRecord & {
  scope: Scope;
  name: string;
  kind: AccountKind;
  initialBalance: number;
  ownerMemberId: string;
  last4: string;
  sort: number;
  archived: boolean;
};
export type Category = BaseRecord & {
  parentId: string | null;
  kind: CategoryKind;
  name: string;
  icon: string;
  color: string;
  sort: number;
  hidden: boolean;
  mergedInto: string | null;
  deleteAction: "migrate" | "discard" | null;
};
export type Txn = BaseRecord & {
  scope: Scope;
  type: TxnType;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  occurredAt: string;
  note: string;
  recorderMemberId: string;
  forWhom: "me" | "partner" | "both";
  discarded: boolean;
  refundOfId: string | null;
  // Optional for pre-migration records in older operation logs.
  refundIncome?: number;
  refundIncomeCategoryId?: string | null;
};
export type Operation = {
  opId: string;
  deviceId: string;
  seq: number;
  hlc: string;
  entity: "member" | "account" | "category" | "txn";
  entityId: string;
  action: "upsert" | "delete";
  record: Member | Account | Category | Txn;
};
export type Snapshot = {
  members: Member[];
  accounts: Account[];
  categories: Category[];
  txns: Txn[];
  preferences: Preferences;
  pending: number;
  meId: string;
};
