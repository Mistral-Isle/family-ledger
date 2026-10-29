import type { Txn } from "../domain/types";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Card, Row, Txt, useTheme } from "./ui";
import { useLedger } from "./LedgerProvider";
import { dailyReport } from "../domain/reports";
import { formatMoney } from "../domain/money";
import { zh } from "../i18n/zh";
export function IncomeCalendar({
  month,
  txns,
}: {
  month: string;
  txns?: Txn[];
}) {
  const { data } = useLedger(),
    t = useTheme();
  const days = dailyReport(txns ?? data.txns, month);
  const [selected, setSelected] = useState(month + "-01");
  const day = days.find((d) => d.date === selected) ?? days[0]!;
  const padding = (new Date(month + "-01T00:00:00Z").getUTCDay() + 6) % 7;
  return (
    <Card>
      <Txt bold>{zh.reports.calendar}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {zh.reports.weekdays.map((label) => (
          <View
            key={label}
            style={{
              width: "14.28%",
              alignItems: "center",
              paddingVertical: 8,
            }}
          >
            <Txt size={12}>{label}</Txt>
          </View>
        ))}
        {Array.from({ length: padding }, (_, i) => (
          <View key={"blank" + i} style={{ width: "14.28%" }} />
        ))}
        {days.map((d) => (
          <Pressable
            key={d.date}
            accessibilityRole="button"
            accessibilityLabel={d.date}
            onPress={() => setSelected(d.date)}
            style={{
              width: "14.28%",
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              backgroundColor: d.date === day.date ? t.soft : "transparent",
            }}
          >
            <Txt bold={d.date === day.date}>{Number(d.date.slice(-2))}</Txt>
            <Txt size={9} color={t.blue}>
              {d.expense || d.income ? "●" : " "}
            </Txt>
          </Pressable>
        ))}
      </View>
      <Txt>{day.date}</Txt>
      <Row>
        <Txt>
          {zh.expense} {formatMoney(day.expense)}
        </Txt>
        <Txt>
          {zh.income} {formatMoney(day.income)}
        </Txt>
      </Row>
    </Card>
  );
}
