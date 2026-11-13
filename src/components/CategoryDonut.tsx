import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Svg, {
  Circle,
  G,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
  TSpan,
} from "react-native-svg";
import {
  donutLayout,
  shareLabel,
  type DonutItem,
} from "../domain/donut";
import { formatMoney } from "../domain/money";
import { Icon, Txt, useTheme } from "./ui";

function polar(cx: number, cy: number, r: number, turn: number) {
  const rad = turn * Math.PI * 2 - Math.PI / 2;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startTurn: number,
  endTurn: number,
): string {
  const span = endTurn - startTurn;
  if (span <= 0.0004) return "";
  if (span >= 0.999) {
    const mid = startTurn + 0.5;
    return (
      sectorPath(cx, cy, rIn, rOut, startTurn, mid + 0.0005) +
      " " +
      sectorPath(cx, cy, rIn, rOut, mid, startTurn + 0.9996)
    );
  }
  const o1 = polar(cx, cy, rOut, startTurn);
  const o2 = polar(cx, cy, rOut, endTurn);
  const i2 = polar(cx, cy, rIn, endTurn);
  const i1 = polar(cx, cy, rIn, startTurn);
  const large = span > 0.5 ? 1 : 0;
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

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
  const height = Math.max(248, Math.round(width * 0.72));
  const cx = width / 2,
    cy = height / 2,
    outerRadius = Math.max(
      46,
      Math.min(width * 0.22, cx - (width < 280 ? 58 : 82)),
    );
  const ringWidth = outerRadius * 0.36,
    innerRadius = outerRadius - ringWidth,
    rimInnerRadius = innerRadius - Math.max(5, ringWidth * 0.22);
  const { slices, labels } = useMemo(
    () => donutLayout(items, width, height, outerRadius),
    [items, width, height, outerRadius],
  );
  const amount = formatMoney(total);
  const centerWidth = (rimInnerRadius - 4) * 2;
  const amountSize = Math.max(
    13,
    Math.min(
      width < 320 ? 17 : 19,
      Math.floor(centerWidth / (amount.length * 0.58)),
    ),
  );
  const labelFont =
    Platform.OS === "web"
      ? "system-ui, -apple-system, sans-serif"
      : Platform.OS === "ios"
        ? "System"
        : "sans-serif";
  const labelSize = width < 280 ? 9 : 11;
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
        {!slices.length ? (
          <Circle
            cx={cx}
            cy={cy}
            r={(innerRadius + outerRadius) / 2}
            fill="none"
            stroke={t.line}
            strokeWidth={ringWidth}
            opacity={0.65}
          />
        ) : (
          slices.map((slice, index) => {
            const endTurn =
              slice.start +
              slice.share +
              (slices.length > 1 && index < slices.length - 1 ? 0.0006 : 0);
            return (
              <G key={slice.id}>
                <Path
                  d={sectorPath(
                    cx,
                    cy,
                    innerRadius,
                    outerRadius,
                    slice.start,
                    endTurn,
                  )}
                  fill={slice.color}
                />
                <Path
                  d={sectorPath(
                    cx,
                    cy,
                    rimInnerRadius,
                    innerRadius,
                    slice.start,
                    endTurn,
                  )}
                  fill={slice.color}
                  opacity={0.24}
                />
              </G>
            );
          })
        )}
        <Circle
          cx={cx}
          cy={cy}
          r={rimInnerRadius}
          fill="none"
          stroke={t.text}
          strokeOpacity={0.07}
          strokeWidth={1}
        />
        {labels.map((label) => {
          const anchor = label.side === 1 ? "end" : "start";
          return (
            <G key={label.id}>
              <Polyline
                points={`${label.x},${label.anchorY} ${label.elbowX},${label.y} ${label.endX},${label.y}`}
                stroke={label.color}
                strokeOpacity={0.85}
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Rect
                x={label.barX}
                y={label.y - (label.twoLine ? 12 : 7.5)}
                width={label.barWidth}
                height={label.twoLine ? 24 : 15}
                rx={1.75}
                fill={label.color}
              />
              {label.twoLine ? (
                <>
                  <SvgText
                    x={label.textX}
                    y={label.y - 2}
                    textAnchor={anchor}
                    fontSize={labelSize}
                    fontFamily={labelFont}
                    fontWeight="600"
                    fill={t.text}
                  >
                    {label.displayName}
                  </SvgText>
                  <SvgText
                    x={label.textX}
                    y={label.y + 12}
                    textAnchor={anchor}
                    fontSize={labelSize - 0.5}
                    fontFamily={labelFont}
                    fontWeight="600"
                    fill={label.color}
                  >
                    {shareLabel(label.share, 1)}
                  </SvgText>
                </>
              ) : (
                <SvgText
                  x={label.textX}
                  y={label.y + 4}
                  textAnchor={anchor}
                  fontSize={labelSize}
                  fontFamily={labelFont}
                >
                  <TSpan fill={t.text} fontWeight="600">
                    {label.displayName + " "}
                  </TSpan>
                  <TSpan fill={t.muted} fontWeight="500">
                    {label.compactPct}
                  </TSpan>
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
          top: cy - rimInnerRadius + 2,
          left: cx - rimInnerRadius + 4,
          width: centerWidth,
          height: (rimInnerRadius - 2) * 2,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <Pressable
          disabled={!onToggle}
          accessibilityRole={onToggle ? "button" : undefined}
          accessibilityLabel={toggleLabel ?? title}
          accessibilityHint={
            onToggle ? "切换饼图和分类列表的收支类型" : undefined
          }
          onPress={onToggle}
          hitSlop={6}
          style={({ pressed }) => ({
            minHeight: 28,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Txt size={11.5} color={t.muted}>
            {title}
          </Txt>
          {onToggle && (
            <Icon name="arrow.left.arrow.right" size={11.5} color={t.muted} />
          )}
        </Pressable>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            color: t.text,
            fontSize: amountSize,
            fontWeight: "700",
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
