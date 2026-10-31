import { useState } from "react";
import { Pressable, View } from "react-native";
import type { Snapshot } from "../domain/types";
import { categoryReport, type DateRange } from "../domain/reports";
import { shareLabel } from "../domain/donut";
import { categoryChartColors, chartOtherColor } from "../domain/chartColors";
import { formatMoney } from "../domain/money";
import { CategoryDonut } from "./CategoryDonut";
import { CategoryPicker } from "./CategoryPicker";
import { Segmented } from "./Segmented";
import { HelpBubble, Popover } from "./HelpBubble";
import { Card, Chip, Icon, Row, Txt, useTheme } from "./ui";

export function CategoryBreakdown({
  data,
  range,
  previous,
  kind,
  includeRepayments,
}: {
  data: Snapshot;
  range: DateRange;
  previous: DateRange | null;
  kind: "expense" | "income";
  includeRepayments: boolean;
}) {
  const t = useTheme();
  const [level, setLevel] = useState<"root" | "leaf">("root");
  const [comparison, setComparison] = useState<"amount" | "percent" | "none">(
    "amount",
  );
  const [categoryId, setCategoryId] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const chartData = {
    ...data,
    txns: data.txns.filter((txn) => {
      const id =
        txn.type === "refund" && kind === "income"
          ? txn.refundIncomeCategoryId
          : txn.categoryId;
      return (
        !categoryId ||
        id === categoryId ||
        data.categories.find((c) => c.id === id)?.parentId === categoryId
      );
    }),
  };
  const categories = categoryReport(chartData, range, kind, level);
  const leaves = categoryReport(chartData, range, kind, "leaf");
  const prior = new Map(
    previous
      ? categoryReport(chartData, previous, kind, level).map((c) => [
          c.id,
          c.amount,
        ])
      : [],
  );
  const positiveTotal = categories.reduce(
    (sum, c) => sum + Math.max(0, c.amount),
    0,
  );
  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  const colors = categoryChartColors(
    data.categories.filter((c) => c.kind === kind),
    categories.map((c) => c.id),
  );
  const label =
    kind === "income" ? "收入" : includeRepayments ? "流出" : "支出";
  const change = (amount: number, id: string) => {
    if (!previous) return "无上期对比";
    const before = prior.get(id) ?? 0;
    const delta = amount - before;
    if (comparison === "percent" && !before)
      return amount ? "较上期新增" : "较上期持平";
    const value =
      comparison === "percent"
        ? `${Number(((Math.abs(delta) * 100) / Math.abs(before)).toFixed(2))}%`
        : formatMoney(Math.abs(delta));
    return delta ? `${delta > 0 ? "↑" : "↓"} ${value}` : "较上期持平";
  };
  return (
    <Card style={{ gap: 18 }}>
      <View testID="category-breakdown" style={{ gap: 18 }}>
        <Row
          style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
        >
          <Txt size={17} bold>
            {label}分类详情
          </Txt>
          <Row style={{ gap: 6 }}>
            <Popover
              disclosure
              compact
              label="环比显示方式"
              triggerText={
                comparison === "amount"
                  ? "环比金额"
                  : comparison === "percent"
                    ? "环比比例"
                    : "隐藏环比"
              }
            >
              {(close) => (
                <>
                  <Txt bold>较上期变化</Txt>
                  <Segmented
                    value={comparison}
                    options={[
                      { value: "amount", label: "金额" },
                      { value: "percent", label: "比例" },
                      { value: "none", label: "隐藏" },
                    ]}
                    onChange={(next) => {
                      setComparison(next);
                      close();
                    }}
                  />
                  <Txt size={12} color={t.muted}>
                    按当前时间范围与上一期比较。上期为零时显示“新增”。
                  </Txt>
                </>
              )}
            </Popover>
            <Popover
              disclosure
              compact
              label="分类层级与筛选"
              triggerText={level === "root" ? "一级分类" : "二级分类"}
            >
              {(close) => (
                <>
                  <Txt bold>分类层级</Txt>
                  <Segmented
                    value={level}
                    options={[
                      { value: "root", label: "一级分类" },
                      { value: "leaf", label: "二级分类" },
                    ]}
                    onChange={(next) => {
                      setLevel(next);
                      setExpanded([]);
                      close();
                    }}
                  />
                  <CategoryPicker
                    value={categoryId}
                    onChange={(next) => {
                      setCategoryId(next);
                      setExpanded([]);
                      close();
                    }}
                    kind={kind}
                    allowAll
                    label="筛选分类"
                  />
                </>
              )}
            </Popover>
          </Row>
        </Row>
        {!!categoryId && (
          <Chip
            label={`${data.categories.find((c) => c.id === categoryId)?.name ?? "分类"} · 清除筛选`}
            selected
            onPress={() => setCategoryId("")}
          />
        )}
        <CategoryDonut
          title={`${categoryId ? "所选分类" : "总"}${label}`}
          total={total}
          items={categories.map((c) => ({
            id: c.id,
            name: c.category?.name ?? "未分类",
            amount: c.amount,
            color: colors.get(c.id) ?? chartOtherColor,
          }))}
        />
        {!categories.length && (
          <Txt color={t.muted} style={{ textAlign: "center" }}>
            所选时间暂无{label}记录
          </Txt>
        )}
        {categories.map((item) => {
          const children = leaves.filter(
            (c) => c.category?.parentId === item.id || c.id === item.id,
          );
          const childTotal = children.reduce(
            (sum, c) => sum + Math.max(0, c.amount),
            0,
          );
          const canExpand = level === "root" && children.length > 0;
          const color = colors.get(item.id) ?? chartOtherColor;
          const delta = item.amount - (prior.get(item.id) ?? 0);
          const favorable = kind === "income" ? delta > 0 : delta < 0;
          const open = expanded.includes(item.id);
          return (
            <View key={item.id} style={{ gap: 10 }}>
              <Pressable
                accessibilityRole={canExpand ? "button" : undefined}
                disabled={!canExpand}
                accessibilityLabel={`${canExpand ? "展开" : ""}${item.category?.name ?? "未分类"}`}
                accessibilityState={canExpand ? { expanded: open } : undefined}
                onPress={() =>
                  setExpanded((current) =>
                    open
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id],
                  )
                }
                style={({ pressed }) => ({
                  gap: 9,
                  opacity: pressed ? 0.6 : 1,
                  minHeight: 66,
                })}
              >
                <Row style={{ gap: 10 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: color,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={item.category?.icon ?? "sparkles"}
                      color="#FFFFFF"
                      size={20}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt bold size={16}>
                      {item.category?.name ?? "未分类"}
                    </Txt>
                    <Txt size={12} color={t.muted}>
                      {shareLabel(item.amount, positiveTotal)}
                      {level === "leaf" && item.category?.parentId
                        ? ` · ${data.categories.find((c) => c.id === item.category?.parentId)?.name ?? ""}`
                        : ""}
                    </Txt>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Txt bold size={17}>
                      {formatMoney(item.amount)}
                    </Txt>
                    <Txt size={12} color={t.muted}>
                      {item.count} 笔
                    </Txt>
                  </View>
                  {canExpand && (
                    <Icon
                      name={open ? "arrow.down" : "chevron.right"}
                      size={13}
                      color={t.muted}
                    />
                  )}
                </Row>
                <View style={{ marginLeft: 48, gap: 6 }}>
                  <View
                    style={{
                      height: 5,
                      backgroundColor: t.line,
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: 5,
                        borderRadius: 3,
                        width: `${positiveTotal ? (Math.max(0, item.amount) * 100) / positiveTotal : 0}%`,
                        backgroundColor: color,
                      }}
                    />
                  </View>
                  {comparison !== "none" && (
                    <Txt
                      size={12}
                      color={
                        !previous || !delta
                          ? t.muted
                          : favorable
                            ? t.green
                            : t.red
                      }
                    >
                      {change(item.amount, item.id)}
                    </Txt>
                  )}
                </View>
              </Pressable>
              {canExpand &&
                open &&
                children.map((child) => (
                  <View
                    key={child.id}
                    style={{
                      marginLeft: 18,
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: t.soft,
                    }}
                  >
                    <Row style={{ gap: 8 }}>
                      <Icon
                        name={child.category?.icon ?? "sparkles"}
                        size={18}
                        color={colors.get(child.id) ?? color}
                      />
                      <Txt size={13} style={{ flex: 1 }}>
                        {child.id === item.id ? "未细分" : child.category?.name}
                      </Txt>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Txt size={14}>{formatMoney(child.amount)}</Txt>
                        <Txt size={11} color={t.muted}>
                          {child.count} 笔 · 占本类{" "}
                          {shareLabel(child.amount, childTotal)}
                        </Txt>
                      </View>
                    </Row>
                  </View>
                ))}
            </View>
          );
        })}
        <Row style={{ gap: 0 }}>
          <Txt size={12} color={t.muted} style={{ flex: 1 }}>
            占比按正值分类计算，笔数包含影响当前收支的退款。
          </Txt>
          <HelpBubble label="分类统计">
            环形图仅展示金额为正的分类；中心金额和列表保留退款抵减后的净额。分类较多时保留所有色块，仅隐藏拥挤或占比较小的文字标签，完整分类可在下方列表查看。子分类占比以该一级分类下的正值金额之和为分母。笔数包括当前收支类型的交易，以及影响该金额的退款记录。
          </HelpBubble>
        </Row>
      </View>
    </Card>
  );
}
