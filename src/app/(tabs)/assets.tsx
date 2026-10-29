import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useLedger } from "../../components/LedgerProvider";
import {
  Button,
  Card,
  Chip,
  Heading,
  Icon,
  Page,
  Row,
  Txt,
  useTheme,
  blue,
} from "../../components/ui";
import { accountBalance } from "../../domain/selectors";
import { formatMoney } from "../../domain/money";
import { today } from "../../domain/date";
import { zh } from "../../i18n/zh";
export default function Assets() {
  const { data } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const [archived, setArchived] = useState(false);
  const accounts = data.accounts
    .filter((a) => a.scope === "family" && !a.deleted)
    .map((account) => ({
      account,
      balance: accountBalance(account, data.txns, today()),
    }));
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);
  const assets = accounts
    .filter((a) => a.balance > 0)
    .reduce((sum, a) => sum + a.balance, 0);
  const debt = accounts
    .filter((a) => a.balance < 0)
    .reduce((sum, a) => sum - a.balance, 0);
  return (
    <Page>
      <Heading title={zh.tabs.assets} subtitle={zh.assetHint} />
      <Card
        style={{
          backgroundColor: t.dark ? "#29364D" : "#EAF0FA",
          borderColor: t.dark ? "#34445F" : "#E0E8F6",
          gap: 16,
        }}
      >
        <Txt size={12} color={t.blue}>
          {zh.netAssets}
        </Txt>
        <Txt size={36} bold>
          {formatMoney(total)}
        </Txt>
        <Row>
          <View style={{ flex: 1, gap: 5 }}>
            <Txt size={11} color={t.muted}>
              {zh.totalAssets}
            </Txt>
            <Txt size={17} bold>
              {formatMoney(assets)}
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Txt size={11} color={t.muted}>
              {zh.liabilities}
            </Txt>
            <Txt size={17} bold>
              {formatMoney(debt)}
            </Txt>
          </View>
        </Row>
      </Card>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt size={19} bold>
          {zh.account}
        </Txt>
        <Chip
          label={zh.showArchived}
          selected={archived}
          onPress={() => setArchived(!archived)}
        />
      </Row>
      <View style={{ gap: 12 }}>
        {accounts
          .filter((a) => archived || !a.account.archived)
          .sort((a, b) => a.account.sort - b.account.sort)
          .map(({ account, balance }) => (
            <Pressable
              key={account.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/account",
                  params: { id: account.id },
                })
              }
            >
              <Card
                style={{ padding: 19, opacity: account.archived ? 0.6 : 1 }}
              >
                <Row>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: t.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={
                        account.kind === "cash"
                          ? "banknote.fill"
                          : "creditcard.fill"
                      }
                      color={t.blue}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Row style={{ gap: 8 }}>
                      <Txt bold>{account.name}</Txt>
                      {data.preferences.pinned.includes(account.id) && (
                        <Icon name="pin.fill" size={11} color={blue} />
                      )}
                    </Row>
                    <Txt size={11} color={t.muted}>
                      {zh.accountKinds[account.kind]}
                      {account.last4 ? ` · ${account.last4}` : ""}
                      {account.archived ? ` · ${zh.archived}` : ""}
                    </Txt>
                  </View>
                  <Txt size={19} bold>
                    {formatMoney(balance)}
                  </Txt>
                  <Icon name="chevron.right" size={13} color={t.muted} />
                </Row>
              </Card>
            </Pressable>
          ))}
      </View>
      <Button
        label={zh.addAccount}
        secondary
        icon="plus"
        onPress={() => router.push("/account")}
      />
    </Page>
  );
}
