import { VaultGate } from "../components/VaultGate";
import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  useTheme,
  confirmAction,
} from "../components/ui";
import { HorizontalStrip } from "../components/HorizontalStrip";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { today } from "../domain/date";
import { zh } from "../i18n/zh";

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
  const t = useTheme();
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
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");
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
      run(() =>
        repo.saveTxn({
          id: existing?.id,
          type: "refund",
          amount: calculate(amount),
          accountId,
          occurredAt: date,
          note,
          forWhom: source.forWhom,
          refundOfId: source.id,
        }),
      );
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
          <Card style={{ gap: 10 }}>
            <Txt color={t.muted}>
              {zh.originalEntry} · {source.occurredAt}
            </Txt>
            <Txt bold>
              {data.categories.find((c) => c.id === source.categoryId)?.name} ·{" "}
              {formatMoney(source.amount)}
            </Txt>
            {!!source.note && <Txt>{source.note}</Txt>}
            <Txt color={t.blue}>
              {zh.refundRemaining} {formatMoney(remaining)}
            </Txt>
          </Card>
          <Txt size={12} color={t.muted}>
            {zh.refundHint}
          </Txt>
          <Field
            label={zh.refundReceived}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          {split && (
            <Card style={{ gap: 8 }}>
              <Txt>
                {zh.refundOffset} {formatMoney(split.offset)}
              </Txt>
              <Txt color={t.green}>
                {zh.refundExcess} {formatMoney(split.income)}
              </Txt>
            </Card>
          )}
          <Txt size={12}>{zh.refundAccount}</Txt>
          <HorizontalStrip>
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                selected={a.id === accountId}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </HorizontalStrip>
          <Field
            label={zh.date}
            value={date}
            onChangeText={setDate}
            placeholder={zh.datePlaceholder}
            maxLength={10}
          />
          <Field
            label={zh.note}
            value={note}
            onChangeText={setNote}
            maxLength={500}
          />
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
