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
  | "expense"
  | "income"
  | "transfer"
  | "refund"
  | "repayment"
  | "adjust"
  | "scope_in"
  | "scope_out";
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
  occurredTime?: string | null;
  note: string;
  recorderMemberId: string;
  payerMemberId?: string | null;
  tripId?: string | null;
  forWhom: "me" | "partner" | "both";
  discarded: boolean;
  refundOfId: string | null;
  // Optional for pre-migration records in older operation logs.
  excludeBudget?: boolean;
  excludeTotals?: boolean;
  refundIncome?: number;
  refundIncomeCategoryId?: string | null;
};
export type Operation = {
  opId: string;
  deviceId: string;
  seq: number;
  hlc: string;
  entity:
    | "member"
    | "account"
    | "category"
    | "txn"
    | "plan"
    | "budget"
    | "trip"
    | "duplicate";
  entityId: string;
  action: "upsert" | "delete";
  record:
    | Member
    | Account
    | Category
    | Txn
    | FinancialPlan
    | Budget
    | Trip
    | DuplicateDecision;
};
export type Snapshot = {
  trips?: Trip[];
  duplicates?: DuplicateDecision[];
  budgets: Budget[];
  plans: FinancialPlan[];
  members: Member[];
  accounts: Account[];
  categories: Category[];
  txns: Txn[];
  preferences: Preferences;
  pending: number;
  meId: string;
};

export type Trip = BaseRecord & {
  scope: "family";
  name: string;
  startDate: string | null;
  endDate: string | null;
  ended: boolean;
};
export type DuplicateDecision = BaseRecord & {
  scope: "family";
  firstId: string;
  secondId: string;
  fingerprint: string;
};

export type FinancialPlan = BaseRecord & {
  scope: "family";
  kind: "loan" | "deposit" | "prepaid";
  name: string;
  data: string;
};

export type Budget = BaseRecord & {
  scope: "family";
  month: string;
  amount: number;
  allocations?: string;
};
