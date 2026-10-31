import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useLedger } from "../../components/LedgerProvider";
import { AccountIcon } from "../../components/AccountIcon";
import {
  Button,
  Card,
  Chip,
  Heading,
  ErrorText,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
  blue,
} from "../../components/ui";
import { accountBalance } from "../../domain/selectors";
import { rentAccountIds } from "../../domain/rentAccounts";
import { formatMoney } from "../../domain/money";
import { today } from "../../domain/date";
import { zh } from "../../i18n/zh";
export default function Assets() {
  const { data, repo } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const [archived, setArchived] = useState(false);
  const [amountsHidden, setAmountsHidden] = useState(() =>
    repo.getAssetAmountsHidden(),
  );
  const [error, setError] = useState("");
  const displayMoney = (amount: number) =>
    amountsHidden ? "***" : formatMoney(amount);
  const toggleAmounts = () => {
    try {
      repo.setAssetAmountsHidden(!amountsHidden);
      setAmountsHidden(!amountsHidden);
      setError("");
    } catch {
      setError("未能保存金额显示设置，请重试。");
    }
  };
  const rentalAccounts = rentAccountIds(data);
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
      <Heading
        title={zh.tabs.assets}
        subtitle={zh.assetHint}
        action={
          <Chip
            label={zh.finance.title}
            onPress={() => router.push("/finance")}
          />
        }
      />
      <Card
        style={{
          backgroundColor: t.soft,
          borderColor: t.line,
          gap: 16,
        }}
      >
        <Row style={{ gap: 2, marginVertical: -10 }}>
          <Txt size={12} color={t.blue}>
            {zh.netAssets}
          </Txt>
          <IconButton
            name={amountsHidden ? "eye.slash" : "eye"}
            label={amountsHidden ? "显示资产金额" : "隐藏资产金额"}
            onPress={toggleAmounts}
            color={t.muted}
          />
        </Row>
        <Txt size={36} bold>
          {displayMoney(total)}
        </Txt>
        <Row>
          <View style={{ flex: 1, gap: 5 }}>
            <Txt size={11} color={t.muted}>
              {zh.totalAssets}
            </Txt>
            <Txt size={17} bold>
              {displayMoney(assets)}
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Txt size={11} color={t.muted}>
              {zh.liabilities}
            </Txt>
            <Txt size={17} bold>
              {displayMoney(debt)}
            </Txt>
          </View>
        </Row>
      </Card>
      <ErrorText message={error} />
      <Card>
        <Txt>
          {zh.finance.available} ·{" "}
          {displayMoney(
            accounts
              .filter(
                (a) => !["deposit", "prepaid", "loan"].includes(a.account.kind),
              )
              .reduce((sum, a) => sum + a.balance, 0),
          )}
        </Txt>
        <Txt>
          {zh.finance.frozen} ·{" "}
          {displayMoney(
            accounts
              .filter((a) => ["deposit", "prepaid"].includes(a.account.kind))
              .reduce((sum, a) => sum + a.balance, 0),
          )}
        </Txt>
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
          .filter(
            (a) =>
              !rentalAccounts.has(a.account.id) &&
              (archived || !a.account.archived),
          )
          .sort((a, b) => a.account.sort - b.account.sort)
          .map(({ account, balance }) => (
            <Pressable
              key={account.id}
              accessibilityRole="button"
              onPress={() =>
                data.plans.some(
                  (p) =>
                    !p.deleted && JSON.parse(p.data).accountId === account.id,
                )
                  ? router.push("/finance")
                  : router.push({
                      pathname: "/account",
                      params: { id: account.id },
                    })
              }
            >
              <Card
                style={{ padding: 19, opacity: account.archived ? 0.6 : 1 }}
              >
                <Row>
                  <AccountIcon kind={account.kind} />
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Row style={{ gap: 8 }}>
                      <Txt bold style={{ flexShrink: 1 }}>
                        {account.name}
                      </Txt>
                      {data.preferences.pinned.includes(account.id) && (
                        <Icon name="pin.fill" size={11} color={blue} />
                      )}
                    </Row>
                    <Txt size={11} color={t.muted}>
                      {account.kind === "prepaid"
                        ? "预付余额 · 尚未计入支出"
                        : account.kind === "deposit"
                          ? "押金余额 · 尚未退回"
                          : zh.accountKinds[account.kind]}
                      {account.last4 ? ` · ${account.last4}` : ""}
                      {account.archived ? ` · ${zh.archived}` : ""}
                    </Txt>
                  </View>
                  <Txt size={19} bold>
                    {displayMoney(balance)}
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
