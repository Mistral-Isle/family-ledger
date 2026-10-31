import * as Notifications from "expo-notifications";

/** Remove notifications scheduled by older app versions; never request permission. */
export async function clearLegacyReminders() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of existing) {
    if (notification.content.data?.familyLedger === true) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}
