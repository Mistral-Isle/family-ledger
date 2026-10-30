import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from "expo-modules-core";
import { Platform, type ViewProps } from "react-native";

type Props = ViewProps & {
  month: string;
  dark: boolean;
  onMonthChange: (event: { nativeEvent: { month: string } }) => void;
};

// Expo Go has no local module. Keep the existing date picker as a safe fallback.
export const NativeMonthWheel =
  Platform.OS === "ios" && requireOptionalNativeModule("LedgerMonthPicker")
    ? requireNativeViewManager<Props>("LedgerMonthPicker")
    : null;
