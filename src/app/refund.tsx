import { EntryDateTime } from "../components/EntryDateTime";
import { EntryAccountChoices } from "../components/EntryAccountChoices";
import { AccountIcon } from "../components/AccountIcon";
import { useReducedMotion } from "../components/useReducedMotion";
import { useSubmissionGuard } from "../components/useSubmissionGuard";
import { VaultGate } from "../components/VaultGate";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Heading,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
  confirmAction,
} from "../components/ui";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { today } from "../domain/date";
import { zh } from "../i18n/zh";
import { isHoldingAccount } from "../domain/rentAccounts";

export default function RefundRoute() {
  const { id, sourceId } = useLocalSearchParams<{
    id?: string;
    sourceId?: string;
  }>();
  const { data } = useLedger();
  return data.txns.some(
    (t) => (t.id === id || t.id === sourceId) && t.scope === "private",
  ) ? (
    <VaultGate>
      <Refund />
    </VaultGate>
  ) : (
    <Refund />
  );
}
function Refund() {
  const { data, repo, run } = useLedger();
  const { sourceId, id } = useLocalSearchParams<{
    sourceId?: string;
    id?: string;
  }>();
  const router = useRouter();
  const t = useTheme(),
    insets = useSafeAreaInsets(),
    reducedMotion = useReducedMotion();
  const existing = data.txns.find(
    (x) => x.id === id && !x.deleted && x.type === "refund",
  );
  const source = data.txns.find(
    (x) =>
      x.id === (existing?.refundOfId ?? sourceId) &&
      !x.deleted &&
      !x.discarded &&
      x.type === "expense",
  );
  const refunded = source
    ? data.txns
        .filter(
          (x) =>
            !x.deleted &&
            x.type === "refund" &&
            x.refundOfId === source.id &&
            x.id !== existing?.id,
        )
        .reduce((sum, x) => sum + (x.amount - (x.refundIncome ?? 0)), 0)
    : 0;
  const remaining = Math.max(0, (source?.amount ?? 0) - refunded);
  const accounts = data.accounts.filter(
    (a) =>
      !a.deleted &&
      !isHoldingAccount(a) &&
      a.scope === source?.scope &&
      (!a.archived || a.id === existing?.accountId),
  );
  const [amount, setAmount] = useState(
    existing
      ? moneyInput(existing.amount)
      : remaining
        ? moneyInput(remaining)
        : "",
  );
  const [accountId, setAccountId] = useState(
    existing?.accountId ??
      accounts.find((a) => a.id === source?.accountId)?.id ??
      accounts[0]?.id ??
      "",
  );
  const [date, setDate] = useState(existing?.occurredAt ?? today());
  const [time, setTime] = useState(
    existing
      ? (existing.occurredTime ?? "")
      : new Date().toTimeString().slice(0, 5),
  );
  const [accountPicker, setAccountPicker] = useState(false);
  const account = accounts.find((a) => a.id === accountId);
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");
  const submission = useSubmissionGuard();
  let split: { offset: number; income: number } | undefined;
  try {
    const total = calculate(amount);
    if (total > 0) {
      const income =
        existing?.amount === total
          ? (existing.refundIncome ?? 0)
          : Math.max(0, total - remaining);
      split = { offset: total - income, income };
    }
  } catch {
    /* Incomplete amount input has no preview yet. */
  }
  const save = () => {
    try {
      if (!source || (id && !existing)) throw new Error(zh.errors.refundSource);
      if (
        !submission.run(() =>
          run(() =>
            repo.saveTxn({
              id: existing?.id,
              type: "refund",
              amount: calculate(amount),
              accountId,
              occurredAt: date,
              occurredTime: time || null,
              note,
              forWhom: source.forWhom,
              refundOfId: source.id,
            }),
          ),
        )
      )
        return;
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Page>
      <Heading
        title={zh.refund}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      {!source ? (
        <ErrorText message={zh.errors.refundSource} />
      ) : (
        <>
          <Card style={{ gap: 4 }}>
            <Txt size={13} color={t.muted}>
              {zh.originalEntry} · {source.occurredAt}
              {source.note ? ` · ${source.note}` : ""}
            </Txt>
            <Txt bold>
              {data.categories.find((c) => c.id === source.categoryId)?.name} ·{" "}
              {formatMoney(source.amount)}
            </Txt>
          </Card>
          <Field
            label={zh.refundReceived}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          {/* Only an over-refund needs explaining: the excess becomes income. */}
          {!!split?.income && (
            <Txt size={12} color={t.muted}>
              {zh.refundOffset} {formatMoney(split.offset)} · {zh.refundExcess}{" "}
              <Txt size={12} color={t.green}>
                {formatMoney(split.income)}
              </Txt>
            </Txt>
          )}
          <Card style={{ paddingVertical: 4, gap: 0 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={zh.refundAccount}
              onPress={() => setAccountPicker(true)}
              style={{ minHeight: 52, justifyContent: "center" }}
            >
              <Row style={{ gap: 10 }}>
                <Txt style={{ flex: 1 }}>{zh.refundTo}</Txt>
                {account && <AccountIcon kind={account.kind} size={26} />}
                <Txt bold>
                  {account
                    ? `${account.name}${account.last4 ? ` ${account.last4}` : ""}`
                    : "选择账户"}
                </Txt>
                <Icon name="chevron.right" size={14} color={t.muted} />
              </Row>
            </Pressable>
            <View style={{ height: 1, backgroundColor: t.line }} />
            <Row style={{ minHeight: 52 }}>
              <Txt style={{ flex: 1 }}>{zh.refundTime}</Txt>
              <EntryDateTime
                date={date}
                time={time}
                onChange={(nextDate, nextTime) => {
                  setDate(nextDate);
                  setTime(nextTime);
                }}
              />
            </Row>
          </Card>
          <Field
            label={zh.note}
            value={note}
            onChangeText={setNote}
            maxLength={500}
          />
          <Modal
            visible={accountPicker}
            transparent
            animationType={reducedMotion ? "none" : "fade"}
            onRequestClose={() => setAccountPicker(false)}
          >
            <View
              style={{
                flex: 1,
                justifyContent: "flex-end",
                backgroundColor: "#00000055",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭账户选择"
                style={{ position: "absolute", inset: 0 }}
                onPress={() => setAccountPicker(false)}
              />
              <View
                accessibilityViewIsModal
                style={{
                  backgroundColor: t.bg,
                  padding: 20,
                  paddingBottom: Math.max(20, insets.bottom),
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  maxHeight: "70%",
                  gap: 14,
                }}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt bold size={18}>
                    {zh.refundAccount}
                  </Txt>
                  <IconButton
                    name="xmark"
                    label="完成账户选择"
                    onPress={() => setAccountPicker(false)}
                  />
                </Row>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <EntryAccountChoices
                    key={String(accountPicker)}
                    accounts={accounts}
                    selectedId={accountId}
                    onSelect={(id) => {
                      setAccountId(id);
                      setAccountPicker(false);
                    }}
                  />
                </ScrollView>
              </View>
            </View>
          </Modal>
          <ErrorText message={error} />
          <View>
            <Button label={zh.save} onPress={save} />
          </View>
          {existing && (
            <Button
              secondary
              icon="trash"
              label={zh.remove}
              onPress={() =>
                confirmAction(zh.deleteRefund, zh.deleteEntryHint, () => {
                  try {
                    run(() => repo.deleteTxn(existing.id));
                    router.back();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                })
              }
            />
          )}
        </>
      )}
    </Page>
  );
}
