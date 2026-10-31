import { useReducedMotion } from "./useReducedMotion";
import { useSubmissionGuard } from "./useSubmissionGuard";
import { useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLedger } from "./LedgerProvider";
import {
  Icon,
  IconButton,
  Txt,
  Row,
  Chip,
  ErrorText,
  Button,
  useTheme,
} from "./ui";
import { categoryIcons, categoryIconGroups } from "../domain/categoryIcons";
import type { Category, CategoryKind } from "../domain/types";
import { zh } from "../i18n/zh";
export type CategoryDraft = Pick<
  Category,
  "name" | "icon" | "color" | "parentId"
> &
  Partial<Pick<Category, "id" | "hidden" | "sort">>;
export function CategoryEditor({
  initial,
  kind,
  onClose,
  onSaved,
  onDelete,
}: {
  initial: CategoryDraft;
  kind: CategoryKind;
  onClose: () => void;
  onSaved?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const { repo, data, run } = useLedger(),
    t = useTheme(),
    insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const submission = useSubmissionGuard();
  const [form, setForm] = useState(initial),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState("全部"),
    [error, setError] = useState("");
  const roots = data.categories.filter(
    (c) => !c.deleted && !c.parentId && c.kind === kind && c.id !== form.id,
  );
  const choices = categoryIcons.filter(
    (i) =>
      (group === "全部" || i.group === group) &&
      (!query || `${i.label} ${i.group}`.includes(query.trim())),
  );
  function save() {
    try {
      const ids = new Set(data.categories.map((c) => c.id));
      if (
        !submission.run(() => run(() => repo.saveCategory({ ...form, kind })))
      )
        return;
      const id =
        form.id ?? repo.snapshot().categories.find((c) => !ids.has(c.id))?.id;
      if (id) onSaved?.(id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      visible
      animationType={reducedMotion ? "none" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          backgroundColor: t.bg,
          paddingTop: Math.max(insets.top, 12),
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 600,
            alignSelf: "center",
            flex: 1,
            paddingHorizontal: 16,
          }}
        >
          <Row style={{ justifyContent: "space-between", paddingBottom: 12 }}>
            <IconButton name="xmark" label={zh.close} onPress={onClose} />
            <Txt size={18} bold>
              {form.id
                ? zh.editCategory
                : kind === "expense"
                  ? "新增支出分类"
                  : "新增收入分类"}
            </Txt>
            <IconButton name="checkmark" label="保存分类" onPress={save} />
          </Row>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: 16,
              paddingBottom: Math.max(insets.bottom, 20),
            }}
          >
            <Row
              style={{ backgroundColor: t.card, padding: 14, borderRadius: 22 }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  backgroundColor: form.color,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={form.icon} color="#fff" size={30} />
              </View>
              <TextInput
                accessibilityLabel={zh.categoryName}
                placeholder="给分类起个名字"
                placeholderTextColor={t.muted}
                value={form.name}
                maxLength={30}
                onChangeText={(name) => setForm({ ...form, name })}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 20,
                  color: t.text,
                  padding: 10,
                }}
              />
            </Row>
            <View style={{ gap: 8 }}>
              <Txt size={12} color={t.muted}>
                {zh.parent}
              </Txt>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                <Chip
                  label={zh.root}
                  selected={!form.parentId}
                  onPress={() => setForm({ ...form, parentId: null })}
                />
                {roots.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={form.parentId === c.id}
                    onPress={() => setForm({ ...form, parentId: c.id })}
                  />
                ))}
              </ScrollView>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 3 }}
            >
              {[
                "#E88766",
                "#E6A23C",
                "#C69C35",
                "#648BD2",
                "#6675C8",
                "#A18ABE",
                "#D18295",
                "#7E9D8A",
                "#689FA0",
                "#8A929E",
              ].map((color) => (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={`颜色 ${color}`}
                  accessibilityState={{ selected: form.color === color }}
                  onPress={() => setForm({ ...form, color })}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: color,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: form.color === color ? 3 : 0,
                    borderColor: t.text,
                  }}
                >
                  {form.color === color && (
                    <Icon name="checkmark" color="#fff" size={22} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Row
              style={{
                backgroundColor: t.card,
                borderRadius: 14,
                paddingHorizontal: 12,
              }}
            >
              <Icon name="magnifyingglass" color={t.muted} size={18} />
              <TextInput
                accessibilityLabel="搜索图标"
                placeholder="搜索图标，如餐饮、交通、工资"
                value={query}
                onChangeText={setQuery}
                placeholderTextColor={t.muted}
                style={{ color: t.text, flex: 1, minHeight: 44, padding: 8 }}
              />
            </Row>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7 }}
            >
              {categoryIconGroups.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  selected={group === g}
                  onPress={() => setGroup(g)}
                />
              ))}
            </ScrollView>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16 }}
            >
              {choices.map((i) => (
                <Pressable
                  key={i.name}
                  accessibilityRole="button"
                  accessibilityLabel={`图标 ${i.label}`}
                  accessibilityState={{ selected: form.icon === i.name }}
                  onPress={() => setForm({ ...form, icon: i.name })}
                  style={({ pressed }) => ({
                    width: "25%",
                    alignItems: "center",
                    gap: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View
                    style={{
                      height: 54,
                      width: 54,
                      borderRadius: 18,
                      backgroundColor:
                        form.icon === i.name ? form.color : t.card,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={i.name}
                      color={form.icon === i.name ? "#fff" : t.text}
                      size={27}
                    />
                  </View>
                  <Txt
                    size={11}
                    color={form.icon === i.name ? t.blue : t.muted}
                  >
                    {i.label}
                  </Txt>
                </Pressable>
              ))}
            </View>
            {!choices.length && (
              <Txt color={t.muted}>没有匹配的图标，试试其他关键词</Txt>
            )}
            <ErrorText message={error} />
            {form.id && onDelete && (
              <Button
                secondary
                label="删除分类…"
                onPress={() => onDelete(form.id!)}
              />
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
