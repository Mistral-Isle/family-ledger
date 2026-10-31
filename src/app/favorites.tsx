import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FavoriteList } from "../components/FavoriteList";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  ErrorText,
  Field,
  Heading,
  IconButton,
  Page,
  Txt,
  useTheme,
} from "../components/ui";
import { moneyInput, parseMoney } from "../domain/money";
import type { Favorite } from "../domain/types";
export default function Favorites() {
  const { data, repo, run } = useLedger(),
    router = useRouter(),
    t = useTheme(),
    insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Favorite | null>(null),
    [amount, setAmount] = useState(""),
    [error, setError] = useState("");
  return (
    <Page>
      <Heading
        title="常用项管理"
        action={
          <IconButton
            name="xmark"
            label="关闭常用项管理"
            onPress={() => router.back()}
          />
        }
      />
      <Txt color={t.muted} size={13}>
        拖动调整顺序，点按编辑，左滑移除。
      </Txt>
      {data.preferences.favorites.length ? (
        <FavoriteList
          items={data.preferences.favorites}
          manage
          onPress={(f) => {
            setDraft({ ...f });
            setAmount(f.amount ? moneyInput(f.amount) : "");
            setError("");
          }}
        />
      ) : (
        <Txt>还没有常用项，可以在明细中侧滑账单存为常用。</Txt>
      )}
      <Modal
        visible={!!draft}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDraft(null)}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: t.bg }}
          contentContainerStyle={{
            padding: 20,
            paddingTop: Math.max(insets.top, 20),
            gap: 20,
          }}
        >
          <Heading
            title="编辑常用项"
            action={
              <IconButton
                name="xmark"
                label="取消编辑常用项"
                onPress={() => setDraft(null)}
              />
            }
          />
          {draft && (
            <>
              <Field
                label="常用项名称"
                value={draft.label}
                maxLength={30}
                onChangeText={(label) => setDraft({ ...draft, label })}
              />
              <Field
                label="预设金额"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <Field
                label="备注"
                value={draft.note}
                onChangeText={(note) => setDraft({ ...draft, note })}
              />
              <ErrorText message={error} />
              <Button
                label="保存常用项"
                onPress={() => {
                  try {
                    const label = draft.label.trim();
                    if (!label) throw new Error("请填写常用项名称");
                    const value = amount.trim()
                      ? parseMoney(amount)
                      : undefined;
                    if (value !== undefined && value <= 0)
                      throw new Error("预设金额须大于零");
                    run(() => {
                      const current = repo.snapshot().preferences.favorites;
                      if (!current.some((f) => f.id === draft.id))
                        throw new Error("常用项已移除");
                      repo.updatePreferences({
                        favorites: current.map((f) =>
                          f.id === draft.id
                            ? { ...f, label, amount: value, note: draft.note }
                            : f,
                        ),
                      });
                    });
                    setDraft(null);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            </>
          )}
        </ScrollView>
      </Modal>
    </Page>
  );
}
