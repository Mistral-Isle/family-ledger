import { useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Card,
  ErrorText,
  Field,
  IconButton,
  Row,
  Txt,
  useTheme,
} from "./ui";
import { useLedger } from "./LedgerProvider";
import { useReducedMotion } from "./useReducedMotion";
import { useSubmissionGuard } from "./useSubmissionGuard";
import { favoriteFromTransaction } from "../domain/localShortcuts";
import { saveTransactionFavorite } from "../services/localShortcuts";
import { formatMoney } from "../domain/money";
import { shortcuts } from "../i18n/shortcuts";

export function SaveFavoriteSheet({
  txnId,
  onClose,
  onSaved,
}: {
  txnId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, repo, run } = useLedger(),
    t = useTheme(),
    insets = useSafeAreaInsets();
  const favorite = favoriteFromTransaction(data, txnId);
  const [label, setLabel] = useState(favorite?.label ?? ""),
    [error, setError] = useState("");
  const guard = useSubmissionGuard(txnId),
    reduced = useReducedMotion();
  return (
    <Modal
      visible
      animationType={reduced ? "none" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: t.bg }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 20,
            paddingTop: Math.max(16, insets.top),
            paddingBottom: Math.max(20, insets.bottom),
            gap: 18,
          }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <Txt size={22} bold>
              {shortcuts.saveFavorite}
            </Txt>
            <IconButton name="xmark" label="取消存为常用" onPress={onClose} />
          </Row>
          <Txt size={13} color={t.muted}>
            {shortcuts.preview}
          </Txt>
          {favorite && (
            <>
              <Field
                label={shortcuts.favoriteName}
                value={label}
                onChangeText={setLabel}
                maxLength={30}
              />
              <Card>
                <Txt bold>
                  {favorite.label} · {formatMoney(favorite.amount ?? 0)}
                </Txt>
                <Txt>
                  {data.accounts.find((a) => a.id === favorite.accountId)?.name}
                </Txt>
                {!!favorite.note && <Txt color={t.muted}>{favorite.note}</Txt>}
              </Card>
            </>
          )}
          <ErrorText message={favorite ? error : shortcuts.unavailable} />
          <Button
            label="保存常用项"
            disabled={!favorite || !label.trim()}
            onPress={() => {
              try {
                guard.run(() => {
                  run(() => saveTransactionFavorite(repo, txnId, label));
                  onSaved();
                });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
