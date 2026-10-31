import {
  categoryChartColors,
  chartPalette,
  chartOtherColor,
} from "../src/domain/chartColors";
import { donutLayout, donutSlices } from "../src/domain/donut";

const items = (amounts: number[]) =>
  amounts.map((amount, i) => ({
    id: String(i),
    name: `分类${i}`,
    amount,
    color: chartPalette[i % chartPalette.length]!,
  }));

test("chart colors distinguish legacy yellow categories and keep list/plot mapping stable", () => {
  const categories = Array.from({ length: 14 }, (_, i) => ({
    id: String(i),
    parentId: null,
    sort: i,
    color: i % 2 ? "#E8BC41" : "#E9BD42",
  }));
  const visible = ["0", "6", "12", "1", "7", "13"];
  const colors = categoryChartColors(categories, visible);
  expect(new Set(visible.map((id) => colors.get(id))).size).toBe(6);
  expect(
    visible.every((id) => colors.get(id) !== categories[Number(id)]!.color),
  ).toBe(true);
  expect(categoryChartColors([...categories].reverse(), visible)).toEqual(
    colors,
  );
  const stable = ["0", "1", "2"];
  const before = categoryChartColors(categories, stable);
  const after = categoryChartColors(
    [...categories, { id: "child", parentId: "0", sort: -1 }],
    [...stable].reverse(),
  );
  stable.forEach((id) => expect(after.get(id)).toBe(before.get(id)));
  expect(
    donutSlices(items([100, 90, 80, 70, 60, 50, 40]), 6).at(-1)?.color,
  ).toBe(chartOtherColor);
});

type Point = { x: number; y: number };
function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
}
function crosses(a: Point, b: Point, c: Point, d: Point) {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return (
    cross(a, b, c) * cross(a, b, d) < -0.000001 &&
    cross(c, d, a) * cross(c, d, b) < -0.000001
  );
}

test.each([240, 256, 287, 311, 326, 358, 440])(
  "leaders stay outside the donut without crossing on a %ipx chart",
  (width) => {
    const height = Math.max(240, width * 0.86),
      radius = Math.min(width * 0.3, width / 2 - (width < 280 ? 54 : 66));
    const center = { x: width / 2, y: height / 2 };
    const scenarios = [
      [],
      [367000],
      [4800, 1200, 400, 200, 200],
      [350000, 15600, 1400],
      [1000, 1, 1, 1, 1, 1],
      [50, 40, 2.5, 2.5, 2.5, 2.5],
      [1, 1, 1, 1, 1, 1],
      [49.37, 26.2, 7.73, 5.08, 4.66, 3.72, 3.24],
    ];
    // Deterministic uneven distributions catch crowded labels beyond the example screenshot.
    let seed = 17;
    for (let i = 0; i < 40; i++)
      scenarios.push(
        Array.from({ length: 6 }, () => {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          return Math.pow(seed / 2 ** 32, 5) * 1000 + 0.001;
        }),
      );
    for (const amounts of scenarios) {
      const layout = donutLayout(items(amounts), width, height, radius);
      expect(
        layout.slices.reduce((sum, slice) => sum + slice.amount, 0),
      ).toBeCloseTo(amounts.reduce((a, b) => a + b, 0));
      const lines = layout.labels.map((label) => [
        { x: label.x, y: label.anchorY },
        { x: label.elbowX, y: label.y },
        { x: label.endX, y: label.y },
      ]);
      for (const side of [-1, 1]) {
        const group = layout.labels
          .filter((label) => label.side === side)
          .sort((a, b) => a.y - b.y);
        group.forEach((label, i) => {
          expect(label.y).toBeGreaterThanOrEqual(24 - 0.000001);
          expect(label.y).toBeLessThanOrEqual(height - 24 + 0.000001);
          if (i)
            expect(label.y - group[i - 1]!.y).toBeGreaterThanOrEqual(
              (label.labelHeight + group[i - 1]!.labelHeight) / 2 +
                6 -
                0.000001,
            );
        });
      }
      lines.forEach((line, i) => {
        line.slice(1).forEach((point, j) => {
          expect(
            distanceToSegment(center, line[j]!, point),
          ).toBeGreaterThanOrEqual(radius - 0.000001);
          lines.slice(i + 1).forEach((other) =>
            other.slice(1).forEach((end, k) => {
              expect(crosses(line[j]!, point, other[k]!, end)).toBe(false);
            }),
          );
        });
      });
    }
  },
);

test.each([326, 440])(
  "labels follow the ring with short leaders at %ipx",
  (width) => {
    const radius = Math.min(width * 0.3, width / 2 - 66);
    const layout = donutLayout(
      items([4800, 1200, 400, 200, 200]),
      width,
      Math.max(240, width * 0.86),
      radius,
    );
    expect(layout.labels.length).toBeGreaterThanOrEqual(4);
    for (const l of layout.labels)
      expect(Math.hypot(l.elbowX - l.x, l.y - l.anchorY)).toBeLessThan(48);
    expect(layout.labels.some((l) => l.y > l.anchorY)).toBe(true);
  },
);
test("dense charts preserve slices and choose a bounded set of readable labels", () => {
  const input = items(Array.from({ length: 30 }, (_, i) => 30 - i));
  const layout = donutLayout(input, 326, 280.36, 97);
  expect(layout.slices).toHaveLength(30);
  expect(layout.labels.length).toBeGreaterThan(0);
  expect(layout.labels.length).toBeLessThanOrEqual(10);
  const cats = input.map((x, i) => ({ id: x.id, parentId: null, sort: i }));
  const all = categoryChartColors(
    cats,
    cats.map((c) => c.id),
  );
  const filtered = categoryChartColors(cats, ["19", "7", "0"]);
  for (const id of ["19", "7", "0"]) expect(filtered.get(id)).toBe(all.get(id));
});
