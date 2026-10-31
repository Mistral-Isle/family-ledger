import type { LedgerRepository } from "../db/repository";
import { today } from "../domain/date";

export function seedIconPreview(repo: LedgerRepository) {
  const data = repo.snapshot();
  if (data.txns.length) return;
  const accountId = data.accounts.find(
    (a) => !a.deleted && a.kind === "wechat",
  )!.id;
  const rows = [
    ["饮品", 1200, "12:15", "可乐杯 · 午餐饮品"],
    ["生活小物", 4900, "13:20", "公仔 · 桌面小熊"],
    ["个人护理", 3590, "14:10", "洗手液 · 挤压瓶"],
    ["快递寄件", 1500, "14:40", "寄出一个包裹"],
    ["纪念品", 6800, "15:30", "旅行纪念品"],
    ["用品", 2900, "16:10", "宠物玩具球"],
    ["红包礼金", 20000, "17:00", "收到红包"],
    ["副业收入", 80000, "18:00", "设计稿收入"],
  ] as const;
  for (const [name, amount, occurredTime, note] of rows) {
    const category = data.categories.find(
      (c) => !c.deleted && c.name === name,
    );
    if (!category) throw new Error(`示例账本缺少分类：${name}`);
    repo.saveTxn({
      type: category.kind,
      categoryId: category.id,
      amount,
      occurredAt: today(),
      occurredTime,
      accountId,
      forWhom: "both",
      note: `示例 · ${note}`,
    });
  }
}
