import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

const feedback = Platform.OS === "ios"
  ? requireOptionalNativeModule<{ amountKeyFeedback?: () => Promise<void> }>("LedgerCategoryOrder")
  : null;

/** Best-effort tactile feedback; unavailable hardware must never block typing. */
export function amountKeyFeedback() {
  try {
    void feedback?.amountKeyFeedback?.()?.catch(() => {});
  } catch {
    // Older installed builds and web previews retain visual key feedback.
  }
}
