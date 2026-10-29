import { CategoryPicker } from "../components/CategoryPicker";
import { DateField } from "../components/DateField";
import { ReminderSettings } from "../components/ReminderSettings";
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
import { loanProjection, type LoanData } from "../domain/finance";
import { today } from "../domain/date";
import { zh } from "../i18n/zh";
export default function Finance() {
  const { kind: requested } = useLocalSearchParams<{ kind?: string }>();
  const { data, repo, run } = useLedger(),
    router = useRouter();
  const [kind, setKind] = useState<"loan" | "deposit" | "prepaid" | "rent">(
      requested === "prepaid" ? "prepaid" : "loan",
    ),
    [creating, setCreating] = useState(requested === "prepaid"),
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
    [depositMonths, setDepositMonths] = useState("1"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState("");
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
    <>
      <Txt>{zh.finance.paymentAccount}</Txt>
      <View style={styles.wrap}>
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            selected={paymentAccount === a.id}
            onPress={() => setPaymentAccount(a.id)}
          />
        ))}
      </View>
      <Txt>{zh.finance.category}</Txt>
      <CategoryPicker value={category} onChange={setCategory} />
    </>
  );
  function perform(fn: () => void) {
    try {
      run(fn);
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
        if (kind === "rent")
          repo.createRent({
            name,
            monthlyRent: calculate(amount),
            depositMonths: Number(depositMonths),
            prepayMonths: Number(months),
            start: date,
            paymentAccountId: accountId,
            categoryId,
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
      <Button
        secondary
        label={zh.addPlan + " · " + zh.finance[kind]}
        onPress={() => {
          setCreating(!creating);
          setEditing("");
          setAction(null);
        }}
      />
      {creating && (
        <Card style={{ gap: 12 }}>
          <Field label={zh.finance.name} value={name} onChangeText={setName} />
          <Field
            label={
              kind === "loan"
                ? zh.finance.monthly
                : kind === "rent"
                  ? zh.finance.rentAmount
                  : zh.amount
            }
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          {kind === "loan" ? (
            <>
              <Field
                label={zh.finance.principal}
                value={principal}
                onChangeText={setPrincipal}
                keyboardType="decimal-pad"
              />
              <Field
                label={zh.finance.due}
                value={due}
                onChangeText={setDue}
                keyboardType="number-pad"
              />
              <Field
                label={zh.finance.paid}
                value={paid}
                onChangeText={setPaid}
                keyboardType="number-pad"
              />
              <Field
                label={zh.finance.total}
                value={total}
                onChangeText={setTotal}
                keyboardType="number-pad"
              />
              <Field
                label={zh.finance.free}
                value={free}
                onChangeText={setFree}
                keyboardType="number-pad"
              />
              <Field
                label={zh.finance.settlePeriod}
                value={settle}
                onChangeText={setSettle}
                keyboardType="number-pad"
              />
            </>
          ) : (
            <DateField label={zh.date} value={date} onChange={setDate} />
          )}
          {kind === "deposit" && (
            <DateField
              optional
              label={zh.finance.expectedReturn}
              value={expectedReturn}
              onChange={setExpectedReturn}
            />
          )}
          {(kind === "prepaid" || kind === "rent") && (
            <Field
              label={
                kind === "rent" ? zh.finance.prepayMonths : zh.finance.months
              }
              value={months}
              onChangeText={setMonths}
              keyboardType="number-pad"
            />
          )}
          {kind === "prepaid" && (
            <>
              <DateField
                mode="month"
                label={zh.finance.startMonth}
                value={startMonth}
                onChange={setStartMonth}
              />
              <Field
                label={zh.finance.day}
                value={day}
                onChangeText={setDay}
                keyboardType="number-pad"
              />
            </>
          )}
          {kind === "rent" && (
            <Field
              label={zh.finance.depositMonths}
              value={depositMonths}
              onChangeText={setDepositMonths}
              keyboardType="number-pad"
            />
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
                {p.name} · {zh.finance[p.kind]}
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
              {p.kind === "prepaid" && (
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
                        perform(() => repo.deletePrepayment(p.id)),
                      )
                    }
                  />
                </>
              )}
            </Card>
          );
        })}
      <ReminderSettings />
    </Page>
  );
}
