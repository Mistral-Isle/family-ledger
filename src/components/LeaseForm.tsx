import { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Icon,
  Row,
  Txt,
  confirmAction,
  styles,
  useTheme,
} from "./ui";
import { DateField } from "./DateField";
import { HelpBubble, Popover } from "./HelpBubble";
import { CategoryPicker } from "./CategoryPicker";
import { AccountField } from "./PickerField";
import { useLedger } from "./LedgerProvider";
import { useSubmissionGuard } from "./useSubmissionGuard";
import { addMonths } from "../domain/finance";
import { addDays } from "../domain/reports";
import { today } from "../domain/date";
import {
  calculate,
  formatMoney,
  moneyInput,
  optionalAmount,
} from "../domain/money";
import {
  leaseCycles,
  leaseCycleLabel,
  leaseParts,
  leaseSchedule,
  leaseExit,
  leaseUnits,
  type LeaseCycle,
  type LeaseTerms,
  type LeaseUnit,
} from "../domain/lease";
import { leaseDepositIds } from "../domain/leaseDeposits";
import { isHoldingAccount } from "../domain/rentAccounts";
import { accountBalance } from "../domain/selectors";

const defaultAccount = (data: ReturnType<typeof useLedger>["data"]) =>
  data.accounts.find(
    (a) =>
      !a.deleted &&
      !a.archived &&
      a.scope === "family" &&
      a.kind !== "loan" &&
      !isHoldingAccount(a),
  )?.id ?? "";

export function LeaseForm({
  editing,
  onSaved,
  onCancel,
}: {
  /** Correct an existing lease; paid periods are replayed on their dates. */
  editing?: { id: string; name: string; data: string };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { data, repo, run } = useLedger();
  const old = editing ? JSON.parse(editing.data) : null;
  const initialStart = old ? old.lease.start : today();
  const [name, setName] = useState(editing?.name ?? "");
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(
    old ? old.lease.end : addDays(addMonths(initialStart, 12), -1),
  );
  const [cycle, setCycle] = useState<LeaseCycle>(
    old?.lease.cycle && old.lease.cycle in leaseCycles
      ? old.lease.cycle
      : "quarter",
  );
  const [unit, setUnit] = useState<LeaseUnit>(old?.lease.unit ?? "month");
  const [every, setEvery] = useState(String(old?.lease.every ?? 2));
  const [editingCustom, setEditingCustom] = useState(false);
  const [rent, setRent] = useState(old ? moneyInput(old.lease.rent) : "");
  const [deposit, setDeposit] = useState(
    old?.deposit ? moneyInput(old.deposit) : "",
  );
  // New leases spread rent evenly over months unless the switch is turned off.
  const [spread, setSpread] = useState(old?.lease.split !== "none");
  const [date, setDate] = useState(old ? old.date : initialStart);
  const [account, setAccount] = useState(
    old?.paymentAccountId ?? defaultAccount(data),
  );
  const [category, setCategory] = useState(
    old?.categoryId ??
      data.categories.find(
        (c) => !c.deleted && c.kind === "expense" && c.name === "房租",
      )?.id ??
      "",
  );
  const [error, setError] = useState("");
  const guard = useSubmissionGuard(editing?.id ?? "new-lease");
  const terms = (): LeaseTerms => ({
    start,
    end,
    cycle,
    rent: calculate(rent),
    split: spread ? "month" : "none",
    ...(cycle === "custom" ? { unit, every: Number(every) } : {}),
  });
  let summary = "";
  let previewError = "";
  try {
    if (rent) {
      const schedule = leaseSchedule(terms());
      const parts = leaseParts(schedule[0]!, terms());
      summary = `共 ${schedule.length} 期 · 合计 ${formatMoney(
        schedule.reduce((n, p) => n + p.amount, 0),
      )}${spread && parts.length > 1 ? ` · 每月计入 ${formatMoney(parts[0]!.amount)}` : ""}`;
    }
  } catch (e) {
    previewError = (e as Error).message;
  }
  return (
    <View style={{ gap: 14 }}>
      <Field label="租赁名称" value={name} onChangeText={setName} />
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <DateField label="起租日" value={start} onChange={setStart} />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="到期日" value={end} onChange={setEnd} />
        </View>
      </Row>
      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt size={12}>付款周期</Txt>
          <HelpBubble label="付款周期">
            押金和首期租金按首期付款日从付款账户扣款。之后每期在租赁卡片上点“交租”：钱按你点的那天扣，房租仍按租期计入对应月份，提前交也不会提前算支出。
          </HelpBubble>
        </Row>
        <Row style={{ gap: 6 }}>
          {(Object.keys(leaseCycles) as LeaseCycle[]).map((c) => (
            <Segment
              key={c}
              label={
                c === "custom" && cycle === "custom"
                  ? leaseCycleLabel({ cycle, unit, every: Number(every) })
                  : leaseCycles[c]
              }
              selected={cycle === c}
              onPress={() => {
                setCycle(c);
                setEditingCustom(c === "custom");
              }}
            />
          ))}
        </Row>
        {cycle === "custom" && editingCustom && (
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
                onPress={() => {
                  setUnit(u);
                  setEditingCustom(false);
                }}
              />
            ))}
          </Row>
        )}
      </View>
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="每期租金"
            value={rent}
            onChangeText={setRent}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="押金"
            value={deposit}
            onChangeText={setDeposit}
            keyboardType="decimal-pad"
          />
        </View>
      </Row>
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <DateField label="首期付款日" value={date} onChange={setDate} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Row style={{ gap: 2 }}>
            <Txt size={12}>按月分摊</Txt>
            <HelpBubble label="按月分摊">
              开启：一期交几个月，就平均计入这几个月的支出，日期为每月的起租日。关闭：整期租金在该期开始那天一次计入。
            </HelpBubble>
          </Row>
          <Switch
            accessibilityLabel="按月分摊"
            value={spread}
            onValueChange={setSpread}
          />
        </View>
      </Row>
      <Row style={{ alignItems: "flex-start" }}>
        <AccountField label="付款账户" value={account} onChange={setAccount} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <CategoryPicker
            field
            label="租金分类"
            value={category}
            onChange={setCategory}
          />
        </View>
      </Row>
      {!!summary && <Txt size={12}>{summary}</Txt>}
      <ErrorText message={error || previewError} />
      <Row>
        <View style={{ flex: 1 }}>
          <Button
            label="保存"
            onPress={() => {
              try {
                if (
                  guard.run(() =>
                    run(() => {
                      const input = {
                        name,
                        paymentAccountId: account,
                        categoryId: category,
                        lease: terms(),
                        deposit: optionalAmount(deposit),
                        date,
                      };
                      if (editing) repo.editLease(editing.id, input);
                      else repo.createLease(input);
                    }),
                  )
                )
                  onSaved();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button secondary label="取消" onPress={onCancel} />
        </View>
      </Row>
    </View>
  );
}

/** Equal-width option that keeps a whole choice set on one line. */
function Segment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        paddingHorizontal: 2,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: selected ? t.primary : t.line,
        backgroundColor: selected ? t.primary : t.soft,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Txt size={13} bold={selected} color={selected ? t.onPrimary : t.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Pill({
  label,
  onPress,
  primary = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        minWidth: 52,
        paddingHorizontal: 12,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary ? t.primary : t.soft,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Txt
        size={14}
        bold
        color={primary ? t.onPrimary : danger ? t.red : t.buttonText}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

/** One compact row per lease; details and actions open only on demand. */
export function LeaseCard({
  plan,
}: {
  plan: { id: string; name: string; data: string };
}) {
  const { data, repo, run } = useLedger();
  const router = useRouter();
  const t = useTheme();
  const d = JSON.parse(plan.data);
  const schedule = leaseSchedule(d.lease),
    next = schedule[d.paidPeriods];
  const currentRent = d.lease.rentChanges?.at(-1)?.rent ?? d.lease.rent;
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<
    "pay" | "end" | "adjust" | "refund" | "extend" | null
  >(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState(d.paidPeriods);
  const [date, setDate] = useState(today());
  const [account, setAccount] = useState(d.paymentAccountId);
  const [newRent, setNewRent] = useState("");
  const [endDate, setEndDate] = useState(today());
  const [rentReturned, setRentReturned] = useState("");
  const [returned, setReturned] = useState("");
  const [shortfall, setShortfall] = useState("");
  const [settleDeposit, setSettleDeposit] = useState(true);
  const [depositIds, setDepositIds] = useState<string[]>([]);
  const [category, setCategory] = useState(d.categoryId);
  const guard = useSubmissionGuard(`${plan.id}:${period}:${mode}`);
  const openDeposits = data.plans.filter(
    (p) => p.kind === "deposit" && !p.deleted && !JSON.parse(p.data).closed,
  );
  const depositBalance = (id: string) => {
    const deposit = openDeposits.find((p) => p.id === id);
    const a =
      deposit &&
      data.accounts.find((a) => a.id === JSON.parse(deposit.data).accountId);
    return a ? accountBalance(a, data.txns) : 0;
  };
  const sum = (ids: string[]) =>
    ids.reduce((total, id) => total + depositBalance(id), 0);
  const linkedDeposits = leaseDepositIds(data, plan.id);
  const heldDeposit = sum(linkedDeposits);
  const prepaidAccount = data.accounts.find((a) => a.id === d.accountId);
  const prepaid = prepaidAccount
    ? accountBalance(prepaidAccount, data.txns, today())
    : 0;
  const renewed = data.plans.some(
    (p) => !p.deleted && JSON.parse(p.data).renewedFrom === plan.id,
  );
  let unusedRent = 0;
  try {
    unusedRent = leaseExit(d.lease, d.paidPeriods, endDate).unused;
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
  const begin = (next: "pay" | "end" | "adjust" | "refund" | "extend") => {
    setMode(next);
    setError("");
    setPeriod(d.paidPeriods);
    if (next === "pay") {
      const last = d.lastPaymentDate ?? "";
      setDate(today() < last ? last : today());
      setAccount(d.paymentAccountId);
    }
    if (next === "adjust" || next === "extend")
      setNewRent(moneyInput(currentRent));
    if (next === "extend")
      setEndDate(addDays(addMonths(addDays(d.lease.end, 1), 12), -1));
    if (next === "end") {
      const ids = renewed ? [] : linkedDeposits;
      setEndDate(today());
      setRentReturned("");
      setShortfall("");
      setDepositIds(ids);
      setReturned(moneyInput(sum(ids)));
      setSettleDeposit(!renewed && openDeposits.length > 0);
      setAccount(d.paymentAccountId);
      setCategory(d.categoryId);
    }
    if (next === "refund") {
      setEndDate(today());
      setRentReturned("");
      setReturned("");
      setDepositIds(renewed ? [] : linkedDeposits);
      setAccount(d.paymentAccountId);
      setCategory(d.categoryId);
    }
  };
  // Short amounts keep each summary line on one line.
  const money = (cents: number) => formatMoney(cents).replace(/\.00$/, "");
  // Late deposit refunds already show in the deposit line.
  const laterRent = (d.laterRefunds ?? []).reduce(
    (total: number, r: { rent: number }) => total + r.rent,
    0,
  );
  let depositShort = false;
  try {
    depositShort = !!returned.trim() && calculate(returned) < sum(depositIds);
  } catch {}
  const menu = (
    <Popover label="更多操作">
      {(close) => (
        <View style={{ gap: 8 }}>
          {!d.closed && (
            <Button
              secondary
              label="结束租赁"
              onPress={() => {
                close();
                begin("end");
              }}
            />
          )}
          {!d.closed && !!next && (
            <Button
              secondary
              label="调整租金"
              onPress={() => {
                close();
                begin("adjust");
              }}
            />
          )}
          {!d.closed && !renewed && (
            <Button
              secondary
              label="续租"
              onPress={() => {
                close();
                begin("extend");
              }}
            />
          )}
          <Button
            secondary
            label={d.archived ? "取消归档" : "归档"}
            onPress={() => {
              close();
              submit(() => repo.archivePlan(plan.id, !d.archived));
            }}
          />
        </View>
      )}
    </Popover>
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
            {leaseCycleLabel(d.lease)} {money(currentRent)} · 已付{" "}
            {d.paidPeriods}/{schedule.length}
          </Txt>
          <Txt size={12} color={t.muted}>
            {d.closed
              ? `已结束 ${d.endedAt ?? ""}`
              : next
                ? `下期 ${next.start} · ${money(next.amount)}`
                : "本租期已交满"}
          </Txt>
        </Pressable>
        {!d.closed && !!next && !mode && (
          <Pill primary label="交租" onPress={() => begin("pay")} />
        )}
        {!d.closed && !mode && menu}
        {/* An ended lease has only two actions, so show both instead of a menu. */}
        {d.closed && !mode && (
          <>
            <Pill label="继续退款" onPress={() => begin("refund")} />
            <Pill
              label={d.archived ? "取消归档" : "归档"}
              onPress={() =>
                submit(() => repo.archivePlan(plan.id, !d.archived))
              }
            />
          </>
        )}
      </Row>
      {expanded && (
        <View style={{ gap: 4 }}>
          <Txt size={12} color={t.muted}>
            租期 {d.lease.start} 至 {d.lease.end} ·{" "}
            {d.lease.split === "none" ? "不分摊" : "按月分摊"}
          </Txt>
          <Txt size={12} color={t.muted}>
            {heldDeposit ? `押金 ${money(heldDeposit)} · ` : ""}预付租金余额{" "}
            {money(prepaid)}
          </Txt>
          {!!d.rentSettlement?.returned && (
            <Txt size={12} color={t.muted}>
              退回租金 {money(d.rentSettlement.returned)}
            </Txt>
          )}
          {d.depositSettlement && (
            <Txt size={12} color={t.muted}>
              押金退回 {money(d.depositSettlement.returned)} · 扣除{" "}
              {money(d.depositSettlement.deducted)}
            </Txt>
          )}
          {d.shortfall && (
            <Txt size={12} color={t.muted}>
              另行补交 {money(d.shortfall.amount)}
            </Txt>
          )}
          {!!laterRent && (
            <Txt size={12} color={t.muted}>
              后续退回租金 {money(laterRent)}
            </Txt>
          )}
          {renewed && (
            <Txt size={12} color={t.muted}>
              已续签
            </Txt>
          )}
          {!mode && (
            <Row style={{ justifyContent: "flex-end", marginTop: 6 }}>
              {!d.closed && (
                <Pill
                  label="修改"
                  onPress={() =>
                    router.push({
                      pathname: "/lease-new",
                      params: { edit: plan.id },
                    })
                  }
                />
              )}
              <Pill
                label="删除"
                danger
                onPress={() =>
                  confirmAction(
                    "删除这个租赁？",
                    "会一并删除它的押金、交租和分摊等所有账单，不能恢复。",
                    () => submit(() => repo.deleteLease(plan.id)),
                  )
                }
              />
            </Row>
          )}
        </View>
      )}
      {mode === "extend" && (
        <>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <DateField
                label="新到期日"
                value={endDate}
                onChange={setEndDate}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="续租后每期租金"
                value={newRent}
                onChangeText={setNewRent}
                keyboardType="decimal-pad"
              />
            </View>
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label="确认续租"
                onPress={() =>
                  submit(() =>
                    repo.extendLease(plan.id, endDate, calculate(newRent)),
                  )
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button secondary label="取消" onPress={() => setMode(null)} />
            </View>
          </Row>
        </>
      )}
      {mode === "refund" && (
        <>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <DateField
                label="到账日期"
                value={endDate}
                onChange={setEndDate}
              />
            </View>
            <AccountField
              label="到账账户"
              value={account}
              onChange={setAccount}
            />
          </Row>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Field
                label="退回租金"
                value={rentReturned}
                onChangeText={setRentReturned}
                keyboardType="decimal-pad"
              />
            </View>
            {!!depositIds.length && (
              <View style={{ flex: 1 }}>
                <Field
                  label={`退回押金（剩 ${money(sum(depositIds))}）`}
                  value={returned}
                  onChangeText={setReturned}
                  keyboardType="decimal-pad"
                />
              </View>
            )}
          </Row>
          {!!depositIds.length && depositShort && (
            <CategoryPicker
              field
              label="押金扣除分类"
              value={category}
              onChange={setCategory}
            />
          )}
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label="确认退款"
                onPress={() =>
                  submit(() =>
                    repo.leaseLaterRefund(plan.id, endDate, {
                      accountId: account,
                      rent: optionalAmount(rentReturned),
                      // Leave the deposit blank while it is still pending.
                      deposit:
                        depositIds.length && returned.trim()
                          ? {
                              depositIds,
                              returned: calculate(returned),
                              categoryId: category,
                            }
                          : undefined,
                    }),
                  )
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button secondary label="取消" onPress={() => setMode(null)} />
            </View>
          </Row>
        </>
      )}
      {mode === "pay" && next && (
        <>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <DateField label="付款日期" value={date} onChange={setDate} />
            </View>
            <AccountField
              label="付款账户"
              value={account}
              onChange={setAccount}
            />
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label={`确认 ${formatMoney(next.amount)}`}
                onPress={() =>
                  submit(() => repo.payLease(plan.id, period, date, account))
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button secondary label="取消" onPress={() => setMode(null)} />
            </View>
          </Row>
        </>
      )}
      {mode === "adjust" && next && (
        <>
          <Field
            label={`新租金（${next.start} 起）`}
            value={newRent}
            onChangeText={setNewRent}
            keyboardType="decimal-pad"
          />
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label="保存"
                onPress={() =>
                  submit(() =>
                    repo.adjustLeaseRent(plan.id, period, calculate(newRent)),
                  )
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button secondary label="取消" onPress={() => setMode(null)} />
            </View>
          </Row>
        </>
      )}
      {mode === "end" && (
        <>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold>结束租赁</Txt>
            <HelpBubble label="结束租赁">
              最后入住日之后的房租分摊会取消。退回租金按实际到账填，未住部分没退的记为损失；押金扣掉的部分记为支出；押金不够抵扣时，在“另需补交”填要另付的钱。没有的项留空即可。
            </HelpBubble>
          </Row>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <DateField
                label="最后入住日"
                value={endDate}
                onChange={setEndDate}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={`退回租金（未住 ${formatMoney(unusedRent)}）`}
                value={rentReturned}
                onChangeText={setRentReturned}
                keyboardType="decimal-pad"
              />
            </View>
          </Row>
          {!!openDeposits.length && (
            <Row style={{ justifyContent: "space-between" }}>
              <Txt size={14}>同时结算押金</Txt>
              <Switch
                accessibilityLabel="同时结算押金"
                value={settleDeposit}
                onValueChange={(value) => {
                  setSettleDeposit(value);
                  if (value && !depositIds.length && linkedDeposits.length) {
                    setDepositIds(linkedDeposits);
                    setReturned(moneyInput(sum(linkedDeposits)));
                  }
                }}
              />
            </Row>
          )}
          {settleDeposit && !linkedDeposits.length && (
            <View style={styles.wrap}>
              {openDeposits.map((p) => (
                <Chip
                  key={p.id}
                  label={`${p.name} ${formatMoney(depositBalance(p.id))}`}
                  selected={depositIds.includes(p.id)}
                  onPress={() => {
                    const ids = depositIds.includes(p.id)
                      ? depositIds.filter((id) => id !== p.id)
                      : [...depositIds, p.id];
                    setDepositIds(ids);
                    setReturned(moneyInput(sum(ids)));
                  }}
                />
              ))}
            </View>
          )}
          <Row style={{ alignItems: "flex-start" }}>
            {settleDeposit && !!openDeposits.length && (
              <View style={{ flex: 1 }}>
                <Field
                  label={`退回押金（共 ${formatMoney(sum(depositIds))}）`}
                  value={returned}
                  onChangeText={setReturned}
                  keyboardType="decimal-pad"
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Field
                label="另需补交"
                value={shortfall}
                onChangeText={setShortfall}
                keyboardType="decimal-pad"
              />
            </View>
          </Row>
          <Row style={{ alignItems: "flex-start" }}>
            <AccountField
              label="收付账户"
              value={account}
              onChange={setAccount}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <CategoryPicker
                field
                label="扣款分类"
                value={category}
                onChange={setCategory}
              />
            </View>
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label="确认结束"
                onPress={() =>
                  submit(() => {
                    const extra = optionalAmount(shortfall);
                    repo.endLease(
                      plan.id,
                      endDate,
                      settleDeposit && openDeposits.length
                        ? {
                            depositIds,
                            returned: optionalAmount(returned),
                            accountId: account,
                            categoryId: category,
                          }
                        : undefined,
                      {
                        returned: optionalAmount(rentReturned),
                        accountId: account,
                      },
                      extra
                        ? {
                            amount: extra,
                            accountId: account,
                            categoryId: category,
                          }
                        : undefined,
                    );
                  })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button secondary label="取消" onPress={() => setMode(null)} />
            </View>
          </Row>
        </>
      )}
      <ErrorText message={error} />
    </Card>
  );
}
