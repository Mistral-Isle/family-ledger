import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
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
  confirmAction,
} from "../components/ui";
import { categoryPath } from "../domain/travel";
import { formatMoney } from "../domain/money";
import { zh } from "../i18n/zh";
export default function CategoryDefaults() {
  const { data, repo, run } = useLedger(),
    router = useRouter(),
    c = zh.collaboration;
  const [source, setSource] = useState(""),
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {data.categories
            .filter((x) => !x.deleted)
            .map((x) => (
              <Chip
                key={x.id}
                label={categoryPath(data, x.id)}
                selected={source === x.id}
                onPress={() => {
                  setSource(x.id);
                  setTarget("");
                }}
              />
            ))}
        </View>
      </Card>
      {old && (
        <Card>
          <Txt bold>{categoryPath(data, source)}</Txt>
          <Txt size={13}>
            {rows.length} {zh.records} ·{" "}
            {formatMoney(rows.reduce((n, t) => n + t.amount, 0))}
          </Txt>
          <Txt size={12}>{c.keepOld}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {data.categories
              .filter(
                (x) =>
                  !x.deleted &&
                  x.kind === old.kind &&
                  x.id !== source &&
                  x.parentId !== source,
              )
              .map((x) => (
                <Chip
                  key={x.id}
                  label={categoryPath(data, x.id)}
                  selected={target === x.id}
                  onPress={() => setTarget(x.id)}
                />
              ))}
          </View>
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
