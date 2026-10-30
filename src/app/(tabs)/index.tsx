import { BudgetCard } from "../../components/BudgetCard";
import { HelpBubble, Popover } from "../../components/HelpBubble";
import { detailBudget, monthDailyMetrics } from "../../domain/budgets";
import { filterMonthTransactions } from "../../domain/transactionFilters";
import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useLedger } from "../../components/LedgerProvider";
import {
  Button,
  Chip,
  Card,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
  blue,
  coral,
  confirmAction,
} from "../../components/ui";
import { SwipeActions } from "../../components/SwipeActions";
import { MonthPicker } from "../../components/MonthPicker";
import { useUi } from "../../state/ui";
import { totals, visibleTxns } from "../../domain/selectors";
import { formatMoney } from "../../domain/money";
import { today } from "../../domain/date";
import { zh } from "../../i18n/zh";
import type { Txn, TxnType } from "../../domain/types";

function TransactionRow({ txn }: { txn: Txn }) {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const category = data.categories.find((c) => c.id === txn.categoryId);
  const account = data.accounts.find((a) => a.id === txn.accountId);
  const member = data.members.find((m) => m.id === txn.recorderMemberId);
  const title =
    txn.type === "refund"
      ? `${zh.refund} · ${category?.name ?? ""}`
      : (category?.name ?? zh[txn.type]);
  const income =
    txn.type === "income" || txn.type === "refund" || txn.type === "scope_in";
  const transfer = txn.type === "transfer";
  const open = () =>
    txn.type === "scope_in" || txn.type === "scope_out"
      ? router.push({ pathname: "/scope-transfer", params: { id: txn.id } })
      : router.push({
          pathname: txn.type === "refund" ? "/refund" : "/entry",
          params: { id: txn.id },
        });
  const canRefund = txn.type === "expense";
  return (
    <SwipeActions
      startActions={
        canRefund ? (
          <Button
            secondary
            label={zh.refund}
            onPress={() =>
              router.push({ pathname: "/refund", params: { sourceId: txn.id } })
            }
          />
        ) : undefined
      }
      actions={
        <Row style={{ justifyContent: "flex-end" }}>
          <IconButton
            name="trash"
            color={coral}
            label={zh.remove}
            onPress={() =>
              confirmAction(zh.deleteEntry, zh.deleteEntryHint, () => {
                try {
                  run(() => repo.deleteTxn(txn.id));
                } catch (e) {
                  setNotice((e as Error).message);
                }
              })
            }
          />
        </Row>
      }
    >
      <View style={{ backgroundColor: t.card }}>
        {!!notice && (
          <Txt size={11} color={t.blue}>
            {notice}
          </Txt>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} ${formatMoney(txn.amount)}`}
          onPress={open}
          style={({ pressed }) => ({
            paddingVertical: 16,
            backgroundColor: pressed ? t.soft : "transparent",
          })}
        >
          <Row>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: t.dark
                  ? t.soft
                  : `${category?.color ?? blue}18`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name={category?.icon ?? "arrow.left.arrow.right"}
                color={category?.color ?? blue}
                size={21}
              />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Row style={{ gap: 7 }}>
                <Txt bold>{title}</Txt>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: member?.color ?? blue,
                  }}
                />
              </Row>
              <Txt size={11} color={t.muted} style={{ flexShrink: 1 }}>
                {account?.name}
                {account?.last4 ? ` · ${account.last4}` : ""}
                {txn.occurredTime ? ` · ${txn.occurredTime}` : ""}
                {txn.note ? ` · ${txn.note}` : ""}
                {transfer
                  ? ` → ${data.accounts.find((a) => a.id === txn.toAccountId)?.name ?? ""}`
                  : ""}
              </Txt>
              {!!txn.refundIncome && (
                <Txt size={11} color={t.green}>
                  {zh.refundOffset} {formatMoney(txn.amount - txn.refundIncome)}{" "}
                  · {zh.income} {formatMoney(txn.refundIncome)}
                </Txt>
              )}
            </View>
            <Txt
              size={17}
              bold
              color={income ? t.green : transfer ? t.muted : t.text}
            >
              {income ? "+" : transfer ? "" : "−"}
              {formatMoney(txn.amount, false)}
            </Txt>
          </Row>
        </Pressable>
      </View>
    </SwipeActions>
  );
}
export default function Details() {
  const { data, repo } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const month = useUi((s) => s.month);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<TxnType[]>([]);
  const monthTxns = visibleTxns(data.txns).filter((txn) =>
    txn.occurredAt.startsWith(month),
  );
  const summary = totals(monthTxns);
  const filtered = filterMonthTransactions(data, month, types, query);
  const metrics = monthDailyMetrics(
    month,
    summary.expense,
    repo.monthBudget(month),
  );
  const budgetDisplay = detailBudget(
    data.txns,
    data.categories,
    month,
    repo.monthBudget(month),
    repo.monthAllocations(month),
    repo.getDetailBudgetPreferences(),
  );
  const budgetMetrics = monthDailyMetrics(
    month,
    budgetDisplay.expense,
    budgetDisplay.budget,
  );
  const me = data.members.find((m) => m.id === data.meId);
  const openStats = (view: "expense" | "income" | "balance") => {
    useUi.getState().openStats(view);
    router.push("/(tabs)/stats");
  };
  const groups = useMemo(
    () =>
      Array.from(new Set(filtered.map((txn) => txn.occurredAt))).map(
        (date) => ({
          date,
          txns: filtered.filter((txn) => txn.occurredAt === date),
        }),
      ),
    [filtered],
  );
  return (
    <Page
      searchActive={!!query}
      revealSearch={
        <Row
          style={{
            backgroundColor: t.card,
            borderRadius: 13,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: t.line,
          }}
        >
          <Icon name="magnifyingglass" size={17} color={t.muted} />
          <TextInput
            accessibilityLabel={zh.search}
            placeholder={zh.search}
            placeholderTextColor={t.muted}
            value={query}
            onChangeText={setQuery}
            style={{
              flex: 1,
              paddingVertical: 13,
              color: t.text,
              fontSize: 13,
            }}
          />
          {!!query && (
            <IconButton
              name="xmark"
              label={zh.close}
              onPress={() => setQuery("")}
            />
          )}
        </Row>
      }
    >
      <Row style={{ justifyContent: "space-between" }}>
        <View style={{ gap: 3, flex: 1 }}>
          <Txt size={13} bold color={t.muted}>
            {zh.family}
          </Txt>
          <Txt size={13} color={t.muted}>
            {today().replaceAll("-", " / ")}
          </Txt>
        </View>
        <Popover label="筛选交易" active={types.length > 0}>
          {(close) => (
            <>
              <Txt size={17} bold>
                交易类型
              </Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["income", "expense", "transfer", "refund"] as const).map(
                  (type) => (
                    <Chip
                      key={type}
                      label={zh[type]}
                      selected={types.includes(type)}
                      onPress={() =>
                        setTypes((current) =>
                          current.includes(type)
                            ? current.filter((x) => x !== type)
                            : [...current, type],
                        )
                      }
                    />
                  ),
                )}
              </View>
              <Txt size={13} color={t.muted}>
                {types.length
                  ? `当前：${types.map((type) => zh[type]).join("、")}`
                  : "当前：全部类型"}
              </Txt>
              {!!types.length && (
                <Button
                  secondary
                  label="重置类型筛选"
                  onPress={() => setTypes([])}
                />
              )}
              <Button label="完成" onPress={close} />
            </>
          )}
        </Popover>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="进入我的"
          onPress={() => router.push("/(tabs)/me")}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: t.soft,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Txt bold size={19} color={t.blue}>
            {me?.name.slice(0, 1) || "我"}
          </Txt>
        </Pressable>
      </Row>
      <MonthPicker />
      <View
        style={{
          borderRadius: 24,
          borderCurve: "continuous",
          backgroundColor: t.card,
          padding: 24,
          gap: 18,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看支出统计"
          onPress={() => openStats("expense")}
          style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.6 : 1 })}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <Txt size={14} color={t.blue}>
              {zh.monthExpense}
            </Txt>
            <Icon name="chevron.right" size={14} color={t.muted} />
          </Row>
          <Txt size={39} bold style={{ letterSpacing: -1 }}>
            {formatMoney(summary.expense)}
          </Txt>
        </Pressable>
        <View style={{ height: 1, backgroundColor: t.line }} />
        <Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看收入统计"
            onPress={() => openStats("income")}
            style={({ pressed }) => ({
              flex: 1,
              gap: 4,
              minHeight: 52,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Txt size={13} color={t.muted}>
              {zh.monthIncome}
            </Txt>
            <Txt size={19} bold>
              {formatMoney(summary.income)}
            </Txt>
          </Pressable>
          <View
            style={{
              width: 1,
              height: 34,
              backgroundColor: t.line,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看结余统计"
            onPress={() => openStats("balance")}
            style={({ pressed }) => ({
              flex: 1,
              gap: 4,
              paddingLeft: 16,
              minHeight: 52,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Txt size={13} color={t.muted}>
              {zh.balance}
            </Txt>
            <Txt size={19} bold>
              {formatMoney(summary.balance)}
            </Txt>
          </Pressable>
        </Row>
        <View style={{ height: 1, backgroundColor: t.line }} />
        <Row style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <View style={{ flex: 1, minWidth: 120, gap: 4 }}>
            <Row style={{ gap: 0 }}>
              <Txt size={12} color={t.muted}>
                日均支出
              </Txt>
              <HelpBubble label="日均支出">
                当月支出除以已过天数（含今天）；历史月份按全月天数计算，未来月份暂不计算。退款抵减支出，还款本金与本人账户间转账不计入。
              </HelpBubble>
            </Row>
            <Txt size={18} bold>
              {metrics.dailyExpense === null
                ? "—"
                : formatMoney(metrics.dailyExpense)}
            </Txt>
          </View>
          <View style={{ flex: 1, minWidth: 120, gap: 4 }}>
            <Row style={{ gap: 0 }}>
              <Txt size={12} color={t.muted}>
                预算日均剩余
              </Txt>
              <HelpBubble label="预算日均剩余">
                按明细预算所选分类计算剩余预算，再除以本月剩余天数（含今天）。未来月份按全月天数计算；历史月份显示已结束；未设置预算时不计算。负数表示已经超支。
              </HelpBubble>
            </Row>
            <Txt
              size={18}
              bold
              color={(budgetMetrics.dailyRemaining ?? 0) < 0 ? coral : t.text}
            >
              {!budgetMetrics.remaining
                ? "已结束"
                : budgetMetrics.dailyRemaining === null
                  ? "未设置"
                  : formatMoney(budgetMetrics.dailyRemaining)}
            </Txt>
          </View>
        </Row>
        <View style={{ height: 1, backgroundColor: t.line }} />
        <BudgetCard key={month} month={month} embedded />
      </View>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt size={20} bold>
          本月明细
        </Txt>
        {!!types.length && (
          <Txt size={12} color={t.blue}>
            {types.length} 种类型 · {filtered.length} 笔
          </Txt>
        )}
      </Row>
      {groups.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
          <View
            style={{
              width: 66,
              height: 66,
              backgroundColor: t.soft,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 6,
            }}
          >
            <Icon name="book.fill" size={30} color={t.blue} />
          </View>
          <Txt size={18} bold>
            {query || types.length ? zh.noResults : zh.noTransactions}
          </Txt>
          <Txt size={12} color={t.muted}>
            {zh.noTransactionsHint}
          </Txt>
          <View style={{ marginTop: 10 }}>
            <Button
              label={zh.firstEntry}
              onPress={() => router.push("/entry")}
              icon="plus"
            />
          </View>
        </Card>
      ) : (
        groups.map((group) => {
          const daily = totals(group.txns);
          return (
            <View key={group.date} style={{ gap: 10 }}>
              <Row
                style={{
                  justifyContent: "space-between",
                  paddingHorizontal: 3,
                }}
              >
                <Txt size={12} color={t.muted}>
                  {group.date === today()
                    ? zh.today
                    : group.date.slice(5).replace("-", " / ")}
                </Txt>
                <Txt size={11} color={t.muted}>
                  {zh.expense} {formatMoney(daily.expense, false)}　{zh.income}{" "}
                  {formatMoney(daily.income, false)}
                </Txt>
              </Row>
              <Card style={{ paddingVertical: 0, paddingHorizontal: 17 }}>
                {group.txns.map((txn, i) => (
                  <View
                    key={txn.id}
                    style={{ borderTopWidth: i ? 1 : 0, borderColor: t.line }}
                  >
                    <TransactionRow txn={txn} />
                  </View>
                ))}
              </Card>
            </View>
          );
        })
      )}
    </Page>
  );
}
