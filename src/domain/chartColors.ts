import type { Category } from "./types";

// Categorical colors for statistics, independent of the app's warm accent and
// the editable category swatches. Keep gray exclusively for grouped slices.
export const chartPalette = [
  "#E57368",
  "#E89A54",
  "#E6BE53",
  "#64B896",
  "#4FAEC4",
  "#5F93E4",
  "#767FE0",
  "#A679DC",
  "#DC78A8",
  "#E0856B",
] as const;
export const chartOtherColor = "#8B95A5";

export function cycleChartColors(orderedIds: string[]) {
  const colors = new Map<string, string>();
  const n = orderedIds.length;
  const wrapCollision = n > 2 && (n - 1) % chartPalette.length === 0;
  orderedIds.forEach((id, index) => {
    const color =
      index === n - 1 && wrapCollision
        ? chartPalette[1]!
        : chartPalette[index % chartPalette.length]!;
    colors.set(id, color);
  });
  return colors;
}

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
  // Assign from the complete category order, never the month or amount ranking.
  // The same category therefore keeps its color in the plot and list across filters.
  visibleIds.forEach((id) => {
    if (!colors.has(id)) colors.set(id, chartOtherColor);
  });
  return colors;
}
