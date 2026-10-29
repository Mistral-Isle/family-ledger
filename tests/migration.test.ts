import { DatabaseSync } from "node:sqlite";
import { initialSql, refundIncomeSql, migrations } from "../src/db/migration";
import { readFileSync } from "node:fs";

test("refund income upgrade preserves legacy receipt, defaults split to zero, and matches migration files", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(initialSql.replace(/--> statement-breakpoint/g, ""));
    db.exec(
      `INSERT INTO txn (id,created_at,updated_at,hlc,scope,type,amount,account_id,occurred_at,recorder_member_id,for_whom,refund_of_id) VALUES ('old','created','updated','clock','family','refund',500,'account','2026-10-29','me','both','source')`,
    );
    db.exec(refundIncomeSql.replace(/--> statement-breakpoint/g, ""));
    expect(
      db
        .prepare(
          "SELECT amount,refund_of_id,refund_income,refund_income_category_id,hlc FROM txn",
        )
        .get(),
    ).toEqual({
      amount: 500,
      refund_of_id: "source",
      refund_income: 0,
      refund_income_category_id: null,
      hlc: "clock",
    });
    const normalize = (sql: string) =>
      sql.replace(/`|\s|--> statement-breakpoint/g, "");
    const upgrade = migrations.journal.entries[1]!;
    expect(
      normalize(readFileSync(`src/db/migrations/${upgrade.tag}.sql`, "utf8")),
    ).toBe(normalize(refundIncomeSql));
    expect(
      JSON.parse(readFileSync("src/db/migrations/meta/_journal.json", "utf8")),
    ).toEqual(migrations.journal);
  } finally {
    db.close();
  }
});
