import { DateField } from "../components/DateField";
import { useSubmissionGuard } from "../components/useSubmissionGuard";
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { VaultGate } from "../components/VaultGate";
import { useVault } from "../state/vault";
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
import { accountBalance, visibleTxns } from "../domain/selectors";
import { calculate, formatMoney, assertMoney } from "../domain/money";
import { today } from "../domain/date";
import { zh } from "../i18n/zh";
export default function VaultRoute() {
  return (
    <VaultGate>
      <Vault />
    </VaultGate>
  );
}
function Vault() {
  const { data, repo, run } = useLedger(),
    router = useRouter();
  const [hidden, setHidden] = useState(true),
    [transfer, setTransfer] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(today()),
    [note, setNote] = useState(""),
    [error, setError] = useState("");
  const submission = useSubmissionGuard(transfer);
  const accounts = data.accounts.filter(
      (a) => a.scope === "private" && !a.deleted,
    ),
    txns = visibleTxns(data.txns, "private");
  const value = (n: number) => (hidden ? "••••" : formatMoney(n));
  return (
    <Page>
      <Heading
        title={zh.vault.title}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <Txt>{zh.vault.hint}</Txt>
      <Card>
        <Txt bold>默认隐私收款账户</Txt>
        <Txt size={13}>
          对方只看到“隐私账户”和本次转账金额，账户名称、余额及其他流水不会同步。
        </Txt>
        <View style={styles.wrap}>
          {accounts
            .filter(
              (a) =>
                !a.archived &&
                a.ownerMemberId === data.meId &&
                !["loan", "deposit", "prepaid"].includes(a.kind),
            )
            .map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                selected={repo.privateReceiptAccount() === a.id}
                onPress={() => {
                  try {
                    run(() => repo.setPrivateReceiptAccount(a.id));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            ))}
        </View>
        {!repo.privateReceiptAccount() && (
          <Txt size={13}>
            请选择默认账户。未设置时，转入记录会保留在待入账中。
          </Txt>
        )}
        {!!repo.pendingPrivateTransfers().length && (
          <Txt>
            待入账 {repo.pendingPrivateTransfers().length}{" "}
            笔；设置默认账户后自动入账。
          </Txt>
        )}
      </Card>
      <Button
        secondary
        label={zh.discarded.title}
        onPress={() =>
          router.push({ pathname: "/discarded", params: { scope: "private" } })
        }
      />
      <View style={styles.wrap}>
        <Chip
          label={hidden ? zh.vault.show : zh.vault.hide}
          selected={hidden}
          onPress={() => setHidden(!hidden)}
        />
        <Chip
          label={zh.vault.lock}
          onPress={() => useVault.getState().setUnlocked(false)}
        />
      </View>
      <Card>
        <Txt>
          {zh.vault.balance} ·{" "}
          {value(
            accounts.reduce(
              (sum, a) => assertMoney(sum + accountBalance(a, data.txns)),
              0,
            ),
          )}
        </Txt>
        {accounts.map((a) => (
          <Button
            key={a.id}
            secondary
            label={`${a.name} · ${value(accountBalance(a, data.txns))}`}
            onPress={() =>
              router.push({
                pathname: "/account",
                params: { id: a.id, scope: "private" },
              })
            }
          />
        ))}
      </Card>
      <Button
        secondary
        label={zh.vault.addAccount}
        onPress={() =>
          router.push({ pathname: "/account", params: { scope: "private" } })
        }
      />
      <Button
        disabled={!accounts.some((a) => !a.archived)}
        label={zh.vault.addEntry}
        onPress={() =>
          router.push({ pathname: "/entry", params: { scope: "private" } })
        }
      />
      <Button
        secondary
        label={zh.vault.transfer}
        onPress={() => setTransfer(!transfer)}
      />
      <ErrorText message={error} />
      {transfer && (
        <Card>
          <Txt>{zh.vault.transferHint}</Txt>
          <Txt>{zh.vault.from}</Txt>
          <View style={styles.wrap}>
            {data.accounts
              .filter((a) => !a.deleted && !a.archived)
              .map((a) => (
                <Chip
                  key={a.id}
                  label={`${a.scope === "private" ? zh.vault.title : zh.family} · ${a.name}`}
                  selected={from === a.id}
                  onPress={() => {
                    setFrom(a.id);
                    setTo("");
                  }}
                />
              ))}
          </View>
          <Txt>{zh.vault.to}</Txt>
          <View style={styles.wrap}>
            {data.accounts
              .filter(
                (a) =>
                  !a.deleted &&
                  !a.archived &&
                  a.scope !== data.accounts.find((x) => x.id === from)?.scope,
              )
              .map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  selected={to === a.id}
                  onPress={() => setTo(a.id)}
                />
              ))}
          </View>
          <Field
            label={zh.amount}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <DateField label={zh.date} value={date} onChange={setDate} />
          <Field label={zh.note} value={note} onChangeText={setNote} />
          <Button
            label={zh.vault.saveTransfer}
            onPress={() => {
              try {
                if (
                  !submission.run(() =>
                    run(() =>
                      repo.transferScopes({
                        fromId: from,
                        toId: to,
                        amount: calculate(amount),
                        occurredAt: date,
                        note,
                      }),
                    ),
                  )
                )
                  return;
                setAmount("");
                setNote("");
                setTransfer(false);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </Card>
      )}
      {txns.map((t) => (
        <Card key={t.id}>
          <Txt>
            {t.occurredAt} ·{" "}
            {t.type === "scope_in"
              ? zh.vault.fromFamily
              : t.type === "scope_out"
                ? zh.vault.toFamily
                : zh[t.type]}{" "}
            · {value(t.amount)}
          </Txt>
          <Txt>{t.note}</Txt>
          {t.type === "scope_in" || t.type === "scope_out" ? (
            <Button
              secondary
              label={zh.vault.undoTransfer}
              onPress={() =>
                confirmAction(
                  zh.vault.undoTransfer,
                  zh.vault.transferHint,
                  () => {
                    try {
                      const pair = repo
                        .scopeTransfers()
                        .find((p) => p.privateId === t.id);
                      if (pair) run(() => repo.deleteScopeTransfer(pair.id));
                      else {
                        const publicRow = data.txns.find(
                          (row) =>
                            t.id === "receipt:" + row.id + ":" + data.meId,
                        );
                        if (!publicRow)
                          throw new Error("找不到对应的家庭转账记录");
                        run(() => repo.deleteTxn(publicRow.id));
                      }
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  },
                )
              }
            />
          ) : (
            <>
              <Button
                secondary
                label={zh.editEntry}
                onPress={() =>
                  router.push({
                    pathname: t.type === "refund" ? "/refund" : "/entry",
                    params: { id: t.id, scope: "private" },
                  })
                }
              />
              {t.type === "expense" && (
                <Button
                  secondary
                  label={zh.refund}
                  onPress={() =>
                    router.push({
                      pathname: "/refund",
                      params: { sourceId: t.id },
                    })
                  }
                />
              )}
              <Button
                secondary
                label={zh.remove}
                onPress={() =>
                  confirmAction(zh.deleteEntry, zh.deleteEntryHint, () => {
                    try {
                      run(() => repo.deleteTxn(t.id));
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  })
                }
              />
            </>
          )}
        </Card>
      ))}
    </Page>
  );
}
