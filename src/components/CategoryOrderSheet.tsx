import { useState } from "react";
import { Modal, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryOrderList } from "./CategoryOrderList";
import { IconButton, Row, Txt, ErrorText, useTheme } from "./ui";
import { useReducedMotion } from "./useReducedMotion";
import type { Category } from "../domain/types";
export function CategoryOrderSheet({
  items,
  title,
  onSave,
  onClose,
}: {
  items: Category[];
  title: string;
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(items.map((i) => i.id)),
    [error, setError] = useState("");
  const t = useTheme(),
    insets = useSafeAreaInsets(),
    reduced = useReducedMotion();
  const names = new Map(
    items.map((i) => [i.id, i.name + (i.hidden ? " · 已隐藏" : "")]),
  );
  function change(ids: string[]) {
    if (
      ids.length !== draft.length ||
      new Set(ids).size !== draft.length ||
      ids.some((id) => !names.has(id))
    )
      return;
    setDraft(ids);
  }
  return (
    <Modal
      visible
      animationType={reduced ? "none" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 16),
          paddingHorizontal: 20,
          width: "100%",
          maxWidth: 600,
          alignSelf: "center",
          gap: 12,
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <IconButton name="xmark" label="取消分类排序" onPress={onClose} />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt size={18} bold>
              {title}
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="保存分类顺序"
            onPress={() => {
              try {
                onSave(draft);
                onClose();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt color={t.blue}>完成</Txt>
          </Pressable>
        </Row>
        <Txt size={12} color={t.muted}>
          拖动右侧把手调整顺序
        </Txt>
        <ErrorText message={error} />
        <CategoryOrderList
          items={draft.map((id) => ({ id, name: names.get(id)! }))}
          onChange={change}
        />
      </View>
    </Modal>
  );
}
