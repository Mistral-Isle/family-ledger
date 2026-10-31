import { readLedgerState } from "../src/services/ledgerState";
import { useUi } from "../src/state/ui";
import { fixture } from "./sqlite";

test("restoring immediately refreshes appearance and preferences", () => {
  const current = fixture(),
    saved = fixture();
  try {
    current.repo.setTheme("light");
    current.repo.setAppearance("classic");
    readLedgerState(current.repo);
    saved.repo.setTheme("dark");
    saved.repo.setAppearance("ink");
    saved.repo.setShowIncomeCalendar(false);
    saved.repo.setIncludeRepayments(true);
    saved.repo.setDetailBudgetPreferences({
      title: "生活",
      excludedCategoryIds: [],
    });
    current.repo.restoreBackup(saved.repo.exportBackup());
    expect(readLedgerState(current.repo)).toEqual(saved.repo.snapshot());
    expect(useUi.getState().theme).toBe("dark");
    expect(useUi.getState().appearance).toBe("ink");
    expect(current.repo.getShowIncomeCalendar()).toBe(false);
    expect(current.repo.getIncludeRepayments()).toBe(true);
    expect(current.repo.getDetailBudgetPreferences().title).toBe("生活");
  } finally {
    current.sqlite.close();
    saved.sqlite.close();
  }
});
