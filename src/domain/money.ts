import { zh } from "../i18n/zh";

export function assertMoney(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error(zh.errors.overflow);
  return value;
}
export function parseMoney(input: string): number {
  const value = input.trim();
  if (!/^-?\d+(\.\d{0,2})?$/.test(value)) throw new Error(zh.errors.money);
  const negative = value.startsWith("-");
  const [whole = "0", decimal = ""] = value.replace(/^-/, "").split(".");
  const cents = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));
  return assertMoney(Number(negative ? -cents : cents));
}
export function moneyInput(cents: number): string {
  assertMoney(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
}
export function formatMoney(cents: number, symbol = true): string {
  const [whole = "0", decimal = "00"] = moneyInput(cents).split(".");
  return `${symbol ? zh.currency : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimal}`;
}
// Exact rational arithmetic; round only the final result to cents, half away
// from zero. Never execute user input or use floating-point money arithmetic.
export function calculate(input: string): number {
  const expression = input
    .replace(/\s/g, "")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");
  if (
    expression.length > 80 ||
    !/^-?\d+(?:\.\d{0,2})?(?:[+*/-]-?\d+(?:\.\d{0,2})?)*$/.test(expression)
  )
    throw new Error(zh.errors.amount);
  const tokens = expression.match(/\d+(?:\.\d{0,2})?|[+*/-]/g)!;
  type Fraction = { n: bigint; d: bigint };
  let cursor = 0;
  const number = (): Fraction => {
    const sign = tokens[cursor] === "-" ? (cursor++, -1n) : 1n;
    return { n: sign * BigInt(parseMoney(tokens[cursor++]!)), d: 100n };
  };
  const product = (): Fraction => {
    let value = number();
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const op = tokens[cursor++];
      const next = number();
      if (op === "/" && next.n === 0n) throw new Error(zh.errors.divideByZero);
      value =
        op === "*"
          ? { n: value.n * next.n, d: value.d * next.d }
          : { n: value.n * next.d, d: value.d * next.n };
    }
    return value;
  };
  let value = product();
  while (cursor < tokens.length) {
    const sign = tokens[cursor++] === "+" ? 1n : -1n;
    const next = product();
    value = {
      n: value.n * next.d + sign * next.n * value.d,
      d: value.d * next.d,
    };
  }
  const sign = value.n < 0n !== value.d < 0n ? -1n : 1n;
  const numerator = (value.n < 0n ? -value.n : value.n) * 100n;
  const denominator = value.d < 0n ? -value.d : value.d;
  const cents =
    numerator / denominator +
    ((numerator % denominator) * 2n >= denominator ? 1n : 0n);
  return assertMoney(Number(sign * cents));
}
