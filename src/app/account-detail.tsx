import { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import { AccountActionSheet } from "../components/AccountActionSheet";
import { AccountIcon } from "../components/AccountIcon";
import { VaultGate } from "../components/VaultGate";
import {
  Button,
  Card,
  Heading,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
} from "../components/ui";
import { accountHistory } from "../domain/accountDetails";
import { accountBalance } from "../domain/selectors";
import { formatMoney } from "../domain/money";
import { today, thisMonth } from "../domain/date";
import { MonthField } from "../components/MonthField";
import { financialRow } from "../domain/financialRows";
import { zh } from "../i18n/zh";
export default function AccountDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { data } = useLedger();
  return data.accounts.find((a) => a.id === id)?.scope === "private" ? (
    <VaultGate>
      <AccountDetail />
    </VaultGate>
  ) : (
    <AccountDetail />
  );
}
function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { data } = useLedger(),
    router = useRouter(),
    t = useTheme();
  const account = data.accounts.find((a) => a.id === id);
  const [month, setMonth] = useState(thisMonth()),
    [action, setAction] = useState<"delete" | "balance" | null>(null),
    [more, setMore] = useState(false);
  const history = useMemo(
    () =>
      account
        ? accountHistory(data, account, month)
        : { rows: [], inflow: 0, outflow: 0 },
    [data, account, month],
  );
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/(tabs)/assets");
  if (!account)
    return (
      <Page>
        <Heading title="账户详情" />
        <Txt>账户不存在</Txt>
        <Button label="返回资产" onPress={goBack} />
      </Page>
    );
  const groups = [...new Set(history.rows.map((r) => r.txn.occurredAt))];
  return (
    <Page>
      <Heading
        title="账户详情"
        action={
          <Row>
            <IconButton name="chevron.left" label="返回资产" onPress={goBack} />
            {!account.deleted && !account.archived && (
              <IconButton
                name="plus"
                label="用此账户记账"
                onPress={() =>
                  router.push({
                    pathname: "/entry",
                    params: { account: id, scope: account.scope },
                  })
                }
              />
            )}
          </Row>
        }
      />
      <Card>
        <Row>
          <AccountIcon kind={account.kind} />
          <Txt bold style={{ flex: 1 }} size={20}>
            {account.name}
          </Txt>
          {!account.deleted && (
            <Button secondary label="更多" onPress={() => setMore(!more)} />
          )}
        </Row>
        <Txt color={t.muted}>
          账户余额（CNY）{account.deleted ? " · 已删除" : ""}
        </Txt>
        <Row>
          <Txt size={34} bold>
            {formatMoney(accountBalance(account, data.txns, today()))}
          </Txt>
          {!account.deleted && (
            <IconButton
              name="pencil"
              label="调整余额"
              onPress={() => setAction("balance")}
            />
          )}
        </Row>
        {more && (
          <Row style={{ flexWrap: "wrap" }}>
            <Button
              secondary
              label="编辑账户"
              onPress={() =>
                router.push({ pathname: "/account", params: { id } })
              }
            />
            <Button
              secondary
              label="删除账户"
              onPress={() => setAction("delete")}
            />
          </Row>
        )}
      </Card>
      <Card>
        <MonthField label="月份" value={month} onChange={setMonth} />
        <Row style={{ justifyContent: "space-between" }}>
          <Txt color={t.red}>流出 {formatMoney(history.outflow)}</Txt>
          <Txt color={t.green}>流入 {formatMoney(history.inflow)}</Txt>
        </Row>
        {groups.length ? (
          groups.map((date) => (
            <View key={date} style={{ gap: 8 }}>
              <Txt size={12} color={t.muted}>
                {date}
              </Txt>
              {history.rows
                .filter((r) => r.txn.occurredAt === date)
                .map(({ txn, delta, balance }) => {
                  const category = data.categories.find(
                    (c) => c.id === txn.categoryId,
                  );
                  const title =
                    txn.type === "adjust"
                      ? "余额调整"
                      : (financialRow(data, txn)?.label ??
                        (txn.type === "refund"
                          ? "退款到账"
                          : (category?.name ?? zh[txn.type])));
                  return (
                    <Pressable
                      key={txn.id}
                      accessibilityRole="button"
                      accessibilityLabel={
                        title + " " + formatMoney(Math.abs(delta))
                      }
                      onPress={() => {
                        if (txn.type === "adjust") {
                          if (!account.deleted) setAction("balance");
                        } else if (
                          financialRow(data, txn) ||
                          txn.type === "repayment"
                        )
                          router.push("/finance");
                        else if (["scope_in", "scope_out"].includes(txn.type))
                          router.push({
                            pathname: "/scope-transfer",
                            params: { id: txn.id },
                          });
                        else
                          router.push({
                            pathname:
                              txn.type === "refund" ? "/refund" : "/entry",
                            params: { id: txn.id },
                          });
                      }}
                      style={{
                        paddingVertical: 12,
                        borderTopWidth: 0.5,
                        borderColor: t.line,
                      }}
                    >
                      <Row>
                        <Icon
                          name={category?.icon ?? "arrow.left.arrow.right"}
                          color={delta < 0 ? t.red : t.green}
                        />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Txt bold>{title}</Txt>
                          <Txt size={12} color={t.muted}>
                            {txn.occurredTime || ""}
                            {txn.note ? ` · ${txn.note}` : ""}
                          </Txt>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <Txt bold>
                            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                            {formatMoney(Math.abs(delta))}
                          </Txt>
                          <Txt size={11} color={t.muted}>
                            余额 {formatMoney(balance)}
                          </Txt>
                        </View>
                      </Row>
                    </Pressable>
                  );
                })}
            </View>
          ))
        ) : (
          <Txt color={t.muted}>本月没有账户流水</Txt>
        )}
      </Card>
      {action && (
        <AccountActionSheet
          id={id}
          action={action}
          onClose={() => setAction(null)}
          onDeleted={goBack}
        />
      )}
    </Page>
  );
}
