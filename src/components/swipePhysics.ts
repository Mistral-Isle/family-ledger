export const swipeWidth = 80;
export function resistedPosition(
  value: number,
  max: number,
  endWidth = swipeWidth,
) {
  const bound = value < -endWidth ? -endWidth : value > max ? max : value;
  const over = value - bound;
  return bound + (over * 24 * 0.55) / (24 + 0.55 * Math.abs(over));
}
export function swipeTarget(
  position: number,
  velocity: number,
  max: number,
  endWidth = swipeWidth,
) {
  const projected = position + ((velocity / 1000) * 0.99) / (1 - 0.99);
  return projected < -endWidth / 2 ? -endWidth : projected > max / 2 ? max : 0;
}
