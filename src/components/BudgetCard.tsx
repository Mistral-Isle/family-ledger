import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLedger } from "./LedgerProvider";
import { Button, Card, ErrorText, Field, Icon, Row, Txt, useTheme } from "./ui";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { totals } from "../domain/selectors";
import { validateBudgetAllocation } from "../domain/budgets";
export function BudgetCard({
  month,
  editable = false,
  embedded = false,
}: {
  month: string;
  editable?: boolean;
  embedded?: boolean;
}) {
  const { data, repo, run } = useLedger(),
    t = useTheme();
  const budget = repo.monthBudget(month),
    allocations = repo.monthAllocations(month);
  const expense = totals(
    data.txns.filter((t) => t.occurredAt.startsWith(month)),
  ).expense;
  const [editing, setEditing] = useState(false),
    [input, setInput] = useState(budget === null ? "" : moneyInput(budget));
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(allocations).map(([id, n]) => [id, moneyInput(n)]),
    ),
  );
  const [expanded, setExpanded] = useState<string[]>([]),
    [error, setError] = useState("");
  const cats = data.categories.filter(
    (c) => !c.deleted && c.kind === "expense",
  );
  const roots = cats.filter((c) => !c.parentId);
  const set = (id: string, value: string) =>
    setDraft({ ...draft, [id]: value });
  const parse = () =>
    Object.fromEntries(
      Object.entries(draft)
        .filter(([id, v]) => v.trim() && cats.some((c) => c.id === id))
        .map(([id, v]) => [id, v.trim() === "0" ? 0 : calculate(v)]),
    );
  let validation = "";
  if (editing) {
    try {
      validateBudgetAllocation(
        input.trim() ? (input.trim() === "0" ? 0 : calculate(input)) : null,
        parse(),
        cats,
      );
    } catch (e) {
      validation = (e as Error).message;
    }
  }
  const body = (
    <View style={{ gap: 14 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt bold>{embedded ? "本月预算" : month + " · 预算"}</Txt>
        <Txt color={t.muted}>
          {budget === null ? "未设置" : formatMoney(budget)}
        </Txt>
      </Row>
      {budget !== null && (
        <>
          <View
            style={{
              height: 6,
              backgroundColor: t.soft,
              borderRadius: 3,
              overflow: "hidden",
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
          <Txt size={12} color={expense > budget ? "#D9363E" : t.muted}>
            {expense > budget ? "已超出" : "剩余"}{" "}
            {formatMoney(Math.abs(budget - expense))}
          </Txt>
        </>
      )}
      {editable && !editing && (
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
            setEditing(true);
          }}
        />
      )}
      {editing && (
        <>
          <Field
            label="总预算"
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            placeholder="未设置"
          />
          <Txt size={12} color={t.muted}>
            先分配一级预算，再展开分配二级预算。留空表示不单独分配。
          </Txt>
          {roots.map((root) => (
            <View
              key={root.id}
              style={{
                gap: 12,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderColor: t.line,
              }}
            >
              <Row>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`展开${root.name}预算`}
                  accessibilityState={{ expanded: expanded.includes(root.id) }}
                  onPress={() =>
                    setExpanded(
                      expanded.includes(root.id)
                        ? expanded.filter((id) => id !== root.id)
                        : [...expanded, root.id],
                    )
                  }
                  style={{
                    flex: 1,
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Icon name={root.icon} color={root.color} />
                  <Txt bold>{root.name}</Txt>
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
                <View style={{ width: 124 }}>
                  <Field
                    label={`${root.name}预算`}
                    value={draft[root.id] ?? ""}
                    onChangeText={(v) => set(root.id, v)}
                    keyboardType="decimal-pad"
                    placeholder="未分配"
                  />
                </View>
              </Row>
              {expanded.includes(root.id) &&
                cats
                  .filter((c) => c.parentId === root.id)
                  .map((c) => (
                    <Row key={c.id} style={{ paddingLeft: 26 }}>
                      <Txt style={{ flex: 1 }}>{c.name}</Txt>
                      <View style={{ width: 124 }}>
                        <Field
                          label={`${root.name} / ${c.name}预算`}
                          value={draft[c.id] ?? ""}
                          onChangeText={(v) => set(c.id, v)}
                          keyboardType="decimal-pad"
                          placeholder="未分配"
                        />
                      </View>
                    </Row>
                  ))}
            </View>
          ))}
          <ErrorText message={validation || error} />
          <Button
            label="保存预算"
            disabled={!!validation}
            onPress={() => {
              try {
                run(() =>
                  repo.setMonthBudget(
                    month,
                    input.trim()
                      ? input.trim() === "0"
                        ? 0
                        : calculate(input)
                      : null,
                    parse(),
                  ),
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
            label="取消"
            onPress={() => {
              setEditing(false);
              setError("");
            }}
          />
        </>
      )}
      {editable &&
        !editing &&
        roots
          .filter((c) => allocations[c.id] !== undefined)
          .map((c) => (
            <View key={c.id} style={{ gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`展开${c.name}预算`}
                onPress={() =>
                  setExpanded(
                    expanded.includes(c.id)
                      ? expanded.filter((id) => id !== c.id)
                      : [...expanded, c.id],
                  )
                }
              >
                <Row>
                  <Icon name={c.icon} color={c.color} />
                  <Txt style={{ flex: 1 }}>{c.name}</Txt>
                  <Txt>{formatMoney(allocations[c.id]!)}</Txt>
                  <Icon name="chevron.right" size={13} />
                </Row>
              </Pressable>
              {expanded.includes(c.id) &&
                cats
                  .filter(
                    (x) =>
                      x.parentId === c.id && allocations[x.id] !== undefined,
                  )
                  .map((x) => (
                    <Row key={x.id} style={{ paddingLeft: 32 }}>
                      <Txt size={13} style={{ flex: 1 }}>
                        {x.name}
                      </Txt>
                      <Txt size={13}>{formatMoney(allocations[x.id]!)}</Txt>
                    </Row>
                  ))}
            </View>
          ))}
    </View>
  );
  return embedded ? body : <Card>{body}</Card>;
}
