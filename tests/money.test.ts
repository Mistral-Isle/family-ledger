import {
  calculate,
  formatMoney,
  parseMoney,
  moneyInput,
} from "../src/domain/money";
describe("integer cents", () => {
  test.each([
    ["0.01", 1],
    ["1666.67", 166667],
    ["-100.10", -10010],
    ["7.", 700],
  ])("parses %s", (input, cents) => expect(parseMoney(input)).toBe(cents));
  test.each(["0.001", "NaN", "Infinity", "1e4", "1,000", "900719925474099.99"])(
    "rejects %s",
    (value) => expect(() => parseMoney(value)).toThrow(),
  );
  test("calculator adds and subtracts exact cents", () => {
    expect(calculate("0.1+0.2")).toBe(30);
    expect(calculate("100-7.01+0.01")).toBe(9300);
    expect(() => calculate("1+alert(1)")).toThrow();
  });
  test("formats without float conversions", () => {
    expect(formatMoney(1234567)).toBe("¥12,345.67");
    expect(moneyInput(-1)).toBe("-0.01");
  });
});
