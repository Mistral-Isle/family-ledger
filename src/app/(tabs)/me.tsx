import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useLedger } from "../../components/LedgerProvider";
import {
  Card,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
} from "../../components/ui";
import { HelpBubble } from "../../components/HelpBubble";
import { zh } from "../../i18n/zh";

function SettingsRow({
  title,
  icon,
  color,
  href,
  last = false,
}: {
  title: string;
  icon: string;
  color: string;
  href: Href;
  last?: boolean;
}) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push(href)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? t.soft : "transparent",
        paddingLeft: 16,
      })}
    >
      <Row style={{ minHeight: 60, paddingRight: 16 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: color,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={18} color="#FFFFFF" />
        </View>
        <Row
          style={{
            flex: 1,
            minHeight: 60,
            borderBottomWidth: last ? 0 : 0.5,
            borderBottomColor: t.line,
            justifyContent: "space-between",
          }}
        >
          <Txt size={16}>{title}</Txt>
          <Icon name="chevron.right" size={14} color={t.muted} />
        </Row>
      </Row>
    </Pressable>
  );
}

export default function Me() {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const me = data.members.find((m) => m.id === data.meId);
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
      <Txt size={34} bold>
        我的
      </Txt>
      <Card style={{ paddingVertical: 28, gap: 16, alignItems: "center" }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: t.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt size={32} bold color={t.blue}>
            {me?.name.slice(0, 1) || "我"}
          </Txt>
        </View>
        <View style={{ alignItems: "center", gap: 5 }}>
          <Txt size={24} bold>
            {me?.name || "家庭成员"}
          </Txt>
          <Txt size={14} color={t.muted}>
            {zh.family}
          </Txt>
        </View>
      </Card>
      <View style={{ gap: 8 }}>
        <Txt size={13} color={t.muted} style={{ paddingLeft: 16 }}>
          账本管理
        </Txt>
        <Card
          style={{ padding: 0, gap: 0, borderRadius: 20, overflow: "hidden" }}
        >
          <SettingsRow
            title="预算设置"
            icon="chart.bar.fill"
            color="#397B68"
            href="/budget"
          />
          <SettingsRow
            title={zh.categoryManagement}
            icon="list.bullet"
            color="#4B82C5"
            href="/categories"
          />
          <SettingsRow
            title={zh.finance.title}
            icon="building.columns.fill"
            color="#B9824C"
            href="/finance"
          />
          <SettingsRow
            title={zh.vault.title}
            icon="lock.fill"
            color="#7B72AF"
            href="/vault"
            last
          />
        </Card>
      </View>
      <View style={{ gap: 8 }}>
        <Txt size={13} color={t.muted} style={{ paddingLeft: 16 }}>
          偏好与数据
        </Txt>
        <Card
          style={{ padding: 0, gap: 0, borderRadius: 20, overflow: "hidden" }}
        >
          <SettingsRow
            title="外观"
            icon="sun.max.fill"
            color="#687C9E"
            href="/appearance"
          />
          <SettingsRow
            title={zh.sync.title}
            icon="cloud"
            color="#4E91AD"
            href="/sync"
          />
          <SettingsRow
            title={zh.backup.title}
            icon="shippingbox.fill"
            color="#78916A"
            href="/backup"
          />
          <SettingsRow
            title={zh.discarded.title}
            icon="trash"
            color="#8C8C94"
            href="/discarded"
            last
          />
        </Card>
      </View>
      <Row style={{ paddingHorizontal: 16, justifyContent: "space-between" }}>
        <Row style={{ gap: 0 }}>
          <Txt size={13} color={t.muted}>
            {zh.localData}
          </Txt>
          <HelpBubble label="数据保存">{zh.dataDescription}</HelpBubble>
        </Row>
        <Txt size={12} color={t.muted}>
          {zh.queued(data.pending)}
        </Txt>
      </Row>
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
        size={12}
        color={t.muted}
        style={{ textAlign: "center", marginTop: 8 }}
      >
        {zh.version}
      </Txt>
    </Page>
  );
}
