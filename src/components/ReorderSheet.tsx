import { useState } from "react";
import { Modal, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryOrderList, type OrderItem } from "./CategoryOrderList";
import { IconButton, Row, Txt, ErrorText, useTheme } from "./ui";
import { useReducedMotion } from "./useReducedMotion";
import { reorderItems } from "../domain/localShortcuts";
import { shortcuts } from "../i18n/shortcuts";

export function ReorderSheet({
  items,
  title,
  onSave,
  onClose,
  cancelLabel = "取消" + title,
  saveLabel = "保存" + title,
  embedded = false,
}: {
  items: OrderItem[];
  title: string;
  onSave: (ids: string[]) => void;
  onClose: () => void;
  cancelLabel?: string;
  saveLabel?: string;
  embedded?: boolean;
}) {
  const [draft, setDraft] = useState(items),
    [error, setError] = useState("");
  const t = useTheme(),
    insets = useSafeAreaInsets(),
    reduced = useReducedMotion();
  const content = (
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
        <IconButton name="xmark" label={cancelLabel} onPress={onClose} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Txt size={18} bold>
            {title}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saveLabel}
          onPress={() => {
            try {
              onSave(draft.map((item) => item.id));
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
          <Txt color={t.blue}>{shortcuts.done}</Txt>
        </Pressable>
      </Row>
      <Txt size={12} color={t.muted}>
        {shortcuts.dragHint}
      </Txt>
      <ErrorText message={error} />
      <CategoryOrderList
        items={draft}
        onChange={(ids) => {
          try {
            setDraft(reorderItems(draft, ids));
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
    </View>
  );
  return embedded ? (
    content
  ) : (
    <Modal
      visible
      animationType={reduced ? "none" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}
