import { BudgetEditor } from "./BudgetEditor";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Platform, Pressable, Switch, View } from "react-native";
import { useLedger } from "./LedgerProvider";
import { Button, Card, ErrorText, Field, Icon, Row, Txt, useTheme } from "./ui";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { budgetTxns, totals } from "../domain/selectors";
import {
  categoryBudgetUsage,
  detailBudget,
  validateBudgetAllocation,
} from "../domain/budgets";
import { HelpBubble, Popover } from "./HelpBubble";
import { DetailBudgetSettings } from "./DetailBudgetSettings";
import type { Category } from "../domain/types";

function BudgetAmounts({
  budget,
  expense,
  testID,
}: {
  budget: number | null;
  expense: number;
  testID: string;
}) {
  const t = useTheme();
  const remaining = budget === null ? null : budget - expense;
  return (
    <View testID={testID} style={{ gap: 12 }}>
      <Row style={{ alignItems: "flex-start", gap: 8 }}>
        {[
          { label: "预算总额", amount: budget },
          { label: "已用", amount: expense },
          {
            label: remaining !== null && remaining < 0 ? "已超出" : "剩余",
            amount: remaining === null ? null : Math.abs(remaining),
          },
        ].map((item, index) => (
          <View key={item.label} style={{ flex: 1, gap: 5 }}>
            <Txt size={12} color={t.muted}>
              {item.label}
            </Txt>
            <Txt
              bold
              size={16}
              color={index >= 1 && (remaining ?? 0) < 0 ? "#D9363E" : t.text}
            >
              {item.amount === null ? "未设置" : formatMoney(item.amount)}
            </Txt>
          </View>
        ))}
      </Row>
      {budget !== null && (
        <View
          style={{
            height: 6,
            borderRadius: 3,
            overflow: "hidden",
            backgroundColor: t.line,
          }}
        >
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: expense > budget ? "#D9363E" : t.blue,
              width: `${budget > 0 ? Math.min(100, (Math.max(0, expense) * 100) / budget) : expense > 0 ? 100 : 0}%`,
            }}
          />
        </View>
      )}
    </View>
  );
}

export function BudgetCard({
  month,
  editable = false,
  embedded = false,
}: {
  month: string;
  editable?: boolean;
  embedded?: boolean;
}) {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const budget = repo.monthBudget(month);
  const allocations = repo.monthAllocations(month);
  const preferences = repo.getDetailBudgetPreferences();
  const display = detailBudget(
    data.txns,
    data.categories,
    month,
    budget,
    allocations,
    preferences,
  );
  const summary = (
    <View style={{ gap: 12 }}>
      <Row style={{ gap: 0 }}>
        <Txt bold style={{ flexShrink: 1 }}>
          {display.title}
        </Txt>
        <HelpBubble label="明细预算范围">{display.explanation}</HelpBubble>
        <View style={{ flex: 1 }} />
        <Popover label="明细预算设置">
          {(close) => (
            <Button
              secondary
              label="分类预算与显示设置"
              onPress={() => {
                close();
                router.push("/budget");
              }}
            />
          )}
        </Popover>
      </Row>
      <BudgetAmounts
        testID="detail-budget-summary"
        budget={display.budget}
        expense={display.expense}
      />
    </View>
  );
  if (embedded) return summary;
  if (editable) return <BudgetEditor key={month} month={month} />;
  return <Card>{summary}</Card>;
}
