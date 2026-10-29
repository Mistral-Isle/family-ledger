import { DateField } from "../../components/DateField";
import { Segmented } from "../../components/Segmented";
import { CategoryPicker } from "../../components/CategoryPicker";
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
import { View, Pressable } from "react-native";
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
  const [categoryId, setCategoryId] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
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
  const chartData = {
    ...reportData,
    txns: reportData.txns.filter(
      (txn) =>
        !categoryId ||
        txn.categoryId === categoryId ||
        data.categories.find((c) => c.id === txn.categoryId)?.parentId ===
          categoryId,
    ),
  };
  const allLeaves = categoryReport(chartData, range, kind, "leaf");
  const categories = categoryReport(chartData, range, kind, level);
  const previousCategories = new Map(
    previous
      ? categoryReport(chartData, previous, kind, level).map((c) => [
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
      <Heading title={zh.tabs.stats} />
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
        <DateField
          label={zh.reports.anchor}
          value={anchorInput}
          onChange={setAnchorInput}
        />
      )}
      {mode === "custom" && (
        <>
          <DateField
            label={zh.reports.start}
            value={start}
            onChange={setStart}
          />
          <DateField label={zh.reports.end} value={end} onChange={setEnd} />
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
      <Txt size={20} bold>
        分类占比
      </Txt>
      <Segmented
        value={kind}
        options={[
          { value: "expense", label: "支出" },
          { value: "income", label: "收入" },
        ]}
        onChange={(value) => {
          setKind(value);
          setCategoryId("");
          setExpanded([]);
        }}
      />
      <Segmented
        value={level}
        options={[
          { value: "root", label: "一级分类" },
          { value: "leaf", label: "二级分类" },
        ]}
        onChange={setLevel}
      />
      <CategoryPicker
        value={categoryId}
        onChange={setCategoryId}
        kind={kind}
        allowAll
        label="筛选分类"
      />
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`展开${category?.name ?? "分类"}`}
                    accessibilityState={{
                      expanded: expanded.includes(category?.id ?? ""),
                    }}
                    onPress={() => {
                      if (category && level === "root")
                        setExpanded(
                          expanded.includes(category.id)
                            ? expanded.filter((id) => id !== category.id)
                            : [...expanded, category.id],
                        );
                    }}
                    style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
                  >
                    <Txt>
                      {level === "leaf" && category?.parentId
                        ? data.categories.find(
                            (c) => c.id === category.parentId,
                          )?.name + " · "
                        : ""}
                      {category?.name}
                      {level === "root" ? " ›" : ""}
                    </Txt>
                  </Pressable>
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
                {level === "root" &&
                  expanded.includes(category?.id ?? "") &&
                  allLeaves
                    .filter(
                      (c) =>
                        c.category?.parentId === category?.id ||
                        c.id === category?.id,
                    )
                    .map((child) => (
                      <Row
                        key={child.id}
                        style={{ marginLeft: 44, paddingVertical: 8 }}
                      >
                        <Txt size={13} style={{ flex: 1 }}>
                          {child.id === category?.id
                            ? "未细分"
                            : child.category?.name}
                        </Txt>
                        <Txt size={13}>{formatMoney(child.amount)}</Txt>
                      </Row>
                    ))}
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
