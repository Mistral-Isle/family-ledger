import { useState } from "react";
import { Pressable, View } from "react-native";
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
import { Popover } from "./HelpBubble";
import { CategoryPicker } from "./CategoryPicker";
import { AccountField } from "./PickerField";
import { Pill } from "./LeaseForm";
import { useLedger } from "./LedgerProvider";
import { useSubmissionGuard } from "./useSubmissionGuard";
import { today } from "../domain/date";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { isHoldingAccount } from "../domain/rentAccounts";
import { accountBalance } from "../domain/selectors";

const money = (cents: number) => formatMoney(cents).replace(/\.00$/, "");

export function DepositForm({
  editing,
  onSaved,
  onCancel,
}: {
  editing?: { id: string; name: string; data: string };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { data, repo, run } = useLedger();
  const old = editing ? JSON.parse(editing.data) : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(old ? moneyInput(old.amount) : "");
  const [date, setDate] = useState<string>(old?.date ?? today());
  const [expectedReturn, setExpectedReturn] = useState<string>(
    old?.expectedReturn ?? "",
  );
  const [account, setAccount] = useState<string>(
    old?.paymentAccountId ??
      data.accounts.find(
        (a) =>
          !a.deleted &&
          !a.archived &&
          a.scope === "family" &&
          a.kind !== "loan" &&
          !isHoldingAccount(a),
      )?.id ??
      "",
  );
  const [error, setError] = useState("");
  const guard = useSubmissionGuard(editing?.id ?? "new-deposit");
  return (
    <View style={{ gap: 14 }}>
      <Field label="名称" value={name} onChangeText={setName} />
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="押金金额"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="付款日期" value={date} onChange={setDate} />
        </View>
      </Row>
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <DateField
            optional
            label="预计退还日"
            value={expectedReturn}
            onChange={setExpectedReturn}
          />
        </View>
        <AccountField label="付款账户" value={account} onChange={setAccount} />
      </Row>
      <ErrorText message={error} />
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
                        amount: calculate(amount),
                        date,
                        expectedReturn,
                        paymentAccountId: account,
                      };
                      if (editing) repo.editDeposit(editing.id, input);
                      else repo.createDeposit(input);
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

/** Compact deposit row: refund and menu on the right, corrections when expanded. */
export function DepositCard({
  plan,
}: {
  plan: { id: string; name: string; data: string };
}) {
  const { data, repo, run } = useLedger();
  const router = useRouter();
  const t = useTheme();
  const d = JSON.parse(plan.data);
  const account = data.accounts.find((a) => a.id === d.accountId);
  const balance = account ? accountBalance(account, data.txns) : 0;
  const [expanded, setExpanded] = useState(false);
  const [returning, setReturning] = useState(false);
  const [date, setDate] = useState(today());
  const [returned, setReturned] = useState("");
  const [to, setTo] = useState<string>(d.paymentAccountId);
  const [category, setCategory] = useState(
    data.categories.find(
      (c) => !c.deleted && !c.hidden && c.kind === "expense" && !c.parentId,
    )?.id ?? "",
  );
  const [error, setError] = useState("");
  const guard = useSubmissionGuard(`${plan.id}:${returning}`);
  const rows = (d.txnIds as string[])
    .map((id) => data.txns.find((t) => t.id === id && !t.deleted))
    .filter((t) => !!t);
  const refund = rows.find(
    (t) => t.type === "transfer" && t.accountId === d.accountId,
  );
  const deduction = rows.find((t) => t.type === "expense");
  let short = false;
  try {
    short = !!returned.trim() && calculate(returned) < balance;
  } catch {}
  const submit = (fn: () => void) => {
    try {
      if (guard.run(() => run(fn))) {
        setReturning(false);
        setError("");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const archive = () => submit(() => repo.archivePlan(plan.id, !d.archived));
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
            押金 {money(d.amount)} · {d.date} 付
          </Txt>
          <Txt size={12} color={t.muted}>
            {d.closed
              ? `已退还 ${refund?.occurredAt ?? deduction?.occurredAt ?? ""}`
              : d.expectedReturn
                ? `预计 ${d.expectedReturn} 退还`
                : "未退还"}
          </Txt>
        </Pressable>
        {!returning && !d.closed && (
          <Pill
            primary
            label="退还"
            onPress={() => {
              setReturning(true);
              setDate(today());
              setReturned(moneyInput(balance));
              setTo(d.paymentAccountId);
              setError("");
            }}
          />
        )}
        {/* Every other action lives in the menu, the same on all plan cards. */}
        {!returning && (
          <Popover label="更多操作">
            {(close) => (
              <View style={{ gap: 8 }}>
                {!d.closed && (
                  <Button
                    secondary
                    label="修改"
                    onPress={() => {
                      close();
                      router.push({
                        pathname: "/deposit-new",
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
                      "删除这笔押金？",
                      "会一并删除它的付款和退还记录，不能恢复。",
                      () => submit(() => repo.deleteDeposit(plan.id)),
                    );
                  }}
                />
              </View>
            )}
          </Popover>
        )}
      </Row>
      {expanded && (
        <View style={{ gap: 4 }}>
          {d.closed && (
            <Txt size={12} color={t.muted}>
              退回 {money(refund?.amount ?? 0)} · 扣除{" "}
              {money(deduction?.amount ?? 0)}
            </Txt>
          )}
          {!d.closed && (
            <Txt size={12} color={t.muted}>
              待退 {money(balance)}
            </Txt>
          )}
        </View>
      )}
      {returning && (
        <>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <DateField label="退还日期" value={date} onChange={setDate} />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={`实际退回（共 ${money(balance)}）`}
                value={returned}
                onChangeText={setReturned}
                keyboardType="decimal-pad"
              />
            </View>
          </Row>
          <Row style={{ alignItems: "flex-start" }}>
            <AccountField label="到账账户" value={to} onChange={setTo} />
            {short && (
              <View style={{ flex: 1, minWidth: 0 }}>
                <CategoryPicker
                  field
                  label="扣除分类"
                  value={category}
                  onChange={setCategory}
                />
              </View>
            )}
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label="确认退还"
                onPress={() =>
                  submit(() =>
                    repo.closeDeposit(
                      plan.id,
                      returned.trim() ? calculate(returned) : 0,
                      to,
                      category,
                      date,
                    ),
                  )
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                label="取消"
                onPress={() => setReturning(false)}
              />
            </View>
          </Row>
        </>
      )}
      <ErrorText message={error} />
    </Card>
  );
}
