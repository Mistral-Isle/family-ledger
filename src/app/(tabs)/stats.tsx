import { DateField } from "../../components/DateField";
import { MonthField } from "../../components/MonthField";
import { PeriodNavigation } from "../../components/PeriodNavigation";
import { Segmented } from "../../components/Segmented";
import { CategoryBreakdown } from "../../components/CategoryBreakdown";
import { ExportCard } from "../../components/ExportCard";
import { HelpBubble, Popover } from "../../components/HelpBubble";
import { IncomeCalendar } from "../../components/IncomeCalendar";
import { today } from "../../domain/date";
import {
  reportingSnapshot,
  addDays,
  reportRange,
  previousRange,
  rangeTxns,
  rangeDays,
  averageExpense,
  type RangeMode,
} from "../../domain/reports";
import { useEffect, useState } from "react";
import { View, Platform, Switch } from "react-native";

import { useLedger } from "../../components/LedgerProvider";
import {
  Button,
  ErrorText,
  styles,
  Card,
  Chip,
  Heading,
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
  const { data, repo } = useLedger();
  const t = useTheme();

  const [memberId, setMemberId] = useState("");
  const [includeRepayments, setIncludeRepayments] = useState(() =>
    repo.getIncludeRepayments(),
  );
  const [scopeOpen, setScopeOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(() =>
    repo.getShowIncomeCalendar(),
  );
  const reportData = reportingSnapshot(
    data,
    memberId,
    includeRepayments,
    "payer",
  );
  const month = useUi((s) => s.month);
  const { statsView, statsRequest } = useUi();
  const [view, setView] = useState<"expense" | "income" | "balance">(statsView);
  const kind = view === "income" ? "income" : "expense";
  const [mode, setMode] = useState<RangeMode>("month");

  const [anchor, setAnchor] = useState(today());
  const [start, setStart] = useState(month + "-01");
  const [end, setEnd] = useState(reportRange("month", month + "-01", []).end);
  const [custom, setCustom] = useState(reportRange("month", month + "-01", []));
  const [error, setError] = useState("");
  useEffect(() => {
    setView(statsView);
    setMode("month");

    setMemberId("");
  }, [statsView, statsRequest]);
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
  const actual = totals(
    rangeTxns(reportingSnapshot(data, memberId, false, "payer").txns, range),
  );
  const value = summary[view];
  const period = mode === "month" ? "本月" : "本期";
  const title =
    period +
    (view === "expense"
      ? includeRepayments
        ? "流出"
        : "支出"
      : view === "income"
        ? "收入"
        : "结余");
  return (
    <Page key={statsRequest}>
      <Heading
        title={zh.tabs.stats}
        action={
          <Row style={{ gap: 8, flexShrink: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Popover
              label="选择统计成员"
              triggerText={
                data.members.find((m) => m.id === memberId)?.name ?? "全部成员"
              }
              compact
            >
              <View style={styles.wrap}>
                <Chip
                  label={zh.collaboration.allPayers}
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
            </Popover>
            <Popover label="统计显示设置" triggerText="显示设置" compact>
              <Txt bold size={18}>
                显示设置
              </Txt>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt>显示收支日历</Txt>
                <Switch
                  accessibilityLabel="显示收支日历"
                  value={showCalendar}
                  trackColor={{ true: t.blue }}
                  thumbColor={Platform.OS === "web" ? "#FFFFFF" : undefined}
                  ios_backgroundColor={t.line}
                  onValueChange={(next) => {
                    try {
                      repo.setShowIncomeCalendar(next);
                      setShowCalendar(next);
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </Row>
              <Txt size={12} color={t.muted}>
                日历仅在按月查看时显示。选择会自动保存。
              </Txt>
            </Popover>
            <HelpBubble label="统计范围">{zh.reportScopeHint}</HelpBubble>
          </Row>
        }
      />
      <Segmented
        value={mode}
        options={[
          { value: "week", label: "周" },
          { value: "month", label: "月" },
          { value: "year", label: "年" },
          { value: "all", label: "全部" },
          { value: "custom", label: "范围" },
        ]}
        onChange={(next) => {
          if (mode === "month")
            setAnchor(month === today().slice(0, 7) ? today() : month + "-01");
          if (next === "month" && (mode === "week" || mode === "year"))
            useUi.getState().setMonth(anchor.slice(0, 7));
          setMode(next);
          setError("");
        }}
      />
      {mode === "month" && <MonthPicker />}
      {mode === "week" && (
        <PeriodNavigation
          previousLabel="上一周"
          nextLabel="下一周"
          onPrevious={() => setAnchor(addDays(anchor, -7))}
          onNext={() => setAnchor(addDays(anchor, 7))}
        >
          <Popover
            label="选择统计周"
            icon="calendar"
            disclosure
            triggerText={`${range.start.replaceAll("-", ".")} — ${range.end.slice(5).replace("-", ".")}`}
          >
            {(close) => (
              <>
                <Txt bold size={18}>
                  选择一周
                </Txt>
                <DateField
                  label="选择周内日期"
                  value={anchor}
                  onChange={(next) => {
                    try {
                      reportRange("week", next, []);
                      setAnchor(next);
                      setError("");
                      close();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
                <Button
                  secondary
                  label="回到本周"
                  onPress={() => {
                    setAnchor(today());
                    close();
                  }}
                />
              </>
            )}
          </Popover>
        </PeriodNavigation>
      )}
      {mode === "year" && (
        <PeriodNavigation
          previousLabel="上一年"
          nextLabel="下一年"
          onPrevious={() =>
            setAnchor(`${Number(anchor.slice(0, 4)) - 1}-01-01`)
          }
          onNext={() => setAnchor(`${Number(anchor.slice(0, 4)) + 1}-01-01`)}
        >
          <MonthField
            yearOnly
            compact
            label="选择统计年份"
            value={anchor.slice(0, 7)}
            onChange={(next) => setAnchor(next + "-01")}
          />
        </PeriodNavigation>
      )}
      {mode === "all" && (
        <View
          style={{
            alignItems: "center",
            minHeight: 44,
            justifyContent: "center",
            gap: 4,
          }}
        >
          <Txt bold>全部时间</Txt>
          <Txt size={12} color={t.muted}>
            {range.start} — {range.end}
          </Txt>
        </View>
      )}
      {mode === "custom" && (
        <View style={{ alignItems: "center" }}>
          <Popover
            label="选择统计范围"
            triggerText={`${range.start.replaceAll("-", ".")} — ${range.end.replaceAll("-", ".")}`}
          >
            {(close) => (
              <>
                <Txt bold size={18}>
                  自定义范围
                </Txt>
                <DateField
                  label={zh.reports.start}
                  value={start}
                  onChange={(next) => {
                    setStart(next);
                    setError("");
                  }}
                />
                <DateField
                  label={zh.reports.end}
                  value={end}
                  onChange={(next) => {
                    setEnd(next);
                    setError("");
                  }}
                />
                <ErrorText message={error} />
                <Button
                  label="应用范围"
                  onPress={() => {
                    try {
                      if (start > end)
                        throw new Error("开始日期不能晚于结束日期");
                      reportRange("custom", anchor, data.txns, { start, end });
                      setCustom({ start, end });
                      setError("");
                      close();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </>
            )}
          </Popover>
        </View>
      )}
      <ErrorText message={mode === "custom" ? "" : error} />
      <Segmented
        value={view}
        options={[
          { value: "expense", label: includeRepayments ? "流出" : "支出" },
          { value: "income", label: "收入" },
          { value: "balance", label: "结余" },
        ]}
        onChange={(next) => {
          setView(next);
        }}
      />
      <Card style={{ padding: 24, gap: 18 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt size={14} color={t.blue}>
            {title}
          </Txt>
          {view === "expense" && (
            <Popover label="支出统计选项">
              {!scopeOpen ? (
                <Button
                  secondary
                  label="统计口径"
                  onPress={() => setScopeOpen(true)}
                />
              ) : (
                <>
                  <Txt size={17} bold>
                    统计口径
                  </Txt>
                  <Row style={{ flexWrap: "wrap", gap: 0 }}>
                    <Txt>{zh.includeRepayments}</Txt>
                    <HelpBubble label="计入还款本金">
                      开启后，统计本月归还本金所付出的金额。此开关只影响统计展示，不改变实际账务；本人账户间转账始终不计入。
                    </HelpBubble>
                    <Switch
                      accessibilityLabel="计入还款本金"
                      value={includeRepayments}
                      trackColor={{ true: t.blue }}
                      onValueChange={(next) => {
                        try {
                          repo.setIncludeRepayments(next);
                          setIncludeRepayments(next);
                          setError("");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    />
                  </Row>
                </>
              )}
            </Popover>
          )}
          {view === "balance" && (
            <HelpBubble label="结余">
              结余等于收入减去当前统计口径下的支出或流出。计入还款本金时，结余会同步扣除本金；这不是净资产变化。
            </HelpBubble>
          )}
        </Row>
        <View style={{ gap: 6 }}>
          <Txt size={38} bold>
            {formatMoney(value)}
          </Txt>
          {includeRepayments && view !== "income" && (
            <Txt size={12} color={t.muted}>
              含还款本金
            </Txt>
          )}
        </View>
        <View style={{ height: 1, backgroundColor: t.line }} />
        <Row style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
          <View style={{ flex: 1, minWidth: 120, gap: 5 }}>
            <Txt size={12} color={t.muted}>
              上期
              {view === "income"
                ? "收入"
                : view === "balance"
                  ? "结余"
                  : includeRepayments
                    ? "流出"
                    : "支出"}
            </Txt>
            <Txt size={18} bold>
              {prior ? formatMoney(prior[view]) : "—"}
            </Txt>
          </View>
          <View style={{ flex: 1, minWidth: 120, gap: 5 }}>
            <Txt size={12} color={t.muted}>
              较上期变化
            </Txt>
            <Txt size={18} bold>
              {prior
                ? `${value > prior[view] ? "+" : ""}${formatMoney(value - prior[view])}`
                : "—"}
            </Txt>
          </View>
        </Row>
        <Row style={{ justifyContent: "space-between" }}>
          <Row style={{ gap: 0 }}>
            <Txt size={13} color={t.muted}>
              日均
              {view === "income"
                ? "收入"
                : view === "balance"
                  ? "结余"
                  : includeRepayments
                    ? "流出"
                    : "支出"}
            </Txt>
            <HelpBubble label="统计日均">
              统计金额除以所选完整区间的天数，便于比较不同区间；明细页的当月日均使用已过天数。
            </HelpBubble>
          </Row>
          <Txt bold>{formatMoney(averageExpense(value, rangeDays(range)))}</Txt>
        </Row>
      </Card>
      {view === "balance" && (
        <Card style={{ gap: 18 }}>
          <Txt size={18} bold>
            结余构成
          </Txt>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt color={t.muted}>收入</Txt>
            <Txt bold color={t.green}>
              {formatMoney(actual.income)}
            </Txt>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt color={t.muted}>支出（退款已抵减）</Txt>
            <Txt bold>{formatMoney(actual.expense)}</Txt>
          </Row>
          {includeRepayments && (
            <Row style={{ justifyContent: "space-between" }}>
              <Txt color={t.muted}>归还本金</Txt>
              <Txt bold>{formatMoney(summary.expense - actual.expense)}</Txt>
            </Row>
          )}
          <View style={{ height: 1, backgroundColor: t.line }} />
          <Row style={{ justifyContent: "space-between" }}>
            <Txt color={t.muted}>结余率</Txt>
            <Txt size={24} bold>
              {summary.income > 0
                ? `${Math.round((summary.balance / summary.income) * 100)}%`
                : "—"}
            </Txt>
          </Row>
        </Card>
      )}
      {mode === "month" && showCalendar && (
        <>
          <IncomeCalendar
            key={"calendar" + month}
            month={month}
            txns={reportData.txns}
            includeRepayments={includeRepayments}
          />
        </>
      )}
      {view !== "balance" && (
        <CategoryBreakdown
          key={`${kind}-${statsRequest}`}
          data={reportData}
          range={range}
          previous={previous}
          kind={kind}
          includeRepayments={includeRepayments}
        />
      )}
      <ExportCard range={range} />
    </Page>
  );
}
