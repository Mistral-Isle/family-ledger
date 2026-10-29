import { CategoryEditor } from "../components/CategoryEditor";
import { CategoryDeletionSheet } from "../components/CategoryDeletionSheet";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
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
  const [kind, setKind] = useState<CategoryKind>("expense");
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
  const [deletionId, setDeletionId] = useState<string | null>(null);
  const roots = data.categories
    .filter((c) => !c.deleted && c.kind === kind && !c.parentId)
    .sort((a, b) => a.sort - b.sort);
  function edit(category: Category) {
    setError("");
    setForm(category);
  }
  function move(category: Category, delta: number) {
    const siblings = data.categories
      .filter(
        (c) =>
          !c.deleted && c.parentId === category.parentId && c.kind === kind,
      )
      .sort((a, b) => a.sort - b.sort);
    const index = siblings.findIndex((c) => c.id === category.id);
    const target = index + delta;
    if (target < 0 || target >= siblings.length) return;
    [siblings[index], siblings[target]] = [siblings[target]!, siblings[index]!];
    try {
      run(() => repo.reorderCategories(siblings.map((c) => c.id)));
    } catch (e) {
      setError((e as Error).message);
    }
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
                backgroundColor: t.soft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={category.icon} color={category.color} size={18} />
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
        <IconButton
          name="arrow.up"
          label={zh.moveUp}
          onPress={() => move(category, -1)}
        />
        <IconButton
          name="arrow.down"
          label={zh.moveDown}
          onPress={() => move(category, 1)}
        />
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
          onClose={() => setDeletionId(null)}
        />
      )}
      <Page>
        <Heading
          title={zh.categoryManagement}
          action={
            <IconButton
              name="xmark"
              label={zh.close}
              onPress={() => router.back()}
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
