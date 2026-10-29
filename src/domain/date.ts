import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { zh } from "../i18n/zh";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Shanghai");
export const today = () => dayjs().tz("Asia/Shanghai").format("YYYY-MM-DD");
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
