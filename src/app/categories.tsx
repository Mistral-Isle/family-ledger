import { CategoryDeletionSheet } from "../components/CategoryDeletionSheet";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Heading,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
  iconOptions,
  styles,
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
        <Button
          secondary
          label={zh.addCategory}
          icon="plus"
          onPress={() => {
            setError("");
            setForm({
              name: "",
              parentId: null,
              icon: "sparkles",
              color: "#648BD2",
            });
          }}
        />
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
      <Modal
        visible={!!form}
        onRequestClose={() => setForm(null)}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: t.bg }}>
          {form && (
            <Page>
              <Heading
                title={form.id ? zh.editCategory : zh.addCategory}
                action={
                  <IconButton
                    name="xmark"
                    label={zh.close}
                    onPress={() => setForm(null)}
                  />
                }
              />
              <Field
                label={zh.categoryName}
                value={form.name}
                onChangeText={(name) => setForm({ ...form, name })}
                maxLength={30}
              />
              <Txt size={12} color={t.muted}>
                {zh.parent}
              </Txt>
              <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                <Chip
                  label={zh.root}
                  selected={!form.parentId}
                  onPress={() => setForm({ ...form, parentId: null })}
                />
                {roots
                  .filter((c) => c.id !== form.id)
                  .map((root) => (
                    <Chip
                      key={root.id}
                      label={root.name}
                      selected={form.parentId === root.id}
                      onPress={() => setForm({ ...form, parentId: root.id })}
                    />
                  ))}
              </ScrollView>
              <Txt size={12} color={t.muted}>
                {zh.icon}
              </Txt>
              <View style={styles.wrap}>
                {iconOptions.map((icon) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={icon}
                    key={icon}
                    onPress={() => setForm({ ...form, icon })}
                    style={{
                      padding: 13,
                      borderWidth: 1,
                      borderColor: form.icon === icon ? t.blue : t.line,
                      borderRadius: 13,
                      backgroundColor: t.card,
                    }}
                  >
                    <Icon name={icon} color={form.color} />
                  </Pressable>
                ))}
              </View>
              <Txt size={12} color={t.muted}>
                {zh.color}
              </Txt>
              <Row style={{ flexWrap: "wrap" }}>
                {[
                  "#648BD2",
                  "#E88766",
                  "#7E9D8A",
                  "#A18ABE",
                  "#C59A63",
                  "#D18295",
                  "#689FA0",
                ].map((color) => (
                  <Pressable
                    key={color}
                    accessibilityRole="button"
                    accessibilityLabel={color}
                    onPress={() => setForm({ ...form, color })}
                    style={{
                      width: 35,
                      height: 35,
                      borderRadius: 18,
                      backgroundColor: color,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {form.color === color && (
                      <Icon name="checkmark" color="#fff" size={18} />
                    )}
                  </Pressable>
                ))}
              </Row>
              {form.id && (
                <Button
                  secondary
                  label="删除分类…"
                  onPress={() => {
                    setDeletionId(form.id!);
                    setForm(null);
                    setError("");
                  }}
                />
              )}
              <ErrorText message={error} />
              <Button
                label={zh.save}
                onPress={() => {
                  try {
                    run(() => repo.saveCategory({ ...form, kind }));
                    setForm(null);
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            </Page>
          )}
        </View>
      </Modal>
    </>
  );
}
