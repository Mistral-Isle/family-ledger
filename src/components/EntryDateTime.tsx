import { useState } from "react";
import { Modal, Pressable, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarControl, TimeControl } from "./DateTimeControls";
import { Button, Row, Txt, useTheme } from "./ui";
import { useReducedMotion } from "./useReducedMotion";
import { today } from "../domain/date";
const pad = (n: number) => String(n).padStart(2, "0");
const dayString = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const timeString = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export function EntryDateTime({
  date,
  time,
  onChange,
}: {
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
}) {
  const t = useTheme(),
    insets = useSafeAreaInsets(),
    reduced = useReducedMotion();
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(new Date()),
    [recordTime, setRecordTime] = useState(true),
    [showTime, setShowTime] = useState(false);
  function show() {
    const next = new Date(`${date}T${time || timeString(new Date())}:00`);
    setDraft(Number.isNaN(next.getTime()) ? new Date() : next);
    setRecordTime(!!time);
    setShowTime(false);
    setOpen(true);
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="日期与时间"
        onPress={show}
        style={{
          minHeight: 44,
          paddingVertical: 12,
          paddingRight: 6,
          justifyContent: "center",
        }}
      >
        <Txt size={12} color={t.blue}>
          {date === today()
            ? time || "今天"
            : `${date.slice(5).replace("-", "月")}日${time ? " " + time : ""}`}
        </Txt>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType={reduced ? "none" : "fade"}
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: 12,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
            backgroundColor: "#00000055",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="取消日期时间选择"
            onPress={() => setOpen(false)}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            style={{
              backgroundColor: t.card,
              borderRadius: 28,
              padding: 14,
              gap: 14,
              width: "100%",
              maxWidth: 400,
              maxHeight: "100%",
              alignSelf: "center",
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 16 }}
            >
              <CalendarControl
                value={draft}
                onChange={(next) => {
                  const d = new Date(next);
                  d.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
                  setDraft(d);
                }}
              />
              <Row>
                <Txt bold style={{ flex: 1 }}>
                  时间
                </Txt>
                <Switch
                  accessibilityLabel="记录时间"
                  value={recordTime}
                  onValueChange={(value) => {
                    setRecordTime(value);
                    if (!value) setShowTime(false);
                  }}
                />
                {recordTime && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="调整时间"
                    accessibilityState={{ expanded: showTime }}
                    onPress={() => setShowTime(!showTime)}
                    style={{
                      backgroundColor: t.soft,
                      borderRadius: 18,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      minHeight: 44,
                    }}
                  >
                    <Txt size={18}>{timeString(draft)}</Txt>
                  </Pressable>
                )}
              </Row>
              {!recordTime && (
                <Txt size={12} color={t.muted}>
                  不记录时间，只保留日期
                </Txt>
              )}
              {recordTime && showTime && (
                <TimeControl
                  value={draft}
                  onChange={(next) => {
                    const d = new Date(draft);
                    d.setHours(next.getHours(), next.getMinutes(), 0, 0);
                    setDraft(d);
                  }}
                />
              )}
            </ScrollView>
            <Row>
              <View style={{ flex: 1 }}>
                <Button secondary label="取消" onPress={() => setOpen(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="确定"
                  onPress={() => {
                    onChange(
                      dayString(draft),
                      recordTime ? timeString(draft) : "",
                    );
                    setOpen(false);
                  }}
                />
              </View>
            </Row>
          </View>
        </View>
      </Modal>
    </>
  );
}
