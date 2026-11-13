import { VaultGate } from "../components/VaultGate";
import { useState } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import { CategoryGrid } from "../components/CategoryGrid";
import {
  Button,
  Card,
  ErrorText,
  Heading,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
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
  const theme = useTheme();
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
          <CategoryGrid
            categories={data.categories.filter(
              (c) =>
                !c.deleted &&
                c.kind === kind &&
                (!source || c.id === source.categoryId),
            )}
            value={category}
            onChange={setCategory}
            allowSelectParent
          />
          <Txt>{zh.discarded.incomeCategory}</Txt>
          <CategoryGrid
            categories={data.categories.filter(
              (c) => !c.deleted && c.kind === "income",
            )}
            value={income}
            onChange={setIncome}
            allowSelectParent
          />
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
      {rows.map((t) => {
        const cat = data.categories.find((c) => c.id === t.categoryId);
        return (
          <Card key={t.id}>
            <Txt>
              {t.occurredAt} · {zh[t.type]} · {formatMoney(t.amount)}
            </Txt>
            <Row style={{ gap: 8 }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  backgroundColor:
                    cat?.kind === "income"
                      ? theme.incomeIcon
                      : theme.expenseIcon,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={cat?.icon ?? "sparkles"} color="#fff" size={16} />
              </View>
              <Txt style={{ flex: 1 }}>
                {cat?.name ?? "未分类"}
                {t.note ? ` · ${t.note}` : ""}
              </Txt>
            </Row>
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
        );
      })}
    </Page>
  );
}
