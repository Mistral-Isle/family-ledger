import { Platform } from "react-native";
import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FavoriteList } from "../components/FavoriteList";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Chip,
  Row,
  ErrorText,
  Field,
  FormScrollView,
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
  const [creating, setCreating] = useState(false);
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
      <Button label="添加常用项" icon="plus" onPress={() => {
        setCreating(true); setAmount(""); setError("");
        setDraft({ id: "", label: "", categoryId: data.categories.find(c => !c.deleted && !c.hidden && c.kind === "expense")?.id ?? "", accountId: data.accounts.find(a => a.scope === "family" && !a.deleted && !a.archived)?.id ?? "", note: "" });
      }} />
      <Txt color={t.muted} size={13}>
        长按拖动排序，点按编辑，左滑移除。
      </Txt>
      {data.preferences.favorites.length ? (
        <FavoriteList
          items={data.preferences.favorites}
          manage
          onPress={(f) => {
            setCreating(false);
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
        <FormScrollView
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: t.bg }}
          contentContainerStyle={{
            padding: 20,
            paddingTop: Platform.OS === "ios" ? 12 : Math.max(12, insets.top),
            gap: 20,
          }}
        >
          <Heading
            title={creating ? "添加常用项" : "编辑常用项"}
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
              {creating && <>
                <Txt bold>分类</Txt>
                <Row style={{ flexWrap: "wrap" }}>{data.categories.filter(c => !c.deleted && !c.hidden).map(c => <Chip key={c.id} label={(c.kind === "income" ? "收入 · " : "") + (c.parentId ? (data.categories.find(p => p.id === c.parentId)?.name ?? "") + " / " : "") + c.name} selected={draft.categoryId === c.id} onPress={() => setDraft({ ...draft, categoryId: c.id })} />)}</Row>
                <Txt bold>账户</Txt>
                <Row style={{ flexWrap: "wrap" }}>{data.accounts.filter(a => a.scope === "family" && !a.deleted && !a.archived).map(a => <Chip key={a.id} label={a.name} selected={draft.accountId === a.id} onPress={() => setDraft({ ...draft, accountId: a.id })} />)}</Row>
              </>}
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
                      if (creating) { repo.saveFavorite({ label, categoryId: draft.categoryId, accountId: draft.accountId, amount: value, note: draft.note }); return; }
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
        </FormScrollView>
      </Modal>
    </Page>
  );
}
