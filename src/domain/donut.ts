import { chartOtherColor } from "./chartColors";

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
            color: chartOtherColor,
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
    // Center the fan around its anchors instead of pushing every small label
    // downward. This keeps the leaders short for very uneven distributions.
    if (group.length) {
      const shift =
        group.reduce(
          (sum, label) =>
            sum + centerY + Math.sin(label.angle) * (radius + 30) - label.y,
          0,
        ) / group.length;
      const bounded = Math.max(
        28 - group[0]!.y,
        Math.min(height - 28 - group[group.length - 1]!.y, shift),
      );
      group.forEach((label) => {
        label.y += bounded;
      });
    }
  }
  return labels;
}

/** Choose an orientation with room for short leaders, especially tiny slices.
 * Rotation changes neither the proportions nor the amount-sorted list. */
export function donutLayout(
  items: DonutItem[],
  width: number,
  height: number,
  outerRadius: number,
) {
  const source = donutSlices(items);
  const cx = width / 2,
    cy = height / 2;
  const baseRotation = source.length ? -source[0]!.angle : 0;
  let best: ReturnType<typeof candidate> | undefined;
  function candidate(rotation: number) {
    const slices = source.map((slice) => ({
      ...slice,
      start: slice.start + rotation / (2 * Math.PI),
      angle: slice.angle + rotation,
    }));
    let score = 0;
    const labels = donutLabels(slices, cy, outerRadius - 18, height).map(
      (label) => {
        const cos = Math.cos(label.angle),
          sin = Math.sin(label.angle);
        const x = cx + cos * outerRadius,
          y = cy + sin * outerRadius;
        const radialX = cx + cos * (outerRadius + 4);
        const radialY = cy + sin * (outerRadius + 4);
        const elbowX = cx + label.side * (outerRadius + 6);
        const edge = width < 280 ? 46 : 54;
        const endX = label.side === 1 ? width - edge : edge;
        const dx = elbowX - radialX,
          dy = label.y - radialY;
        // Penalize any segment entering the circle, rather than routing a long
        // rectangular line across the top of the chart to reach a moved label.
        const lengthSquared = dx * dx + dy * dy;
        const projection = lengthSquared
          ? Math.max(
              0,
              Math.min(
                1,
                -((radialX - cx) * dx + (radialY - cy) * dy) / lengthSquared,
              ),
            )
          : 0;
        const clearance = Math.hypot(
          radialX + projection * dx - cx,
          radialY + projection * dy - cy,
        );
        score +=
          lengthSquared + Math.max(0, outerRadius + 1 - clearance) * 100000;
        return { ...label, x, anchorY: y, radialX, radialY, elbowX, endX };
      },
    );
    return { slices, labels, score };
  }
  // Only six slices are drawn; this bounded search is cheap and keeps a dense
  // cluster beside the ring rather than directly above or below it.
  for (let step = 0; step < 72; step++) {
    const layout = candidate(baseRotation + (step * Math.PI) / 36);
    if (!best || layout.score < best.score - 0.01) best = layout;
  }
  return best!;
}

export function shareLabel(amount: number, total: number) {
  return amount > 0 && total > 0
    ? `${Number(((amount * 100) / total).toFixed(2))}%`
    : "—";
}
