import { Popover } from "../components/HelpBubble";
import { LeaseCard } from "../components/LeaseForm";
import { DepositCard } from "../components/DepositCard";
import { LoanCard } from "../components/LoanCard";
import { leaseLinkedDepositIds } from "../domain/leaseDeposits";
import { leftoverRecords } from "../domain/planRecords";
import { Pill } from "../components/LeaseForm";
import { CategoryPicker } from "../components/CategoryPicker";
import { useSubmissionGuard } from "../components/useSubmissionGuard";
import { DateField } from "../components/DateField";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Heading,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  styles,
  confirmAction,
} from "../components/ui";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { splitPrepayment } from "../domain/finance";
import { today } from "../domain/date";
import { zh } from "../i18n/zh";
export default function Finance() {
  const { kind: requested } = useLocalSearchParams<{ kind?: string }>();
  const { data, repo, run } = useLedger(),
    router = useRouter();
  // Standalone cost splitting is retired; rent spreading is a switch inside the lease.
  const [kind, setKind] = useState<"loan" | "deposit" | "rent">(
      requested === "loan" || requested === "deposit" ? requested : "rent",
    ),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(today()),
    [paymentAccount, setPaymentAccount] = useState(""),
    [category, setCategory] = useState(""),
    [months, setMonths] = useState("3"),
    [startMonth, setStartMonth] = useState(today().slice(0, 7)),
    [day, setDay] = useState(today().slice(-2)),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  let parts: ReturnType<typeof splitPrepayment> = [];
  let previewError = "";
  if (editing && amount) {
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
      <CategoryPicker
        label="费用分类"
        value={category || categories[0]?.id || ""}
        onChange={setCategory}
      />
    </View>
  );
  const submission = useSubmissionGuard(`${creating}:${editing}`);
  const leftovers = leftoverRecords(data);
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
  // Only older cost-split groups are still edited inline; new plans have their own pages.
  function save() {
    if (
      perform(() =>
        repo.savePrepayment({
          id: editing || undefined,
          name,
          amount: calculate(amount),
          paymentAccountId: paymentAccount || accounts[0]?.id || "",
          categoryId: category || categories[0]?.id || "",
          date,
          startMonth,
          months: Number(months),
          day: Number(day),
        }),
      )
    ) {
      setCreating(false);
      setEditing("");
      setName("");
      setAmount("");
    }
  }
  return (
    <Page>
      <Heading
        title={zh.finance.title}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            // After a browser refresh there is no previous page to return to.
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/assets")
            }
          />
        }
      />
      <ErrorText message={error} />
      {!!message && <Txt>{message}</Txt>}
      {(!!leftovers.accounts.length || !!leftovers.txns.length) && (
        <Card style={{ padding: 14 }}>
          <Row>
            <Txt size={13} style={{ flex: 1 }}>
              发现已删除计划遗留的 {leftovers.accounts.length} 个账户、
              {leftovers.txns.length} 笔记录
            </Txt>
            <Pill
              label="清理"
              onPress={() =>
                confirmAction(
                  "清理遗留记录？",
                  "这些账户和记录已不属于任何租赁、押金或贷款，多为旧版本修改或删除租赁后留下的。删除后，付款账户的余额会恢复成没有这些付款时的样子，不能恢复。",
                  () => perform(() => repo.removeLeftovers(), false),
                )
              }
            />
          </Row>
        </Card>
      )}
      <View style={styles.wrap}>
        {(["rent", "loan", "deposit"] as const).map((k) => (
          <Chip
            key={k}
            label={zh.finance[k]}
            selected={kind === k}
            onPress={() => {
              setKind(k);
              setCreating(false);
              setEditing("");
              setMessage("");
              setError("");
            }}
          />
        ))}
      </View>
      <Button
        icon="plus"
        label={
          kind === "rent"
            ? "新增租赁"
            : kind === "loan"
              ? "新增贷款"
              : "新增押金"
        }
        onPress={() =>
          router.push(
            kind === "rent"
              ? "/lease-new"
              : kind === "loan"
                ? "/loan-new"
                : "/deposit-new",
          )
        }
      />
      {creating && !!editing && (
        <Card style={{ gap: 12 }}>
          <Field label={zh.finance.name} value={name} onChangeText={setName} />
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Field
                label={zh.amount}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: 110 }}>
              <Field
                label={zh.finance.months}
                value={months}
                onChangeText={setMonths}
                keyboardType="number-pad"
              />
            </View>
          </View>
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
          {selection}
          <Button label={zh.save} onPress={save} />
          <Button
            secondary
            label={zh.cancel}
            onPress={() => setCreating(false)}
          />
        </Card>
      )}
      {(() => {
        const linked = leaseLinkedDepositIds(data);
        // Each tab lists its own plans; the rent tab also keeps older cost-split groups.
        const visible = data.plans.filter(
          (p) =>
            !p.deleted &&
            !linked.has(p.id) &&
            (kind === "rent" ? p.kind === "prepaid" : p.kind === kind),
        );
        const archivedPlans = visible.filter(
          (p) => JSON.parse(p.data).archived,
        );
        const shown = visible.filter((p) => !JSON.parse(p.data).archived);
        return (
          <>
            {shown.map((p) =>
              JSON.parse(p.data).lease ? (
                <LeaseCard key={p.id} plan={p} />
              ) : p.kind === "deposit" ? (
                <DepositCard key={p.id} plan={p} />
              ) : p.kind === "loan" ? (
                <LoanCard key={p.id} plan={p} />
              ) : (
                planCard(p)
              ),
            )}
            {!shown.length && (
              <Txt size={13}>
                {kind === "rent"
                  ? "还没有租赁，点上方“新增租赁”开始记录。"
                  : kind === "deposit"
                    ? "还没有押金，点上方“新增押金”开始记录。"
                    : "还没有贷款，点上方“新增贷款”开始记录。"}
              </Txt>
            )}
            {!!archivedPlans.length && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`查看已归档 ${archivedPlans.length} 条`}
                onPress={() =>
                  router.push({
                    pathname: "/finance-archive",
                    params: { kind },
                  })
                }
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 12,
                }}
              >
                <Txt>已归档 {archivedPlans.length} 条</Txt>
                <Icon name="chevron.right" size={13} />
              </Pressable>
            )}
          </>
        );
      })()}
    </Page>
  );
  /** Older cost-split groups, kept until they are archived or deleted. */
  function planCard(p: (typeof data.plans)[number]) {
    const d = JSON.parse(p.data);
    return (
      <Card key={p.id} style={{ gap: 12 }}>
        <Txt bold>
          {p.name} · {zh.finance.prepaid}
        </Txt>
        <Txt>
          {d.startMonth} · {d.months} {zh.reports.month}
        </Txt>
        <Button
          secondary
          label={zh.finance.editGroup}
          onPress={() => {
            setEditing(p.id);
            setCreating(true);
            setName(p.name);
            setAmount(moneyInput(d.amount));
            setPaymentAccount(d.paymentAccountId);
            setCategory(d.categoryId);
            setDate(d.date);
            setStartMonth(d.startMonth);
            setMonths(String(d.months));
            setDay(String(d.day));
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
        <Button
          secondary
          label={d.archived ? "取消归档" : "归档"}
          onPress={() =>
            perform(() => repo.archivePlan(p.id, !d.archived), false)
          }
        />
      </Card>
    );
  }
}
