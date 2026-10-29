import type { Snapshot } from "../domain/types";
import { zh } from "../i18n/zh";
export async function requestReminders() {
  throw new Error(zh.reminders.web);
}
export async function updateReminders(_snapshot: Snapshot, _enabled: boolean) {}
