import { useState } from "react";
import { Pressable, View } from "react-native";
import { IconButton, Row, Txt, useTheme } from "./ui";
export function CalendarControl({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const t = useTheme();
  const [month, setMonth] = useState(
    new Date(value.getFullYear(), value.getMonth(), 1),
  );
  const first = month.getDay(),
    count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <View style={{ gap: 12 }}>
      <Row>
        <Txt size={19} bold style={{ flex: 1 }}>
          {month.getFullYear()}年{month.getMonth() + 1}月
        </Txt>
        <IconButton
          name="chevron.left"
          label="上个月"
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        />
        <IconButton
          name="chevron.right"
          label="下个月"
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        />
      </Row>
      <View style={{ flexDirection: "row" }}>
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <View key={day} style={{ width: "14.2857%", alignItems: "center" }}>
            <Txt size={12} color={t.muted}>
              {day}
            </Txt>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {Array.from(
          { length: Math.ceil((first + count) / 7) * 7 },
          (_, index) => {
            const day = index - first + 1,
              valid = day > 0 && day <= count,
              selected =
                valid &&
                value.getFullYear() === month.getFullYear() &&
                value.getMonth() === month.getMonth() &&
                value.getDate() === day;
            return (
              <View
                key={index}
                style={{ width: "14.2857%", alignItems: "center" }}
              >
                {valid ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}
                    accessibilityState={{ selected }}
                    onPress={() =>
                      onChange(
                        new Date(
                          month.getFullYear(),
                          month.getMonth(),
                          day,
                          value.getHours(),
                          value.getMinutes(),
                        ),
                      )
                    }
                    style={{
                      minHeight: 42,
                      width: 42,
                      borderRadius: 21,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? t.primary : "transparent",
                    }}
                  >
                    <Txt size={19} color={selected ? t.onPrimary : t.text}>
                      {day}
                    </Txt>
                  </Pressable>
                ) : (
                  <View style={{ height: 42 }} />
                )}
              </View>
            );
          },
        )}
      </View>
    </View>
  );
}
export function TimeControl({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const t = useTheme();
  return (
    <input
      aria-label="选择时间"
      type="time"
      value={`${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`}
      onChange={(event) => {
        if (!event.target.value) return;
        const [hours, minutes] = event.target.value.split(":").map(Number),
          next = new Date(value);
        next.setHours(hours!, minutes!, 0, 0);
        onChange(next);
      }}
      style={{
        boxSizing: "border-box",
        minWidth: 0,
        minHeight: 72,
        background: t.soft,
        color: t.text,
        colorScheme: t.dark ? "dark" : "light",
        border: 0,
        borderRadius: 20,
        padding: 16,
        fontSize: 28,
        textAlign: "center",
        width: "100%",
      }}
    />
  );
}
