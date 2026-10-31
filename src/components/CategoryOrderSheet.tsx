import type { Category } from "../domain/types";
import { ReorderSheet } from "./ReorderSheet";
export function CategoryOrderSheet({
  items,
  title,
  onSave,
  onClose,
}: {
  items: Category[];
  title: string;
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  return (
    <ReorderSheet
      items={items.map((c) => ({
        id: c.id,
        name: c.name + (c.hidden ? " · 已隐藏" : ""),
      }))}
      title={title}
      onSave={onSave}
      onClose={onClose}
      cancelLabel="取消分类排序"
      saveLabel="保存分类顺序"
    />
  );
}
