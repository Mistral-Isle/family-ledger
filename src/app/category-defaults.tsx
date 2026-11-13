import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import { CategoryGrid } from "../components/CategoryGrid";
import { Segmented } from "../components/Segmented";
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
  confirmAction,
  useTheme,
} from "../components/ui";
import { categoryPath } from "../domain/travel";
import { formatMoney } from "../domain/money";
import { zh } from "../i18n/zh";
export default function CategoryDefaults() {
  const { data, repo, run } = useLedger(),
    router = useRouter(),
    t = useTheme(),
    c = zh.collaboration;
  const [kind, setKind] = useState<"expense" | "income">("expense"),
    [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [error, setError] = useState("");
  const missing = repo.defaultCategoryPreview(),
    old = data.categories.find((x) => x.id === source);
  const rows = data.txns.filter(
    (x) => !x.deleted && x.scope === "family" && x.categoryId === source,
  );
  const perform = (fn: () => void) => {
    try {
      run(fn);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Page>
      <Heading
        title={c.categoryUpgrade}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <Txt size={13}>{c.upgradeHint}</Txt>
      <ErrorText message={error} />
      <Card>
        {missing.length ? (
          missing.map((x, i) => (
            <Txt key={i} size={13}>
              {zh[x.kind]} · {[x.parent, x.name].filter(Boolean).join("／")}
            </Txt>
          ))
        ) : (
          <Txt>{c.noMissing}</Txt>
        )}
        {!!missing.length && (
          <Button
            label={c.addMissing}
            onPress={() =>
              confirmAction(c.addMissing, c.upgradeHint, () =>
                perform(() => repo.installDefaultCategories()),
              )
            }
          />
        )}
      </Card>
      <Card>
        <Txt bold>{zh.categoryManagement}</Txt>
        <Segmented
          height={38}
          value={kind}
          options={[
            { value: "expense", label: zh.expense },
            { value: "income", label: zh.income },
          ]}
          onChange={(next) => {
            setKind(next);
            setSource("");
            setTarget("");
          }}
        />
        <CategoryGrid
          categories={data.categories.filter((x) => !x.deleted && x.kind === kind)}
          value={source}
          onChange={(id) => {
            setSource(id);
            setTarget("");
          }}
          allowSelectParent
        />
      </Card>
      {old && (
        <Card>
          <Row style={{ gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: old.kind === "income" ? t.incomeIcon : t.expenseIcon,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={old.icon} color="#fff" size={19} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt bold>{categoryPath(data, source)}</Txt>
              <Txt size={13} color={t.muted}>
                {rows.length} {zh.records} ·{" "}
                {formatMoney(rows.reduce((n, item) => n + item.amount, 0))}
              </Txt>
            </View>
          </Row>
          <Txt size={12}>{c.keepOld}</Txt>
          <CategoryGrid
            categories={data.categories.filter(
              (x) =>
                !x.deleted &&
                x.kind === old.kind &&
                x.id !== source &&
                x.parentId !== source,
            )}
            value={target}
            onChange={setTarget}
            allowSelectParent
          />
          <Button
            secondary
            label={c.migrateOld}
            onPress={() => {
              if (!target) {
                setError(zh.errors.category);
                return;
              }
              // Existing category manager provides the full subtree impact preview and recovery.
              router.push({
                pathname: "/categories",
                params: { migrate: source, target },
              });
            }}
          />
        </Card>
      )}
    </Page>
  );
}
