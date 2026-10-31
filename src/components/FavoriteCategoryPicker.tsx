import { useState } from "react";
import { View } from "react-native";
import { CategoryTile } from "./CategoryTile";
import { useLedger } from "./LedgerProvider";
import { Segmented } from "./Segmented";
import { IconButton, Row, Txt, useTheme } from "./ui";

export function FavoriteCategoryPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data } = useLedger();
  const t = useTheme();
  const selected = data.categories.find((c) => c.id === value);
  const [kind, setKind] = useState<"expense" | "income">(selected?.kind ?? "expense");
  const [expanded, setExpanded] = useState("");
  const categories = data.categories.filter((c) => !c.deleted && !c.hidden && c.kind === kind &&
    (!c.parentId || data.categories.some((p) => p.id === c.parentId && !p.deleted && !p.hidden)))
    .sort((a, b) => a.sort - b.sort);
  const parent = categories.find((c) => c.id === expanded);
  return (
    <View style={{ gap: 12 }}>
      <Segmented compact value={kind} options={[{ value: "expense", label: "支出" }, { value: "income", label: "收入" }]}
        onChange={(next) => {
          setKind(next);
          setExpanded("");
          onChange(data.categories.find((c) => c.kind === next && !c.deleted && !c.hidden && !c.parentId)?.id ?? "");
        }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {categories.filter((c) => !c.parentId).map((c) => {
          const hasChildren = categories.some((child) => child.parentId === c.id);
          return <CategoryTile key={c.id} category={c}
            shown={selected?.parentId === c.id ? selected : c}
            selected={value === c.id || selected?.parentId === c.id} hasChildren={hasChildren}
            onPress={() => { if (hasChildren) setExpanded(c.id); else { onChange(c.id); setExpanded(""); } }} />;
        })}
      </View>
      {parent && (
        <View style={{ backgroundColor: t.soft, borderRadius: 20, padding: 12, gap: 8 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold>{parent.name}</Txt>
            <IconButton name="xmark" label="收起常用项二级分类" onPress={() => setExpanded("")} />
          </Row>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {categories.filter((c) => c.parentId === expanded).map((c) => (
              <CategoryTile key={c.id} category={c} selected={value === c.id} hasChildren={false}
                onPress={() => { onChange(c.id); setExpanded(""); }} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
