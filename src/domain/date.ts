import dayjs from "dayjs";
import { zh } from "../i18n/zh";
// The ledger uses present-day Shanghai time (UTC+8), regardless of device zone.
// Do not round-trip toLocaleString through Date.parse: Hermes/iOS may reject
// the localized text that Day.js's timezone plugin generates.
export const today = () =>
  new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
export const thisMonth = () => today().slice(0, 7);
export function validDate(value: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !dayjs(value).isValid() ||
    dayjs(value).format("YYYY-MM-DD") !== value
  )
    throw new Error(zh.errors.date);
  return value;
}
export function shiftMonth(month: string, delta: number): string {
  return dayjs(`${month}-01`).add(delta, "month").format("YYYY-MM");
}
export function monthTitle(month: string): string {
  return `${month.slice(0, 4)} / ${month.slice(5)}`;
}
