import { MemberShare } from "../../components/MemberShare";
import { BudgetCard } from "../../components/BudgetCard";
import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useLedger } from "../../components/LedgerProvider";
import {
  Button,
  Chip,
  ErrorText,
  Card,
  Heading,
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
import type { Txn } from "../../domain/types";

function TransactionRow({
  txn,
  selecting,
  selected,
  onToggle,
  onSelect,
}: {
  txn: Txn;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
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
      key={selecting ? "select" : "swipe"}
      disabled={selecting}
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
          accessibilityRole={selecting ? "checkbox" : "button"}
          accessibilityState={selecting ? { checked: selected } : undefined}
          accessibilityLabel={`${title} ${formatMoney(txn.amount)}`}
          onPress={selecting ? onToggle : open}
          onLongPress={onSelect}
          style={({ pressed }) => ({
            paddingVertical: 16,
            backgroundColor: pressed ? t.soft : "transparent",
          })}
        >
          <Row>
            {selecting && (
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: selected ? t.blue : t.line,
                  backgroundColor: selected ? t.blue : t.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selected && <Txt color="#fff">✓</Txt>}
              </View>
            )}
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
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const month = useUi((s) => s.month);
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setSelected([]);
    setSelecting(false);
    setError("");
  }, [month, query]);
  const exitSelection = () => {
    setSelecting(false);
    setSelected([]);
    setError("");
  };
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  const removeSelected = () =>
    confirmAction(
      zh.batchDeleteTitle(selected.length),
      zh.deleteEntryHint,
      () => {
        try {
          run(() => repo.deleteTxns(selected));
          exitSelection();
        } catch (e) {
          setError((e as Error).message);
        }
      },
    );
  const monthTxns = visibleTxns(data.txns).filter((txn) =>
    txn.occurredAt.startsWith(month),
  );
  const summary = totals(monthTxns);
  const filtered = monthTxns.filter((txn) => {
    const category = data.categories.find((c) => c.id === txn.categoryId);
    const account = data.accounts.find((a) => a.id === txn.accountId);
    return `${txn.note} ${category?.name ?? ""} ${account?.name ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });
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
    <Page>
      <Heading
        title={zh.family}
        subtitle={zh.tagline}
        action={
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              backgroundColor: t.soft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="book.closed.fill" color={t.blue} />
          </View>
        }
      />
      <MonthPicker />
      <BudgetCard key={month} month={month} />
      <MemberShare month={month} />
      <View
        style={{
          borderRadius: 24,
          borderCurve: "continuous",
          backgroundColor: t.card,
          padding: 24,
          gap: 18,
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <Txt size={12} color={t.blue}>
            {zh.monthExpense}
          </Txt>
          <Row style={{ gap: 5 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: t.muted,
              }}
            />
            <Txt size={10} color={t.muted}>
              {zh.localOnly}
            </Txt>
          </Row>
        </Row>
        <Txt size={39} bold style={{ letterSpacing: -1 }}>
          {formatMoney(summary.expense)}
        </Txt>
        <View style={{ height: 1, backgroundColor: t.line }} />
        <Row>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={11} color={t.muted}>
              {zh.monthIncome}
            </Txt>
            <Txt size={19} bold>
              {formatMoney(summary.income)}
            </Txt>
          </View>
          <View
            style={{
              width: 1,
              height: 34,
              backgroundColor: t.line,
            }}
          />
          <View style={{ flex: 1, gap: 4, paddingLeft: 16 }}>
            <Txt size={11} color={t.muted}>
              {zh.balance}
            </Txt>
            <Txt size={19} bold>
              {formatMoney(summary.balance)}
            </Txt>
          </View>
        </Row>
      </View>
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
          style={{ flex: 1, paddingVertical: 13, color: t.text, fontSize: 13 }}
        />
        {!!query && (
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => setQuery("")}
          />
        )}
      </Row>
      {selecting ? (
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold>{zh.selectedEntries(selected.length)}</Txt>
            <Chip label={zh.cancel} onPress={exitSelection} />
          </Row>
          <Row style={{ flexWrap: "wrap" }}>
            <Chip
              label={zh.selectAll}
              onPress={() => setSelected(filtered.map((x) => x.id))}
            />
            <Chip label={zh.clearSelection} onPress={() => setSelected([])} />
            {!!selected.length && (
              <Button
                secondary
                label={zh.batchDelete}
                onPress={removeSelected}
              />
            )}
          </Row>
          <ErrorText message={error} />
        </Card>
      ) : (
        <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <Txt size={11} color={t.muted}>
            {zh.gestureHint}
          </Txt>
          <Chip label={zh.selectEntries} onPress={() => setSelecting(true)} />
        </Row>
      )}
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
            {query ? zh.noResults : zh.noTransactions}
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
                    <TransactionRow
                      txn={txn}
                      selecting={selecting}
                      selected={selected.includes(txn.id)}
                      onToggle={() => toggle(txn.id)}
                      onSelect={() => {
                        setSelecting(true);
                        setSelected((ids) =>
                          ids.includes(txn.id) ? ids : [...ids, txn.id],
                        );
                      }}
                    />
                  </View>
                ))}
              </Card>
            </View>
          );
        })
      )}
      <Row style={{ justifyContent: "center", gap: 6 }}>
        <Icon name="cloud" size={14} color={t.muted} />
        <Txt size={10} color={t.muted}>
          {zh.syncNotConfigured}
        </Txt>
      </Row>
    </Page>
  );
}
