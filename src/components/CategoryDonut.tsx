import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Polyline, Text as SvgText } from "react-native-svg";
import {
  donutLabels,
  donutSlices,
  shareLabel,
  type DonutItem,
} from "../domain/donut";
import { formatMoney } from "../domain/money";
import { Txt, useTheme } from "./ui";

export function CategoryDonut({
  items,
  total,
  title,
}: {
  items: DonutItem[];
  total: number;
  title: string;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(320);
  const height = Math.max(280, width * 0.86);
  const cx = width / 2,
    cy = height / 2,
    radius = width * 0.265;
  const stroke = width * 0.115,
    circumference = Math.PI * 2 * radius;
  const slices = donutSlices(items);
  const labels = donutLabels(slices, cy, radius, height);
  return (
    <View
      testID="category-donut"
      accessible
      accessibilityRole="image"
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
            <Circle
              cx={cx}
              cy={cy}
              r={radius - stroke / 2 + 3}
              fill="none"
              stroke={slice.color}
              strokeOpacity={0.55}
              strokeWidth={6}
              strokeDasharray={`${slice.share * Math.PI * 2 * (radius - stroke / 2 + 3)} ${(1 - slice.share) * Math.PI * 2 * (radius - stroke / 2 + 3)}`}
              strokeDashoffset={
                -slice.start * Math.PI * 2 * (radius - stroke / 2 + 3)
              }
              rotation={-90}
              origin={`${cx}, ${cy}`}
            />
          </G>
        ))}
        {labels.map((label) => {
          const x = cx + Math.cos(label.angle) * (radius + stroke / 2);
          const y = cy + Math.sin(label.angle) * (radius + stroke / 2);
          const endX = label.side === 1 ? width - 51 : 51;
          // Route the leader around the outside of the ring before aligning it
          // with the displaced label, so clustered labels never cut through slices.
          const radialX =
            cx + Math.cos(label.angle) * (radius + stroke / 2 + 9);
          const radialY =
            cy + Math.sin(label.angle) * (radius + stroke / 2 + 9);
          const elbowX =
            label.side === 1
              ? Math.min(endX, radialX)
              : Math.max(endX, radialX);
          return (
            <G key={label.id}>
              <Polyline
                points={`${x},${y} ${elbowX},${radialY} ${endX},${radialY} ${endX},${label.y}`}
                stroke={label.color}
                strokeWidth={1.5}
                fill="none"
              />
              <SvgText
                x={label.side === 1 ? width - 2 : 2}
                y={label.y - 4}
                textAnchor={label.side === 1 ? "end" : "start"}
                fontSize={11.5}
                fill={t.text}
              >
                {shareLabel(label.share, 1)}
              </SvgText>
              <SvgText
                x={label.side === 1 ? width - 2 : 2}
                y={label.y + 12}
                textAnchor={label.side === 1 ? "end" : "start"}
                fontSize={11.5}
                fill={t.text}
              >
                {label.name.length > 4
                  ? label.name.slice(0, 3) + "…"
                  : label.name}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: cy - 27,
          left: cx - radius + stroke / 2 + 4,
          width: (radius - stroke / 2 - 4) * 2,
          alignItems: "center",
          gap: 6,
        }}
      >
        <Txt size={12} color={t.muted}>
          {title}
        </Txt>
        <Txt size={width < 320 ? 18 : 21} bold style={{ textAlign: "center" }}>
          {formatMoney(total)}
        </Txt>
      </View>
    </View>
  );
}
