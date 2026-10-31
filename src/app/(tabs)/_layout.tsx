import { Tabs, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, useTheme } from "../../components/ui";
import { Segmented } from "../../components/SlidingTabs";
const labels = ["明细", "统计", "资产", "我的"];
const icons = [
  "list.bullet",
  "chart.bar.fill",
  "creditcard.fill",
  "person.crop.circle",
];
export default function TabsLayout() {
  const router = useRouter(),
    t = useTheme(),
    insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            bottom: Math.max(insets.bottom, 12),
            left: 16,
            right: 16,
            alignItems: "center",
          }}
        >
          <View
            pointerEvents="box-none"
            style={{ width: "100%", maxWidth: 560 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="记一笔"
              onPress={() => router.push("/entry")}
              style={({ pressed }) => ({
                position: "absolute",
                right: 4,
                bottom: 84,
                width: 58,
                height: 58,
                borderRadius: 29,
                backgroundColor: t.primary,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: t.dark
                  ? "0 6px 20px rgba(0,0,0,.24)"
                  : "0 6px 20px rgba(0,85,200,.24)",
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <Icon name="plus" color={t.onPrimary} size={26} />
            </Pressable>
            <Segmented
              value={state.routes[state.index]!.name}
              options={state.routes.map((r, i) => ({
                value: r.name,
                label: labels[i]!,
                icon: icons[i],
              }))}
              onChange={(name) => {
                const route = state.routes.find((r) => r.name === name)!;
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) navigation.navigate(name);
              }}
            />
          </View>
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="assets" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
