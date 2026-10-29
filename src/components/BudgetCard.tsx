import { useState } from "react";
import { View } from "react-native";
import { useLedger } from "./LedgerProvider";
import { Button, Card, ErrorText, Field, Row, Txt, useTheme } from "./ui";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { totals } from "../domain/selectors";
import { zh } from "../i18n/zh";
export function BudgetCard({
  month,
  editable = false,
}: {
  month: string;
  editable?: boolean;
}) {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const budget = repo.monthBudget(month);
  const expense = totals(
    data.txns.filter((t) => t.occurredAt.startsWith(month)),
  ).expense;
  const [input, setInput] = useState(budget ? moneyInput(budget) : "");
  const [error, setError] = useState("");
  return (
    <Card>
      <Row>
        <Txt bold style={{ flex: 1 }}>
          {month} · {zh.reports.budget}
        </Txt>
        <Txt>{budget === null ? zh.reports.noBudget : formatMoney(budget)}</Txt>
      </Row>
      {budget !== null && (
        <>
          <Txt color={expense > budget ? t.blue : t.muted}>
            {expense > budget ? zh.reports.exceeded : zh.reports.remaining} ·{" "}
            {formatMoney(Math.abs(budget - expense))}
          </Txt>
          <View style={{ height: 6, backgroundColor: t.line, borderRadius: 3 }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: t.blue,
                width: `${Math.min(100, (Math.max(0, expense) * 100) / budget)}%`,
              }}
            />
          </View>
        </>
      )}
      {editable && (
        <>
          <Field
            label={zh.reports.budgetInput}
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
          />
          <Button
            secondary
            label={zh.reports.setBudget}
            onPress={() => {
              try {
                run(() =>
                  repo.setMonthBudget(
                    month,
                    input.trim() ? calculate(input) : null,
                  ),
                );
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <ErrorText message={error} />
        </>
      )}
    </Card>
  );
}
