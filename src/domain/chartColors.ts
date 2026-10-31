import type { Category } from "./types";

// Categorical colors for statistics, independent of the app's warm accent and
// the editable category swatches. Keep gray exclusively for grouped slices.
export const chartPalette = [
  "#4D83F3", // blue
  "#EF6C78", // coral
  "#20AB9D", // teal
  "#9670DD", // violet
  "#F39B45", // orange
  "#55A64E", // green
] as const;
export const chartOtherColor = "#8B95A5";

export function categoryChartColors(
  categories: Pick<Category, "id" | "parentId" | "sort">[],
  visibleIds: string[],
) {
  const colors = new Map<string, string>();
  // Children must not consume their parents' palette slots. Base assignments
  // depend on category order, never on the selected month or transaction amount.
  for (const children of [false, true]) {
    categories
      .filter((category) => !!category.parentId === children)
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
      .forEach((category, index) => {
        colors.set(category.id, chartPalette[index % chartPalette.length]!);
      });
  }
  const used = new Set<string>();
  // Prioritize the visible slices (the report is amount-sorted). Resolve reuse
  // from large category sets before drawing, and share this map with the list.
  visibleIds.forEach((id, index) => {
    const preferred = colors.get(id) ?? chartPalette[0];
    const color = !used.has(preferred)
      ? preferred
      : (chartPalette.find((candidate) => !used.has(candidate)) ??
        chartPalette[index % chartPalette.length]!);
    colors.set(id, color);
    used.add(color);
  });
  return colors;
}
