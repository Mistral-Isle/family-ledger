import { isFutureTransaction } from "../domain/transactionFilters";
import { reportingSnapshot } from "../domain/reports";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { detailBudget, monthDailyMetrics } from "../domain/budgets";
import { formatMoney } from "../domain/money";
import { totals, visibleTxns } from "../domain/selectors";
import type { SummaryPreferences } from "../domain/summaryPreferences";
import { useUi } from "../state/ui";
import { Popover } from "./HelpBubble";
import { useLedger } from "./LedgerProvider";
import { SummaryPager } from "./SummaryPager";
import { ErrorText, Icon, Row, Txt, useTheme } from "./ui";

const cashflowOptions = [
  { value: "expense", label: "本月支出", short: "支出" },
  { value: "income", label: "本月收入", short: "收入" },
  { value: "balance", label: "本月结余", short: "结余" },
] as const;
const budgetOptions = [
  { value: "remaining", label: "预算剩余" },
  { value: "total", label: "预算总额" },
] as const;

function MetricPicker<T extends string>({
  value,
  options,
  label,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  label: string;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <Popover
      label={label}
      align="start"
      menuWidth={192}
      contentStyle={{ padding: 5, gap: 0 }}
      triggerContent={
        <Row style={{ gap: 6 }}>
          <Txt size={16} color={t.blue}>
            {options.find((option) => option.value === value)?.label}
          </Txt>
          <Icon name="chevron.down" size={14} color={t.blue} />
        </Row>
      }
    >
      {(close) =>
        options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={`主数字显示${option.label}`}
            accessibilityState={{ selected: value === option.value }}
            aria-pressed={value === option.value}
            onPress={() => {
              onChange(option.value);
              close();
            }}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor:
                pressed || value === option.value ? t.soft : "transparent",
            })}
          >
            <Txt
              size={14}
              color={value === option.value ? t.blue : t.text}
              style={{ flex: 1 }}
            >
              {option.label}
            </Txt>
            {value === option.value && (
              <Icon name="checkmark" size={15} color={t.blue} />
            )}
          </Pressable>
        ))
      }
    </Popover>
  );
}

function MainAmount({ amount }: { amount: number | null }) {
  const t = useTheme();
  if (amount === null)
    return (
      <Txt size={27} bold>
        预算未设置
      </Txt>
    );
  const [whole, decimal] = formatMoney(amount, false).split(".");
  const size = Math.max(
    24,
    Math.min(42, (42 * 12) / formatMoney(amount).length),
  );
  return (
    <Text
      style={{
        color: t.text,
        fontSize: size,
        lineHeight: size * 1.2,
        fontWeight: "600",
        letterSpacing: -1,
        fontVariant: ["tabular-nums"],
      }}
    >
      <Text>¥</Text>
      {whole}
      <Text style={{ fontSize: size * 0.65 }}>.{decimal}</Text>
    </Text>
  );
}

function Auxiliary({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "baseline",
        columnGap: 6,
        rowGap: 2,
      }}
    >
      <Txt size={14} color={t.muted}>
        {label}
      </Txt>
      <Txt size={18} bold color={color} style={{ flexShrink: 1 }}>
        {value}
      </Txt>
    </View>
  );
}

function Explanation({
  label,
  trigger,
  children,
}: {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover label={label} align="start" triggerContent={trigger}>
      {children}
    </Popover>
  );
}

export function MonthlySummaryCard({
  month,
  asOf,
  memberId = "",
}: {
  month: string;
  asOf?: Date;
  memberId?: string;
}) {
  const { data, repo } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const [choices, setChoices] = useState(() => repo.getSummaryPreferences());
  const [error, setError] = useState("");
  const txns = asOf
    ? data.txns.filter((t) => !isFutureTransaction(t, asOf))
    : data.txns;
  const summary = totals(
    visibleTxns(reportingSnapshot({ ...data, txns }, memberId, false, "payer").txns).filter((txn) => txn.occurredAt.startsWith(month)),
  );
  const budget = detailBudget(
    txns,
    data.categories,
    month,
    repo.monthBudget(month),
    repo.monthAllocations(month),
    repo.getDetailBudgetPreferences(),
  );
  const cashDays = monthDailyMetrics(month, summary.expense, null);
  const budgetDays = monthDailyMetrics(month, budget.expense, budget.budget);
  const dailyRemaining = !budgetDays.remaining
    ? "已结束"
    : budgetDays.dailyRemaining === null
      ? "未设置"
      : formatMoney(budgetDays.dailyRemaining);
  const overBudget = budget.remaining !== null && budget.remaining < 0;
  const usage =
    budget.budget === null
      ? "未设置"
      : overBudget
        ? "已超支"
        : budget.expense < 0
          ? `净退款 ${formatMoney(-budget.expense)}`
          : budget.budget > 0
            ? `已用 ${((budget.expense / budget.budget) * 100).toFixed(1)}%`
            : `已用 ${formatMoney(budget.expense)}`;
  const saveChoices = (update: Partial<SummaryPreferences>) => {
    const next = { ...choices, ...update };
    setChoices(next);
    try {
      repo.setSummaryPreferences(next);
      setError("");
    } catch (error) {
      console.error("[summary-preferences] Save failed", error);
      setError("显示已切换，但暂时无法记住选择。");
    }
  };
  const openStats = (view: SummaryPreferences["cashflowMetric"]) => {
    useUi.getState().openStats(view, memberId);
    router.push("/(tabs)/stats");
  };
  const openBudget = () => router.push("/budget");
  const page = choices.page === "budget" ? 1 : 0;
  return (
    <View>
      <View
        testID="monthly-summary-card"
        style={[styles.card, { backgroundColor: t.card }]}
      >
        <SummaryPager
          page={page}
          onChange={(index) =>
            saveChoices({ page: index === 1 ? "budget" : "cashflow" })
          }
        >
          {[
            <View key="cashflow" testID="cashflow-summary" style={styles.pane}>
              <View style={styles.heading}>
                <MetricPicker
                  value={choices.cashflowMetric}
                  options={cashflowOptions}
                  label="切换收支主数字"
                  onChange={(cashflowMetric) => saveChoices({ cashflowMetric })}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`查看${cashflowOptions.find((option) => option.value === choices.cashflowMetric)!.short}统计`}
                onPress={() => openStats(choices.cashflowMetric)}
                style={({ pressed }) => [
                  styles.amount,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <MainAmount amount={summary[choices.cashflowMetric]} />
              </Pressable>
              <View style={styles.auxiliary}>
                {cashflowOptions
                  .filter((option) => option.value !== choices.cashflowMetric)
                  .map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`查看${option.short}统计`}
                      onPress={() => openStats(option.value)}
                      style={({ pressed }) => [
                        styles.auxiliaryItem,
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                    >
                      <Auxiliary
                        label={option.short}
                        value={formatMoney(summary[option.value])}
                      />
                    </Pressable>
                  ))}
              </View>
              <View style={styles.footer}>
                <Explanation
                  label="日均支出说明"
                  trigger={
                    <Row style={{ gap: 6 }}>
                      <Txt size={12} color={t.muted}>
                        日均支出{" "}
                        {cashDays.dailyExpense === null
                          ? "—"
                          : formatMoney(cashDays.dailyExpense)}
                      </Txt>
                      <Icon
                        name="questionmark.circle"
                        size={14}
                        color={t.muted}
                      />
                    </Row>
                  }
                >
                  <Txt size={14}>
                    当月支出除以已过天数（含今天）；历史月份按全月天数计算，未来月份暂不计算。退款抵减支出，还款本金与本人账户间转账不计入。
                  </Txt>
                </Explanation>
              </View>
              <View style={styles.progressSpace} />
            </View>,
            <View
              key="budget"
              testID="detail-budget-summary"
              style={styles.pane}
            >
              <View style={styles.heading}>
                <MetricPicker
                  value={choices.budgetMetric}
                  options={budgetOptions}
                  label="切换预算主数字"
                  onChange={(budgetMetric) => saveChoices({ budgetMetric })}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="查看预算详情"
                onPress={openBudget}
                style={({ pressed }) => [
                  styles.amount,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <MainAmount
                  amount={
                    choices.budgetMetric === "total"
                      ? budget.budget
                      : budget.remaining
                  }
                />
              </Pressable>
              <View style={styles.auxiliary}>
                <View style={styles.auxiliaryItem}>
                  <Auxiliary
                    label={
                      choices.budgetMetric === "total" || budget.budget === null
                        ? "已用"
                        : "总预算"
                    }
                    value={
                      choices.budgetMetric === "total" || budget.budget === null
                        ? formatMoney(budget.expense)
                        : formatMoney(budget.budget!)
                    }
                  />
                </View>
                <View style={styles.auxiliaryItem}>
                  {choices.budgetMetric === "total" ? (
                    <Auxiliary
                      label="剩余"
                      value={
                        budget.remaining === null
                          ? "未设置"
                          : formatMoney(budget.remaining)
                      }
                      color={overBudget ? t.red : undefined}
                    />
                  ) : (
                    <Explanation
                      label="预算日均剩余说明"
                      trigger={
                        <Auxiliary
                          label="剩余日均"
                          value={dailyRemaining}
                          color={
                            (budgetDays.dailyRemaining ?? 0) < 0
                              ? t.red
                              : undefined
                          }
                        />
                      }
                    >
                      <Txt size={14}>
                        按明细预算所选分类计算剩余预算，再除以本月剩余天数（含今天）。未来月份按全月天数计算；历史月份显示已结束；未设置预算时不计算。负数表示已经超支。
                      </Txt>
                    </Explanation>
                  )}
                </View>
              </View>
              <View style={styles.footer}>
                <View
                  style={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}
                >
                  <Explanation
                    label="明细预算范围说明"
                    trigger={
                      <Row style={{ gap: 5, flexShrink: 1 }}>
                        <Txt
                          size={12}
                          color={overBudget ? t.red : t.muted}
                          style={{ flexShrink: 1 }}
                        >
                          {memberId ? "共同 · " : ""}{budget.title} · {usage}
                        </Txt>
                        <Icon
                          name="questionmark.circle"
                          size={14}
                          color={t.muted}
                        />
                      </Row>
                    }
                  >
                    <Txt bold>{budget.title}</Txt>
                    <Txt size={14}>{budget.explanation}</Txt>
                    {!!memberId && <Txt size={14}>预算按全部家庭账单计算，不受“我”的付款人筛选影响。</Txt>}
                    <Txt size={14}>
                      已用 {formatMoney(budget.expense)}；剩余日均{" "}
                      {dailyRemaining}。
                    </Txt>
                  </Explanation>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="明细预算设置"
                  onPress={openBudget}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    justifyContent: "center",
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Row style={{ gap: 3 }}>
                    <Txt size={12} color={t.blue}>
                      {budget.budget === null ? "设置预算" : "调整预算"}
                    </Txt>
                    <Icon name="chevron.right" size={12} color={t.blue} />
                  </Row>
                </Pressable>
              </View>
              <View style={styles.progressSpace}>
                {budget.budget !== null && (
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel="预算使用进度"
                    accessibilityValue={{
                      min: 0,
                      max: 100,
                      now: Math.round(budget.progress * 100),
                      text: usage,
                    }}
                    style={[styles.progress, { backgroundColor: t.soft }]}
                  >
                    <View
                      style={{
                        height: 4,
                        width: `${budget.progress * 100}%`,
                        borderRadius: 2,
                        backgroundColor: overBudget ? t.red : t.blue,
                      }}
                    />
                  </View>
                )}
              </View>
            </View>,
          ]}
        </SummaryPager>
        <View style={[styles.tabs, { backgroundColor: t.soft }]}>
          {(["收支", "预算"] as const).map((label, index) => (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityLabel={`${label}概览`}
              accessibilityState={{ selected: page === index }}
              aria-selected={page === index}
              onPress={() =>
                saveChoices({ page: index === 0 ? "cashflow" : "budget" })
              }
              style={({ pressed }) => ({
                minWidth: 46,
                minHeight: 28,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  page === index
                    ? t.dark
                      ? t.selected
                      : t.card
                    : "transparent",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Txt
                size={12}
                bold={page === index}
                color={
                  page === index ? (t.dark ? t.onSelected : t.blue) : t.muted
                }
              >
                {label}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>
      <ErrorText message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderCurve: "continuous", overflow: "hidden" },
  pane: { padding: 16, flex: 1 },
  heading: { minHeight: 44, paddingRight: 106, alignItems: "flex-start" },
  amount: {
    minHeight: 50,
    marginTop: 4,
    marginBottom: 4,
    justifyContent: "center",
  },
  auxiliary: { flexDirection: "row", gap: 14, minHeight: 44 },
  auxiliaryItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 44,
    marginTop: 2,
    paddingTop: 4,
  },
  progressSpace: { height: 4 },
  progress: { height: 4, borderRadius: 2, overflow: "hidden" },
  tabs: {
    position: "absolute",
    top: 22,
    right: 16,
    flexDirection: "row",
    padding: 2,
    borderRadius: 12,
  },
});
