import { DateField } from "../components/DateField";
import { useReducedMotion } from "../components/useReducedMotion";
import { VaultGate } from "../components/VaultGate";
import { useState } from "react";
import {
  Pressable,
  TextInput,
  Text,
  View,
  ScrollView,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CategoryEditor,
  type CategoryDraft,
} from "../components/CategoryEditor";
import { EntryKeyboard } from "../components/EntryKeyboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { HorizontalStrip } from "../components/HorizontalStrip";
import { Segmented } from "../components/Segmented";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Chip,
  ErrorText,
  Field,
  Icon,
  IconButton,
  Row,
  Txt,
  useTheme,
  coral,
  confirmAction,
} from "../components/ui";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { today } from "../domain/date";
import type { Favorite, Txn } from "../domain/types";
import { zh } from "../i18n/zh";

export default function EntryRoute() {
  const { id, scope } = useLocalSearchParams<{ id?: string; scope?: string }>();
  const { data } = useLedger();
  return scope === "private" ||
    data.txns.find((t) => t.id === id)?.scope === "private" ? (
    <VaultGate>
      <Entry />
    </VaultGate>
  ) : (
    <Entry />
  );
}
function Entry() {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [childPicker, setChildPicker] = useState(false),
    [options, setOptions] = useState(false),
    [textEditing, setTextEditing] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(
    null,
  );
  const router = useRouter();
  const { id, scope: requestedScope } = useLocalSearchParams<{
    id?: string;
    scope?: string;
  }>();
  const existing = data.txns.find((txn) => txn.id === id && !txn.deleted);
  const scope =
    existing?.scope ?? (requestedScope === "private" ? "private" : "family");
  const [type, setType] = useState<"expense" | "income" | "transfer">(
    existing?.type === "income"
      ? "income"
      : existing?.type === "transfer"
        ? "transfer"
        : "expense",
  );
  const [amount, setAmount] = useState(
    existing ? moneyInput(existing.amount) : "",
  );
  const [accountId, setAccountId] = useState(
    existing?.accountId ??
      data.preferences.pinned.find((p) =>
        data.accounts.some(
          (a) => a.id === p && a.scope === scope && !a.deleted && !a.archived,
        ),
      ) ??
      data.accounts.find((a) => a.scope === scope && !a.deleted && !a.archived)
        ?.id ??
      "",
  );
  const [toId, setToId] = useState(existing?.toAccountId ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [expanded, setExpanded] = useState(
    data.categories.find((c) => c.id === existing?.categoryId)?.parentId ?? "",
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [date, setDate] = useState(existing?.occurredAt ?? today());
  const [time, setTime] = useState(
    existing
      ? (existing.occurredTime ?? "")
      : new Date().toTimeString().slice(0, 5),
  );
  const [allAccounts, setAllAccounts] = useState(false);
  const [mode, setMode] = useState(
    scope === "private" ? "standard" : data.preferences.mode,
  );
  const [error, setError] = useState("");
  const [favoriteName, setFavoriteName] = useState("");
  const [message, setMessage] = useState("");
  let preview = "";
  try {
    if (/[+−×÷*/-]/.test(amount)) preview = formatMoney(calculate(amount));
  } catch {
    /* Expression is still being entered. */
  }
  const accounts = data.accounts
    .filter(
      (a) =>
        a.scope === scope &&
        !a.deleted &&
        (!a.archived ||
          a.id === existing?.accountId ||
          a.id === existing?.toAccountId),
    )
    .sort((a, b) => a.sort - b.sort);
  const visibleAccounts =
    allAccounts || scope === "private"
      ? accounts
      : accounts
          .filter(
            (a) =>
              data.preferences.pinned.includes(a.id) ||
              a.id === accountId ||
              a.id === toId,
          )
          .sort((a, b) => {
            const rank = (id: string) => {
              const index = data.preferences.pinned.indexOf(id);
              return index < 0 ? 99 : index;
            };
            return rank(a.id) - rank(b.id);
          });
  const roots = data.categories
    .filter((c) => !c.deleted && !c.hidden && !c.parentId && c.kind === type)
    .sort((a, b) => {
      const rank = (id: string) => {
        const i = data.preferences.recentCategories.findIndex(
          (p) =>
            p === id ||
            data.categories.find((c) => c.id === p)?.parentId === id,
        );
        return i < 0 ? 999 : i;
      };
      return rank(a.id) - rank(b.id) || a.sort - b.sort;
    });
  const children = data.categories
    .filter(
      (c) =>
        !c.deleted && !c.hidden && c.parentId === expanded && c.kind === type,
    )
    .sort((a, b) => a.sort - b.sort);
  const selectedCategory = data.categories.find((c) => c.id === categoryId);
  function selectCategory(id: string) {
    setCategoryId(id);
    setError("");
    const last = data.preferences.lastAccount[id];
    if (last && accounts.some((a) => a.id === last && !a.archived))
      setAccountId(last);
    else
      setAccountId(
        data.preferences.pinned.find((p) =>
          accounts.some((a) => a.id === p && !a.archived),
        ) ??
          accounts[0]?.id ??
          "",
      );
  }
  function selectMode(next: "standard" | "daily") {
    if (scope === "private") return;
    setMode(next);
    run(() => repo.updatePreferences({ mode: next }));
  }
  function applyFavorite(favorite: Favorite) {
    const category = data.categories.find(
      (c) => c.id === favorite.categoryId && !c.deleted && !c.hidden,
    );
    if (!category) return;
    setType(category.kind);
    selectCategory(category.id);
    setExpanded(category.parentId ?? category.id);
    if (accounts.some((a) => a.id === favorite.accountId && !a.archived))
      setAccountId(favorite.accountId);
    setAmount(favorite.amount ? moneyInput(favorite.amount) : "");
    setNote(favorite.note);
    setMessage("");
  }
  function submit(again = false) {
    setError("");
    try {
      if (id && !existing) throw new Error(zh.errors.missing);
      const cents = calculate(amount);
      run(() =>
        repo.saveTxn({
          id: existing?.id,
          type,
          amount: cents,
          accountId,
          toAccountId: toId,
          categoryId,
          occurredAt: date,
          note,
          forWhom: existing?.forWhom ?? "both",
          occurredTime: time || null,
        }),
      );
      if (again) {
        setAmount("");
        setNote("");
        setMessage(zh.saved);
      } else router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function addFavorite() {
    if (scope === "private") return;
    try {
      const value = amount ? calculate(amount) : undefined;
      run(() =>
        repo.saveFavorite({
          categoryId,
          label: favoriteName || selectedCategory?.name || "",
          accountId,
          amount: value,
          note,
        }),
      );
      setMessage(zh.favoriteSaved);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function key(key: string) {
    setMessage("");
    if (key === "⌫") {
      setAmount(amount.slice(0, -1));
      return;
    }
    setError("");
    if (amount.length < 36) setAmount(amount + key);
  }
  function newCategory(parentId: string | null = null) {
    setCategoryDraft({
      name: "",
      parentId,
      icon: "category:bag",
      color: "#648BD2",
    });
    setChildPicker(false);
  }
  const focusText = () => {
    if (Platform.OS !== "web") setTextEditing(true);
  };
  const finishText = () => {
    Keyboard.dismiss();
    setTextEditing(false);
  };
  function accountStrip(destination = false) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon
          name={
            type === "transfer" ? "arrow.left.arrow.right" : "creditcard.fill"
          }
          color={t.muted}
          size={18}
        />
        {type === "transfer" && (
          <Txt size={11}>{destination ? zh.to : zh.from}</Txt>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <HorizontalStrip>
            {visibleAccounts.map((a) => (
              <Chip
                key={a.id}
                label={`${a.name}${a.last4 ? ` ${a.last4}` : ""}`}
                selected={a.id === (destination ? toId : accountId)}
                onPress={() =>
                  destination ? setToId(a.id) : setAccountId(a.id)
                }
              />
            ))}
            <IconButton
              name="ellipsis"
              label={zh.moreAccounts}
              onPress={() => setAllAccounts(!allAccounts)}
            />
            {!accounts.length && (
              <Button
                secondary
                label={zh.addAccount}
                onPress={() =>
                  router.push({ pathname: "/account", params: { scope } })
                }
              />
            )}
          </HorizontalStrip>
        </View>
      </View>
    );
  }
  function tile(c: (typeof roots)[number], child = false) {
    const selected =
      categoryId === c.id || (!child && selectedCategory?.parentId === c.id);
    const shown =
      selected && !child && selectedCategory?.parentId === c.id
        ? selectedCategory
        : c;
    const hasChildren =
      !child &&
      data.categories.some(
        (x) => x.parentId === c.id && !x.deleted && !x.hidden,
      );
    return (
      <Pressable
        key={c.id}
        accessibilityRole="button"
        accessibilityLabel={c.name}
        accessibilityState={{ selected }}
        onPress={() => {
          if (hasChildren) {
            setExpanded(c.id);
            setChildPicker(true);
          } else {
            selectCategory(c.id);
            setExpanded(c.parentId ?? c.id);
            setChildPicker(false);
          }
        }}
        style={({ pressed }) => ({
          width: "20%",
          alignItems: "center",
          paddingVertical: 6,
          gap: 5,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            backgroundColor: selected ? shown.color : t.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={shown.icon}
            size={25}
            color={selected ? "#fff" : shown.color}
          />
          {hasChildren && (
            <View
              style={{
                position: "absolute",
                right: -3,
                bottom: -2,
                width: 17,
                height: 17,
                borderRadius: 9,
                backgroundColor: t.card,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="ellipsis" size={14} color={t.muted} />
            </View>
          )}
        </View>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 11,
            lineHeight: 15,
            color: selected ? t.text : t.muted,
            textAlign: "center",
            paddingHorizontal: 2,
          }}
        >
          {shown.id !== c.id ? `${c.name}·${shown.name}` : c.name}
        </Text>
      </Pressable>
    );
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 600,
          alignSelf: "center",
          paddingTop: Math.max(insets.top, 8),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingHorizontal: 16,
        }}
      >
        <Row style={{ gap: 8, marginBottom: 8 }}>
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
          <View style={{ flex: 1 }}>
            <Segmented
              value={type}
              options={(["expense", "income", "transfer"] as const).map(
                (value) => ({ value, label: zh[value] }),
              )}
              onChange={(kind) => {
                setType(kind);
                setCategoryId("");
                setExpanded("");
                setError("");
              }}
            />
          </View>
          <IconButton
            name="ellipsis"
            label="记账选项"
            onPress={() => setOptions(true)}
          />
        </Row>
        <Row style={{ justifyContent: "space-between", minHeight: 34 }}>
          <Txt size={12} color={t.muted}>
            {scope === "private" ? zh.vault.title : zh.family}
          </Txt>
          {type !== "transfer" && scope === "family" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                mode === "standard" ? "切换常用" : zh.allCategories
              }
              onPress={() =>
                selectMode(mode === "standard" ? "daily" : "standard")
              }
              style={{ padding: 8 }}
            >
              <Txt size={12} color={t.blue}>
                {mode === "standard" ? "切换常用" : "全部分类"}
              </Txt>
            </Pressable>
          )}
        </Row>
        <ScrollView
          style={{ flex: 1, minHeight: type === "transfer" ? 0 : 64 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {type === "transfer" ? (
            <View style={{ alignItems: "center", padding: 20, gap: 8 }}>
              <Icon name="arrow.left.arrow.right" size={32} />
              <Txt size={13} color={t.muted}>
                选择转出与转入账户
              </Txt>
            </View>
          ) : mode === "daily" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {data.preferences.favorites
                .filter((f) => {
                  const c = data.categories.find((c) => c.id === f.categoryId);
                  return (
                    c &&
                    !c.deleted &&
                    !c.hidden &&
                    c.kind === type &&
                    !data.categories.find((p) => p.id === c.parentId)?.hidden
                  );
                })
                .map((f) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={f.label}
                    key={f.id}
                    onPress={() => applyFavorite(f)}
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      backgroundColor:
                        categoryId === f.categoryId ? t.soft : t.card,
                      minWidth: "45%",
                    }}
                  >
                    <Row>
                      <Icon
                        name={
                          data.categories.find((c) => c.id === f.categoryId)
                            ?.icon ?? "star.fill"
                        }
                      />
                      <Txt>{f.label}</Txt>
                    </Row>
                    <Txt size={12} color={t.muted}>
                      {f.amount ? formatMoney(f.amount) : zh.amount}
                    </Txt>
                  </Pressable>
                ))}
              {!data.preferences.favorites.length && (
                <Txt size={12} color={t.muted}>
                  {zh.noFavorites}
                </Txt>
              )}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {roots.map((c) => tile(c))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={zh.addCategory}
                onPress={() => newCategory()}
                style={{
                  width: "20%",
                  alignItems: "center",
                  paddingVertical: 6,
                  gap: 5,
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 16,
                    backgroundColor: t.card,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="plus" color={t.muted} size={24} />
                </View>
                <Txt size={11} color={t.muted}>
                  新增分类
                </Txt>
              </Pressable>
            </View>
          )}
        </ScrollView>
        <View style={{ gap: 6, paddingTop: 6 }}>
          {accountStrip()}
          {type === "transfer" && accountStrip(true)}
          <View
            style={{
              backgroundColor: t.card,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <Row style={{ gap: 6 }}>
              <Txt size={27} color={type === "income" ? t.green : coral}>
                ¥
              </Txt>
              <TextInput
                accessibilityLabel={zh.amount}
                value={amount}
                placeholder="0.00"
                onChangeText={setAmount}
                onFocus={finishText}
                showSoftInputOnFocus={false}
                maxLength={36}
                placeholderTextColor={t.muted}
                style={{
                  fontSize: 32,
                  fontWeight: "600",
                  color: type === "income" ? t.green : coral,
                  flex: 1,
                  minWidth: 0,
                  minHeight: 48,
                  padding: 0,
                }}
              />
              <View style={{ maxWidth: "36%" }}>
                <Txt size={11} color={t.muted}>
                  {selectedCategory?.name ??
                    (type === "transfer" ? zh.transfer : zh.chooseCategory)}
                </Txt>
                {!!preview && (
                  <Txt size={12} color={t.blue}>
                    {preview}
                  </Txt>
                )}
              </View>
            </Row>
            <View style={{ height: 1, backgroundColor: t.line }} />
            <Row style={{ gap: 10 }}>
              <DateField
                compact
                label={zh.date}
                value={date}
                onChange={setDate}
              />
              <View style={{ width: 1, height: 18, backgroundColor: t.line }} />
              <TextInput
                accessibilityLabel={zh.note}
                value={note}
                onChangeText={setNote}
                onFocus={focusText}
                maxLength={500}
                placeholder={zh.notePlaceholder}
                placeholderTextColor={t.muted}
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: t.text,
                  fontSize: 13,
                  minHeight: 44,
                }}
              />
            </Row>
          </View>
          <Row style={{ justifyContent: "space-between" }}>
            <DateField
              compact
              mode="time"
              label="时间"
              value={time}
              onChange={setTime}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setTime("")}
              style={{ minHeight: 44, padding: 12 }}
            >
              <Txt size={12} color={t.muted}>
                不记录时间
              </Txt>
            </Pressable>
          </Row>
          <ErrorText message={error} />
          {!!message && (
            <Txt size={11} color={t.green}>
              {message}
            </Txt>
          )}
          {textEditing ? (
            <Button label="完成输入" onPress={finishText} />
          ) : (
            <EntryKeyboard
              onKey={key}
              onSave={() => submit()}
              onAgain={existing ? undefined : () => submit(true)}
            />
          )}
        </View>
        <Modal
          transparent
          visible={childPicker}
          animationType={reducedMotion ? "none" : "fade"}
          onRequestClose={() => setChildPicker(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="收起二级分类"
              onPress={() => setChildPicker(false)}
              style={{ position: "absolute", inset: 0 }}
            />
            <View
              style={{
                backgroundColor: t.bg,
                borderTopLeftRadius: 26,
                borderTopRightRadius: 26,
                padding: 18,
                paddingBottom: Math.max(insets.bottom, 20),
                maxHeight: "65%",
                width: "100%",
                maxWidth: 600,
                alignSelf: "center",
                gap: 12,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <Txt size={18} bold>
                  {data.categories.find((c) => c.id === expanded)?.name}
                </Txt>
                <IconButton
                  name="xmark"
                  label="关闭二级分类"
                  onPress={() => setChildPicker(false)}
                />
              </Row>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {roots
                    .filter((c) => c.id === expanded)
                    .map((c) => tile(c, true))}
                  {children.map((c) => tile(c, true))}
                </View>
                <Button
                  secondary
                  icon="plus"
                  label="新增二级分类"
                  onPress={() => newCategory(expanded)}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
        {categoryDraft && (
          <CategoryEditor
            initial={categoryDraft}
            kind={type === "income" ? "income" : "expense"}
            onClose={() => setCategoryDraft(null)}
            onSaved={(id) => {
              setCategoryId(id);
              const c = repo.snapshot().categories.find((c) => c.id === id);
              setExpanded(c?.parentId ?? id);
            }}
          />
        )}
        <Modal
          visible={options}
          transparent
          animationType={reducedMotion ? "none" : "fade"}
          onRequestClose={() => setOptions(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭记账选项"
              onPress={() => setOptions(false)}
              style={{ position: "absolute", inset: 0 }}
            />
            <View
              style={{
                padding: 20,
                paddingBottom: Math.max(insets.bottom, 20),
                gap: 12,
                backgroundColor: t.bg,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <Txt bold>记账选项</Txt>
                <IconButton
                  name="xmark"
                  label={zh.close}
                  onPress={() => setOptions(false)}
                />
              </Row>
              <Button
                secondary
                label={zh.categoryManagement}
                onPress={() => {
                  setOptions(false);
                  router.push("/categories");
                }}
              />
              {scope === "family" && (
                <>
                  <Button
                    secondary
                    label={zh.vault.title}
                    onPress={() => {
                      setOptions(false);
                      router.replace({
                        pathname: "/entry",
                        params: { scope: "private" },
                      });
                    }}
                  />
                  {!existing && type === "expense" && (
                    <Button
                      secondary
                      label={zh.finance.prepaid}
                      onPress={() => {
                        setOptions(false);
                        router.push({
                          pathname: "/finance",
                          params: { kind: "prepaid" },
                        });
                      }}
                    />
                  )}
                  {!!categoryId && type !== "transfer" && (
                    <>
                      <Field
                        label={zh.favoriteName}
                        value={favoriteName}
                        onChangeText={setFavoriteName}
                        placeholder={selectedCategory?.name}
                      />
                      <Button
                        secondary
                        label={zh.addFavorite}
                        onPress={() => {
                          addFavorite();
                          setOptions(false);
                        }}
                      />
                    </>
                  )}
                </>
              )}
              {existing && (
                <Button
                  secondary
                  label={zh.remove}
                  onPress={() =>
                    confirmAction(zh.deleteEntry, zh.deleteEntryHint, () => {
                      try {
                        run(() => repo.deleteTxn(existing.id));
                        router.back();
                      } catch (e) {
                        setError((e as Error).message);
                        setOptions(false);
                      }
                    })
                  }
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}
