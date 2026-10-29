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
  Row,
  Txt,
  useTheme,
  styles,
  confirmAction,
} from "../components/ui";
import { moneyInput, parseMoney } from "../domain/money";
import { zh } from "../i18n/zh";
import type { AccountKind } from "../domain/types";
export default function AccountRoute() {
  const { id, scope } = useLocalSearchParams<{ id?: string; scope?: string }>();
  const { data } = useLedger();
  return scope === "private" ||
    data.accounts.find((a) => a.id === id)?.scope === "private" ? (
    <VaultGate>
      <AccountEditor />
    </VaultGate>
  ) : (
    <AccountEditor />
  );
}
function AccountEditor() {
  const { id, scope } = useLocalSearchParams<{ id?: string; scope?: string }>();
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const existing = data.accounts.find((a) => a.id === id);
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(existing?.kind ?? "bank");
  const [balance, setBalance] = useState(
    moneyInput(existing?.initialBalance ?? 0),
  );
  const [ownerMemberId, setOwnerMemberId] = useState(
    existing?.ownerMemberId ?? data.meId,
  );
  const [last4, setLast4] = useState(existing?.last4 ?? "");
  const [error, setError] = useState("");
  const save = (archive?: boolean) => {
    try {
      if (id && !existing) throw new Error(zh.errors.missing);
      run(() =>
        repo.saveAccount({
          id: existing?.id,
          scope:
            existing?.scope ?? (scope === "private" ? "private" : "family"),
          name,
          kind,
          initialBalance: parseMoney(balance),
          last4,
          ownerMemberId,
          archived: archive ?? existing?.archived,
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
        title={existing ? zh.editAccount : zh.addAccount}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <Card style={{ gap: 20 }}>
        <Field
          label={zh.accountName}
          value={name}
          onChangeText={setName}
          maxLength={30}
        />
        <View style={{ gap: 8 }}>
          <Txt size={12} color={t.muted}>
            {zh.accountKind}
          </Txt>
          <View style={styles.wrap}>
            {(
              ["bank", "wechat", "alipay", "cash", "credit", "loan"] as const
            ).map((k) => (
              <Chip
                key={k}
                label={zh.accountKinds[k]}
                selected={kind === k}
                onPress={() => setKind(k)}
              />
            ))}
          </View>
        </View>
        <Field
          label={zh.initialBalance}
          value={balance}
          onChangeText={setBalance}
          keyboardType="numbers-and-punctuation"
        />
        <Txt size={11} color={t.muted}>
          {zh.negativeBalanceHint}
        </Txt>
        <Field
          label={zh.last4}
          value={last4}
          onChangeText={setLast4}
          keyboardType="number-pad"
          maxLength={4}
        />
      </Card>
      {scope !== "private" && existing?.scope !== "private" && (
        <Card style={{ gap: 12 }}>
          <Txt>{zh.accountOwner}</Txt>
          <View style={styles.wrap}>
            {data.members
              .filter((m) => !m.deleted)
              .map((m) => (
                <Chip
                  key={m.id}
                  label={m.name}
                  selected={ownerMemberId === m.id}
                  onPress={() => setOwnerMemberId(m.id)}
                />
              ))}
          </View>
        </Card>
      )}
      <ErrorText message={error} />
      <Button label={zh.save} onPress={() => save()} />
      {existing && (
        <Row>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              label={
                data.preferences.pinned.includes(existing.id)
                  ? zh.unpin
                  : zh.pin
              }
              icon="pin.fill"
              onPress={() => {
                try {
                  run(() => repo.togglePin(existing.id));
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              label={existing.archived ? zh.unarchive : zh.archive}
              onPress={() =>
                confirmAction(
                  existing.archived ? zh.unarchive : zh.archive,
                  zh.archiveHint,
                  () => save(!existing.archived),
                )
              }
            />
          </View>
        </Row>
      )}
    </Page>
  );
}
