jest.mock("expo-notifications", () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));
import * as Notifications from "expo-notifications";
import { clearLegacyReminders } from "../src/services/reminders";

test("removes old ledger reminders without cancelling unrelated notifications", async () => {
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
    { identifier: "old-payment", content: { data: { familyLedger: true } } },
    { identifier: "other", content: { data: {} } },
  ] as Notifications.NotificationRequest[]);
  await clearLegacyReminders();
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("old-payment");
});
