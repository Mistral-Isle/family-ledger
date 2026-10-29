import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useLedger } from "../../components/LedgerProvider";
import {
  Card,
  Chip,
  Heading,
  Icon,
  Page,
  Row,
  Txt,
  useTheme,
} from "../../components/ui";
import { MonthPicker } from "../../components/MonthPicker";
import { useUi } from "../../state/ui";
import { totals, visibleTxns, categoryAmounts } from "../../domain/selectors";
import { formatMoney } from "../../domain/money";
import { zh } from "../../i18n/zh";
export default function Stats() {
  const { data } = useLedger();
  const t = useTheme();
  const month = useUi((s) => s.month);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const rows = visibleTxns(data.txns).filter((txn) =>
    txn.occurredAt.startsWith(month),
  );
  const summary = totals(rows);
  const amounts = categoryAmounts(rows, kind);
  const categories = Array.from(amounts.entries())
    .map(([id, amount]) => ({
      category: data.categories.find((c) => c.id === id),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  const positiveTotal = categories.reduce(
    (sum, c) => sum + Math.max(0, c.amount),
    0,
  );
  const circumference = 2 * Math.PI * 67;
  let offset = 0;
  return (
    <Page>
      <Heading title={zh.tabs.stats} subtitle={zh.statsHint} />
      <MonthPicker />
      <Card>
        <Txt size={13} color={t.muted}>
          {zh.overview}
        </Txt>
        <Row style={{ marginTop: 15 }}>
          {[
            { label: zh.expense, value: summary.expense },
            { label: zh.income, value: summary.income },
            { label: zh.balance, value: summary.balance },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, gap: 6 }}>
              <Txt size={11} color={t.muted}>
                {item.label}
              </Txt>
              <Txt size={16} bold>
                {formatMoney(item.value)}
              </Txt>
            </View>
          ))}
        </Row>
      </Card>
      <Row>
        <Txt size={19} bold style={{ flex: 1 }}>
          {zh.spending}
        </Txt>
        <Chip
          label={zh.expense}
          selected={kind === "expense"}
          onPress={() => setKind("expense")}
        />
        <Chip
          label={zh.income}
          selected={kind === "income"}
          onPress={() => setKind("income")}
        />
      </Row>
      <Card style={{ alignItems: "center", gap: 24 }}>
        <View
          style={{
            width: 180,
            height: 180,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={180} height={180} style={{ position: "absolute" }}>
            <Circle
              cx={90}
              cy={90}
              r={67}
              stroke={t.line}
              strokeWidth={18}
              fill="none"
            />
            {categories.map(({ category, amount }, i) => {
              const length = positiveTotal
                ? (Math.max(0, amount) / positiveTotal) * circumference
                : 0;
              const start = offset;
              offset += length;
              return (
                <Circle
                  key={category?.id ?? i}
                  cx={90}
                  cy={90}
                  r={67}
                  fill="none"
                  stroke={category?.color ?? t.blue}
                  strokeWidth={18}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-start}
                  rotation={-90}
                  origin="90, 90"
                />
              );
            })}
          </Svg>
          <Txt size={11} color={t.muted}>
            {kind === "expense" ? zh.expense : zh.income}
          </Txt>
          <Txt size={23} bold>
            {formatMoney(total)}
          </Txt>
        </View>
        {!categories.length ? (
          <Txt color={t.muted}>{zh.noStats}</Txt>
        ) : (
          <View style={{ alignSelf: "stretch", gap: 22 }}>
            {categories.map(({ category, amount }, i) => (
              <View key={category?.id ?? i} style={{ gap: 8 }}>
                <Row>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: t.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={category?.icon ?? "sparkles"}
                      color={category?.color}
                      size={17}
                    />
                  </View>
                  <Txt style={{ flex: 1 }}>{category?.name}</Txt>
                  <Txt size={11} color={t.muted}>
                    {amount > 0 && positiveTotal
                      ? `${Math.round((amount * 100) / positiveTotal)}%`
                      : "—"}
                  </Txt>
                  <Txt bold>{formatMoney(amount)}</Txt>
                </Row>
                <View
                  style={{
                    height: 4,
                    backgroundColor: t.line,
                    borderRadius: 2,
                    marginLeft: 44,
                  }}
                >
                  <View
                    style={{
                      height: 4,
                      width: `${positiveTotal ? (Math.max(0, amount) * 100) / positiveTotal : 0}%`,
                      backgroundColor: category?.color,
                      borderRadius: 2,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
      {kind === "expense" && categories.some((c) => c.amount < 0) && (
        <Txt size={11} color={t.muted}>
          {zh.refundChartHint}
        </Txt>
      )}
    </Page>
  );
}
