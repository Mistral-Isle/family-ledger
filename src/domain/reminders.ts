import type { Snapshot } from "./types";
import { loanProjection, addMonths, type LoanData } from "./finance";
import { accountBalance } from "./selectors";
import { addDays } from "./reports";
import { zh } from "../i18n/zh";
export function financialReminders(s: Snapshot, now = new Date()) {
  const rows: { id: string; title: string; body: string; date: Date }[] = [];
  const add = (id: string, title: string, body: string, day: string) => {
    const date = new Date(day + "T09:00:00+08:00");
    if (date > now) rows.push({ id, title, body, date });
  };
  for (const plan of s.plans.filter((p) => !p.deleted)) {
    const d = JSON.parse(plan.data);
    if (d.closed) continue;
    if (plan.kind === "loan") {
      const account = s.accounts.find((a) => a.id === d.accountId);
      if (!account) continue;
      const projection = loanProjection(
        d as LoanData,
        Math.max(0, -accountBalance(account, s.txns)),
      );
      add(
        plan.id + "-payment",
        plan.name,
        zh.reminders.payment,
        addDays(d.nextDueDate, -3),
      );
      if (d.settlePeriod > d.paidPeriods)
        for (const days of [30, 7])
          add(
            plan.id + "-settle-" + days,
            plan.name,
            zh.reminders.settlement,
            addDays(projection.deadline, -days),
          );
    } else if (plan.kind === "prepaid")
      add(
        plan.id + "-renew",
        plan.name,
        zh.reminders.renewal,
        addDays(addMonths(d.startMonth + "-01", d.months, d.day), -7),
      );
  }
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 60);
}
