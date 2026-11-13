import { InlineReorderList } from "../components/InlineReorderList";
import { CategoryTile } from "../components/CategoryTile";
import { CategoryEditor } from "../components/CategoryEditor";
import { CategoryDeletionSheet } from "../components/CategoryDeletionSheet";
import { Segmented } from "../components/Segmented";
import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  ErrorText,
  Heading,
  IconButton,
  Page,
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
  const [level, setLevel] = useState<"root" | "child">("root");
  const [parentId, setParentId] = useState("");
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
  const selectedParent = roots.find((c) => c.id === parentId) ?? roots[0];
  const visible = level === "root" ? roots : data.categories
    .filter((c) => !c.deleted && c.kind === kind && c.parentId === selectedParent?.id)
    .sort((a, b) => a.sort - b.sort);
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
        <Segmented
          height={40}
          value={kind}
          options={[
            { value: "expense", label: zh.expense },
            { value: "income", label: zh.income },
          ]}
          onChange={(next) => {
            setKind(next);
            setParentId("");
          }}
        />
        <ErrorText message={form ? "" : error} />
        <Segmented
          height={40}
          value={level}
          options={[
            { value: "root", label: "一级分类" },
            { value: "child", label: "二级分类" },
          ]}
          onChange={setLevel}
        />
        {level === "child" && (
          <Card style={{ padding: 12, gap: 8 }}>
            <Txt size={12} color={t.muted}>
              选择所属一级分类
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {roots.map((c) => (
                <CategoryTile
                  key={c.id}
                  category={c}
                  selected={selectedParent?.id === c.id}
                  hasChildren={false}
                  onPress={() => setParentId(c.id)}
                />
              ))}
            </View>
          </Card>
        )}
        <Txt size={12} color={t.muted}>长按列表或拖动右侧手柄排序；左滑隐藏或删除，点击编辑。</Txt>
        <Button
          secondary
          label={zh.addCategory}
          icon="plus"
          onPress={() => {
            setError("");
            setForm({
              name: "",
              parentId: level === "child" ? selectedParent?.id ?? null : null,
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
        <InlineReorderList
          key={kind + level + (level === "child" ? selectedParent?.id : "")}
          items={visible.map((c) => ({
            id: c.id, name: c.name, symbol: c.icon, color: t.idleIcon,
            subtitle: c.hidden ? "已隐藏" : undefined,
            trailing: (c.hidden ? "show" : "hide") + ",delete",
          }))}
          rowHeight={64}
          maxHeight={480}
          onReorder={(ids) => { run(() => repo.reorderCategories(ids)); setError(""); }}
          onPress={(id) => { const c = visible.find((c) => c.id === id); if (c) edit(c); }}
          onAction={(id, action) => {
            const c = visible.find((c) => c.id === id);
            if (!c) return;
            if (action === "delete") setDeletionId(id);
            else hide(c);
          }}
          onError={setError}
        />
        {!visible.length && <Txt color={t.muted}>暂无二级分类，可点击新增分类。</Txt>}
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
