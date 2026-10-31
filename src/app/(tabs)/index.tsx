import {
  transferAccountName,
  transferDirection,
} from "../../domain/privacyTransfer";
import { TxnMetadata } from "../../components/TxnMetadata";
import { MonthlySummaryCard } from "../../components/MonthlySummaryCard";
import { Popover } from "../../components/HelpBubble";
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
import { totals } from "../../domain/selectors";
import { formatMoney } from "../../domain/money";
import { today } from "../../domain/date";
import { zh } from "../../i18n/zh";
import type { Txn, TxnType } from "../../domain/types";
import { financialRow, financialRowGroups } from "../../domain/financialRows";

function FinancialGroup({ name, txns }: { name: string; txns: Txn[] }) {
  const { data } = useLedger();
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const info = txns.map((txn) => financialRow(data, txn));
  const paid = info.reduce((sum, row) => sum + (row?.paid ?? 0), 0);
  const returned = info.reduce((sum, row) => sum + (row?.returned ?? 0), 0);
  const deposit = info.reduce(
    (sum, row) => sum + (row?.plan.kind === "deposit" ? row.paid : 0),
    0,
  );
  const prepaid = paid - deposit;
  const rental = info.some(
    (row) =>
      row?.label === "预付租金" ||
      row?.label === "房租分摊" ||
      row?.label === "租金退回",
  );
  const expense = totals(txns).expense;
  const cash = paid > 0 || returned > 0;
  const amount = cash ? paid - returned : expense;
  const title = paid
    ? rental
      ? "交租"
      : "预付费用"
    : returned
      ? "退款到账"
      : rental
        ? "房租分摊"
        : "费用分摊";
  const detail =
    paid && !returned
      ? [
          prepaid
            ? `${rental ? "租金" : "预付"} ${formatMoney(prepaid, false)}`
            : "",
          deposit ? `押金 ${formatMoney(deposit, false)}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : returned
        ? `退回 ${formatMoney(returned, false)}${paid ? ` · 付出 ${formatMoney(paid, false)}` : ""}`
        : "本期费用分摊";
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}，${name}，${detail}，${expanded ? "收起" : "展开"}明细`}
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => ({
          paddingVertical: 10,
          backgroundColor: pressed ? t.soft : "transparent",
        })}
      >
        <Row>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: t.dark ? t.soft : "#A18ABE18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name={rental ? "house.fill" : "creditcard.fill"}
              color="#A18ABE"
              size={21}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Row style={{ justifyContent: "space-between", gap: 8 }}>
              <Txt size={16} bold>
                {title}
              </Txt>
              <Txt size={17} bold color={amount < 0 ? t.green : t.text}>
                {amount < 0 ? "+" : amount > 0 ? "−" : ""}
                {formatMoney(Math.abs(amount), false)}
              </Txt>
            </Row>
            <Txt size={12} color={t.muted}>
              {detail}
            </Txt>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt size={11} color={t.muted}>
                {name}
                {cash ? " · 实际收付" : ""}
              </Txt>
              <Icon
                name={expanded ? "chevron.up" : "chevron.down"}
                size={12}
                color={t.muted}
              />
            </Row>
          </View>
        </Row>
      </Pressable>
      {expanded && (
        <View style={{ borderTopWidth: 1, borderColor: t.line, paddingTop: 8 }}>
          <Txt size={12} color={t.muted}>
            本日计入支出 {formatMoney(expense)}；以下分摊不重复扣款。
          </Txt>
          {txns.map((txn) => (
            <TransactionRow key={txn.id} txn={txn} />
          ))}
        </View>
      )}
    </View>
  );
}

function TransactionRow({ txn }: { txn: Txn }) {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const category = data.categories.find((c) => c.id === txn.categoryId);
  const account = data.accounts.find((a) => a.id === txn.accountId);
  const financial = financialRow(data, txn);
  const title = financial
    ? financial.label
    : txn.type === "refund"
      ? `${zh.refund} · ${category?.name ?? ""}`
      : txn.type === "transfer"
        ? transferDirection(data, txn)
        : (category?.name ?? zh[txn.type]);
  const income =
    txn.type === "income" || txn.type === "refund" || txn.type === "scope_in";
  const transfer = txn.type === "transfer";
  const open = () =>
    financial
      ? router.push("/finance")
      : txn.type === "scope_in" || txn.type === "scope_out"
        ? router.push({ pathname: "/scope-transfer", params: { id: txn.id } })
        : router.push({
            pathname: txn.type === "refund" ? "/refund" : "/entry",
            params: { id: txn.id },
          });
  const canRefund = txn.type === "expense" && !financial;
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
            paddingVertical: 10,
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
                <Txt size={16} bold>
                  {title}
                </Txt>
              </Row>
              <Txt size={13} color={t.muted} style={{ flexShrink: 1 }}>
                {txn.type === "transfer"
                  ? transferAccountName(data, txn.accountId)
                  : account?.name}
                {account?.last4 ? ` · ${account.last4}` : ""}
                {txn.occurredTime ? ` · ${txn.occurredTime}` : ""}
                {txn.note ? ` · ${txn.note}` : ""}
                {transfer
                  ? ` → ${transferAccountName(data, txn.toAccountId)}`
                  : ""}
              </Txt>
              {financial?.hint ? (
                <Txt size={11} color={t.muted}>
                  {financial.hint}
                </Txt>
              ) : (
                <TxnMetadata data={data} txn={txn} />
              )}
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
  const { data } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const month = useUi((s) => s.month);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<TxnType[]>([]);
  const filtered = filterMonthTransactions(data, month, types, query);
  const me = data.members.find((m) => m.id === data.meId);
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
      <MonthlySummaryCard month={month} />
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
              <Card
                style={{ paddingVertical: 0, paddingHorizontal: 17, gap: 0 }}
              >
                {financialRowGroups(data, group.txns).map((row, i) => (
                  <View
                    key={row.id}
                    style={{ borderTopWidth: i ? 1 : 0, borderColor: t.line }}
                  >
                    {row.txns.length > 1 ? (
                      <FinancialGroup name={row.name} txns={row.txns} />
                    ) : (
                      <TransactionRow txn={row.txns[0]!} />
                    )}
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
