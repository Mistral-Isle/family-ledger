import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CategoryTile } from "../components/CategoryTile";
import { useLedger } from "../components/LedgerProvider";
import { TxnMetadata } from "../components/TxnMetadata";
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
} from "../components/ui";
import { today } from "../domain/date";
import { financeKind, financialRow } from "../domain/financialRows";
import { formatMoney } from "../domain/money";
import { categoryDetailReport, reportingSnapshot } from "../domain/reports";
import { refundState, spendingSnapshot } from "../domain/selectors";
import { zh } from "../i18n/zh";

export default function CategoryDetail() {
  const params = useLocalSearchParams<{
    id?: string;
    scope?: string;
    start?: string;
    end?: string;
    kind?: string;
    memberId?: string;
    includeRepayments?: string;
  }>();
  const { data } = useLedger();
  const router = useRouter();
  const t = useTheme();
  const [subFilter, setSubFilter] = useState("");

  const id = params.id ?? "";
  const kind = params.kind === "income" ? "income" : "expense";
  const scope = params.scope === "exact" ? "exact" : "tree";
  const includeRepayments = params.includeRepayments === "1";
  const memberId = params.memberId ?? "";
  const range = useMemo(
    () => ({
      start: params.start || today(),
      end: params.end || today(),
    }),
    [params.start, params.end],
  );

  const reportData = useMemo(
    () =>
      reportingSnapshot(
        spendingSnapshot(data),
        memberId,
        includeRepayments,
        "payer",
      ),
    [data, memberId, includeRepayments],
  );

  const baseDetail = useMemo(
    () => categoryDetailReport(reportData, range, kind, id, scope),
    [reportData, range, kind, id, scope],
  );

  const activeDetail = useMemo(
    () =>
      subFilter
        ? categoryDetailReport(reportData, range, kind, subFilter, "exact")
        : baseDetail,
    [reportData, range, kind, subFilter, baseDetail],
  );

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/(tabs)/stats");

  const category = activeDetail.category ?? baseDetail.category;
  const parent = category?.parentId
    ? reportData.categories.find((c) => c.id === category.parentId)
    : undefined;
  const member = memberId
    ? data.members.find((m) => m.id === memberId)?.name
    : undefined;
  const titleText =
    subFilter && subFilter === id
      ? `${baseDetail.category?.name ?? "未分类"} · 未细分`
      : category?.name ?? "分类明细";

  const groups = useMemo(
    () => [...new Set(activeDetail.rows.map((r) => r.occurredAt))],
    [activeDetail.rows],
  );

  const showSubFilters =
    scope === "tree" &&
    (baseDetail.children.length > 1 ||
      baseDetail.children.some((c) => c.id !== id));

  if (!id || !baseDetail.category) {
    return (
      <Page>
        <Heading
          title="分类明细"
          action={
            <IconButton name="chevron.left" label="返回统计" onPress={goBack} />
          }
        />
        <Card>
          <Txt>未找到对应的分类信息。</Txt>
          <Button label="返回统计" onPress={goBack} />
        </Card>
      </Page>
    );
  }

  const badgeColor =
    kind === "income"
      ? t.incomeIcon
      : id === "report-loan-principal"
        ? t.transferIcon
        : t.expenseIcon;

  return (
    <Page>
      <Heading
        title={parent ? `${parent.name} · ${titleText}` : titleText}
        action={
          <IconButton name="chevron.left" label="返回统计" onPress={goBack} />
        }
      />

      <Card style={{ gap: 12 }}>
        <Row style={{ gap: 12 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              backgroundColor: badgeColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name={category?.icon ?? "sparkles"}
              color="#FFFFFF"
              size={24}
            />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt bold size={17}>
              {titleText}
            </Txt>
            <Txt size={12} color={t.muted}>
              {range.start.replaceAll("-", ".")} —{" "}
              {range.end.replaceAll("-", ".")}
              {member ? ` · ${member}` : ""}
              {includeRepayments && kind === "expense" ? " · 含还款本金" : ""}
            </Txt>
          </View>
        </Row>
        <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <View style={{ gap: 2 }}>
            <Txt size={12} color={t.muted}>
              {kind === "income"
                ? "累计收入"
                : includeRepayments
                  ? "累计流出"
                  : "累计支出"}
            </Txt>
            <Txt size={32} bold>
              {formatMoney(activeDetail.total)}
            </Txt>
          </View>
          <Txt size={13} color={t.muted}>
            共 {activeDetail.count} 笔
          </Txt>
        </Row>
      </Card>

      {showSubFilters && (
        <Card style={{ padding: 12, gap: 8 }}>
          <Txt size={12} color={t.muted}>
            按子分类筛选
          </Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <CategoryTile
              category={{
                ...baseDetail.category,
                name: "全部",
              }}
              selected={!subFilter}
              hasChildren={false}
              onPress={() => setSubFilter("")}
            />
            {baseDetail.children.map((child) => {
              const tileCategory =
                child.category ?? {
                  ...baseDetail.category!,
                  id: child.id,
                  name: "未细分",
                };
              return (
                <CategoryTile
                  key={child.id}
                  category={
                    child.id === id
                      ? { ...tileCategory, name: "未细分" }
                      : tileCategory
                  }
                  selected={subFilter === child.id}
                  hasChildren={false}
                  onPress={() =>
                    setSubFilter((current) =>
                      current === child.id ? "" : child.id,
                    )
                  }
                />
              );
            })}
          </View>
        </Card>
      )}

      {!groups.length ? (
        <Card>
          <Txt color={t.muted} style={{ textAlign: "center" }}>
            当前筛选条件下暂无明细记录
          </Txt>
        </Card>
      ) : (
        groups.map((date) => {
          const dayRows = activeDetail.rows.filter((r) => r.occurredAt === date);
          return (
            <Card key={date} style={{ padding: 0, gap: 0, overflow: "hidden" }}>
              <Row
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: t.soft,
                  justifyContent: "space-between",
                }}
              >
                <Txt size={12} bold color={t.muted}>
                  {date}
                </Txt>
                <Txt size={12} color={t.muted}>
                  {dayRows.length} 笔
                </Txt>
              </Row>
              {dayRows.map((txn, idx) => {
                const rawTxn = data.txns.find((x) => x.id === txn.id) ?? txn;
                const rowCategory = data.categories.find(
                  (c) =>
                    c.id ===
                    (rawTxn.type === "refund" && kind === "income"
                      ? rawTxn.refundIncomeCategoryId
                      : rawTxn.categoryId),
                );
                const account = data.accounts.find(
                  (a) => a.id === rawTxn.accountId,
                );
                const financial = financialRow(data, rawTxn);
                const planKind = financeKind(data, rawTxn);
                const refunded = refundState(data.txns, rawTxn);
                const rowTitle = financial
                  ? financial.label
                  : rawTxn.type === "refund"
                    ? `${zh.refund} · ${rowCategory?.name ?? "未分类"}`
                    : (rowCategory?.name ?? zh[rawTxn.type]);
                const isIncome =
                  rawTxn.type === "income" ||
                  (rawTxn.type === "refund" && kind === "income");
                const displayAmount = refunded
                  ? `${refunded.net ? "−" : ""}${formatMoney(refunded.net, false)}`
                  : rawTxn.type === "refund" && kind === "income"
                    ? `+${formatMoney(rawTxn.refundIncome ?? 0, false)}`
                    : rawTxn.type === "refund"
                      ? `+${formatMoney(Math.max(0, rawTxn.amount - (rawTxn.refundIncome ?? 0)), false)}`
                      : `${isIncome ? "+" : "−"}${formatMoney(Math.abs(rawTxn.amount), false)}`;

                const openRow = () => {
                  if (planKind || rawTxn.type === "repayment") {
                    router.push({
                      pathname: "/finance",
                      params: { kind: planKind ?? "loan" },
                    });
                  } else if (rawTxn.type === "adjust") {
                    router.push({
                      pathname: "/account-detail",
                      params: { id: rawTxn.accountId },
                    });
                  } else if (
                    rawTxn.type === "scope_in" ||
                    rawTxn.type === "scope_out"
                  ) {
                    router.push({
                      pathname: "/scope-transfer",
                      params: { id: rawTxn.id },
                    });
                  } else {
                    router.push({
                      pathname: rawTxn.type === "refund" ? "/refund" : "/entry",
                      params: { id: rawTxn.id },
                    });
                  }
                };

                return (
                  <Pressable
                    key={rawTxn.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${rowTitle} ${formatMoney(rawTxn.amount)}`}
                    onPress={openRow}
                    style={({ pressed }) => ({
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderTopWidth: idx === 0 ? 0 : 0.5,
                      borderColor: t.line,
                      backgroundColor: pressed ? t.soft : "transparent",
                    })}
                  >
                    <Row>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 13,
                          backgroundColor:
                            kind === "income"
                              ? t.incomeIcon
                              : rawTxn.type === "repayment"
                                ? t.transferIcon
                                : t.expenseIcon,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name={
                            rowCategory?.icon ??
                            (rawTxn.type === "repayment"
                              ? "building.columns.fill"
                              : "sparkles")
                          }
                          color="#FFFFFF"
                          size={19}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Row style={{ gap: 6 }}>
                          <Txt bold size={15}>
                            {rowTitle}
                          </Txt>
                          {refunded && (
                            <View
                              style={{
                                paddingHorizontal: 6,
                                borderRadius: 6,
                                backgroundColor: t.soft,
                              }}
                            >
                              <Txt
                                size={11}
                                color={
                                  refunded.kind === "partial" ? t.blue : t.green
                                }
                              >
                                {zh.refundStates[refunded.kind]}
                              </Txt>
                            </View>
                          )}
                        </Row>
                        {!!(rawTxn.occurredTime || rawTxn.note) && (
                          <Txt size={12} color={t.muted}>
                            {[rawTxn.occurredTime, rawTxn.note]
                              .filter(Boolean)
                              .join(" · ")}
                          </Txt>
                        )}
                        <TxnMetadata data={data} txn={rawTxn} />
                        {!!rawTxn.refundIncome && (
                          <Txt size={11} color={t.green}>
                            {zh.refundOffset}{" "}
                            {formatMoney(rawTxn.amount - rawTxn.refundIncome)} ·{" "}
                            {zh.income} {formatMoney(rawTxn.refundIncome)}
                          </Txt>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 3 }}>
                        <Txt
                          bold
                          size={16}
                          color={
                            isIncome || rawTxn.type === "refund"
                              ? t.green
                              : t.text
                          }
                        >
                          {displayAmount}
                        </Txt>
                        {refunded && (
                          <Txt size={11} color={t.muted}>
                            {zh.refundOriginal}{" "}
                            {formatMoney(rawTxn.amount, false)}
                          </Txt>
                        )}
                        {!!account && (
                          <Txt size={11} color={t.muted}>
                            {account.name}
                          </Txt>
                        )}
                      </View>
                    </Row>
                  </Pressable>
                );
              })}
            </Card>
          );
        })
      )}
    </Page>
  );
}
