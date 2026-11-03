import { MonthPicker } from "./MonthPicker";
import { useReducedMotion } from "./useReducedMotion";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLedger } from "./LedgerProvider";
import {
  Button,
  Card,
  ErrorText,
  Icon,
  IconButton,
  Row,
  Txt,
  useTheme,
} from "./ui";
import { EntryKeyboard } from "./EntryKeyboard";
import { Popover } from "./HelpBubble";
import { DetailBudgetSettings } from "./DetailBudgetSettings";
import { Segmented } from "./Segmented";
import { loanExpenseTxns } from "../domain/selectors";
import {
  monthBudgetView,
  planMonthAmounts,
  unbudgetedClosedCategories,
} from "../domain/planBudgets";
import {
  calculate,
  formatMoney,
  moneyInput,
  moneyKey,
  assertMoney,
} from "../domain/money";
import {
  budgetAllocationWarnings,
  categoryBudgetUsage,
  effectiveAllocation,
  scopedBudget,
  type BudgetScope,
} from "../domain/budgets";
import type { Category } from "../domain/types";

export function BudgetEditor({ month }: { month: string }) {
  const { data, repo, run } = useLedger(),
    t = useTheme(),
    insets = useSafeAreaInsets();
  const [parentId, setParentId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    id: string | null;
    label: string;
    value: string;
    replace: boolean;
  } | null>(null);
  const reduced = useReducedMotion();
  const motion = useRef(new Animated.Value(0)).current;
  const previousParent = useRef(parentId);
  useLayoutEffect(() => {
    if (previousParent.current === parentId) return;
    previousParent.current = parentId;
    motion.stopAnimation();
    motion.setValue(reduced ? 0 : parentId ? 32 : -32);
    const animation = Animated.spring(motion, { toValue: 0, damping: 28, stiffness: 260, mass: 1, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [parentId, reduced, motion]);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<BudgetScope>(
    () => repo.getSummaryPreferences().budgetScope,
  );
  // Shown and edited as they apply this month: linked categories follow their plans.
  const linkedIds = repo.getLinkedBudgetCategories();
  const effective = monthBudgetView(
    data,
    month,
    repo.monthBudget(month),
    repo.monthAllocations(month),
    linkedIds,
  );
  const total = effective.total,
    allocations = effective.allocations,
    linked = effective.linked;
  const preferences = repo.getDetailBudgetPreferences(),
    excluded = new Set(preferences.excludedCategoryIds);
  const cats = data.categories
    .filter((c) => !c.deleted && c.kind === "expense")
    .sort((a, b) => a.sort - b.sort);
  const roots = cats.filter((c) => !c.parentId),
    parent = cats.find((c) => c.id === parentId);
  const children = cats.filter((c) => c.parentId === parentId);
  const spending = loanExpenseTxns(data.txns, data.plans);
  const usage = categoryBudgetUsage(spending, data.categories, month);
  const warnings = budgetAllocationWarnings(total, allocations, data.categories);
  const view = scopedBudget(
    scope,
    spending,
    data.categories,
    month,
    total,
    allocations,
    preferences,
  );
  const selectedTitle = preferences.title.trim() || "日常预算";
  const unbudgeted = unbudgetedClosedCategories(
    data,
    month,
    allocations,
    preferences.excludedCategoryIds,
    (m) => categoryBudgetUsage(spending, data.categories, m),
    planMonthAmounts(data, month),
  );
  function addBudget(row: (typeof unbudgeted)[number]) {
    try {
      run(() =>
        repo.addCategoryBudget(
          month,
          row.category.id,
          row.suggested,
          row.planned,
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const overBudget = view.remaining !== null && view.remaining < 0;
  function chooseScope(next: BudgetScope) {
    setScope(next);
    try {
      run(() =>
        repo.setSummaryPreferences({
          ...repo.getSummaryPreferences(),
          budgetScope: next,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function openAmount(id: string | null) {
    const amount = id ? allocations[id] : total;
    setError("");
    setEditor({
      id,
      label: id
        ? (cats.find((c) => c.id === id)?.name ?? "分类") + "预算"
        : "支出总预算",
      value: amount == null ? "" : moneyInput(amount),
      replace: true,
    });
  }
  function persist(value: string, id: string | null) {
    const amount = value.trim() ? calculate(value) : null;
    const next = { ...allocations };
    if (id) {
      if (amount === null) delete next[id];
      else next[id] = amount;
    }
    run(() => {
      repo.setMonthBudget(month, id ? total : amount, next);
      // A typed amount takes over from the plan.
      if (id && linked.has(id))
        repo.setLinkedBudgetCategories(linkedIds.filter((l) => l !== id));
    });
  }
  function change(value: string) {
    if (!editor) return;
    setEditor({ ...editor, value, replace: false });
    try {
      persist(value, editor.id);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function finish() {
    if (!editor) return;
    try {
      persist(editor.value, editor.id);
      setError("");
      setEditor(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function toggle(category: Category, enabled: boolean) {
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
  }
  function sumChildren() {
    try {
      const next = { ...allocations };
      if (parent) {
        next[parent.id] = children.reduce(
          (sum, c) => assertMoney(sum + (next[c.id] ?? 0)),
          0,
        );
        run(() => repo.setMonthBudget(month, total, next));
      } else {
        const sum = roots.reduce(
          (n, c) => assertMoney(n + (next[c.id] ?? 0)),
          0,
        );
        run(() => repo.setMonthBudget(month, sum, next));
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function categoryRow(category: Category, last: boolean, detail = false) {
    const own = allocations[category.id],
      amount = effectiveAllocation(category.id, allocations, data.categories),
      spent = usage.get(category.id) ?? 0,
      over = warnings.children[category.id]?.over;
    const hasChildren = cats.some((c) => c.parentId === category.id);
    const disabled = !!category.parentId && excluded.has(category.parentId);
    return (
      <View
        key={category.id}
        style={{
          borderBottomWidth: last ? 0 : 0.5,
          borderColor: t.line,
          paddingVertical: 8,
        }}
      >
        <Row style={{ gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              (hasChildren && !detail ? "展开" : "修改") +
              category.name +
              "预算"
            }
            onPress={() =>
              hasChildren && !detail
                ? setParentId(category.id)
                : openAmount(category.id)
            }
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 68,
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: t.expenseIcon,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={category.icon} color="#fff" size={23} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Row
                style={{
                  justifyContent: "space-between",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <Txt bold size={16}>
                  {category.name}
                </Txt>
                {amount !== undefined && (
                  <Txt size={12} color={spent > amount ? t.red : t.muted}>
                    可用 {formatMoney(amount - spent)}
                  </Txt>
                )}
              </Row>
              <View
                style={{
                  height: 4,
                  backgroundColor: t.soft,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: 4,
                    width: `${amount ? Math.min(100, Math.max(0, (spent / amount) * 100)) : spent > 0 ? 100 : 0}%`,
                    backgroundColor:
                      spent > (amount ?? Infinity) ? t.red : t.blue,
                  }}
                />
              </View>
              <Txt size={12} color={spent > (amount ?? Infinity) ? t.red : t.muted}>
                预算 {amount === undefined ? "未设置" : formatMoney(amount)}
                {own === undefined && amount !== undefined ? "（二级合计）" : ""}
                {linked.has(category.id) ? "（跟随计划）" : ""} ·
                支出 {formatMoney(spent)}
                {!!over && (
                  <Txt size={12} color={t.orange}>
                    {" "}· 二级超 {formatMoney(over)}
                  </Txt>
                )}
              </Txt>
            </View>
            <Icon name="chevron.right" size={14} color={t.muted} />
          </Pressable>
          <View
            style={{
              width: 51,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Switch
              accessibilityLabel={category.name + "计入" + selectedTitle}
              value={!disabled && !excluded.has(category.id)}
              disabled={disabled}
              style={{ alignSelf: "center" }}
              trackColor={{ true: t.blue }}
              thumbColor={Platform.OS === "web" ? "#fff" : undefined}
              ios_backgroundColor={t.line}
              onValueChange={(value) => toggle(category, value)}
            />
          </View>
        </Row>
      </View>
    );
  }
  return (
    <Animated.View style={{ gap: 14, transform: [{ translateX: motion }] }}>
      {!parent && <MonthPicker />}
      {parent ? (
        <Row>
          <IconButton
            name="chevron.left"
            label="返回一级预算"
            onPress={() => setParentId(null)}
          />
          <Txt bold size={20} style={{ flex: 1 }}>
            {parent.name}
          </Txt>
          <Button secondary label="合计二级" onPress={sumChildren} />
        </Row>
      ) : (
        <Card style={{ gap: 12 }}>
          <Segmented
            height={36}
            value={scope}
            options={[
              { value: "all", label: "全部预算" },
              { value: "selected", label: selectedTitle },
            ]}
            onChange={chooseScope}
          />
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold color={t.muted}>
              {scope === "all" ? "支出总预算" : view.title}
            </Txt>
            <Button secondary label="合计预算" onPress={sumChildren} />
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="修改总预算"
            onPress={() => openAmount(null)}
            style={{ minHeight: 50, justifyContent: "center" }}
          >
            <Row>
              <Txt size={34} bold>
                {view.budget === null ? "未设置" : formatMoney(view.budget)}
              </Txt>
              <Icon name="pencil" size={18} color={t.muted} />
            </Row>
          </Pressable>
          {scope === "selected" && view.filtered && total !== null && (
            <Txt size={12} color={t.muted}>
              总预算 {formatMoney(total)} − 已关闭分类{" "}
              {formatMoney(Math.max(0, total - (view.budget ?? 0)))}
            </Txt>
          )}
          <Row style={{ flexWrap: "wrap" }}>
            <Txt color={overBudget ? t.red : t.muted}>
              已用 {formatMoney(view.expense)}
            </Txt>
            <Txt color={overBudget ? t.red : t.muted}>
              可用{" "}
              {view.remaining === null ? "未设置" : formatMoney(view.remaining)}
            </Txt>
          </Row>
          {warnings.rootOver > 0 && (
            <Txt size={12} color={t.muted}>
              一级预算合计 {formatMoney(warnings.rootSum)}，超出总预算{" "}
              <Txt size={12} color={t.orange}>
                {formatMoney(warnings.rootOver)}
              </Txt>
            </Txt>
          )}
          <Txt size={12} color={t.muted}>
            修改即时生效；未单独设置的后续月份自动沿用。
          </Txt>
        </Card>
      )}
      {parent && (
        <Card style={{ paddingVertical: 0, paddingHorizontal: 14 }}>
          {categoryRow(parent, true, true)}
        </Card>
      )}
      {!parent &&
        unbudgeted.map((row) => (
          <Card key={row.category.id} style={{ gap: 8, padding: 14 }}>
            <Txt size={13} color={t.muted}>
              {row.category.name}没有计入{selectedTitle}，但还没有自己的预算，
              {selectedTitle}扣不掉它这部分。
              {row.planned ? "设置后会跟随计划，计划结束自动扣除。" : ""}
            </Txt>
            <Button
              secondary
              label={`设为每月 ${formatMoney(row.suggested)}，并加到总预算`}
              onPress={() => addBudget(row)}
            />
          </Card>
        ))}
      <Row style={{ justifyContent: "space-between" }}>
        <Txt bold>{parent ? "二级分类" : "分类预算"}</Txt>
        <Row style={{ gap: 4 }}>
          <Txt size={12} color={t.muted}>
            计入{selectedTitle}
          </Txt>
          <Popover label="明细预算显示设置">
            <DetailBudgetSettings />
          </Popover>
        </Row>
      </Row>
      <Card style={{ paddingVertical: 0, paddingHorizontal: 14, gap: 0 }}>
        {(parent ? children : roots).map((c, i, list) =>
          categoryRow(c, i === list.length - 1),
        )}
      </Card>
      {!editor && <ErrorText message={error} />}
      <Modal
        visible={!!editor}
        transparent
        animationType="fade"
        onRequestClose={finish}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#00000055",
            paddingTop: insets.top + 12,
          }}
        >
          <Pressable
            accessibilityLabel="完成预算输入"
            onPress={finish}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            style={{
              padding: 16,
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: t.bg,
              gap: 10,
              width: "100%",
              maxWidth: 600,
              alignSelf: "center",
            }}
          >
            <Row>
              <Txt bold style={{ flex: 1 }}>
                {editor?.label}
              </Txt>
              <IconButton
                name="xmark"
                label="关闭预算输入"
                onPress={() => {
                  setEditor(null);
                  setError("");
                }}
              />
            </Row>
            <ScrollView style={{ maxHeight: 70 }}>
              <Txt size={32} bold>
                {editor?.value || "未设置"}
              </Txt>
            </ScrollView>
            <Txt size={12} color={t.muted}>
              {editor?.id && linked.has(editor.id)
                ? "当前跟随计划自动调整；手动修改后不再跟随。"
                : "有效金额即时生效"}
            </Txt>
            <ErrorText message={error} />
            <EntryKeyboard
              onKey={(key) =>
                change(
                  moneyKey(
                    editor?.replace && /^[\d.]$/.test(key)
                      ? ""
                      : (editor?.value ?? ""),
                    key,
                  ),
                )
              }
              onSave={finish}
            />
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}
