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
        <Txt size={17} bold>
          {monthTitle(month)}
        </Txt>
        <Txt size={11} color={t.muted}>
          {zh.family}
        </Txt>
      </Row>
      <Row style={{ gap: 0 }}>
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
