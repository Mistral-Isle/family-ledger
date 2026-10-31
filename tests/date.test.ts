import { monthDailyMetrics } from "../src/domain/budgets";
import { thisMonth, today, validDate } from "../src/domain/date";

describe("Shanghai calendar dates on native and web", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("home summary does not parse locale-dependent date strings", () => {
    jest.setSystemTime(new Date("2026-10-31T16:43:51Z"));
    // Localized text is presentation data, not a portable Date.parse input.
    const localized = jest
      .spyOn(Date.prototype, "toLocaleString")
      .mockReturnValue("2026年11月1日 00:43:51");
    expect(today()).toBe("2026-11-01");
    expect(thisMonth()).toBe("2026-11");
    expect(monthDailyMetrics(thisMonth(), 300, 30000)).toEqual({
      elapsed: 1,
      remaining: 30,
      dailyExpense: 300,
      dailyRemaining: 990,
    });
    expect(localized).not.toHaveBeenCalled();
  });

  test.each([
    ["2026-10-31T15:59:59Z", "2026-10-31"],
    ["2026-10-31T16:00:00Z", "2026-11-01"],
    ["2026-12-31T16:00:00Z", "2027-01-01"],
    ["2028-02-28T16:00:00Z", "2028-02-29"],
    ["2028-02-29T16:00:00Z", "2028-03-01"],
  ])("%s uses the Shanghai calendar day %s", (instant, expected) => {
    jest.setSystemTime(new Date(instant));
    expect(today()).toBe(expected);
    expect(validDate(today())).toBe(expected);
  });

  test.each(["2026-02-29", "2026-11-31", "Invalid Date", "2026-1-01"])(
    "invalid input %s is still rejected",
    (value) => expect(() => validDate(value)).toThrow("请输入有效日期"),
  );
});
