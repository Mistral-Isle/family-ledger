import * as Notifications from "expo-notifications";
import type { Snapshot } from "../domain/types";
import { financialReminders } from "../domain/reminders";
import { zh } from "../i18n/zh";
export async function requestReminders() {
  const p = await Notifications.requestPermissionsAsync();
  if (!p.granted) throw new Error(zh.reminders.denied);
}
let queue: Promise<void> = Promise.resolve();
export function updateReminders(snapshot: Snapshot, enabled: boolean) {
  const run = async () => {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing)
      if (n.content.data?.familyLedger === true)
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
    if (!enabled) return;
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted) return;
    for (const n of financialReminders(snapshot))
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.title, body: n.body, data: { familyLedger: true } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: n.date,
        },
      });
  };
  queue = queue.catch(() => {}).then(run);
  return queue;
}
