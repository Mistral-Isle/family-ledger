import { useState } from "react";
import { Modal, ScrollView, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  ErrorText,
  Field,
  Heading,
  IconButton,
  Txt,
  useTheme,
} from "./ui";
import { useLedger } from "./LedgerProvider";
import { DateField } from "./DateField";
import { useSubmissionGuard } from "./useSubmissionGuard";
import { accountBalance } from "../domain/selectors";
import { accountDeletionRows } from "../domain/accountDetails";
import { moneyInput, parseMoney } from "../domain/money";
import { today } from "../domain/date";
export function AccountActionSheet({
  id,
  action,
  onClose,
  onDeleted,
}: {
  id: string;
  action: "delete" | "balance";
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { data, repo, run } = useLedger(),
    t = useTheme(),
    insets = useSafeAreaInsets();
  const account = data.accounts.find((a) => a.id === id && !a.deleted);
  const [amount, setAmount] = useState(
    account ? moneyInput(accountBalance(account, data.txns, today())) : "0",
  );
  const [date, setDate] = useState(today()),
    [error, setError] = useState("");
  const guard = useSubmissionGuard(id + action);
  function perform(removeRecords?: boolean) {
    try {
      guard.run(() => {
        run(() =>
          action === "balance"
            ? repo.adjustAccountBalance(id, parseMoney(amount), date)
            : repo.deleteAccount(id, !!removeRecords),
        );
        onClose();
        if (action === "delete") onDeleted?.();
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (action === "delete")
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            backgroundColor: "rgba(0,0,0,0.28)",
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 32,
              borderCurve: "continuous",
              backgroundColor: t.card,
              padding: 24,
              gap: 18,
            }}
          >
            <Txt bold size={22}>
              删除账户
            </Txt>
            <Txt>
              正在删除「{account?.name ?? "已删除账户"}
              」，请选择是否保留关联的账单记录。
            </Txt>
            <Txt size={13} color={t.muted}>
              同时删除会撤销 {accountDeletionRows(data, id).length}{" "}
              笔关联记录，包括转账和退款，并更新相关账户余额。
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="同时删除账户和账单记录"
              disabled={!account}
              onPress={() => perform(true)}
              style={({ pressed }) => ({
                padding: 16,
                minHeight: 52,
                borderRadius: 26,
                backgroundColor: t.soft,
                alignItems: "center",
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Txt bold color={t.red}>
                同时删除账户和账单记录
              </Txt>
            </Pressable>
            <Button
              secondary
              label="删除账户，保留账单记录"
              disabled={!account}
              onPress={() => perform(false)}
            />
            <ErrorText message={error} />
            <Button secondary label="取消" onPress={onClose} />
          </View>
        </View>
      </Modal>
    );
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: t.bg }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: Math.max(20, insets.top),
          gap: 20,
        }}
      >
        <Heading
          title="调整余额"
          action={
            <IconButton name="xmark" label="取消账户操作" onPress={onClose} />
          }
        />
        <Txt bold size={20}>
          {account?.name ?? "账户已删除"}
        </Txt>

        <Field
          label="实际余额"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numbers-and-punctuation"
        />
        <DateField label="调整日期" value={date} onChange={setDate} />
        <Txt size={13} color={t.muted}>
          差额将保存为一条余额调整记录，不计入收入、支出和预算。
        </Txt>
        <Button
          label="确认调整余额"
          disabled={!account}
          onPress={() => perform()}
        />
        <ErrorText message={error} />
        <Button secondary label="取消" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}
