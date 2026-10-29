import { ExportCard } from "../../components/ExportCard";
import { BudgetCard } from "../../components/BudgetCard";
import { IncomeCalendar } from "../../components/IncomeCalendar";
import { today } from "../../domain/date";
import {
  reportingSnapshot,
  reportRange,
  previousRange,
  rangeTxns,
  categoryReport,
  rangeDays,
  averageExpense,
  type RangeMode,
} from "../../domain/reports";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useLedger } from "../../components/LedgerProvider";
import {
  Button,
  Field,
  ErrorText,
  styles,
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
import { totals } from "../../domain/selectors";
import { formatMoney } from "../../domain/money";
import { zh } from "../../i18n/zh";
export default function Stats() {
  const { data } = useLedger();
  const t = useTheme();
  const [memberId, setMemberId] = useState("");
  const [includeRepayments, setIncludeRepayments] = useState(false);
  const reportData = reportingSnapshot(data, memberId, includeRepayments);
  const month = useUi((s) => s.month);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [mode, setMode] = useState<RangeMode>("month");
  const [level, setLevel] = useState<"root" | "leaf">("root");
  const [anchor, setAnchor] = useState(today());
  const [anchorInput, setAnchorInput] = useState(today());
  const [start, setStart] = useState(month + "-01");
  const [end, setEnd] = useState(reportRange("month", month + "-01", []).end);
  const [custom, setCustom] = useState(reportRange("month", month + "-01", []));
  const [error, setError] = useState("");
  const range = reportRange(
    mode,
    mode === "month" ? month + "-01" : anchor,
    data.txns,
    custom,
  );
  const previous = previousRange(mode, range);
  const rows = rangeTxns(reportData.txns, range);
  const summary = totals(rows);
  const prior = previous ? totals(rangeTxns(reportData.txns, previous)) : null;
  const categories = categoryReport(reportData, range, kind, level);
  const previousCategories = new Map(
    previous
      ? categoryReport(reportData, previous, kind, level).map((c) => [
          c.id,
          c.amount,
        ])
      : [],
  );
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
      <View style={styles.wrap}>
        <Chip
          label={zh.memberAll}
          selected={!memberId}
          onPress={() => setMemberId("")}
        />
        {data.members
          .filter((m) => !m.deleted)
          .map((m) => (
            <Chip
              key={m.id}
              label={m.name}
              selected={memberId === m.id}
              onPress={() => setMemberId(m.id)}
            />
          ))}
      </View>
      <Chip
        label={zh.includeRepayments}
        selected={includeRepayments}
        onPress={() => setIncludeRepayments(!includeRepayments)}
      />
      <Txt size={11} color={t.muted}>
        {zh.reportScopeHint}
      </Txt>
      <View style={styles.wrap}>
        {(["week", "month", "year", "all", "custom"] as const).map((m) => (
          <Chip
            key={m}
            label={zh.reports[m]}
            selected={mode === m}
            onPress={() => {
              setMode(m);
              setError("");
            }}
          />
        ))}
      </View>
      {mode === "month" && <MonthPicker />}
      {(mode === "week" || mode === "year") && (
        <Field
          label={zh.reports.anchor}
          value={anchorInput}
          onChangeText={setAnchorInput}
        />
      )}
      {mode === "custom" && (
        <>
          <Field
            label={zh.reports.start}
            value={start}
            onChangeText={setStart}
          />
          <Field label={zh.reports.end} value={end} onChangeText={setEnd} />
        </>
      )}
      {["week", "year", "custom"].includes(mode) && (
        <Button
          secondary
          label={zh.reports.apply}
          onPress={() => {
            try {
              reportRange(mode, anchorInput, data.txns, { start, end });
              if (mode === "custom") setCustom({ start, end });
              else setAnchor(anchorInput);
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      <ErrorText message={error} />
      <Txt size={12} color={t.muted}>
        {range.start} — {range.end} · {rangeDays(range)} {zh.reports.days}
      </Txt>
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
      <Card>
        <Txt>
          {zh.reports.average} ·{" "}
          {formatMoney(averageExpense(summary.expense, rangeDays(range)))}
        </Txt>
        {prior && (
          <Txt>
            {zh.reports.previous} {zh.expense} {formatMoney(prior.expense)} ·{" "}
            {zh.reports.change} {formatMoney(summary.expense - prior.expense)}
          </Txt>
        )}
        <Txt size={11} color={t.muted}>
          {zh.reports.dailyHint}
        </Txt>
      </Card>
      {mode === "month" && (
        <>
          <BudgetCard key={month} month={month} editable />
          <IncomeCalendar
            key={"calendar" + month}
            month={month}
            txns={reportData.txns}
          />
        </>
      )}
      <View style={styles.wrap}>
        {(["root", "leaf"] as const).map((l) => (
          <Chip
            key={l}
            label={zh.reports[l]}
            selected={level === l}
            onPress={() => setLevel(l)}
          />
        ))}
      </View>
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
                  <View>
                    <Txt bold>{formatMoney(amount)}</Txt>
                    {previous && (
                      <Txt size={10} color={t.muted}>
                        {zh.reports.change}{" "}
                        {formatMoney(
                          amount -
                            (previousCategories.get(category?.id ?? "") ?? 0),
                        )}
                      </Txt>
                    )}
                  </View>
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
      <ExportCard range={range} />
    </Page>
  );
}
