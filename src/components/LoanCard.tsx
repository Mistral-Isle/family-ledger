import { useState } from "react";
import { Platform, Pressable, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Icon,
  Row,
  Txt,
  confirmAction,
  useTheme,
} from "./ui";
import { DateField } from "./DateField";
import { HelpBubble, Popover } from "./HelpBubble";
import { CategoryPicker } from "./CategoryPicker";
import { AccountField } from "./PickerField";
import { Pill, Segment } from "./LeaseForm";
import { useLedger } from "./LedgerProvider";
import { useSubmissionGuard } from "./useSubmissionGuard";
import { today } from "../domain/date";
import {
  addMonths,
  loanAdvance,
  loanCycleLabel,
  loanInstallment,
  loanNextAmount,
  loanProjection,
  type LoanData,
} from "../domain/finance";
import { leaseUnits, type LeaseUnit } from "../domain/lease";
import {
  calculate,
  formatMoney,
  moneyInput,
  optionalAmount,
} from "../domain/money";
import { isHoldingAccount } from "../domain/rentAccounts";
import { accountBalance } from "../domain/selectors";

// Short amounts keep each summary line on one line.
const money = (cents: number) => formatMoney(cents).replace(/\.00$/, "");
type Ledger = ReturnType<typeof useLedger>["data"];
const defaultAccount = (data: Ledger) =>
  data.accounts.find(
    (a) =>
      !a.deleted &&
      !a.archived &&
      a.scope === "family" &&
      a.kind !== "loan" &&
      !isHoldingAccount(a),
  )?.id ?? "";
const interestCategory = (data: Ledger) => {
  const expense = data.categories.filter(
    (c) => !c.deleted && !c.hidden && c.kind === "expense",
  );
  return (
    ["利息", "银行贷款", "手续费"]
      .map((name) => expense.find((c) => c.name === name))
      .find((c) => !!c)?.id ??
    expense.find((c) => !c.parentId)?.id ??
    ""
  );
};
const whole = (text: string) => (text.trim() ? Number(text) : 0);

/** Borrowed amount and first due date; older loans only stored what was left. */
function loanStart(data: Ledger, d: LoanData) {
  const paid = d.initialPaidPeriods ?? 0;
  const account = data.accounts.find((a) => a.id === d.accountId);
  const principal =
    d.principal ??
    Math.max(0, -(account?.initialBalance ?? 0)) + d.monthlyPayment * paid;
  const firstDue = d.initialNextDueDate
    ? d.oneTime
      ? d.initialNextDueDate
      : loanAdvance(d, d.initialNextDueDate, -paid)
    : "";
  return { principal, firstDue, paid };
}

export function LoanForm({
  editing,
  onSaved,
  onCancel,
}: {
  /** Correct a loan still being repaid; recorded repayments stay. */
  editing?: { id: string; name: string; data: string };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const old: LoanData | null = editing ? JSON.parse(editing.data) : null;
  const start = old ? loanStart(data, old) : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [principal, setPrincipal] = useState(
    start ? moneyInput(start.principal) : "",
  );
  const [date, setDate] = useState(old?.date ?? today());
  const [receive, setReceive] = useState(old?.receiveAccountId ?? "");
  const [account, setAccount] = useState(
    old?.paymentAccountId ?? defaultAccount(data),
  );
  const [countAsExpense, setCountAsExpense] = useState(
    !!old?.expenseCategoryId,
  );
  const [expenseCategory, setExpenseCategory] = useState(
    () =>
      old?.expenseCategoryId ??
      data.categories.find(
        (c) => !c.deleted && c.kind === "expense" && c.name === "车贷",
      )?.id ??
      "",
  );
  const [oneTime, setOneTime] = useState(!!old?.oneTime);
  const [every, setEvery] = useState(String(old?.every ?? 1));
  const [unit, setUnit] = useState<LeaseUnit>(old?.unit ?? "month");
  const [periods, setPeriods] = useState(
    old && !old.oneTime ? String(old.totalPeriods) : "",
  );
  // Blank spreads the amount evenly; only a different amount is shown.
  const [installment, setInstallment] = useState(() => {
    if (!old || old.oneTime || !start) return "";
    try {
      return loanInstallment(start.principal, old.totalPeriods).each ===
        old.monthlyPayment
        ? ""
        : moneyInput(old.monthlyPayment);
    } catch {
      return moneyInput(old.monthlyPayment);
    }
  });
  const [free, setFree] = useState(
    old?.interestFreePeriods ? String(old.interestFreePeriods) : "",
  );
  const [paid, setPaid] = useState(String(start?.paid ?? 0));
  const [firstDue, setFirstDue] = useState(
    start?.firstDue || (old?.oneTime ? "" : addMonths(today(), 1)),
  );
  const [error, setError] = useState("");
  const guard = useSubmissionGuard(editing?.id ?? "new-loan");
  let summary = "";
  let previewError = "";
  try {
    if (!oneTime && principal.trim() && periods.trim()) {
      const total = calculate(principal),
        n = Number(periods),
        { each, last } = loanInstallment(
          total,
          n,
          optionalAmount(installment) || null,
        ),
        freeCount = whole(free);
      summary = `共 ${n} 期 · 每期 ${money(each)}${last !== each ? `，末期 ${money(last)}` : ""}`;
      if (freeCount > 0 && freeCount < n && firstDue) {
        const end = loanAdvance(
          { unit, every: Number(every), dueDay: Number(firstDue.slice(-2)) },
          firstDue,
          freeCount - 1,
        );
        summary += `\n免息 ${freeCount} 期至 ${end}，届时还剩 ${money(total - each * freeCount)}`;
      }
    }
  } catch (e) {
    previewError = (e as Error).message;
  }
  const save = () => {
    try {
      if (
        guard.run(() =>
          run(() => {
            const input = {
              name,
              principal: calculate(principal),
              date,
              receiveAccountId: receive || null,
              paymentAccountId: account,
              oneTime,
              unit,
              every: Number(every),
              periods: Number(periods),
              installment: optionalAmount(installment) || null,
              freePeriods: whole(free),
              paidPeriods: whole(paid),
              firstDue,
              countAsExpense,
              expenseCategoryId: expenseCategory || null,
            };
            repo.saveLoan(input, editing?.id);
          }),
        )
      )
        onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <View style={{ gap: 14 }}>
      <Field label="名称" value={name} onChangeText={setName} />
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="借款金额"
            value={principal}
            onChangeText={setPrincipal}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="借款日期" value={date} onChange={setDate} />
        </View>
      </Row>
      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt size={12}>还款方式</Txt>
          <HelpBubble label="还款方式">
            分期：每隔几天、几周、几个月或几年还一期，可填免息期数，免息期结束时卡片会显示届时还剩多少，方便一次还清。一次还清：到期一笔还掉，也可以分几次还。
          </HelpBubble>
        </Row>
        <Row style={{ gap: 6 }}>
          <Segment
            label="分期还款"
            selected={!oneTime}
            onPress={() => {
              setOneTime(false);
              if (!firstDue) setFirstDue(addMonths(today(), 1));
            }}
          />
          <Segment
            label="一次还清"
            selected={oneTime}
            onPress={() => setOneTime(true)}
          />
        </Row>
      </View>
      {!oneTime ? (
        <>
          <Row style={{ alignItems: "flex-end" }}>
            <View style={{ width: 80 }}>
              <Field
                label="每"
                value={every}
                onChangeText={setEvery}
                keyboardType="number-pad"
              />
            </View>
            {(Object.keys(leaseUnits) as LeaseUnit[]).map((u) => (
              <Segment
                key={u}
                label={leaseUnits[u].label}
                selected={unit === u}
                onPress={() => setUnit(u)}
              />
            ))}
          </Row>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Field
                label="总期数"
                value={periods}
                onChangeText={setPeriods}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="每期还款（空 = 平均）"
                value={installment}
                onChangeText={setInstallment}
                keyboardType="decimal-pad"
              />
            </View>
          </Row>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <DateField
                label="首期还款日"
                value={firstDue}
                onChange={setFirstDue}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="免息期数（可空）"
                value={free}
                onChangeText={setFree}
                keyboardType="number-pad"
              />
            </View>
          </Row>
          {/* Only a loan already under way can have installments paid before it was recorded. */}
          {!!firstDue && firstDue <= today() && (
            <Row style={{ alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="记账前已还期数"
                  value={paid}
                  onChangeText={setPaid}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }} />
            </Row>
          )}
        </>
      ) : (
        <DateField
          optional
          label="约定还款日（可空）"
          value={firstDue}
          onChange={setFirstDue}
        />
      )}
      <Row style={{ alignItems: "flex-start" }}>
        <AccountField
          label="借款到账"
          value={receive}
          onChange={setReceive}
          noneLabel="不入账"
        />
        <AccountField label="还款账户" value={account} onChange={setAccount} />
      </Row>
      <Txt size={12}>
        {receive
          ? "借到的钱会记一笔转入所选账户。"
          : "不入账：钱直接付给了商家（如车贷），只记下欠款。"}
      </Txt>
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Txt size={12} color={t.muted}>
            还款计入支出
          </Txt>
          <Row style={{ minHeight: 48, gap: 0 }}>
            <Switch
              accessibilityLabel="还款计入支出"
              value={countAsExpense}
              trackColor={{ true: t.blue }}
              thumbColor={Platform.OS === "web" ? "#fff" : undefined}
              ios_backgroundColor={t.line}
              onValueChange={setCountAsExpense}
            />
            <HelpBubble label="还款计入支出">
              每期还款（本金加利息）记为支出，计入统计和预算。买东西时已记过全款支出的不要打开，以免重复。
            </HelpBubble>
          </Row>
        </View>
        <View style={{ flex: 1 }}>
          {countAsExpense && (
            <CategoryPicker
              field
              label="支出分类"
              value={expenseCategory}
              placeholder="车贷（自动创建）"
              onChange={setExpenseCategory}
            />
          )}
        </View>
      </Row>
      {!!summary && <Txt size={12}>{summary}</Txt>}
      <ErrorText message={error || previewError} />
      <Row>
        <View style={{ flex: 1 }}>
          <Button label="保存" onPress={save} />
        </View>
        <View style={{ flex: 1 }}>
          <Button secondary label="取消" onPress={onCancel} />
        </View>
      </Row>
    </View>
  );
}

/** One compact row per loan, matching lease cards: repay on the right, the rest on demand. */
export function LoanCard({
  plan,
}: {
  plan: { id: string; name: string; data: string };
}) {
  const { data, repo, run } = useLedger();
  const router = useRouter();
  const t = useTheme();
  const d: LoanData = JSON.parse(plan.data);
  const account = data.accounts.find((a) => a.id === d.accountId);
  const remaining = account
    ? Math.max(0, -accountBalance(account, data.txns))
    : 0;
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"pay" | "settle" | "calibrate" | null>(null);
  const [date, setDate] = useState(today());
  const [payFrom, setPayFrom] = useState(d.paymentAccountId);
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("");
  const [category, setCategory] = useState(
    () => d.expenseCategoryId || interestCategory(data),
  );
  const [error, setError] = useState("");
  const guard = useSubmissionGuard(`${plan.id}:${d.paidPeriods}:${mode}`);
  if (!account)
    return (
      <Card style={{ padding: 14 }}>
        <Txt>{plan.name} · 等待同步账户</Txt>
      </Card>
    );
  const rows = data.txns.filter(
    (t) => !t.deleted && (d.txnIds ?? []).includes(t.id),
  );
  const interestPaid = rows
    .filter((t) => t.type === "expense")
    .reduce((n, t) => n + t.amount, 0);
  const lastPaid = rows
    .filter((t) => t.type === "repayment" || t.type === "adjust")
    .map((t) => t.occurredAt)
    .sort()
    .at(-1);
  const { principal } = loanStart(data, d);
  const inFree = d.paidPeriods < d.interestFreePeriods;
  // Where the loan stands when the interest-free periods end.
  let freeEnd: ReturnType<typeof loanProjection> | null = null;
  try {
    if (inFree && d.interestFreePeriods < d.totalPeriods)
      freeEnd = loanProjection(
        { ...d, settlePeriod: d.interestFreePeriods },
        remaining,
      );
  } catch {}
  const nextAmount = loanNextAmount(d, remaining);
  const overdue = !d.closed && !!d.nextDueDate && d.nextDueDate < today();
  let interestValue = 0;
  try {
    interestValue = optionalAmount(interest);
  } catch {}
  const submit = (fn: () => void) => {
    try {
      if (guard.run(() => run(fn))) {
        setMode(null);
        setError("");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const begin = (next: "pay" | "settle" | "calibrate") => {
    setMode(next);
    setError("");
    setDate(today());
    setPayFrom(d.paymentAccountId);
    setInterest("");
    setAmount(moneyInput(next === "pay" ? nextAmount : remaining));
  };
  const archive = () => submit(() => repo.archivePlan(plan.id, !d.archived));
  const pay = (settle: boolean) =>
    submit(() =>
      repo.payLoan(plan.id, {
        amount: settle
          ? remaining + optionalAmount(interest)
          : calculate(amount),
        interest: optionalAmount(interest),
        date,
        categoryId: category,
        paymentAccountId: payFrom,
        settle,
      }),
    );
  const menu = (
    <Popover label="更多操作">
      {(close) => (
        <View style={{ gap: 8 }}>
          {!d.closed && !d.oneTime && (
            <Button
              secondary
              label="提前还清"
              onPress={() => {
                close();
                begin("settle");
              }}
            />
          )}
          {!d.closed && (
            <Button
              secondary
              label="校准剩余本金"
              onPress={() => {
                close();
                begin("calibrate");
              }}
            />
          )}
          {!d.closed && (
            <Button
              secondary
              label="修改"
              onPress={() => {
                close();
                router.push({
                  pathname: "/loan-new",
                  params: { edit: plan.id },
                });
              }}
            />
          )}
          <Button
            secondary
            label={d.archived ? "取消归档" : "归档"}
            onPress={() => {
              close();
              archive();
            }}
          />
          <Button
            secondary
            label="删除"
            onPress={() => {
              close();
              confirmAction(
                "删除这笔贷款？",
                "会一并删除它的借款、还款和利息记录，不能恢复。",
                () => submit(() => repo.deleteLoan(plan.id)),
              );
            }}
          />
        </View>
      )}
    </Popover>
  );
  const actions = (confirm: string, onConfirm: () => void) => (
    <Row>
      <View style={{ flex: 1 }}>
        <Button label={confirm} onPress={onConfirm} />
      </View>
      <View style={{ flex: 1 }}>
        <Button secondary label="取消" onPress={() => setMode(null)} />
      </View>
    </Row>
  );
  const interestFields = (
    <>
      <Field
        label="利息／手续费（没有就空着）"
        value={interest}
        onChangeText={setInterest}
        keyboardType="decimal-pad"
      />
      {interestValue > 0 && (
        <CategoryPicker
          field
          label="利息分类"
          value={category}
          onChange={setCategory}
        />
      )}
    </>
  );
  return (
    <Card style={{ gap: 10, padding: 14 }}>
      <Row>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${plan.name}，${expanded ? "收起" : "展开"}详情`}
          onPress={() => setExpanded(!expanded)}
          style={{ flex: 1, minWidth: 0, gap: 3 }}
        >
          <Row style={{ gap: 6 }}>
            <Txt size={16} bold>
              {plan.name}
            </Txt>
            <Icon
              name={expanded ? "chevron.up" : "chevron.down"}
              size={11}
              color={t.muted}
            />
          </Row>
          <Txt size={12} color={t.muted}>
            {d.oneTime
              ? `一次还清 · 借 ${money(principal)}`
              : `${loanCycleLabel(d)} ${money(d.monthlyPayment)} · 已还 ${d.paidPeriods}/${d.totalPeriods}`}
          </Txt>
          <Txt size={12} color={overdue ? t.red : t.muted}>
            {d.closed
              ? `已还清 ${lastPaid ?? ""}`
              : d.oneTime
                ? `${d.nextDueDate ? `${d.nextDueDate} 前 · ` : ""}待还 ${money(remaining)}`
                : `下期 ${d.nextDueDate} · ${money(nextAmount)}${overdue ? " · 已到期" : ""}`}
          </Txt>
        </Pressable>
        {!d.closed && !mode && (
          <Pill primary label="还款" onPress={() => begin("pay")} />
        )}
        {/* Every other action lives in the menu, the same on all plan cards. */}
        {!mode && menu}
      </Row>
      {expanded && (
        <View style={{ gap: 4 }}>
          <Txt size={12} color={t.muted}>
            借款 {money(principal)}
            {d.date ? ` · ${d.date}` : ""} · 剩余本金 {money(remaining)}
          </Txt>
          {freeEnd && (
            <Txt size={12} color={t.muted}>
              免息至第 {d.interestFreePeriods} 期（{freeEnd.deadline}）·
              届时还剩 {money(freeEnd.amount)}
            </Txt>
          )}
          {!d.closed && !!d.interestFreePeriods && !inFree && (
            <Txt size={12} color={t.muted}>
              免息期已结束
            </Txt>
          )}
          {!!interestPaid && (
            <Txt size={12} color={t.muted}>
              已付利息／手续费 {money(interestPaid)}
            </Txt>
          )}
        </View>
      )}
      {(mode === "pay" || mode === "settle") && (
        <>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <DateField label="还款日期" value={date} onChange={setDate} />
            </View>
            <AccountField
              label="付款账户"
              value={payFrom}
              onChange={setPayFrom}
            />
          </Row>
          {mode === "pay" && (
            <Field
              label={`还款金额（剩 ${money(remaining)}${inFree ? "" : "，含利息"}）`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          )}
          {/* Interest-free periods take principal only. */}
          {(mode === "settle" || !inFree) && interestFields}
          {mode === "pay"
            ? actions("确认还款", () => pay(false))
            : actions(`还清 ${money(remaining + interestValue)}`, () =>
                pay(true),
              )}
        </>
      )}
      {mode === "calibrate" && (
        <>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold>校准剩余本金</Txt>
            <HelpBubble label="校准剩余本金">
              按银行或借款方显示的剩余本金填写，和账上不一致的差额会记一笔调整，不算支出。
            </HelpBubble>
          </Row>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <DateField label="校准日期" value={date} onChange={setDate} />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="实际剩余本金"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>
          </Row>
          {actions("保存", () =>
            submit(() => repo.calibrateLoan(plan.id, calculate(amount), date)),
          )}
        </>
      )}
      <ErrorText message={error} />
    </Card>
  );
}
