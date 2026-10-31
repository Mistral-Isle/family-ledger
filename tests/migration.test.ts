import { DatabaseSync } from "node:sqlite";
import { initialSql, refundIncomeSql, migrations } from "../src/db/migration";
import { readFileSync } from "node:fs";
import { familyTravelSql } from "../src/db/migration";

test("family travel upgrade preserves old money and leaves payer unknown", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(initialSql.replace(/--> statement-breakpoint/g, ""));
    db.exec(
      "INSERT INTO txn(id,created_at,updated_at,hlc,scope,type,amount,account_id,occurred_at,recorder_member_id,for_whom) VALUES('legacy','c','u','h','family','expense',1234,'a','2026-10-01','m','both')",
    );
    db.exec(familyTravelSql.replace(/--> statement-breakpoint/g, ""));
    expect(
      db.prepare("SELECT amount,payer_member_id,trip_id FROM txn").get(),
    ).toEqual({ amount: 1234, payer_member_id: null, trip_id: null });
    expect(
      readFileSync("src/db/migrations/0005_family_travel.sql", "utf8")
        .replace(/\r/g, "")
        .trim(),
    ).toBe(familyTravelSql.trim());
  } finally {
    db.close();
  }
});

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
test("financial and budget migrations preserve existing transactions and match runtime SQL", () => {
  const { financialSql, budgetSql } = require("../src/db/migration");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(initialSql.replace(/--> statement-breakpoint/g, ""));
    db.exec(refundIncomeSql.replace(/--> statement-breakpoint/g, ""));
    db.exec(
      "INSERT INTO txn(id,created_at,updated_at,hlc,scope,type,amount,account_id,occurred_at,recorder_member_id,for_whom) VALUES('legacy','c','u','h','family','expense',1234,'a','2026-10-01','m','both')",
    );
    for (const [index, sql] of [
      [2, financialSql],
      [3, budgetSql],
    ] as const) {
      db.exec(sql.replace(/--> statement-breakpoint/g, ""));
      const normalize = (s: string) =>
        s.replace(/`|\s|--> statement-breakpoint/g, "");
      expect(
        normalize(
          readFileSync(
            `src/db/migrations/${migrations.journal.entries[index]!.tag}.sql`,
            "utf8",
          ),
        ),
      ).toBe(normalize(sql));
    }
    expect(
      db.prepare("SELECT amount FROM txn WHERE id='legacy'").get(),
    ).toEqual({ amount: 1234 });
    expect(db.prepare("SELECT * FROM plan").all()).toEqual([]);
    expect(db.prepare("SELECT * FROM budget").all()).toEqual([]);
  } finally {
    db.close();
  }
});
