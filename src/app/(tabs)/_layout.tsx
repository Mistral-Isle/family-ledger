import { useUi } from "../../state/ui";
import { Tabs, useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Segmented } from "../../components/SlidingTabs";
import { FloatingAddButton } from "../../components/FloatingAddButton";
const labels = ["明细", "统计", "资产", "我的"];
const icons = [
  "list.bullet",
  "chart.bar.fill",
  "creditcard.fill",
  "person.crop.circle",
];
export default function TabsLayout() {
  const selecting = useUi((s) => s.selectingTransactions);
  const router = useRouter(),
    insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) =>
        selecting && state.routes[state.index]?.name === "index" ? null : (
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
              <FloatingAddButton
                onPress={() => router.push("/entry")}
                style={{ position: "absolute", right: 4, bottom: 84 }}
              />
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
        )
      }
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="assets" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
