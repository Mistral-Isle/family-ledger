import { useState } from "react";
import {
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
import {
  calculate,
  formatMoney,
  moneyInput,
  moneyKey,
  assertMoney,
} from "../domain/money";
import { categoryBudgetUsage } from "../domain/budgets";
import { budgetTxns, totals } from "../domain/selectors";
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
  const [error, setError] = useState("");
  const total = repo.monthBudget(month),
    allocations = repo.monthAllocations(month);
  const preferences = repo.getDetailBudgetPreferences(),
    excluded = new Set(preferences.excludedCategoryIds);
  const cats = data.categories
    .filter((c) => !c.deleted && c.kind === "expense")
    .sort((a, b) => a.sort - b.sort);
  const roots = cats.filter((c) => !c.parentId),
    parent = cats.find((c) => c.id === parentId);
  const children = cats.filter((c) => c.parentId === parentId);
  const usage = categoryBudgetUsage(data.txns, data.categories, month);
  const expense = totals(
    budgetTxns(data.txns).filter((txn) => txn.occurredAt.startsWith(month)),
  ).expense;
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
    const next = { ...repo.monthAllocations(month) };
    if (id) {
      if (amount === null) delete next[id];
      else next[id] = amount;
    }
    run(() =>
      repo.setMonthBudget(month, id ? repo.monthBudget(month) : amount, next),
    );
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
    const amount = allocations[category.id],
      spent = usage.get(category.id) ?? 0;
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
              <Txt size={12} color={t.muted}>
                预算 {amount === undefined ? "未设置" : formatMoney(amount)} ·
                支出 {formatMoney(spent)}
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
              accessibilityLabel={category.name + "计入明细预算"}
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
    <View style={{ gap: 14 }}>
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
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold color={t.muted}>
              支出总预算
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
                {total === null ? "未设置" : formatMoney(total)}
              </Txt>
              <Icon name="pencil" size={18} color={t.muted} />
            </Row>
          </Pressable>
          <Row style={{ flexWrap: "wrap" }}>
            <Txt color={t.muted}>已用 {formatMoney(expense)}</Txt>
            <Txt color={total !== null && expense > total ? t.red : t.muted}>
              可用 {total === null ? "未设置" : formatMoney(total - expense)}
            </Txt>
          </Row>
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
      <Row style={{ justifyContent: "space-between" }}>
        <Txt bold>{parent ? "二级分类" : "分类预算"}</Txt>
        <Row style={{ gap: 4 }}>
          <Txt size={12} color={t.muted}>
            计入明细
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
              有效金额即时生效
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
    </View>
  );
}
