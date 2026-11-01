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
  const projected = position + ((velocity / 1000) * 0.98) / (1 - 0.98);
  return projected < -endWidth * 0.45 ? -endWidth : projected > max * 0.45 ? max : 0;
}
