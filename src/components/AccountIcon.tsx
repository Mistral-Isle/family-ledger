import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { AccountKind } from "../domain/types";
import { Icon, useTheme } from "./ui";

/** Theme-colored payment glyphs shared with the native account list. */
export function AccountIcon({
  kind,
  size = 44,
  selected = false,
}: {
  kind: AccountKind;
  size?: number;
  selected?: boolean;
}) {
  const t = useTheme();
  const brand = kind === "wechat" || kind === "alipay";
  const background = selected ? t.primary : t.soft;
  const foreground = selected ? "#FFFFFF" : t.blue;
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {brand ? (
        <Svg
          width={size * 0.82}
          height={size * 0.82}
          viewBox="0 0 32 32"
          accessible={false}
        >
          {kind === "wechat" ? (
            <>
              <Path
                d="M12.5 4C6.7 4 2 7.8 2 12.5c0 2.7 1.6 5.1 4.1 6.7L5 23l4.1-2.3c1.1.3 2.2.4 3.4.4h.4a8.7 8.7 0 0 1-.7-3.4c0-4.7 4.3-8.4 9.6-8.4h.1C20.3 6.2 16.7 4 12.5 4Z"
                fill={foreground}
              />
              <Circle cx="9" cy="10" r="1.25" fill={background} />
              <Circle cx="16" cy="10" r="1.25" fill={background} />
              <Path
                d="M30 18c0-3.9-3.7-7-8.2-7s-8.2 3.1-8.2 7 3.7 7 8.2 7c.9 0 1.8-.1 2.6-.4l3.5 2-1-3.1c1.9-1.3 3.1-3.3 3.1-5.5Z"
                fill={foreground}
              />
              <Circle cx="19" cy="16" r="1.1" fill={background} />
              <Circle cx="24.5" cy="16" r="1.1" fill={background} />
            </>
          ) : (
            <>
              <Path
                d="M15 4v9M7 8h19M8 13h15c-1.5 6.7-7.2 13-13.2 13C3.4 26 3 19.8 8.7 19.8c6.8 0 13.1 6 22.3 7"
                fill="none"
                stroke={foreground}
                strokeWidth="2.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </Svg>
      ) : (
        <Icon
          name={
            kind === "cash"
              ? "banknote.fill"
              : kind === "loan"
                ? "arrow.down.left"
                : kind === "deposit"
                  ? "lock.fill"
                  : kind === "prepaid"
                    ? "gift.fill"
                    : "creditcard.fill"
          }
          size={size * 0.5}
          color={selected ? "#FFFFFF" : t.blue}
        />
      )}
    </View>
  );
}
