import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Row, Txt, useTheme } from "./ui";
import { today } from "../domain/date";
export type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: "date" | "time" | "month";
  optional?: boolean;
  compact?: boolean;
};
export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  optional,
  compact,
}: DateFieldProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  function show() {
    const next =
      mode === "time"
        ? new Date(`${today()}T${value || "12:00"}:00`)
        : new Date(
            `${(value || today()).slice(0, mode === "month" ? 7 : 10)}${mode === "month" ? "-01" : ""}T12:00:00`,
          );
    setDraft(Number.isNaN(next.getTime()) ? new Date() : next);
    setOpen(true);
  }
  function commit(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    onChange(
      mode === "time"
        ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
        : `${d.getFullYear()}-${pad(d.getMonth() + 1)}${mode === "month" ? "" : "-" + pad(d.getDate())}`,
    );
    setOpen(false);
  }
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
        onPress={show}
        style={{
          minHeight: 44,
          paddingHorizontal: compact ? 6 : 14,
          paddingVertical: 12,
          borderRadius: 16,
          backgroundColor: t.card,
        }}
      >
        <Txt size={compact ? 12 : 15}>
          {value || (mode === "time" ? "不记录时间" : "选择日期")}
        </Txt>
      </Pressable>
      {open &&
        (Platform.OS === "android" ? (
          <DateTimePicker
            value={draft}
            mode={mode === "time" ? "time" : "date"}
            onChange={(event, d) => {
              if (event.type === "set" && d) commit(d);
              else setOpen(false);
            }}
          />
        ) : (
          <Modal
            transparent
            animationType="fade"
            onRequestClose={() => setOpen(false)}
          >
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                padding: 20,
                backgroundColor: "#00000055",
              }}
            >
              <View
                style={{
                  backgroundColor: t.card,
                  borderRadius: 28,
                  padding: 20,
                  gap: 16,
                  width: "100%",
                  maxWidth: 420,
                  alignSelf: "center",
                }}
              >
                <Txt bold size={20}>
                  {label}
                </Txt>
                <ScrollView style={{ maxHeight: 400 }}>
                  <DateTimePicker
                    value={draft}
                    mode={mode === "time" ? "time" : "date"}
                    display={mode === "time" ? "spinner" : "inline"}
                    themeVariant={t.dark ? "dark" : "light"}
                    locale="zh-CN"
                    onChange={(_, d) => {
                      if (d) setDraft(d);
                    }}
                  />
                </ScrollView>
                <Row style={{ flexWrap: "wrap" }}>
                  <Button
                    secondary
                    label="取消"
                    onPress={() => setOpen(false)}
                  />
                  <Button label="确定" onPress={() => commit(draft)} />
                  {optional && (
                    <Button
                      secondary
                      label={mode === "time" ? "不记录时间" : "清除日期"}
                      onPress={() => {
                        onChange("");
                        setOpen(false);
                      }}
                    />
                  )}
                </Row>
              </View>
            </View>
          </Modal>
        ))}
    </View>
  );
}
