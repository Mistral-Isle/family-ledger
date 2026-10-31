import { useState } from "react";
import { View } from "react-native";
import { Button, Chip, ErrorText, Field, Row, Txt, styles } from "./ui";
import { DateField } from "./DateField";
import { Popover } from "./HelpBubble";
import { CategoryPicker } from "./CategoryPicker";
import { useLedger } from "./LedgerProvider";
import { useSubmissionGuard } from "./useSubmissionGuard";
import { addMonths } from "../domain/finance";
import { addDays } from "../domain/reports";
import { today } from "../domain/date";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import {
  leaseCycles,
  leaseSchedule,
  leaseExit,
  type LeaseCycle,
} from "../domain/lease";
import { leaseDepositIds } from "../domain/leaseDeposits";
import { accountBalance } from "../domain/selectors";

export function LeaseForm({
  previous,
  onSaved,
  onCancel,
}: {
  previous?: { id: string; name: string; data: string };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { data, repo, run } = useLedger();
  const old = previous ? JSON.parse(previous.data) : null;
  const initialStart = old ? addDays(old.lease.end, 1) : today();
  const [name, setName] = useState(previous?.name ?? "");
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(addDays(addMonths(initialStart, 12), -1));
  const [cycle, setCycle] = useState<LeaseCycle>(old?.lease.cycle ?? "quarter");
  const [rent, setRent] = useState(
    old
      ? moneyInput(old.lease.rentChanges?.at(-1)?.rent ?? old.lease.rent)
      : "",
  );
  const [deposit, setDeposit] = useState("0");
  const [date, setDate] = useState(initialStart);
  const accounts = data.accounts.filter(
    (a) =>
      !a.deleted &&
      !a.archived &&
      a.scope === "family" &&
      !["loan", "deposit", "prepaid"].includes(a.kind),
  );
  const [account, setAccount] = useState(
    old?.paymentAccountId ?? accounts[0]?.id ?? "",
  );
  const [category, setCategory] = useState(
    old?.categoryId ??
      data.categories.find(
        (c) => !c.deleted && c.kind === "expense" && c.name === "房租",
      )?.id ??
      "",
  );
  const [error, setError] = useState("");
  const guard = useSubmissionGuard(previous?.id ?? "new-lease");
  let schedule: ReturnType<typeof leaseSchedule> = [];
  let previewError = "";
  try {
    if (rent)
      schedule = leaseSchedule({ start, end, cycle, rent: calculate(rent) });
  } catch (e) {
    previewError = (e as Error).message;
  }
  return (
    <View style={{ gap: 8 }}>
      <Txt bold>{previous ? "续签合同" : "新增租赁"}</Txt>
      <Field label="租赁名称" value={name} onChangeText={setName} />
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <DateField label="起租日" value={start} onChange={setStart} />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="到期日（含当天）" value={end} onChange={setEnd} />
        </View>
      </Row>
      <Txt>付款周期</Txt>
      <View style={styles.wrap}>
        {(Object.keys(leaseCycles) as LeaseCycle[]).map((c) => (
          <Chip
            key={c}
            label={leaseCycles[c]}
            selected={cycle === c}
            onPress={() => setCycle(c)}
          />
        ))}
      </View>
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Field
            label={`${leaseCycles[cycle]}租金（元／期）`}
            value={rent}
            onChangeText={setRent}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={
              previous
                ? "本次新增押金（元，原押金保留）"
                : "押金（元，无押金填 0）"
            }
            value={deposit}
            onChangeText={setDeposit}
            keyboardType="decimal-pad"
          />
        </View>
      </Row>
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <DateField label="首期实际付款日期" value={date} onChange={setDate} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Txt size={12}>付款账户</Txt>
          <Popover
            label="选择租赁付款账户"
            triggerText={
              accounts.find((a) => a.id === account)?.name ?? "选择账户"
            }
            compact
          >
            {(close) => (
              <View style={styles.wrap}>
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    selected={account === a.id}
                    onPress={() => {
                      setAccount(a.id);
                      close();
                    }}
                  />
                ))}
              </View>
            )}
          </Popover>
        </View>
      </Row>
      <CategoryPicker
        label="租金分类"
        value={category}
        onChange={setCategory}
      />
      <Txt size={12}>
        首期租金和押金立即入账；后续确认付款后入账，租金按覆盖天数分摊。
      </Txt>
      {!!schedule.length && (
        <Txt>
          共 {schedule.length} 期 · 首期 {formatMoney(schedule[0]!.amount)} ·
          租金合计 {formatMoney(schedule.reduce((n, p) => n + p.amount, 0))} ·
          下期 {schedule[1]?.start ?? "无"}
        </Txt>
      )}
      <ErrorText message={error || previewError} />
      <Row>
        <View style={{ flex: 1 }}>
          <Button
            label={previous ? "保存新合同并记录首期付款" : "保存并记录首期付款"}
            onPress={() => {
              try {
                if (
                  guard.run(() =>
                    run(() =>
                      repo.createLease({
                        name,
                        paymentAccountId: account,
                        categoryId: category,
                        lease: { start, end, cycle, rent: calculate(rent) },
                        deposit: calculate(deposit),
                        date,
                        renewedFrom: previous?.id,
                      }),
                    ),
                  )
                )
                  onSaved();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </View>
        <Button secondary label="取消" onPress={onCancel} />
      </Row>
    </View>
  );
}

export function LeaseDetails({
  plan,
}: {
  plan: { id: string; name: string; data: string };
}) {
  const { data, repo, run } = useLedger();
  const d = JSON.parse(plan.data);
  const schedule = leaseSchedule(d.lease),
    next = schedule[d.paidPeriods];
  const [paying, setPaying] = useState(false),
    [renewing, setRenewing] = useState(false);
  const [more, setMore] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [ending, setEnding] = useState(false);
  const currentRent = d.lease.rentChanges?.at(-1)?.rent ?? d.lease.rent;
  const [newRent, setNewRent] = useState(moneyInput(currentRent));
  const [endDate, setEndDate] = useState(today());
  const [rentReturned, setRentReturned] = useState("");
  let unusedRent = 0;
  try {
    unusedRent = leaseExit(d.lease, d.paidPeriods, endDate).unused;
  } catch {}
  const [depositIds, setDepositIds] = useState<string[]>([]);
  const [returned, setReturned] = useState("");
  const [refundAccount, setRefundAccount] = useState(d.paymentAccountId);
  const [lossCategory, setLossCategory] = useState(d.categoryId);
  const [settleDeposit, setSettleDeposit] = useState(true);
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
  const depositTotal = depositIds.reduce(
    (sum, id) => sum + depositBalance(id),
    0,
  );
  let deduction: number | null = null;
  try {
    const value = calculate(returned);
    if (value >= 0 && value <= depositTotal) deduction = depositTotal - value;
  } catch {}
  const [date, setDate] = useState(today()),
    [error, setError] = useState("");
  const [account, setAccount] = useState(d.paymentAccountId);
  const [period, setPeriod] = useState(d.paidPeriods);
  const guard = useSubmissionGuard(
    `${plan.id}:${period}:${paying}:${adjusting}:${ending}`,
  );
  const renewed = data.plans.some(
    (p) => !p.deleted && JSON.parse(p.data).renewedFrom === plan.id,
  );
  return (
    <View style={{ gap: 10 }}>
      <Txt>
        {d.lease.start} 至 {d.lease.end}
      </Txt>
      {d.depositSettlement && (
        <Txt>
          押金已结算 · 实退 {formatMoney(d.depositSettlement.returned)} · 扣除{" "}
          {formatMoney(d.depositSettlement.deducted)}
        </Txt>
      )}
      {d.rentSettlement && (
        <Txt>
          租金已结算 · 实退 {formatMoney(d.rentSettlement.returned)} · 未退租金{" "}
          {formatMoney(d.rentSettlement.withheld)}
        </Txt>
      )}
      <Txt>
        {leaseCycles[d.lease.cycle as LeaseCycle]} · 每期{" "}
        {formatMoney(currentRent)} · 已付 {d.paidPeriods}/{schedule.length} 期
      </Txt>
      <Txt>
        {d.closed
          ? `已结束${d.endedAt ? " · " + d.endedAt : ""}`
          : next
            ? `下期 ${next.start} 至 ${next.end} · ${formatMoney(next.amount)}`
            : "本租期租金已全部记录"}
      </Txt>
      {!d.closed && !!next && !paying && !ending && !adjusting && (
        <Button
          label="交租"
          onPress={() => {
            setPeriod(d.paidPeriods);
            setDate(today() < next.start ? today() : next.start);
            setPaying(true);
            setError("");
          }}
        />
      )}
      {!d.closed && paying && next && (
        <>
          <DateField label="实际付款日期" value={date} onChange={setDate} />
          <View style={styles.wrap}>
            {data.accounts
              .filter(
                (a) =>
                  !a.deleted &&
                  !a.archived &&
                  a.scope === "family" &&
                  !["loan", "deposit", "prepaid"].includes(a.kind),
              )
              .map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  selected={a.id === account}
                  onPress={() => setAccount(a.id)}
                />
              ))}
          </View>
          <Button
            label={`确认付款 ${formatMoney(next.amount)}`}
            onPress={() => {
              try {
                if (
                  guard.run(() =>
                    run(() => repo.payLease(plan.id, period, date, account)),
                  )
                )
                  setPaying(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Button secondary label="取消" onPress={() => setPaying(false)} />
        </>
      )}
      {!d.closed && !paying && !adjusting && !ending && (
        <>
          <Button
            secondary
            label="结束租赁"
            onPress={() => {
              setEndDate(today());
              setRentReturned("");
              const ids = renewed ? [] : leaseDepositIds(data, plan.id);
              setDepositIds(ids);
              setReturned(
                moneyInput(
                  ids.reduce((sum, id) => sum + depositBalance(id), 0),
                ),
              );
              setSettleDeposit(
                !renewed && (ids.length > 0 || openDeposits.length > 0),
              );
              setRefundAccount(d.paymentAccountId);
              setLossCategory(d.categoryId);
              setEnding(true);
              setError("");
            }}
          />
          <Button
            secondary
            label={more ? "收起更多操作" : "更多操作"}
            onPress={() => setMore(!more)}
          />
        </>
      )}
      {more && !d.closed && !paying && !ending && !adjusting && (
        <View style={{ gap: 10 }}>
          {!!next && (
            <Button
              secondary
              label="调整租金"
              onPress={() => {
                setNewRent(moneyInput(currentRent));
                setPeriod(d.paidPeriods);
                setAdjusting(true);
                setError("");
              }}
            />
          )}
          {!renewed && !renewing && (
            <Button
              secondary
              label="续签合同"
              onPress={() => setRenewing(true)}
            />
          )}
        </View>
      )}
      {!d.closed && adjusting && next && (
        <>
          <Field
            label="新的每期租金（元）"
            value={newRent}
            onChangeText={setNewRent}
            keyboardType="decimal-pad"
          />
          <Txt size={12}>
            从下一未付款期（{next.start}）生效，已交租金和历史分摊保持原样。
          </Txt>
          <Button
            label="保存租金调整"
            onPress={() => {
              try {
                if (
                  guard.run(() =>
                    run(() =>
                      repo.adjustLeaseRent(plan.id, period, calculate(newRent)),
                    ),
                  )
                )
                  setAdjusting(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Button secondary label="取消" onPress={() => setAdjusting(false)} />
        </>
      )}
      {!d.closed && ending && (
        <>
          <DateField label="结束日期" value={endDate} onChange={setEndDate} />
          <Txt size={12}>
            结束日期算作最后入住日。结束后停止分摊未住部分，已住费用保留。
          </Txt>
          <Txt>未住租金（按天计算）{formatMoney(unusedRent)}</Txt>
          <Field
            label="实际退回租金（元，不退款填 0）"
            value={rentReturned}
            onChangeText={setRentReturned}
            keyboardType="decimal-pad"
          />
          <Txt size={12}>
            按实际到账填写。未住部分未退回的金额记为退租损失；超过按天计算金额的退款会抵减已分摊租金。
          </Txt>
          <Txt>租金及押金退款到账账户</Txt>
          <View style={styles.wrap}>
            {data.accounts
              .filter(
                (a) =>
                  !a.deleted &&
                  !a.archived &&
                  a.scope === "family" &&
                  !["loan", "deposit", "prepaid"].includes(a.kind),
              )
              .map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  selected={refundAccount === a.id}
                  onPress={() => setRefundAccount(a.id)}
                />
              ))}
          </View>
          {renewed && (
            <Txt size={12}>
              已有后续租约，押金默认继续沿用；确实退还时再选择一起结算。
            </Txt>
          )}
          {!!openDeposits.length && (
            <>
              <View style={styles.wrap}>
                <Chip
                  label="一起结算押金"
                  selected={settleDeposit}
                  onPress={() => setSettleDeposit(true)}
                />
                <Chip
                  label="暂不结算押金"
                  selected={!settleDeposit}
                  onPress={() => setSettleDeposit(false)}
                />
              </View>
              {settleDeposit && (
                <>
                  <Txt>待退押金（请选择本次租赁的押金）</Txt>
                  <View style={styles.wrap}>
                    {openDeposits.map((p) => (
                      <Chip
                        key={p.id}
                        label={`${p.name} · ${formatMoney(depositBalance(p.id))}`}
                        selected={depositIds.includes(p.id)}
                        onPress={() => {
                          const ids = depositIds.includes(p.id)
                            ? depositIds.filter((id) => id !== p.id)
                            : [...depositIds, p.id];
                          setDepositIds(ids);
                          setReturned(
                            moneyInput(
                              ids.reduce(
                                (sum, id) => sum + depositBalance(id),
                                0,
                              ),
                            ),
                          );
                        }}
                      />
                    ))}
                  </View>
                  <Txt>押金合计 {formatMoney(depositTotal)}</Txt>
                  <Field
                    label="实际退回金额（元，全部扣除填 0）"
                    value={returned}
                    onChangeText={setReturned}
                    keyboardType="decimal-pad"
                  />
                  {deduction !== null && (
                    <Txt>押金扣除 {formatMoney(deduction)}</Txt>
                  )}
                  <Txt>退款到账账户</Txt>
                  <View style={styles.wrap}>
                    {data.accounts
                      .filter(
                        (a) =>
                          !a.deleted &&
                          !a.archived &&
                          a.scope === "family" &&
                          !["loan", "deposit", "prepaid"].includes(a.kind),
                      )
                      .map((a) => (
                        <Chip
                          key={a.id}
                          label={a.name}
                          selected={refundAccount === a.id}
                          onPress={() => setRefundAccount(a.id)}
                        />
                      ))}
                  </View>
                  {deduction !== 0 && (
                    <CategoryPicker
                      label="押金扣除分类"
                      value={lossCategory}
                      onChange={setLossCategory}
                    />
                  )}
                  <Txt size={12}>
                    退款按结束日期入账，扣除部分记为支出。尚未收到退款时请选择“暂不结算押金”。
                  </Txt>
                </>
              )}
            </>
          )}
          {!openDeposits.length && <Txt size={12}>没有待结算押金。</Txt>}
          <Button
            label={settleDeposit ? "结束租赁并结算押金" : "确认结束租赁"}
            onPress={() => {
              try {
                if (
                  guard.run(() =>
                    run(() =>
                      repo.endLease(
                        plan.id,
                        endDate,
                        settleDeposit
                          ? {
                              depositIds,
                              returned: calculate(returned),
                              accountId: refundAccount,
                              categoryId: lossCategory,
                            }
                          : undefined,
                        {
                          returned: calculate(rentReturned),
                          accountId: refundAccount,
                        },
                      ),
                    ),
                  )
                ) {
                  setEnding(false);
                  setRenewing(false);
                }
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Button secondary label="取消" onPress={() => setEnding(false)} />
        </>
      )}
      {renewed && <Txt>已创建后续租约</Txt>}
      {renewing && !d.closed && !paying && !ending && !adjusting && (
        <LeaseForm
          previous={plan}
          onSaved={() => setRenewing(false)}
          onCancel={() => setRenewing(false)}
        />
      )}
      <ErrorText message={error} />
    </View>
  );
}
