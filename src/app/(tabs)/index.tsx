import { syncNow } from "../../services/syncRuntime";
import { loadSyncConfig } from "../../services/syncConfig";
import { useSyncStatus } from "../../state/sync";
import { SaveFavoriteSheet } from "../../components/SaveFavoriteSheet";
import { favoriteFromTransaction } from "../../domain/localShortcuts";
import {
  transferAccountName,
  transferDirection,
} from "../../domain/privacyTransfer";
import { TxnMetadata } from "../../components/TxnMetadata";
import { MonthlySummaryCard } from "../../components/MonthlySummaryCard";
import { Popover } from "../../components/HelpBubble";
import { detailViewSnapshot, filterMonthTransactions } from "../../domain/transactionFilters";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View, Switch } from "react-native";
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

const SelectionContext = createContext({
  active: false,
  ids: new Set<string>(),
  start: (_id: string) => {},
  toggle: (_id: string) => {},
});

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
  const [savingFavorite, setSavingFavorite] = useState(false);
  const canFavorite = !!favoriteFromTransaction(data, txn.id);
  const selection = useContext(SelectionContext);
  const category = data.categories.find((c) => c.id === txn.categoryId);
  const account = data.accounts.find((a) => a.id === txn.accountId);
  const financial = financialRow(data, txn);
  const title = financial
    ? financial.label
    : txn.type === "adjust"
      ? "余额调整"
      : txn.type === "refund"
        ? `${zh.refund} · ${category?.name ?? ""}`
        : txn.type === "transfer"
          ? transferDirection(data, txn)
          : (category?.name ?? zh[txn.type]);
  const income =
    txn.type === "income" ||
    txn.type === "refund" ||
    txn.type === "scope_in" ||
    (txn.type === "adjust" && txn.amount > 0);
  const transfer = txn.type === "transfer";
  const open = () =>
    financial
      ? router.push("/finance")
      : txn.type === "adjust"
        ? router.push({
            pathname: "/account-detail",
            params: { id: txn.accountId },
          })
        : txn.type === "scope_in" || txn.type === "scope_out"
          ? router.push({ pathname: "/scope-transfer", params: { id: txn.id } })
          : router.push({
              pathname: txn.type === "refund" ? "/refund" : "/entry",
              params: { id: txn.id },
            });
  const canRefund = txn.type === "expense" && !financial;
  const canSelect = !financial && txn.type !== "repayment";
  return (
    <>
      <SwipeActions
        disabled={selection.active || savingFavorite}
        actionWidth={canFavorite ? 154 : 64}
        startWidth={100}
        startActions={
          canRefund ? (
            <View style={{ paddingRight: 20 }}>
            <Button
              secondary
              label={zh.refund}
              onPress={() =>
                router.push({
                  pathname: "/refund",
                  params: { sourceId: txn.id },
                })
              }
            />
            </View>
          ) : undefined
        }
        actions={
          <Row style={{ justifyContent: "flex-end", gap: 4 }}>
            {canFavorite && (
              <Button
                secondary
                label="存为常用"
                onPress={() => setSavingFavorite(true)}
              />
            )}
            <IconButton
              name="trash"
              color={t.red}
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
            onPress={() =>
              selection.active ? canSelect && selection.toggle(txn.id) : open()
            }
            delayLongPress={450}
            onLongPress={canSelect ? () => selection.start(txn.id) : undefined}
            accessibilityHint={
              canSelect ? "长按多选，左滑存为常用或删除，右滑退款" : undefined
            }
            accessibilityState={{
              selected: selection.active && selection.ids.has(txn.id),
            }}
            style={({ pressed }) => ({
              paddingVertical: 10,
              backgroundColor: pressed ? t.soft : "transparent",
            })}
          >
            <Row>
              {selection.active && (
                <Icon
                  name={
                    selection.ids.has(txn.id)
                      ? "checkmark.circle.fill"
                      : "circle"
                  }
                  size={23}
                  color={canSelect ? t.blue : t.line}
                />
              )}

              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor:
                    txn.type === "income"
                      ? t.incomeIcon
                      : txn.type === "expense"
                        ? t.expenseIcon
                        : t.transferIcon,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={category?.icon ?? "arrow.left.arrow.right"}
                  color="#fff"
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
                    {zh.refundOffset}{" "}
                    {formatMoney(txn.amount - txn.refundIncome)} · {zh.income}{" "}
                    {formatMoney(txn.refundIncome)}
                  </Txt>
                )}
              </View>
              <Txt
                size={17}
                bold
                color={income ? t.green : transfer ? t.muted : t.text}
              >
                {income ? "+" : transfer ? "" : "−"}
                {formatMoney(Math.abs(txn.amount), false)}
              </Txt>
            </Row>
          </Pressable>
        </View>
      </SwipeActions>
      {savingFavorite && (
        <SaveFavoriteSheet
          txnId={txn.id}
          onClose={() => setSavingFavorite(false)}
          onSaved={() => {
            setSavingFavorite(false);
          }}
        />
      )}
    </>
  );
}
export default function Details() {
  const { data, repo, run, refresh } = useLedger();
  const syncStatus = useSyncStatus();
  const [manualSyncBusy, setManualSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  useEffect(() => {
    if (syncMessage !== "同步完成") return;
    const timeout = setTimeout(() => setSyncMessage(""), 2000);
    return () => clearTimeout(timeout);
  }, [syncMessage]);
  async function manualSync() {
    if (manualSyncBusy || syncStatus.busy) return;
    setManualSyncBusy(true); setSyncMessage("");
    try {
      if (!await loadSyncConfig()) { router.push("/sync"); return; }
      await syncNow(repo, refresh); setSyncMessage("同步完成");
    } catch (e) { setSyncMessage((e as Error).message); }
    finally { setManualSyncBusy(false); }
  }
  const t = useTheme();
  const router = useRouter();
  const month = useUi((s) => s.month);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<TxnType[]>([]);
  const [detailView, setDetailView] = useState(() => repo.getDetailView());
  const viewData = useMemo(() => detailViewSnapshot(data, detailView), [data, detailView]);
  const [hideFuture, setHideFuture] = useState(() =>
    repo.getHideFutureTransactions(),
  );
  const [now, setNow] = useState(() => new Date());
  const [filterError, setFilterError] = useState("");
  useEffect(() => {
    if (!hideFuture) return;
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, [hideFuture]);
  const filtered = filterMonthTransactions(
    viewData,
    month,
    types,
    query,
    hideFuture ? now : undefined,
  );
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const selectable = filtered.filter(
    (txn) => !financialRow(data, txn) && txn.type !== "repayment",
  );
  const chosen = selectable.filter((txn) => selection?.has(txn.id));
  const selectedTotals = totals(chosen);
  useEffect(() => {
    setSelection(null);
    setSelectionError("");
  }, [month, query, types, hideFuture, detailView]);
  useEffect(() => {
    useUi.setState({ selectingTransactions: selection !== null });
    return () => {
      useUi.setState({ selectingTransactions: false });
    };
  }, [selection !== null]);
  const selectionValue = {
    active: selection !== null,
    ids: selection ?? new Set<string>(),
    start: (id: string) => setSelection((current) => current ?? new Set([id])),
    toggle: (id: string) =>
      setSelection((current) => {
        const next = new Set(current ?? []);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };

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
    <SelectionContext.Provider value={selectionValue}>
      <Page
        footer={
          selection !== null ? (
            <>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt bold>已选 {chosen.length} 笔</Txt>
                <Txt size={12}>
                  支出 {formatMoney(selectedTotals.expense)} · 收入{" "}
                  {formatMoney(selectedTotals.income)}
                </Txt>
              </Row>
              {!!selectionError && (
                <Txt size={12} color={t.red}>
                  {selectionError}
                </Txt>
              )}
              <Row style={{ justifyContent: "space-between" }}>
                <Button
                  secondary
                  label={
                    chosen.length === selectable.length ? "取消全选" : "全选"
                  }
                  onPress={() =>
                    setSelection(
                      chosen.length === selectable.length
                        ? new Set()
                        : new Set(selectable.map((t) => t.id)),
                    )
                  }
                />
                <Button
                  secondary
                  label="退出多选"
                  onPress={() => {
                    setSelection(null);
                    setSelectionError("");
                  }}
                />
                <Button
                  label="删除所选"
                  disabled={!chosen.length}
                  onPress={() =>
                    confirmAction(
                      "删除所选账单",
                      `将删除 ${chosen.length} 笔账单，余额会相应更新。`,
                      () => {
                        try {
                          run(() => repo.deleteTxns(chosen.map((t) => t.id)));
                          setSelection(null);
                          setSelectionError("");
                        } catch (e) {
                          setSelectionError((e as Error).message);
                        }
                      },
                    )
                  }
                />
              </Row>
            </>
          ) : undefined
        }
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
              {zh.family} · {detailView === "mine" ? "我" : "共同"}
            </Txt>
            <Txt size={13} color={t.muted}>
              {today().replaceAll("-", " / ")}
            </Txt>
          </View>
          <IconButton name="arrow.clockwise" label={manualSyncBusy || syncStatus.busy ? "正在同步" : "手动同步"} disabled={manualSyncBusy || syncStatus.busy} onPress={() => void manualSync()} />
          <Popover label="筛选交易" active={detailView === "mine" || types.length > 0 || hideFuture}>
            {(close) => (
              <>
                <Txt size={17} bold>显示范围</Txt>
                <Row>
                  {([{ value: "mine", label: "我" }, { value: "shared", label: "共同" }] as const).map((option) => (
                    <Chip key={option.value} label={option.label} selected={detailView === option.value}
                      onPress={() => {
                        try {
                          repo.setDetailView(option.value);
                          setDetailView(option.value);
                          setFilterError("");
                          close();
                        } catch (e) { setFilterError((e as Error).message); }
                      }} />
                  ))}
                </Row>
                <Txt size={12} color={t.muted}>我：本人的支出和收入；共同：全部家庭账单。收入按收款账户所属成员归属，共同账户按记录人归属；退款跟随原账单。</Txt>
                <Txt size={17} bold>
                  交易类型
                </Txt>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
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
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt>不显示未来账单</Txt>
                  <Switch
                    accessibilityLabel="不显示未来账单"
                    value={hideFuture}
                    onValueChange={(value) => {
                      try {
                        repo.setHideFutureTransactions(value);
                        setHideFuture(value);
                        setNow(new Date());
                        setFilterError("");
                      } catch (e) {
                        setFilterError((e as Error).message);
                      }
                    }}
                  />
                </Row>
                <Txt size={12} color={t.muted}>
                  开启后，明细和本页汇总只显示截至现在的账单。
                </Txt>
                {!!filterError && <Txt color={t.red}>{filterError}</Txt>}
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
        {!!syncMessage && <Txt size={12} color={syncStatus.error ? t.red : t.muted}>{syncMessage}</Txt>}
        <MonthPicker />
        <MonthlySummaryCard month={month} asOf={hideFuture ? now : undefined} memberId={detailView === "mine" ? data.meId : ""} />
        <Row style={{ justifyContent: "space-between" }}>
          <Txt size={20} bold>
            {hideFuture ? "截至现在的明细" : "本月明细"}
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
                    {zh.expense} {formatMoney(daily.expense, false)}　
                    {zh.income} {formatMoney(daily.income, false)}
                  </Txt>
                </Row>
                <Card
                  style={{
                    paddingVertical: 0,
                    paddingHorizontal: 17,
                    gap: 0,
                    overflow: "hidden",
                  }}
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
    </SelectionContext.Provider>
  );
}
