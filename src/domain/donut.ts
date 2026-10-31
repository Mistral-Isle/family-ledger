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

/** Resolve labels in anchor order; lift prefers an upward diagonal into each label. */
export function donutLabels(
  slices: ReturnType<typeof donutSlices>,
  centerY: number,
  radius: number,
  height: number,
  lift = false,
) {
  const preferredY = (slice: { angle: number }) =>
    lift
      ? centerY +
        Math.sin(slice.angle) * radius -
        Math.max(
          18,
          (radius + 6 - Math.abs(Math.cos(slice.angle) * radius)) * 0.85,
        )
      : centerY + Math.sin(slice.angle) * (radius + 30);
  const labels = slices.map((slice) => ({
    ...slice,
    side: Math.cos(slice.angle) >= 0 ? 1 : -1,
    y: preferredY(slice),
  }));
  for (const side of [-1, 1]) {
    const group = labels
      .filter((label) => label.side === side)
      .sort((a, b) => Math.sin(a.angle) - Math.sin(b.angle));
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
        group.reduce((sum, label) => sum + preferredY(label) - label.y, 0) /
        group.length;
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
  function candidate(rotation: number, lift: boolean) {
    const slices = source.map((slice) => ({
      ...slice,
      start: slice.start + rotation / (2 * Math.PI),
      angle: slice.angle + rotation,
    }));
    let score = 0;
    const labels = donutLabels(
      slices,
      cy,
      lift ? outerRadius : outerRadius - 18,
      height,
      lift,
    ).map((label) => {
      const cos = Math.cos(label.angle),
        sin = Math.sin(label.angle);
      const x = cx + cos * outerRadius,
        y = cy + sin * outerRadius;
      const elbowX = cx + label.side * (outerRadius + 6);
      const edge = width < 280 ? 46 : 54;
      const endX = label.side === 1 ? width - edge : edge;
      const dx = elbowX - x,
        dy = label.y - y;
      // Connect the ring directly to one elbow; avoid an extra radial kink.
      // Penalize any segment entering the circle, rather than routing a long
      // rectangular line across the top of the chart to reach a moved label.
      const lengthSquared = dx * dx + dy * dy;
      const projection = lengthSquared
        ? Math.max(
            0,
            Math.min(1, -((x - cx) * dx + (y - cy) * dy) / lengthSquared),
          )
        : 0;
      const clearance = Math.hypot(
        x + projection * dx - cx,
        y + projection * dy - cy,
      );
      // Prefer upward leaders and turns of at least 30 degrees; circle clearance
      // takes priority when a narrow chart or dense cluster needs a fallback.
      score +=
        lengthSquared +
        (dy > -8 ? 2000 : 0) +
        Math.max(0, Math.abs(dx) * 0.58 - Math.abs(dy)) * 100 +
        (clearance < outerRadius - 0.000001 ? 1e9 : 0) +
        Math.max(0, outerRadius - clearance) * 100000;
      return { ...label, x, anchorY: y, elbowX, endX };
    });
    return { slices, labels, score };
  }
  // Only six slices are drawn; this bounded search is cheap and keeps a dense
  // cluster beside the ring rather than directly above or below it.
  for (let step = 0; step < 72; step++) {
    for (const lift of [true, false]) {
      const layout = candidate(baseRotation + (step * Math.PI) / 36, lift);
      if (!best || layout.score < best.score - 0.01) best = layout;
    }
  }
  return best!;
}

export function shareLabel(amount: number, total: number) {
  return amount > 0 && total > 0
    ? `${Number(((amount * 100) / total).toFixed(2))}%`
    : "—";
}
