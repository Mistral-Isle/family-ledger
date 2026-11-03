import {
  assetViewAccounts,
  assetAccountGroups,
  availableBalance,
} from "../../domain/assetView";
import { Popover } from "../../components/HelpBubble";
import { Segmented } from "../../components/Segmented";
import { InlineReorderList } from "../../components/InlineReorderList";
import { AccountActionSheet } from "../../components/AccountActionSheet";
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
import { isHoldingAccount } from "../../domain/rentAccounts";
import { formatMoney } from "../../domain/money";
import { today } from "../../domain/date";
import { zh } from "../../i18n/zh";
export default function Assets() {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const [archived, setArchived] = useState(false);
  const [view, setView] = useState(() => repo.getAssetView());
  const [amountsHidden, setAmountsHidden] = useState(() =>
    repo.getAssetAmountsHidden(),
  );
  const [error, setError] = useState("");
  const [accountAction, setAccountAction] = useState<{
    id: string;
    action: "delete" | "balance";
  } | null>(null);
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
  const accounts = assetViewAccounts(data, view, today());
  const groups = assetAccountGroups(data, accounts.filter(a => !isHoldingAccount(a.account) && (archived || !a.account.archived)));
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);
  const assets = accounts
    .filter((a) => a.balance > 0)
    .reduce((sum, a) => sum + a.balance, 0);
  const debt = accounts
    .filter((a) => a.balance < 0)
    .reduce((sum, a) => sum - a.balance, 0);
  const available = availableBalance(accounts);
  const netLabel = view === "mine" ? "我的净资产" : "家庭净资产";
  const [headline, setHeadline] = useState(() => repo.getAssetHeadline());
  const switchHeadline = () => {
    const next = headline === "net" ? "available" : "net";
    setHeadline(next);
    try {
      repo.setAssetHeadline(next);
      setError("");
    } catch {
      setError("未能保存显示设置，请重试。");
    }
  };
  const composition = (
    <>
      {available.parts.map((part) => (
        <Row key={part.kind} style={{ justifyContent: "space-between" }}>
          <Txt size={13} color={t.muted}>
            {part.kind === "credit" && part.amount < 0
              ? "信用卡待还"
              : zh.accountKinds[part.kind]}
          </Txt>
          <Txt size={13}>{displayMoney(part.amount)}</Txt>
        </Row>
      ))}
      {!available.parts.length && (
        <Txt size={13} color={t.muted}>
          暂无储蓄卡、微信、支付宝、现金或信用卡余额。
        </Txt>
      )}
    </>
  );
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
      <Segmented height={40} value={view}
        options={[{ value: "mine", label: "我的资产" }, { value: "family", label: "家庭总资产" }]}
        onChange={(next) => { try { repo.setAssetView(next); setView(next); setError(""); } catch { setError("未能保存显示范围，请重试。"); } }} />
      <Card
        style={{
          backgroundColor: t.soft,
          borderColor: t.line,
          gap: 16,
        }}
      >
        <Row style={{ gap: 2, marginVertical: -10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`大字显示${headline === "net" ? zh.available : netLabel}`}
            onPress={switchHeadline}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              minHeight: 44,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Txt size={12} color={t.blue}>
              {headline === "net" ? netLabel : zh.available}
            </Txt>
            <Icon name="arrow.left.arrow.right" size={12} color={t.blue} />
          </Pressable>
          <IconButton
            name={amountsHidden ? "eye.slash" : "eye"}
            label={amountsHidden ? "显示资产金额" : "隐藏资产金额"}
            onPress={toggleAmounts}
            color={t.muted}
          />
        </Row>
        <Txt size={36} bold>
          {displayMoney(headline === "net" ? total : available.total)}
        </Txt>
        <Row style={{ alignItems: "flex-start" }}>
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
          <View style={{ flex: 1, gap: 5 }}>
            {headline === "net" ? (
              <Popover
                label="可用余额组成"
                align="end"
                menuWidth={260}
                triggerContent={
                  <View style={{ gap: 5 }}>
                    <Row style={{ gap: 3 }}>
                      <Txt size={11} color={t.muted}>
                        {zh.available}
                      </Txt>
                      <Icon name="questionmark.circle" size={11} color={t.muted} />
                    </Row>
                    <Txt size={17} bold>
                      {displayMoney(available.total)}
                    </Txt>
                  </View>
                }
              >
                {composition}
              </Popover>
            ) : (
              <>
                <Txt size={11} color={t.muted}>
                  {netLabel}
                </Txt>
                <Txt size={17} bold>
                  {displayMoney(total)}
                </Txt>
              </>
            )}
          </View>
        </Row>
        {headline === "available" && (
          <View style={{ gap: 6 }}>{composition}</View>
        )}
      </Card>
      <ErrorText message={error} />
      <Card>
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
      {groups.map(group => (
      <View key={group.id || "shared"} style={{ gap: 8 }}>
        <Txt size={14} bold color={t.muted}>{group.name}</Txt>
      <InlineReorderList
        items={group.rows
          .filter(
            (a) =>
              !isHoldingAccount(a.account) &&
              (archived || !a.account.archived),
          )
          .sort((a, b) => a.account.sort - b.account.sort)
          .map(({ account, balance }) => ({
            id: account.id,
            accountKind: account.kind,
            color: t.blue,
            name: account.name,
            subtitle:
              zh.accountKinds[account.kind] +
              (account.last4 ? ` · ${account.last4}` : "") +
              (account.archived ? " · 已归档" : ""),
            amount: displayMoney(balance),
            symbol:
              account.kind === "cash"
                ? "banknote"
                : account.kind === "wechat"
                  ? "message.fill"
                  : "creditcard.fill",
            leading: "balance",
            trailing: "delete,edit",
          }))}
        onReorder={(ids) => {
          run(() => repo.reorderAccounts(ids));
          setError("");
        }}
        onError={setError}
        onPress={(id) =>
          router.push({ pathname: "/account-detail", params: { id } })
        }
        onAction={(id, action) =>
          action === "edit"
            ? router.push({ pathname: "/account", params: { id } })
            : setAccountAction({
                id,
                action: action === "delete" ? "delete" : "balance",
              })
        }
      />
      </View>
      ))}
      {!groups.length && <Txt color={t.muted}>{view === "mine" ? "暂无属于你的账户，可添加账户或在账户编辑中调整归属成员。" : "暂无可显示的账户。"}</Txt>}
      {accountAction && (
        <AccountActionSheet
          id={accountAction.id}
          action={accountAction.action}
          onClose={() => setAccountAction(null)}
        />
      )}
      <Button
        label={zh.addAccount}
        secondary
        icon="plus"
        onPress={() => router.push("/account")}
      />
    </Page>
  );
}
