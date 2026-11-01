import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Svg, { Circle, G, Polyline, Text as SvgText } from "react-native-svg";
import { donutLayout, shareLabel, type DonutItem } from "../domain/donut";
import { formatMoney } from "../domain/money";
import { Icon, Txt, useTheme } from "./ui";

export function CategoryDonut({
  items,
  total,
  title,
  onToggle,
  toggleLabel,
}: {
  items: DonutItem[];
  total: number;
  title: string;
  onToggle?: () => void;
  toggleLabel?: string;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(320);
  const height = Math.max(240, width * 0.86);
  const cx = width / 2,
    cy = height / 2,
    outerRadius = Math.min(width * 0.3, cx - (width < 280 ? 54 : 66));
  const stroke = width * 0.105,
    radius = outerRadius - stroke / 2,
    circumference = Math.PI * 2 * radius;
  const { slices, labels } = useMemo(
    () => donutLayout(items, width, height, outerRadius),
    [items, width, height, outerRadius],
  );
  const amount = formatMoney(total);
  const centerWidth = (radius - stroke / 2 - 4) * 2;
  const amountSize = Math.min(
    width < 320 ? 18 : 21,
    Math.floor(centerWidth / (amount.length * 0.58)),
  );
  const labelFont =
    Platform.OS === "web"
      ? "system-ui, -apple-system, sans-serif"
      : Platform.OS === "ios"
        ? "System"
        : "sans-serif";
  const labelSize = width < 280 ? 10 : 11.5;
  return (
    <View
      testID="category-donut"
      accessible={!onToggle}
      accessibilityRole={onToggle ? undefined : "image"}
      accessibilityLabel={`${title} ${formatMoney(total)}。${slices.map((s) => `${s.name} ${shareLabel(s.share, 1)}`).join("，")}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ width: "100%", maxWidth: 440, alignSelf: "center", height }}
    >
      <Svg width={width} height={height} accessible={false}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={t.line}
          strokeWidth={stroke}
        />
        {slices.map((slice) => (
          <G key={slice.id}>
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={stroke}
              strokeDasharray={`${slice.share * circumference} ${circumference - slice.share * circumference}`}
              strokeDashoffset={-slice.start * circumference}
              rotation={-90}
              origin={`${cx}, ${cy}`}
            />
          </G>
        ))}
        {labels.map((label) => {
          const name = label.displayName;
          return (
            <G key={label.id}>
              <Polyline
                points={`${label.x},${label.anchorY} ${label.elbowX},${label.y} ${label.endX},${label.y}`}
                stroke={label.color}
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <SvgText
                x={label.endX + label.side * 5}
                y={label.twoLine ? label.y - 3 : label.y + 4}
                textAnchor={label.side === 1 ? "start" : "end"}
                fontSize={labelSize}
                fontFamily={labelFont}
                fontWeight="400"
                fill={t.text}
              >
                {label.twoLine
                  ? shareLabel(label.share, 1)
                  : name + " " + shareLabel(label.share, 1)}
              </SvgText>
              {label.twoLine && (
                <SvgText
                  x={label.endX + label.side * 5}
                  y={label.y + 12}
                  textAnchor={label.side === 1 ? "start" : "end"}
                  fontSize={labelSize}
                  fontFamily={labelFont}
                  fill={t.text}
                >
                  {name}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: cy - radius + stroke / 2,
          left: cx - radius + stroke / 2 + 4,
          width: centerWidth,
          height: (radius - stroke / 2) * 2,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Pressable
          disabled={!onToggle}
          accessibilityRole={onToggle ? "button" : undefined}
          accessibilityLabel={toggleLabel ?? title}
          accessibilityHint={onToggle ? "切换饼图和分类列表的收支类型" : undefined}
          onPress={onToggle}
          hitSlop={6}
          style={({ pressed }) => ({ minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, opacity: pressed ? 0.6 : 1 })}
        >
          <Txt size={12} color={onToggle ? t.blue : t.muted}>{title}</Txt>
          {onToggle && <Icon name="arrow.left.arrow.right" size={12} color={t.blue} />}
        </Pressable>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            color: t.text,
            fontSize: amountSize,
            fontWeight: "600",
            textAlign: "center",
            maxWidth: "100%",
            fontVariant: ["tabular-nums"],
          }}
        >
          {amount}
        </Text>
      </View>
    </View>
  );
}
