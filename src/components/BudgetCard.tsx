import { useState } from "react";
import { useRouter } from "expo-router";
import { Platform, Pressable, Switch, View } from "react-native";
import { useLedger } from "./LedgerProvider";
import { Button, Card, ErrorText, Field, Icon, Row, Txt, useTheme } from "./ui";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { budgetTxns, totals } from "../domain/selectors";
import {
  categoryBudgetUsage,
  detailBudget,
  validateBudgetAllocation,
} from "../domain/budgets";
import { HelpBubble, Popover } from "./HelpBubble";
import { DetailBudgetSettings } from "./DetailBudgetSettings";
import type { Category } from "../domain/types";

function BudgetAmounts({
  budget,
  expense,
  testID,
}: {
  budget: number | null;
  expense: number;
  testID: string;
}) {
  const t = useTheme();
  const remaining = budget === null ? null : budget - expense;
  return (
    <View testID={testID} style={{ gap: 12 }}>
      <Row style={{ alignItems: "flex-start", gap: 8 }}>
        {[
          { label: "预算总额", amount: budget },
          { label: "已用", amount: expense },
          {
            label: remaining !== null && remaining < 0 ? "已超出" : "剩余",
            amount: remaining === null ? null : Math.abs(remaining),
          },
        ].map((item, index) => (
          <View key={item.label} style={{ flex: 1, gap: 5 }}>
            <Txt size={12} color={t.muted}>
              {item.label}
            </Txt>
            <Txt
              bold
              size={16}
              color={index === 2 && (remaining ?? 0) < 0 ? "#D9363E" : t.text}
            >
              {item.amount === null ? "未设置" : formatMoney(item.amount)}
            </Txt>
          </View>
        ))}
      </Row>
      {budget !== null && (
        <View
          style={{
            height: 6,
            borderRadius: 3,
            overflow: "hidden",
            backgroundColor: t.line,
          }}
        >
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: expense > budget ? "#D9363E" : t.blue,
              width: `${budget > 0 ? Math.min(100, (Math.max(0, expense) * 100) / budget) : expense > 0 ? 100 : 0}%`,
            }}
          />
        </View>
      )}
    </View>
  );
}

export function BudgetCard({
  month,
  editable = false,
  embedded = false,
}: {
  month: string;
  editable?: boolean;
  embedded?: boolean;
}) {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const budget = repo.monthBudget(month);
  const allocations = repo.monthAllocations(month);
  const preferences = repo.getDetailBudgetPreferences();
  const display = detailBudget(
    data.txns,
    data.categories,
    month,
    budget,
    allocations,
    preferences,
  );
  const expense = totals(
    budgetTxns(data.txns).filter((txn) => txn.occurredAt.startsWith(month)),
  ).expense;
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(budget === null ? "" : moneyInput(budget));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string[]>([]);
  const [error, setError] = useState("");
  const cats = data.categories.filter(
    (c) => !c.deleted && c.kind === "expense",
  );
  const roots = cats
    .filter((c) => !c.parentId)
    .sort(
      (a, b) =>
        Number(allocations[b.id] !== undefined) -
          Number(allocations[a.id] !== undefined) || a.sort - b.sort,
    );
  const usage = categoryBudgetUsage(data.txns, data.categories, month);
  const excluded = new Set(preferences.excludedCategoryIds);
  const parse = () =>
    Object.fromEntries(
      Object.entries(draft)
        .filter(([id, value]) => value.trim() && cats.some((c) => c.id === id))
        .map(([id, value]) => [
          id,
          value.trim() === "0" ? 0 : calculate(value),
        ]),
    );
  const parseTotal = () =>
    input.trim() ? (input.trim() === "0" ? 0 : calculate(input)) : null;
  let validation = "";
  if (editing) {
    try {
      validateBudgetAllocation(parseTotal(), parse(), cats);
    } catch (e) {
      validation = (e as Error).message;
    }
  }
  const toggle = (category: Category, enabled: boolean) => {
    try {
      const current = repo.getDetailBudgetPreferences();
      run(() =>
        repo.setDetailBudgetPreferences({
          ...current,
          excludedCategoryIds: enabled
            ? current.excludedCategoryIds.filter((id) => id !== category.id)
            : [...new Set([...current.excludedCategoryIds, category.id])],
        }),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const switchFor = (category: Category) => {
    const parent = cats.find((c) => c.id === category.parentId);
    const disabled = !!parent && excluded.has(parent.id);
    return (
      <Switch
        accessibilityLabel={`${parent ? parent.name + " / " : ""}${category.name}计入明细预算`}
        value={!disabled && !excluded.has(category.id)}
        disabled={disabled}
        trackColor={{ true: t.blue }}
        thumbColor={Platform.OS === "web" ? "#FFFFFF" : undefined}
        ios_backgroundColor={t.line}
        onValueChange={(value) => toggle(category, value)}
      />
    );
  };
  const categoryAmount = (category: Category) => {
    const parent = cats.find((c) => c.id === category.parentId);
    const label = `${parent ? parent.name + " / " : ""}${category.name}预算`;
    const amount = allocations[category.id];
    const spent = usage.get(category.id) ?? 0;
    const included =
      !excluded.has(category.id) && (!parent || !excluded.has(parent.id));
    return editing ? (
      <Field
        label={label}
        value={draft[category.id] ?? ""}
        keyboardType="decimal-pad"
        placeholder="未分配"
        onChangeText={(value) =>
          setDraft((current) => ({ ...current, [category.id]: value }))
        }
      />
    ) : (
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          columnGap: 8,
          rowGap: 2,
        }}
      >
        <Txt size={12} color={t.muted}>
          预算 {amount === undefined ? "未设置" : formatMoney(amount)}
        </Txt>
        <Txt size={12} color={t.muted}>
          已用 {formatMoney(spent)}
        </Txt>
        {amount !== undefined && (
          <Txt size={12} color={amount < spent ? "#D9363E" : t.green}>
            {amount < spent ? "超支" : "剩余"}{" "}
            {formatMoney(Math.abs(amount - spent))}
          </Txt>
        )}
        {!included && (
          <Txt size={12} color={t.muted}>
            不计入明细
          </Txt>
        )}
      </View>
    );
  };
  const summary = (
    <View style={{ gap: 12 }}>
      <Row style={{ gap: 0 }}>
        <Txt bold style={{ flexShrink: 1 }}>
          {display.title}
        </Txt>
        <HelpBubble label="明细预算范围">{display.explanation}</HelpBubble>
        <View style={{ flex: 1 }} />
        <Popover label="明细预算设置">
          {(close) => (
            <Button
              secondary
              label="分类预算与显示设置"
              onPress={() => {
                close();
                router.push("/budget");
              }}
            />
          )}
        </Popover>
      </Row>
      <BudgetAmounts
        testID="detail-budget-summary"
        budget={display.budget}
        expense={display.expense}
      />
    </View>
  );
  if (embedded) return summary;
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt bold size={20}>
          完整预算
        </Txt>
        <HelpBubble label="预算分配">
          设置每月总额，可按分类分配。一级分类额度已包含子分类。
        </HelpBubble>
        <View style={{ flex: 1 }} />
        <Popover label="修改明细预算名称" icon="pencil">
          {(close) => <DetailBudgetSettings onDone={close} />}
        </Popover>
      </Row>
      <BudgetAmounts
        testID="full-budget-summary"
        budget={budget}
        expense={expense}
      />
      {editable && (
        <>
          <Row style={{ justifyContent: "space-between" }}>
            <Row style={{ gap: 0 }}>
              <Txt bold>分类预算</Txt>
              <HelpBubble label="分类预算开关">
                开关即时保存，适用于所有月份。关闭一级分类会一并排除子分类，重新开启后保留子分类选择。
              </HelpBubble>
            </Row>
            <Txt size={12} color={t.muted}>
              计入明细
            </Txt>
          </Row>
          {!editing ? (
            <Button
              secondary
              label="编辑预算"
              onPress={() => {
                setInput(budget === null ? "" : moneyInput(budget));
                setDraft(
                  Object.fromEntries(
                    Object.entries(allocations).map(([id, n]) => [
                      id,
                      moneyInput(n),
                    ]),
                  ),
                );
                setError("");
                setEditing(true);
              }}
            />
          ) : (
            <Field
              label="总预算"
              value={input}
              onChangeText={setInput}
              keyboardType="decimal-pad"
              placeholder="未设置"
            />
          )}
          <View>
            {roots.map((root) => (
              <View
                key={root.id}
                style={{
                  gap: editing ? 8 : 0,
                  borderTopWidth: 1,
                  borderColor: t.line,
                  paddingVertical: 6,
                }}
              >
                <Row>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`展开${root.name}预算`}
                    accessibilityState={{
                      expanded: expanded.includes(root.id),
                    }}
                    onPress={() =>
                      setExpanded((current) =>
                        current.includes(root.id)
                          ? current.filter((id) => id !== root.id)
                          : [...current, root.id],
                      )
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 52,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Icon name={root.icon} color={root.color} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Txt bold>{root.name}</Txt>
                      {!editing && categoryAmount(root)}
                    </View>
                    <Icon
                      name={
                        expanded.includes(root.id)
                          ? "arrow.down"
                          : "chevron.right"
                      }
                      size={13}
                      color={t.muted}
                    />
                  </Pressable>
                  {switchFor(root)}
                </Row>
                {editing && categoryAmount(root)}
                {expanded.includes(root.id) &&
                  cats
                    .filter((c) => c.parentId === root.id)
                    .map((child) => (
                      <View
                        key={child.id}
                        style={{
                          marginLeft: 24,
                          gap: editing ? 6 : 0,
                          paddingVertical: 5,
                          borderTopWidth: 1,
                          borderColor: t.line,
                        }}
                      >
                        <Row
                          style={{
                            minHeight: 44,
                            justifyContent: "space-between",
                          }}
                        >
                          <Icon
                            name={child.icon}
                            color={child.color}
                            size={20}
                          />
                          <View style={{ flex: 1, gap: 3 }}>
                            <Txt>{child.name}</Txt>
                            {!editing && categoryAmount(child)}
                          </View>
                          {switchFor(child)}
                        </Row>
                        {editing && categoryAmount(child)}
                      </View>
                    ))}
              </View>
            ))}
          </View>
          <ErrorText message={validation || error} />
          {editing && (
            <>
              <Txt size={12} color={t.muted}>
                金额修改在保存后生效。取消金额编辑不会撤销已保存的显示开关。
              </Txt>
              <Button
                label="保存预算"
                disabled={!!validation}
                onPress={() => {
                  try {
                    run(() =>
                      repo.setMonthBudget(month, parseTotal(), parse()),
                    );
                    setError("");
                    setEditing(false);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
              <Button
                secondary
                label="取消金额编辑"
                onPress={() => {
                  setEditing(false);
                  setError("");
                }}
              />
            </>
          )}
          <Button
            secondary
            label="恢复全部分类与默认名称"
            onPress={() => {
              try {
                run(() =>
                  repo.setDetailBudgetPreferences({
                    title: "",
                    excludedCategoryIds: [],
                  }),
                );
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </>
      )}
    </Card>
  );
}
