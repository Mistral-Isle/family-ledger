import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Page,
  Heading,
  Card,
  Txt,
  Field,
  Button,
  ErrorText,
  IconButton,
  confirmAction,
} from "../components/ui";
import { calculate, moneyInput } from "../domain/money";
import { zh } from "../i18n/zh";
export default function ScopeTransfer() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { data, repo, run } = useLedger(),
    router = useRouter();
  const row = data.txns.find(
    (t) =>
      t.id === id &&
      t.scope === "family" &&
      !t.deleted &&
      ["scope_in", "scope_out"].includes(t.type),
  );
  const [amount, setAmount] = useState(moneyInput(row?.amount ?? 0)),
    [date, setDate] = useState(row?.occurredAt ?? ""),
    [error, setError] = useState("");
  function perform(fn: () => void) {
    try {
      run(fn);
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Page>
      <Heading
        title={row ? zh[row.type] : zh.editEntry}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <Card style={{ gap: 12 }}>
        <Txt>{zh.vault.transferHint}</Txt>
        {row ? (
          <>
            <Txt>
              {
                data.accounts.find(
                  (a) => a.id === row.accountId && a.scope === "family",
                )?.name
              }
            </Txt>
            <Field
              label={zh.amount}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Field label={zh.date} value={date} onChangeText={setDate} />
            <Button
              label={zh.save}
              onPress={() =>
                perform(() =>
                  repo.editScopeShell(row.id, calculate(amount), date),
                )
              }
            />
            <Button
              secondary
              label={zh.vault.undoTransfer}
              onPress={() =>
                confirmAction(
                  zh.vault.undoTransfer,
                  zh.vault.transferHint,
                  () => perform(() => repo.deleteTxn(row.id)),
                )
              }
            />
          </>
        ) : (
          <Txt>{zh.errors.missing}</Txt>
        )}
      </Card>
      <ErrorText message={error} />
    </Page>
  );
}
