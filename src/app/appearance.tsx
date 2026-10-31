import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  darcula,
  Card,
  Chip,
  Heading,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
  styles,
} from "../components/ui";
import { useUi } from "../state/ui";
import { zh } from "../i18n/zh";
export default function Appearance() {
  const { repo } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const { theme, setTheme, appearance, setAppearance } = useUi();
  return (
    <Page>
      <Row>
        <IconButton
          name="chevron.left"
          label="返回"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)/me")
          }
        />
        <Heading title="外观" />
      </Row>
      <Card style={{ gap: 14 }}>
        <Txt bold>{zh.preferences}</Txt>
        <Txt size={12} color={t.muted}>
          界面风格
        </Txt>
        <View style={{ gap: 12 }}>
          {(
            [
              {
                id: "classic",
                name: "系统白",
                bg: "#F2F2F7",
                card: "#FFFFFF",
                accent: "#007AFF",
              },
              {
                id: "warm",
                name: "暖白",
                bg: "#F5F1EA",
                card: "#FFFDFA",
                accent: "#8B6844",
              },
              {
                id: "ink",
                name: "Darcula 深色",
                bg: darcula.bg,
                card: darcula.card,
                accent: darcula.blue,
              },
            ] as const
          ).map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              accessibilityState={{ selected: appearance === item.id }}
              aria-selected={appearance === item.id}
              key={item.id}
              onPress={() => {
                repo.setAppearance(item.id);
                setAppearance(item.id);
              }}
              style={{
                backgroundColor: item.bg,
                borderRadius: 24,
                padding: 16,
                borderWidth: 2,
                borderColor:
                  appearance === item.id ? item.accent : "transparent",
                gap: 10,
              }}
            >
              <Row>
                <Txt bold color={item.accent} style={{ flex: 1 }}>
                  {item.name}
                </Txt>
                {appearance === item.id && (
                  <Icon name="checkmark" color={item.accent} />
                )}
              </Row>
              <View
                style={{
                  backgroundColor: item.card,
                  borderRadius: 18,
                  padding: 16,
                  gap: 8,
                }}
              >
                <Txt size={11} color={item.accent}>
                  本月支出
                </Txt>
                <Txt
                  bold
                  size={24}
                  color={item.id === "ink" ? darcula.text : "#1C1C1E"}
                >
                  ¥ 2,680.00
                </Txt>
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    width: "60%",
                    backgroundColor: item.accent,
                  }}
                />
              </View>
            </Pressable>
          ))}
        </View>
        <View style={styles.wrap}>
          {(["system", "light", "dark"] as const).map((mode) => (
            <Chip
              key={mode}
              label={zh[mode]}
              selected={theme === mode}
              onPress={() => {
                repo.setTheme(mode);
                setTheme(mode);
              }}
            />
          ))}
        </View>
      </Card>
    </Page>
  );
}
