import { CategoryOrderSheet } from "../components/CategoryOrderSheet";
import { CategoryEditor } from "../components/CategoryEditor";
import { CategoryDeletionSheet } from "../components/CategoryDeletionSheet";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Heading,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
} from "../components/ui";
import { zh } from "../i18n/zh";
import type { Category, CategoryKind } from "../domain/types";
export default function Categories() {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    migrate?: string;
    target?: string;
    kind?: string;
  }>();
  const [kind, setKind] = useState<CategoryKind>(
    params.kind === "income" ? "income" : "expense",
  );
  const [sorting, setSorting] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState<{
    id?: string;
    name: string;
    parentId: string | null;
    icon: string;
    color: string;
    hidden?: boolean;
    sort?: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [deletionId, setDeletionId] = useState<string | null>(
    params.migrate ?? null,
  );
  const roots = data.categories
    .filter((c) => !c.deleted && c.kind === kind && !c.parentId)
    .sort((a, b) => a.sort - b.sort);
  function edit(category: Category) {
    setError("");
    setForm(category);
  }
  function hide(category: Category) {
    try {
      run(() => repo.saveCategory({ ...category, hidden: !category.hidden }));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function row(category: Category, child = false) {
    return (
      <Row
        key={category.id}
        style={{
          paddingVertical: 10,
          paddingLeft: child ? 14 : 0,
          opacity: category.hidden ? 0.5 : 1,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => edit(category)}
          style={{ flex: 1 }}
        >
          <Row>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                backgroundColor: category.kind === "income" ? t.incomeIcon : t.expenseIcon,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={category.icon} color="#fff" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt bold={!child}>{category.name}</Txt>
              {category.hidden && (
                <Txt size={10} color={t.muted}>
                  {zh.hidden}
                </Txt>
              )}
            </View>
          </Row>
        </Pressable>
        {!child &&
          data.categories.filter(
            (c) => !c.deleted && c.parentId === category.id,
          ).length > 1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={category.name + "子分类排序"}
              onPress={() => setSorting(category.id)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
            >
              <Txt size={12} color={t.blue}>
                子类排序
              </Txt>
            </Pressable>
          )}
        <Pressable accessibilityRole="button" onPress={() => hide(category)}>
          <Txt size={11} color={t.blue}>
            {category.hidden ? zh.show : zh.hide}
          </Txt>
        </Pressable>
      </Row>
    );
  }
  return (
    <>
      {deletionId && (
        <CategoryDeletionSheet
          id={deletionId}
          initialTargetId={params.target}
          onClose={() => setDeletionId(null)}
        />
      )}
      <Page>
        <Heading
          title="分类设置"
          action={
            <IconButton
              name="xmark"
              label={zh.close}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/entry")
              }
            />
          }
        />
        <Row>
          <Chip
            label={zh.expense}
            selected={kind === "expense"}
            onPress={() => setKind("expense")}
          />
          <Chip
            label={zh.income}
            selected={kind === "income"}
            onPress={() => setKind("income")}
          />
        </Row>
        <ErrorText message={form ? "" : error} />
        <Button
          secondary
          label="调整顺序"
          disabled={roots.length < 2}
          onPress={() => setSorting(null)}
        />
        <Button
          secondary
          label={zh.addCategory}
          icon="plus"
          onPress={() => {
            setError("");
            setForm({
              name: "",
              parentId: null,
              icon: "category:bag",
              color: "#648BD2",
            });
          }}
        />
        <Button
          secondary
          label={zh.collaboration.categoryUpgrade}
          onPress={() => router.push("/category-defaults")}
        />
        {roots.map((root) => (
          <Card
            key={root.id}
            style={{ paddingVertical: 8, paddingHorizontal: 14 }}
          >
            {row(root)}
            <View style={{ height: 1, backgroundColor: t.line }} />
            {data.categories
              .filter((c) => c.parentId === root.id && !c.deleted)
              .sort((a, b) => a.sort - b.sort)
              .map((c) => row(c, true))}
          </Card>
        ))}
        {repo.categoryDeletionHistory().length > 0 && (
          <Card>
            <Txt bold>已删除分类 · 可恢复</Txt>
            <Txt size={12} color={t.muted}>
              恢复原分类及当时的流水分类和统计状态；接收分类中后来新增的流水不受影响。
            </Txt>
            {repo
              .categoryDeletionHistory()
              .slice()
              .reverse()
              .map((item) => (
                <Button
                  key={item.id}
                  secondary
                  label={`恢复 ${item.name}（${item.txns.filter((t) => t.scope === "family").length} 笔）`}
                  onPress={() => {
                    try {
                      run(() => repo.restoreCategoryDeletion(item.id));
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              ))}
          </Card>
        )}
      </Page>
      {sorting !== undefined && (
        <CategoryOrderSheet
          items={data.categories
            .filter(
              (c) => !c.deleted && c.kind === kind && c.parentId === sorting,
            )
            .sort((a, b) => a.sort - b.sort)}
          title={
            sorting === null
              ? "一级分类排序"
              : (data.categories.find((c) => c.id === sorting)?.name ??
                  "二级分类") + "排序"
          }
          onClose={() => setSorting(undefined)}
          onSave={(ids) => run(() => repo.reorderCategories(ids))}
        />
      )}
      {form && (
        <CategoryEditor
          initial={form}
          kind={kind}
          onClose={() => setForm(null)}
          onDelete={(id) => {
            setForm(null);
            setDeletionId(id);
          }}
        />
      )}
    </>
  );
}
