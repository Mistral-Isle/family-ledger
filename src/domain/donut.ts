import { chartOtherColor } from "./chartColors";

export type DonutItem = {
  id: string;
  name: string;
  amount: number;
  color: string;
};

/** Small slices are grouped visually only; the underlying category list stays complete. */
export function donutSlices(items: DonutItem[], limit = Infinity) {
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

/** Keep every slice, but label only the largest readable categories. Labels follow
 * the circumference; short radial leaders take priority over column alignment. */
export function donutLayout(
  items: DonutItem[],
  width: number,
  height: number,
  outerRadius: number,
) {
  const source = donutSlices(items);
  const cx = width / 2,
    cy = height / 2;
  const fontSize = width < 280 ? 10 : 11.5;
  const textWidth = (text: string) =>
    Array.from(text).reduce(
      (sum, char) => sum + (/[^\x00-\x7F]/.test(char) ? 1 : 0.57) * fontSize,
      0,
    );
  const candidates = source
    .filter((s, i) => i === 0 || s.share >= 0.02)
    .slice(0, width < 280 ? 6 : 10);
  function candidate(rotation: number, count: number) {
    const slices = source.map((s) => ({
      ...s,
      start: s.start + rotation / (Math.PI * 2),
      angle: s.angle + rotation,
    }));
    const ids = new Set(candidates.slice(0, count).map((s) => s.id));
    const labels = slices
      .filter((s) => ids.has(s.id))
      .map((slice) => {
        const cos = Math.cos(slice.angle),
          sin = Math.sin(slice.angle);
        const side = cos >= 0 ? 1 : -1;
        const x = cx + cos * outerRadius,
          anchorY = cy + sin * outerRadius;
        const naturalY = cy + sin * (outerRadius + 12);
        const name = slice.name.replace(/[\s/／]+/g, "");
        const shortName = name.length > 4 ? name.slice(0, 3) + "…" : name;
        const available = width / 2 - Math.abs(cos * (outerRadius + 12)) - 12;
        const singleText = shortName + " " + shareLabel(slice.share, 1);
        const twoLine = slice.share >= 0.1 || textWidth(singleText) > available;
        return {
          ...slice,
          side,
          x,
          anchorY,
          naturalY,
          y: naturalY,
          elbowX: 0,
          endX: 0,
          twoLine,
          displayName: shortName,
          labelHeight: twoLine ? 29 : 16,
        };
      });
    for (const side of [-1, 1]) {
      const group = labels
        .filter((l) => l.side === side)
        .sort((a, b) => a.anchorY - b.anchorY);
      group.forEach((l, i) => {
        l.y = Math.max(
          24,
          l.y,
          i
            ? group[i - 1]!.y +
                (group[i - 1]!.labelHeight + l.labelHeight) / 2 +
                6
            : 24,
        );
      });
      for (let i = group.length - 1; i >= 0; i--)
        group[i]!.y = Math.min(
          group[i]!.y,
          i === group.length - 1
            ? height - 24
            : group[i + 1]!.y -
                (group[i + 1]!.labelHeight + group[i]!.labelHeight) / 2 -
                6,
        );
    }
    let valid = true,
      score = Math.abs(rotation) * 8;
    for (const l of labels) {
      const dy = l.y - cy;
      l.elbowX =
        cx +
        l.side *
          Math.max(
            Math.abs(l.x - cx) + 5,
            Math.sqrt(Math.max(0, (outerRadius + 12) ** 2 - dy ** 2)),
          );
      l.endX = l.elbowX + l.side * 7;
      const dx = l.elbowX - l.x,
        deltaY = l.y - l.anchorY;
      // A line leaving the ring must point outward, including after label avoidance.
      if ((l.x - cx) * dx + (l.anchorY - cy) * deltaY < -1e-6 || l.y < 24)
        valid = false;
      const available = l.side === 1 ? width - l.endX - 5 : l.endX - 5;
      if (
        !l.twoLine &&
        textWidth(l.displayName + " " + shareLabel(l.share, 1)) > available
      ) {
        valid = false;
      }
      const needed = l.twoLine
        ? Math.max(textWidth(l.displayName), textWidth(shareLabel(l.share, 1)))
        : textWidth(l.displayName + " " + shareLabel(l.share, 1));
      if (needed > available) valid = false;
      score += (l.y - l.naturalY) ** 2 * 8 + dx * dx + deltaY * deltaY;
    }
    // Avoid crossed leaders or text boxes, even for dense, uneven distributions.
    const cross = (a: number[], b: number[], c: number[]) =>
      (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
    const points = (l: (typeof labels)[number]) => [
      [l.x, l.anchorY],
      [l.elbowX, l.y],
      [l.endX, l.y],
    ];
    labels.forEach((l, i) =>
      labels.slice(i + 1).forEach((other) => {
        const a = points(l),
          b = points(other);
        for (let j = 0; j < 2; j++)
          for (let k = 0; k < 2; k++)
            if (
              cross(a[j]!, a[j + 1]!, b[k]!) *
                cross(a[j]!, a[j + 1]!, b[k + 1]!) <
                -1e-6 &&
              cross(b[k]!, b[k + 1]!, a[j]!) *
                cross(b[k]!, b[k + 1]!, a[j + 1]!) <
                -1e-6
            )
              valid = false;
      }),
    );
    return { slices, labels, score, valid };
  }
  for (let count = candidates.length; count >= 0; count--) {
    let best: ReturnType<typeof candidate> | undefined;
    for (let step = 0; step < 72; step++) {
      const rotation = ((step <= 36 ? step : step - 72) * Math.PI) / 36;
      const next = candidate(rotation, count);
      if (next.valid && (!best || next.score < best.score)) best = next;
    }
    if (best) return best;
  }
  return candidate(0, 0);
}

export function shareLabel(amount: number, total: number) {
  return amount > 0 && total > 0
    ? `${Number(((amount * 100) / total).toFixed(2))}%`
    : "—";
}
