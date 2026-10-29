import { VaultGate } from "../components/VaultGate";
import { useState } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Heading,
  IconButton,
  Page,
  Txt,
  styles,
} from "../components/ui";
import { formatMoney } from "../domain/money";
import { zh } from "../i18n/zh";
export default function DiscardedRoute() {
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  return scope === "private" ? (
    <VaultGate>
      <Discarded scope="private" />
    </VaultGate>
  ) : (
    <Discarded scope="family" />
  );
}
function Discarded({ scope }: { scope: "family" | "private" }) {
  const { data, repo, run } = useLedger();
  const router = useRouter();
  const [selected, setSelected] = useState(""),
    [category, setCategory] = useState(""),
    [income, setIncome] = useState(""),
    [error, setError] = useState("");
  const rows = data.txns
    .filter((t) => t.scope === scope && !t.deleted && t.discarded)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const row = rows.find((t) => t.id === selected),
    source = data.txns.find((t) => t.id === row?.refundOfId);
  const kind = row?.type === "income" ? "income" : "expense";
  return (
    <Page>
      <Heading
        title={zh.discarded.title}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <Txt>{zh.discarded.hint}</Txt>
      <ErrorText message={error} />
      {row && (
        <Card>
          <Txt bold>
            {row.occurredAt} · {formatMoney(row.amount)}
          </Txt>
          <Txt>{zh.discarded.category}</Txt>
          <View style={styles.wrap}>
            {data.categories
              .filter(
                (c) =>
                  !c.deleted &&
                  c.kind === kind &&
                  (!source || c.id === source.categoryId),
              )
              .map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={category === c.id}
                  onPress={() => setCategory(c.id)}
                />
              ))}
          </View>
          <Txt>{zh.discarded.incomeCategory}</Txt>
          <View style={styles.wrap}>
            {data.categories
              .filter((c) => !c.deleted && c.kind === "income")
              .map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={income === c.id}
                  onPress={() => setIncome(c.id)}
                />
              ))}
          </View>
          <Button
            label={zh.discarded.restore}
            onPress={() => {
              try {
                run(() => repo.restoreDiscardedTxn(row.id, category, income));
                setSelected("");
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Button
            secondary
            label={zh.discarded.cancel}
            onPress={() => setSelected("")}
          />
        </Card>
      )}
      {!rows.length && <Txt>{zh.discarded.empty}</Txt>}
      {rows.map((t) => (
        <Card key={t.id}>
          <Txt>
            {t.occurredAt} · {zh[t.type]} · {formatMoney(t.amount)}
          </Txt>
          <Txt>
            {data.categories.find((c) => c.id === t.categoryId)?.name} ·{" "}
            {t.note}
          </Txt>
          <Button
            secondary
            label={zh.discarded.restore}
            onPress={() => {
              setSelected(t.id);
              setCategory(t.categoryId ?? "");
              setIncome(t.refundIncomeCategoryId ?? "");
              setError("");
            }}
          />
        </Card>
      ))}
    </Page>
  );
}
