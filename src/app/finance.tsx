import { Popover } from "../components/HelpBubble";
import { LeaseForm, LeaseDetails } from "../components/LeaseForm";
import { CategoryPicker } from "../components/CategoryPicker";
import { useSubmissionGuard } from "../components/useSubmissionGuard";
import { DateField } from "../components/DateField";
import { useState } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Heading,
  IconButton,
  Page,
  Txt,
  styles,
  confirmAction,
} from "../components/ui";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { accountBalance } from "../domain/selectors";
import {
  loanProjection,
  splitPrepayment,
  type LoanData,
} from "../domain/finance";
import { today } from "../domain/date";
import { zh } from "../i18n/zh";
export default function Finance() {
  const { kind: requested } = useLocalSearchParams<{ kind?: string }>();
  const { data, repo, run } = useLedger(),
    router = useRouter();
  const [kind, setKind] = useState<"loan" | "deposit" | "prepaid" | "rent">(
      requested === "rent"
        ? "rent"
        : requested === "prepaid"
          ? "prepaid"
          : "loan",
    ),
    [creating, setCreating] = useState(
      requested === "prepaid" || requested === "rent",
    ),
    [expectedReturn, setExpectedReturn] = useState(""),
    [name, setName] = useState(""),
    [amount, setAmount] = useState(""),
    [principal, setPrincipal] = useState(""),
    [date, setDate] = useState(today()),
    [paymentAccount, setPaymentAccount] = useState(""),
    [category, setCategory] = useState(""),
    [paid, setPaid] = useState("0"),
    [total, setTotal] = useState(""),
    [free, setFree] = useState("0"),
    [settle, setSettle] = useState(""),
    [due, setDue] = useState("15"),
    [months, setMonths] = useState("3"),
    [startMonth, setStartMonth] = useState(today().slice(0, 7)),
    [day, setDay] = useState(today().slice(-2)),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  let parts: ReturnType<typeof splitPrepayment> = [];
  let previewError = "";
  if (kind === "prepaid" && amount) {
    try {
      parts = splitPrepayment(
        calculate(amount),
        Number(months),
        startMonth,
        Number(day),
      );
    } catch (e) {
      previewError = (e as Error).message;
    }
  }
  const [action, setAction] = useState<{
      id: string;
      mode: "pay" | "settle" | "calibrate" | "return";
    } | null>(null),
    [actionAmount, setActionAmount] = useState(""),
    [interest, setInterest] = useState("0"),
    [actionDate, setActionDate] = useState(today());
  const accounts = data.accounts.filter(
    (a) =>
      a.scope === "family" &&
      !a.deleted &&
      !a.archived &&
      !["loan", "deposit", "prepaid"].includes(a.kind),
  );
  const categories = data.categories.filter(
    (c) => !c.deleted && c.kind === "expense",
  );
  const selection = (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Popover
        label="选择付款账户"
        triggerText={
          accounts.find((a) => a.id === paymentAccount)?.name ??
          accounts[0]?.name ??
          "添加付款账户"
        }
        compact
      >
        {(close) => (
          <View style={styles.wrap}>
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                selected={paymentAccount === a.id}
                onPress={() => {
                  setPaymentAccount(a.id);
                  close();
                }}
              />
            ))}
            {!accounts.length && (
              <Button
                label="添加账户"
                onPress={() => router.push("/account")}
              />
            )}
          </View>
        )}
      </Popover>
      {kind !== "deposit" && (
        <CategoryPicker
          label="费用分类"
          value={category || categories[0]?.id || ""}
          onChange={setCategory}
        />
      )}
    </View>
  );
  const submission = useSubmissionGuard(
    `${creating}:${editing}:${action?.id ?? ""}:${action?.mode ?? ""}`,
  );
  function perform(fn: () => void, once = true) {
    try {
      if (once) {
        if (!submission.run(() => run(fn))) return false;
      } else run(fn);
      setError("");
      setMessage(zh.finance.created);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  function save() {
    if (
      perform(() => {
        const accountId = paymentAccount || accounts[0]?.id || "",
          categoryId = category || categories[0]?.id || "";
        if (kind === "loan")
          repo.createLoan({
            name,
            principal: calculate(principal),
            paymentAccountId: accountId,
            monthlyPayment: calculate(amount),
            dueDay: Number(due),
            paidPeriods: Number(paid),
            totalPeriods: Number(total),
            interestFreePeriods: Number(free),
            settlePeriod: settle
              ? Number(settle)
              : Math.max(
                  Number(paid),
                  Number(free) > 0 ? Number(free) : Number(total),
                ),
          });
        if (kind === "deposit")
          repo.createDeposit({
            expectedReturn,
            name,
            amount: calculate(amount),
            paymentAccountId: accountId,
            date,
          });
        if (kind === "prepaid")
          repo.savePrepayment({
            id: editing || undefined,
            name,
            amount: calculate(amount),
            paymentAccountId: accountId,
            categoryId,
            date,
            startMonth,
            months: Number(months),
            day: Number(day),
          });
      })
    ) {
      setCreating(false);
      setEditing("");
      setName("");
      setAmount("");
    }
  }
  function submitAction() {
    if (!action) return;
    const a = action;
    if (
      perform(() => {
        if (a.mode === "calibrate")
          repo.calibrateLoan(a.id, calculate(actionAmount), actionDate);
        else if (a.mode === "return")
          repo.closeDeposit(
            a.id,
            calculate(actionAmount),
            paymentAccount || accounts[0]?.id || "",
            category || categories[0]?.id || "",
            actionDate,
          );
        else
          repo.payLoan(a.id, {
            amount: calculate(actionAmount),
            interest: calculate(interest),
            date: actionDate,
            categoryId: category || categories[0]?.id || "",
            paymentAccountId: paymentAccount || undefined,
            settle: a.mode === "settle",
          });
      })
    )
      setAction(null);
  }
  return (
    <Page>
      <Heading
        title={zh.finance.title}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <ErrorText message={error} />
      {!!message && <Txt>{message}</Txt>}
      <View style={styles.wrap}>
        {(["loan", "deposit", "prepaid", "rent"] as const).map((k) => (
          <Chip
            key={k}
            label={zh.finance[k]}
            selected={kind === k}
            onPress={() => {
              setKind(k);
              setCreating(true);
              setEditing("");
              setAction(null);
              setMessage("");
            }}
          />
        ))}
      </View>
      {!creating && (
        <Button
          secondary
          label={zh.addPlan + " · " + zh.finance[kind]}
          onPress={() => {
            setCreating(!creating);
            setEditing("");
            setAction(null);
          }}
        />
      )}
      {creating && kind === "rent" && (
        <Card style={{ padding: 14, gap: 8 }}>
          <LeaseForm
            onSaved={() => {
              setCreating(false);
              setMessage(zh.finance.created);
            }}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}
      {creating && kind !== "rent" && (
        <Card style={{ gap: 12 }}>
          <Field label={zh.finance.name} value={name} onChangeText={setName} />
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Field
                label={kind === "loan" ? zh.finance.monthly : zh.amount}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>
            {kind === "prepaid" && (
              <View style={{ width: 110 }}>
                <Field
                  label={zh.finance.months}
                  value={months}
                  onChangeText={setMonths}
                  keyboardType="number-pad"
                />
              </View>
            )}
          </View>
          {kind === "loan" ? (
            <>
              <Field
                label={zh.finance.principal}
                value={principal}
                onChangeText={setPrincipal}
                keyboardType="decimal-pad"
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ width: "47%" }}>
                  <Field
                    label={zh.finance.due}
                    value={due}
                    onChangeText={setDue}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ width: "47%" }}>
                  <Field
                    label={zh.finance.paid}
                    value={paid}
                    onChangeText={setPaid}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ width: "47%" }}>
                  <Field
                    label={zh.finance.total}
                    value={total}
                    onChangeText={setTotal}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ width: "47%" }}>
                  <Field
                    label={zh.finance.free}
                    value={free}
                    onChangeText={setFree}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ width: "47%" }}>
                  <Field
                    label={zh.finance.settlePeriod}
                    value={settle}
                    onChangeText={setSettle}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </>
          ) : kind !== "prepaid" ? (
            <DateField label={zh.date} value={date} onChange={setDate} />
          ) : null}
          {kind === "deposit" && (
            <DateField
              optional
              label={zh.finance.expectedReturn}
              value={expectedReturn}
              onChange={setExpectedReturn}
            />
          )}
          {kind === "prepaid" && (
            <>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <DateField label="付款日期" value={date} onChange={setDate} />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField
                    mode="month"
                    label={zh.finance.startMonth}
                    value={startMonth}
                    onChange={setStartMonth}
                  />
                </View>
              </View>
              <Field
                label={zh.finance.day + "（1–31）"}
                value={day}
                onChangeText={setDay}
                keyboardType="number-pad"
              />
            </>
          )}
          {kind === "prepaid" && (
            <View style={{ gap: 6 }}>
              <Txt size={12}>
                当月没有所选日期时在月末分摊，下个月恢复原定日期。
              </Txt>
              {!!previewError && <ErrorText message={previewError} />}
              {!!parts.length && (
                <>
                  <Txt bold>
                    总额 {formatMoney(calculate(amount))} · {parts.length} 个月
                  </Txt>
                  <Txt>
                    每月 {formatMoney(parts[0]!.amount)}
                    {parts.at(-1)!.amount !== parts[0]!.amount
                      ? "，末月 " + formatMoney(parts.at(-1)!.amount)
                      : ""}
                  </Txt>
                  <Chip
                    label={showSchedule ? "收起分摊明细" : "查看分摊日期"}
                    onPress={() => setShowSchedule(!showSchedule)}
                  />
                  {showSchedule &&
                    parts.slice(0, 3).map((p) => (
                      <Txt size={13} key={p.date}>
                        {p.date} · {formatMoney(p.amount)}
                      </Txt>
                    ))}
                  {showSchedule && parts.length > 3 && (
                    <Txt size={13}>
                      … 至 {parts.at(-1)!.date}，合计{" "}
                      {formatMoney(parts.reduce((n, p) => n + p.amount, 0))}
                    </Txt>
                  )}
                </>
              )}
            </View>
          )}
          {selection}
          <Button label={zh.save} onPress={save} />
          <Button
            secondary
            label={zh.cancel}
            onPress={() => setCreating(false)}
          />
        </Card>
      )}
      {action && (
        <Card style={{ gap: 12 }}>
          <Txt bold>{data.plans.find((p) => p.id === action.id)?.name}</Txt>
          <Field
            label={
              action.mode === "calibrate"
                ? zh.finance.newPrincipal
                : action.mode === "return"
                  ? zh.finance.returned
                  : zh.finance.paymentAmount
            }
            value={actionAmount}
            onChangeText={setActionAmount}
            keyboardType="decimal-pad"
          />
          {(action.mode === "pay" || action.mode === "settle") && (
            <Field
              label={zh.finance.interestInput}
              value={interest}
              onChangeText={setInterest}
              keyboardType="decimal-pad"
            />
          )}
          <DateField
            label={zh.date}
            value={actionDate}
            onChange={setActionDate}
          />
          {selection}
          <Button label={zh.save} onPress={submitAction} />
          <Button secondary label={zh.cancel} onPress={() => setAction(null)} />
        </Card>
      )}
      {data.plans
        .filter((p) => !p.deleted)
        .map((p) => {
          const d = JSON.parse(p.data),
            a = data.accounts.find((a) => a.id === d.accountId);
          if (!a)
            return (
              <Card key={p.id} style={{ gap: 12 }}>
                <Txt>{p.name} · 等待同步账户</Txt>
              </Card>
            );
          const balance = accountBalance(a, data.txns, today());
          const projection =
            p.kind === "loan"
              ? loanProjection(d as LoanData, Math.max(0, -balance))
              : null;
          const begin = (mode: "pay" | "settle" | "calibrate" | "return") => {
            setAction({ id: p.id, mode });
            setCreating(false);
            setActionDate(today());
            setInterest("0");
            setActionAmount(
              moneyInput(
                p.kind === "loan"
                  ? mode === "pay"
                    ? Math.min(d.monthlyPayment, -balance)
                    : -balance
                  : balance,
              ),
            );
            setPaymentAccount(d.paymentAccountId);
            setError("");
            setMessage("");
          };
          return (
            <Card key={p.id} style={{ gap: 12 }}>
              <Txt bold>
                {p.name} · {d.lease ? zh.finance.rent : zh.finance[p.kind]}
              </Txt>
              <Txt>{formatMoney(p.kind === "loan" ? -balance : balance)}</Txt>
              {d.closed && <Txt>{zh.finance.closed}</Txt>}
              {p.kind === "deposit" && d.expectedReturn && (
                <Txt>
                  {zh.finance.expectedReturn} · {d.expectedReturn}
                </Txt>
              )}
              {projection && (
                <>
                  <Txt>
                    {zh.finance.paid} {d.paidPeriods}/{d.totalPeriods} ·{" "}
                    {zh.finance.freeRemaining} {projection.freeRemaining}
                  </Txt>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: "#dce2ea",
                      borderRadius: 3,
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        left: `${(d.interestFreePeriods * 100) / d.totalPeriods}%`,
                        top: -3,
                        height: 12,
                        width: 2,
                        backgroundColor: "#d77d66",
                        zIndex: 1,
                      }}
                    />
                    <View
                      style={{
                        height: 6,
                        width: `${(d.paidPeriods * 100) / d.totalPeriods}%`,
                        backgroundColor: "#648BD2",
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Txt size={11}>
                    {zh.finance.free} · {d.interestFreePeriods}/{d.totalPeriods}
                  </Txt>
                  <Txt>
                    {zh.finance.nextDue} · {d.nextDueDate}
                  </Txt>
                  <Txt>
                    {zh.finance.settle} · {projection.deadline} ·{" "}
                    {formatMoney(projection.amount)} · {projection.days}{" "}
                    {zh.reports.days}
                  </Txt>
                  {projection.estimated && <Txt>{zh.finance.estimated}</Txt>}
                  {!d.closed && (
                    <>
                      <Button
                        secondary
                        label={zh.finance.payment}
                        onPress={() => begin("pay")}
                      />
                      <Button
                        secondary
                        label={zh.finance.payoff}
                        onPress={() => begin("settle")}
                      />
                    </>
                  )}
                  <Button
                    secondary
                    label={zh.finance.calibrate}
                    onPress={() => begin("calibrate")}
                  />
                </>
              )}
              {p.kind === "deposit" && !d.closed && (
                <Button
                  secondary
                  label={zh.finance.refundDeposit}
                  onPress={() => begin("return")}
                />
              )}
              {p.kind === "prepaid" && d.lease && <LeaseDetails plan={p} />}
              {p.kind === "prepaid" && !d.lease && (
                <>
                  <Txt>
                    {d.startMonth} · {d.months} {zh.reports.month}
                  </Txt>
                  <Button
                    secondary
                    label={zh.finance.editGroup}
                    onPress={() => {
                      setEditing(p.id);
                      setKind("prepaid");
                      setCreating(true);
                      setName(p.name);
                      setAmount(moneyInput(d.amount));
                      setPaymentAccount(d.paymentAccountId);
                      setCategory(d.categoryId);
                      setDate(d.date);
                      setStartMonth(d.startMonth);
                      setMonths(String(d.months));
                      setDay(String(d.day));
                      setAction(null);
                    }}
                  />
                  <Button
                    secondary
                    label={zh.finance.deleteGroup}
                    onPress={() =>
                      confirmAction(zh.finance.deleteGroup, p.name, () =>
                        perform(() => repo.deletePrepayment(p.id), false),
                      )
                    }
                  />
                </>
              )}
            </Card>
          );
        })}
    </Page>
  );
}
