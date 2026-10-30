export type DonutItem = {
  id: string;
  name: string;
  amount: number;
  color: string;
};

/** Small slices are grouped visually only; the underlying category list stays complete. */
export function donutSlices(items: DonutItem[], limit = 6) {
  const positive = items
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const shown =
    positive.length <= limit
      ? positive
      : [
          ...positive.slice(0, limit - 1),
          {
            id: "donut-other",
            name: "其他",
            amount: positive
              .slice(limit - 1)
              .reduce((sum, item) => sum + item.amount, 0),
            color: "#9A8AC7",
          },
        ];
  const total = shown.reduce((sum, item) => sum + item.amount, 0);
  let offset = 0;
  return shown.map((item) => {
    const share = item.amount / total;
    const start = offset;
    offset += share;
    return {
      ...item,
      share,
      start,
      angle: (start + share / 2) * Math.PI * 2 - Math.PI / 2,
    };
  });
}

/** Resolve labels on each side in vertical order, keeping two text lines clear. */
export function donutLabels(
  slices: ReturnType<typeof donutSlices>,
  centerY: number,
  radius: number,
  height: number,
) {
  const labels = slices.map((slice) => ({
    ...slice,
    side: Math.cos(slice.angle) >= 0 ? 1 : -1,
    y: centerY + Math.sin(slice.angle) * (radius + 30),
  }));
  for (const side of [-1, 1]) {
    const group = labels
      .filter((label) => label.side === side)
      .sort((a, b) => a.y - b.y);
    group.forEach((label, index) => {
      label.y = Math.max(28, label.y, index ? group[index - 1]!.y + 36 : 28);
    });
    for (let i = group.length - 1; i >= 0; i--) {
      group[i]!.y = Math.min(
        group[i]!.y,
        i === group.length - 1 ? height - 28 : group[i + 1]!.y - 36,
      );
    }
  }
  return labels;
}

export function shareLabel(amount: number, total: number) {
  return amount > 0 && total > 0
    ? `${Number(((amount * 100) / total).toFixed(2))}%`
    : "—";
}
