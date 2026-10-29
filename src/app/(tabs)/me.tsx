import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useLedger } from "../../components/LedgerProvider";
import {
  Button,
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
} from "../../components/ui";
import { useUi } from "../../state/ui";
import { zh } from "../../i18n/zh";
export default function Me() {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const { theme, setTheme } = useUi();
  function moveFavorite(index: number, delta: number) {
    const favorites = [...data.preferences.favorites];
    const target = index + delta;
    if (target < 0 || target >= favorites.length) return;
    [favorites[index], favorites[target]] = [
      favorites[target]!,
      favorites[index]!,
    ];
    run(() => repo.updatePreferences({ favorites }));
  }
  return (
    <Page>
      <Heading title={zh.tabs.me} subtitle={zh.profileHint} />
      <Row style={{ paddingVertical: 8 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 23,
            backgroundColor: t.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt size={25} bold color={t.blue}>
            {zh.me}
          </Txt>
        </View>
        <View style={{ gap: 5 }}>
          <Txt size={22} bold>
            {zh.appName}
          </Txt>
          <Txt size={12} color={t.muted}>
            {zh.progress}
          </Txt>
        </View>
      </Row>
      <Txt size={12} color={t.muted}>
        {zh.settings}
      </Txt>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/categories")}
      >
        <Card>
          <Row>
            <Icon name="list.bullet" />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt bold>{zh.categoryManagement}</Txt>
              <Txt size={11} color={t.muted}>
                {zh.categoryHint}
              </Txt>
            </View>
            <Icon name="chevron.right" color={t.muted} size={15} />
          </Row>
        </Card>
      </Pressable>
      <Button
        secondary
        label={zh.sync.title}
        onPress={() => router.push("/sync")}
      />
      <Button
        secondary
        label={zh.finance.title}
        onPress={() => router.push("/finance")}
      />
      <Button
        secondary
        label={zh.vault.title}
        onPress={() => router.push("/vault")}
      />
      <Button
        secondary
        label={zh.discarded.title}
        onPress={() => router.push("/discarded")}
      />
      <Button
        secondary
        label={zh.backup.title}
        onPress={() => router.push("/backup")}
      />
      <Card style={{ gap: 14 }}>
        <Txt bold>{zh.preferences}</Txt>
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
      <Card style={{ gap: 12 }}>
        <Row>
          <Icon name="cloud" color={t.muted} />
          <Txt bold>{zh.localData}</Txt>
        </Row>
        <Txt size={12} color={t.muted}>
          {zh.dataDescription}
        </Txt>
        <View
          style={{ backgroundColor: t.soft, padding: 12, borderRadius: 12 }}
        >
          <Txt size={11} color={t.blue}>
            {zh.queued(data.pending)}
          </Txt>
        </View>
      </Card>
      {data.preferences.favorites.length > 0 && (
        <Card style={{ gap: 10 }}>
          <Txt bold>{zh.favorites}</Txt>
          {data.preferences.favorites.map((favorite, index) => (
            <Row key={favorite.id}>
              <Txt style={{ flex: 1 }}>{favorite.label}</Txt>
              <IconButton
                name="arrow.up"
                label={zh.moveUp}
                onPress={() => moveFavorite(index, -1)}
              />
              <IconButton
                name="arrow.down"
                label={zh.moveDown}
                onPress={() => moveFavorite(index, 1)}
              />
              <IconButton
                name="xmark"
                label={zh.removeFavorite}
                onPress={() =>
                  run(() =>
                    repo.updatePreferences({
                      favorites: data.preferences.favorites.filter(
                        (f) => f.id !== favorite.id,
                      ),
                    }),
                  )
                }
              />
            </Row>
          ))}
        </Card>
      )}

      <Txt
        size={11}
        color={t.muted}
        style={{ textAlign: "center", marginTop: 12 }}
      >
        {zh.version} · {zh.localOnly}
      </Txt>
    </Page>
  );
}
