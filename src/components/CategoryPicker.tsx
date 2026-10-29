import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useLedger } from "./LedgerProvider";
import { Button, Icon, IconButton, Row, Txt, useTheme } from "./ui";
export function CategoryPicker({
  value,
  onChange,
  kind = "expense",
  label = "选择分类",
  allowAll = false,
}: {
  value: string;
  onChange: (id: string) => void;
  kind?: "expense" | "income";
  label?: string;
  allowAll?: boolean;
}) {
  const { data } = useLedger(),
    t = useTheme();
  const [open, setOpen] = useState(false),
    [root, setRoot] = useState("");
  const cats = data.categories.filter(
    (c) => !c.deleted && !c.hidden && c.kind === kind,
  );
  const selected = cats.find((c) => c.id === value);
  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setRoot("");
  }
  return (
    <>
      <Button
        secondary
        label={selected ? `${label} · ${selected.name}` : label}
        onPress={() => setOpen(true)}
      />
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#00000055",
          }}
        >
          <Pressable
            accessibilityLabel="关闭分类选择"
            onPress={() => setOpen(false)}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            style={{
              backgroundColor: t.bg,
              padding: 24,
              paddingBottom: 40,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: "75%",
              gap: 16,
            }}
          >
            <Row>
              <Txt size={20} bold style={{ flex: 1 }}>
                {root ? cats.find((c) => c.id === root)?.name : label}
              </Txt>
              <IconButton
                name="xmark"
                label="关闭分类选择"
                onPress={() => setOpen(false)}
              />
            </Row>
            {root && (
              <Button
                secondary
                label="返回一级分类"
                onPress={() => setRoot("")}
              />
            )}
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {cats
                  .filter((c) => (root ? c.parentId === root : !c.parentId))
                  .map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityLabel={c.name}
                      onPress={() => {
                        if (!root && cats.some((x) => x.parentId === c.id))
                          setRoot(c.id);
                        else choose(c.id);
                      }}
                      style={{
                        width: "25%",
                        alignItems: "center",
                        gap: 7,
                        paddingVertical: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          backgroundColor: value === c.id ? c.color : t.card,
                          borderRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name={c.icon}
                          color={value === c.id ? "#fff" : c.color}
                          size={24}
                        />
                      </View>
                      <Txt size={12}>{c.name}</Txt>
                    </Pressable>
                  ))}
              </View>
              {root && (
                <Button
                  secondary
                  label="选择整个一级分类"
                  onPress={() => choose(root)}
                />
              )}
              {allowAll && (
                <Button secondary label="全部分类" onPress={() => choose("")} />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
