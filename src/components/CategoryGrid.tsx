import { useState } from "react";
import { View } from "react-native";
import type { Category } from "../domain/types";
import { CategoryTile } from "./CategoryTile";
import { IconButton, Row, Txt, useTheme } from "./ui";

export function CategoryGrid({
  categories,
  value,
  onChange,
  allowSelectParent = false,
  emptyText,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  allowSelectParent?: boolean;
  emptyText?: string;
}) {
  const t = useTheme();
  const [expanded, setExpanded] = useState("");
  const sorted = [...categories].sort((a, b) => a.sort - b.sort);
  const idSet = new Set(sorted.map((c) => c.id));
  const roots = sorted.filter((c) => !c.parentId || !idSet.has(c.parentId));
  const childrenMap = new Map<string, Category[]>();
  for (const c of sorted) {
    if (!c.parentId || !idSet.has(c.parentId)) continue;
    const list = childrenMap.get(c.parentId) ?? [];
    list.push(c);
    childrenMap.set(c.parentId, list);
  }
  const expandedParent = roots.find((c) => c.id === expanded);
  const expandedChildren = expandedParent
    ? (childrenMap.get(expandedParent.id) ?? [])
    : [];

  if (!sorted.length) {
    return emptyText ? <Txt color={t.muted}>{emptyText}</Txt> : null;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {roots.map((c) => {
          const children = childrenMap.get(c.id) ?? [];
          const selectedChild = children.find((ch) => ch.id === value);
          return (
            <CategoryTile
              key={c.id}
              category={c}
              shown={selectedChild ?? c}
              selected={value === c.id || !!selectedChild}
              hasChildren={children.length > 0}
              onPress={() => {
                if (children.length > 0) {
                  setExpanded((current) => (current === c.id ? "" : c.id));
                } else {
                  onChange(c.id);
                  setExpanded("");
                }
              }}
            />
          );
        })}
      </View>
      {expandedParent && expandedChildren.length > 0 && (
        <View
          style={{
            backgroundColor: t.soft,
            borderRadius: 20,
            padding: 12,
            gap: 8,
          }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold>{expandedParent.name}</Txt>
            <IconButton
              name="xmark"
              label={`收起${expandedParent.name}二级分类`}
              onPress={() => setExpanded("")}
            />
          </Row>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {allowSelectParent && (
              <CategoryTile
                category={{
                  ...expandedParent,
                  name: `全部${expandedParent.name}`,
                }}
                selected={value === expandedParent.id}
                hasChildren={false}
                onPress={() => {
                  onChange(expandedParent.id);
                  setExpanded("");
                }}
              />
            )}
            {expandedChildren.map((child) => (
              <CategoryTile
                key={child.id}
                category={child}
                selected={value === child.id}
                hasChildren={false}
                onPress={() => {
                  onChange(child.id);
                  setExpanded("");
                }}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
