import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useLedger } from "../../components/LedgerProvider";
import {
  Button,
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
import { MonthPicker } from "../../components/MonthPicker";
import { useUi } from "../../state/ui";
import { totals, visibleTxns } from "../../domain/selectors";
import { formatMoney } from "../../domain/money";
import { today } from "../../domain/date";
import { zh } from "../../i18n/zh";
import type { Txn } from "../../domain/types";

function TransactionRow({ txn }: { txn: Txn }) {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const [actions, setActions] = useState(false);
  const [notice, setNotice] = useState("");
  const gesture = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 25 && Math.abs(g.dy) < 15,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -45) setActions(true);
        if (g.dx > 45) setActions(false);
      },
    }),
  ).current;
  const category = data.categories.find((c) => c.id === txn.categoryId);
  const account = data.accounts.find((a) => a.id === txn.accountId);
  const member = data.members.find((m) => m.id === txn.recorderMemberId);
  const title = category?.name ?? zh[txn.type];
  const income = txn.type === "income";
  const transfer = txn.type === "transfer";
  const favorite = () => {
    if (!category) return;
    try {
      run(() =>
        repo.saveFavorite({
          categoryId: category.id,
          label: txn.note || title,
          accountId: txn.accountId,
          amount: txn.amount,
          note: txn.note,
        }),
      );
      setNotice(zh.favoriteSaved);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  return (
    <View {...gesture.panHandlers}>
      {!!notice && (
        <Txt size={11} color={t.blue}>
          {notice}
        </Txt>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ${formatMoney(txn.amount)}`}
        onPress={() =>
          router.push({ pathname: "/entry", params: { id: txn.id } })
        }
        onLongPress={favorite}
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
              backgroundColor: t.dark ? t.soft : `${category?.color ?? blue}18`,
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
      {actions && (
        <Row style={{ justifyContent: "flex-end", paddingBottom: 12 }}>
          <IconButton
            name="pencil"
            label={zh.edit}
            onPress={() =>
              router.push({ pathname: "/entry", params: { id: txn.id } })
            }
          />
          <IconButton
            name="trash"
            color={coral}
            label={zh.remove}
            onPress={() =>
              confirmAction(zh.deleteEntry, zh.deleteEntryHint, () =>
                run(() => repo.deleteTxn(txn.id)),
              )
            }
          />
        </Row>
      )}
    </View>
  );
}
export default function Details() {
  const { data } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const month = useUi((s) => s.month);
  const [query, setQuery] = useState("");
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
      <View
        style={{
          borderRadius: 25,
          backgroundColor: t.dark ? "#29364D" : "#EAF0FA",
          padding: 25,
          gap: 18,
          borderWidth: 1,
          borderColor: t.dark ? "#34445F" : "#E0E8F6",
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
        <View
          style={{ height: 1, backgroundColor: t.dark ? "#3C4860" : "#D9E2F2" }}
        />
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
              backgroundColor: t.dark ? "#3C4860" : "#D9E2F2",
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
                    <TransactionRow txn={txn} />
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
