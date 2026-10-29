import { Tabs, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Txt, useTheme, blue } from "../../components/ui";
import { zh } from "../../i18n/zh";
export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <View
          style={{
            backgroundColor: t.bg,
            paddingBottom: Math.max(insets.bottom, 12),
            paddingTop: 8,
            borderTopWidth: 1,
            borderColor: t.line,
          }}
        >
          <View
            style={{
              maxWidth: 760,
              width: "100%",
              alignSelf: "center",
              flexDirection: "row",
              justifyContent: "space-around",
              alignItems: "center",
              paddingHorizontal: 14,
            }}
          >
            {state.routes.map((route, index) => (
              <View
                key={route.key}
                style={{
                  flex: index === 1 ? 2 : 1,
                  flexDirection: "row",
                  justifyContent: "space-around",
                  alignItems: "center",
                }}
              >
                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel={
                    [zh.tabs.detail, zh.tabs.stats, zh.tabs.assets, zh.tabs.me][
                      index
                    ]
                  }
                  accessibilityState={{ selected: state.index === index }}
                  onPress={() => navigation.navigate(route.name)}
                  style={{ alignItems: "center", gap: 5, padding: 8 }}
                >
                  <Icon
                    name={
                      [
                        "list.bullet",
                        "chart.bar.fill",
                        "creditcard.fill",
                        "person.crop.circle",
                      ][index] ?? "list.bullet"
                    }
                    color={state.index === index ? t.blue : t.muted}
                    size={21}
                  />
                  <Txt
                    size={10}
                    color={state.index === index ? t.blue : t.muted}
                    bold={state.index === index}
                  >
                    {
                      [
                        zh.tabs.detail,
                        zh.tabs.stats,
                        zh.tabs.assets,
                        zh.tabs.me,
                      ][index]
                    }
                  </Txt>
                </Pressable>
                {index === 1 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={zh.tabs.add}
                    onPress={() => router.push("/entry")}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 19,
                      backgroundColor: blue,
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 5px 12px rgba(100,139,210,.25)",
                    }}
                  >
                    <Icon name="plus" color="#fff" size={26} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    >
      <Tabs.Screen name="index" options={{ title: zh.tabs.detail }} />
      <Tabs.Screen name="stats" options={{ title: zh.tabs.stats }} />
      <Tabs.Screen name="assets" options={{ title: zh.tabs.assets }} />
      <Tabs.Screen name="me" options={{ title: zh.tabs.me }} />
    </Tabs>
  );
}
