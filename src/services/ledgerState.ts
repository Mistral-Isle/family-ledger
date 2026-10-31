import type { LedgerRepository } from "../db/repository";
import { useUi } from "../state/ui";

/** Apply one consistent snapshot after opening, writing, syncing or restoring. */
export function readLedgerState(repo: LedgerRepository) {
  const snapshot = repo.snapshot();
  useUi.getState().setTheme(repo.getTheme());
  useUi.getState().setAppearance(repo.getAppearance());
  return snapshot;
}
