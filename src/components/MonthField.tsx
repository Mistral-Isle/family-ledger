import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { thisMonth } from "../domain/date";
import { Button, Icon, IconButton, Row, Txt, useTheme } from "./ui";

/** A small month-only picker, with the same layout in Expo Go and native builds. */
export function MonthField({
  label,
  value,
  onChange,
  compact = false,
  yearOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  yearOnly?: boolean;
}) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  const current = thisMonth();
  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  const firstYear = Math.floor(year / 12) * 12;
  return (
    <View style={{ gap: 6, flexShrink: 1 }}>
      {!compact && (
        <Txt size={12} color={t.muted}>
          {label}
        </Txt>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setYear(Number(value.slice(0, 4)));
          setOpen(true);
        }}
        style={({ pressed }) => ({
          minHeight: 44,
          paddingHorizontal: compact ? 4 : 14,
          paddingVertical: 10,
          borderRadius: 16,
          backgroundColor: compact ? "transparent" : t.card,
          opacity: pressed ? 0.55 : 1,
        })}
      >
        <Row style={{ gap: 6, justifyContent: "center" }}>
          <Txt bold size={compact ? 19 : 15} style={{ flexShrink: 1 }}>
            {value.slice(0, 4)}年{!yearOnly && `${Number(value.slice(5, 7))}月`}
          </Txt>
          <Icon name="chevron.down" size={11} color={t.muted} />
        </Row>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            padding: 20,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭月份选择"
            onPress={() => setOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "#00000044",
            }}
          />
          <View
            accessibilityViewIsModal
            style={{
              width: "100%",
              maxWidth: 360,
              maxHeight: height - 80,
              backgroundColor: t.card,
              borderRadius: 28,
              borderCurve: "continuous",
              overflow: "hidden",
              boxShadow: "0 16px 60px rgba(0,0,0,0.18)",
            }}
          >
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt bold size={20}>
                  {label}
                </Txt>
                <IconButton
                  name="xmark"
                  label="取消选择月份"
                  onPress={() => setOpen(false)}
                />
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <IconButton
                  name="chevron.left"
                  label={yearOnly ? "前十二年" : "上一年"}
                  onPress={() =>
                    setYear(Math.max(1900, year - (yearOnly ? 12 : 1)))
                  }
                />
                <Txt bold size={18}>
                  {yearOnly ? `${firstYear}—${firstYear + 11}` : `${year}年`}
                </Txt>
                <IconButton
                  name="chevron.right"
                  label={yearOnly ? "后十二年" : "下一年"}
                  onPress={() =>
                    setYear(Math.min(9990, year + (yearOnly ? 12 : 1)))
                  }
                />
              </Row>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {Array.from({ length: 12 }, (_, i) => {
                  const next = yearOnly
                    ? `${firstYear + i}-01`
                    : `${year}-${String(i + 1).padStart(2, "0")}`;
                  const selected = yearOnly
                    ? next.slice(0, 4) === value.slice(0, 4)
                    : next === value;
                  const isCurrent = yearOnly
                    ? next.slice(0, 4) === current.slice(0, 4)
                    : next === current;
                  return (
                    <View key={next} style={{ width: "33.3333%", padding: 4 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          yearOnly
                            ? `${firstYear + i}年`
                            : `${year}年${i + 1}月`
                        }
                        accessibilityState={{ selected }}
                        onPress={() => select(next)}
                        style={({ pressed }) => ({
                          minHeight: 48,
                          borderRadius: 15,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected
                            ? t.blue
                            : pressed
                              ? t.soft
                              : "transparent",
                          borderWidth: 1,
                          borderColor:
                            isCurrent && !selected ? t.blue : "transparent",
                        })}
                      >
                        <Txt
                          bold={selected || isCurrent}
                          size={16}
                          color={
                            selected
                              ? t.dark
                                ? t.bg
                                : "#FFFFFF"
                              : isCurrent
                                ? t.blue
                                : t.text
                          }
                        >
                          {yearOnly ? firstYear + i : `${i + 1}月`}
                        </Txt>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              <Button
                secondary
                label={yearOnly ? "回到今年" : "回到本月"}
                onPress={() =>
                  select(yearOnly ? current.slice(0, 4) + "-01" : current)
                }
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
