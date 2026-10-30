import { DateField } from "./DateField";
import { useUi } from "../state/ui";
import { shiftMonth } from "../domain/date";
import { PeriodNavigation } from "./PeriodNavigation";
import { zh } from "../i18n/zh";
export function MonthPicker() {
  const { month, setMonth } = useUi();
  return (
    <PeriodNavigation
      previousLabel={zh.previousMonth}
      nextLabel={zh.nextMonth}
      onPrevious={() => setMonth(shiftMonth(month, -1))}
      onNext={() => setMonth(shiftMonth(month, 1))}
    >
      <DateField
        compact
        mode="month"
        label="选择月份"
        value={month}
        onChange={setMonth}
      />
    </PeriodNavigation>
  );
}
