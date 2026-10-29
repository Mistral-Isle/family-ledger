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
// Only addition and subtraction; parsing never evaluates arbitrary JavaScript.
export function calculate(input: string): number {
  const expression = input.replace(/\s/g, "").replace(/−/g, "-");
  if (!/^-?\d+(?:\.\d{0,2})?(?:[+-]\d+(?:\.\d{0,2})?)*$/.test(expression))
    throw new Error(zh.errors.amount);
  return (expression.match(/[+-]?\d+(?:\.\d{0,2})?/g) ?? []).reduce(
    (sum, part) => assertMoney(sum + parseMoney(part.replace(/^\+/, ""))),
    0,
  );
}
