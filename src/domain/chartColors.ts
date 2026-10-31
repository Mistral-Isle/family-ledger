import type { Category } from "./types";

// Categorical colors for statistics, independent of the app's warm accent and
// the editable category swatches. Keep gray exclusively for grouped slices.
export const chartPalette = [
  "#EF747B",
  "#F29D58",
  "#EAC44F",
  "#66B99B",
  "#49ADC0",
  "#679DDF",
  "#8586D5",
  "#AF83CD",
  "#D580AD",
  "#CF8370",
  "#B3AF54",
  "#7BAC6C",
  "#5EAAA6",
  "#648CB7",
  "#9B91C5",
  "#C99ABC",
  "#CEAC7A",
  "#88A6A0",
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
  // Assign from the complete category order, never the month or amount ranking.
  // The same category therefore keeps its color in the plot and list across filters.
  visibleIds.forEach((id) => {
    if (!colors.has(id)) colors.set(id, chartOtherColor);
  });
  return colors;
}
