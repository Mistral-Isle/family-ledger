import { DateField } from "./DateField";
import { useUi } from "../state/ui";
import { shiftMonth, monthTitle } from "../domain/date";
import { Row, Txt, IconButton, useTheme } from "./ui";
import { zh } from "../i18n/zh";
export function MonthPicker() {
  const { month, setMonth } = useUi();
  const t = useTheme();
  return (
    <Row style={{ justifyContent: "space-between" }}>
      <Row>
        <DateField compact mode="month" label="选择月份" value={month} onChange={setMonth}/>
        <Txt size={11} color={t.muted}>
          {zh.family}
        </Txt>
      </Row>
      <Row style={{ gap: 10 }}>
        <IconButton
          name="chevron.left"
          label={zh.previousMonth}
          onPress={() => setMonth(shiftMonth(month, -1))}
        />
        <IconButton
          name="chevron.right"
          label={zh.nextMonth}
          onPress={() => setMonth(shiftMonth(month, 1))}
        />
      </Row>
    </Row>
  );
}
