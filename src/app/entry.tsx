import {
  privacyAccountId,
  privacyMemberId,
  transferAccountName,
} from "../domain/privacyTransfer";
import { EntryDateTime } from "../components/EntryDateTime";
import { useSubmissionGuard } from "../components/useSubmissionGuard";
import { useReducedMotion } from "../components/useReducedMotion";
import { VaultGate } from "../components/VaultGate";
import { SharedEntryFields } from "../components/SharedEntryFields";
import { TxnMetadata } from "../components/TxnMetadata";
import { type DuplicateMatch } from "../domain/travel";
import { useEffect, useState } from "react";
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
    data.txns.find((t) => t.id === id)?.scope === "private" ||
    privacyMemberId(data.txns.find((t) => t.id === id)?.accountId) ===
      data.meId ? (
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
    [advancedOptions, setAdvancedOptions] = useState(false),
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
  function closeEntry() {
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace(scope === "private" ? "/vault" : "/");
  }
  function closeOptions() {
    setOptions(false);
    setSharedOptions(false);
    setAdvancedOptions(false);
  }
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
  // Keep historical attribution until the payment account is changed.
  const payerMemberId =
    existing && existing.accountId === accountId
      ? (existing.payerMemberId ?? null)
      : (data.accounts.find((a) => a.id === accountId)?.ownerMemberId ??
        data.meId);
  const [tripId, setTripId] = useState<string | null>(
    existing ? (existing.tripId ?? null) : repo.currentTripId(),
  );
  const [forWhom] = useState<Txn["forWhom"]>(existing?.forWhom ?? "both");
  const [sharedOptions, setSharedOptions] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>(
    [],
  );
  const [duplicateAgain, setDuplicateAgain] = useState(false);
  const [toId, setToId] = useState(
    existing?.toAccountId ??
      data.accounts.find(
        (a) =>
          a.scope === scope &&
          !a.deleted &&
          !a.archived &&
          a.id !== accountId &&
          a.ownerMemberId !== data.meId,
      )?.id ??
      data.accounts.find(
        (a) =>
          a.scope === scope &&
          !a.deleted &&
          !a.archived &&
          a.id !== accountId &&
          !["loan", "deposit", "prepaid"].includes(a.kind),
      )?.id ??
      "",
  );
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [expanded, setExpanded] = useState(
    data.categories.find((c) => c.id === existing?.categoryId)?.parentId ?? "",
  );
  const [excludeBudget, setExcludeBudget] = useState(
    existing?.excludeBudget ?? false,
  );
  const [excludeTotals, setExcludeTotals] = useState(
    existing?.excludeTotals ?? false,
  );
  const [addingFavorite, setAddingFavorite] = useState(false);
  const [transferPicker, setTransferPicker] = useState(false);
  const [transferSide, setTransferSide] = useState<"from" | "to">("to");
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
  const submission = useSubmissionGuard(amount === "");
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
    .sort((a, b) => a.sort - b.sort);
  const children = data.categories
    .filter(
      (c) =>
        !c.deleted && !c.hidden && c.parentId === expanded && c.kind === type,
    )
    .sort((a, b) => a.sort - b.sort);
  const selectedCategory = data.categories.find((c) => c.id === categoryId);
  function selectCategory(id: string) {
    setCategoryId(id);
    if (addingFavorite) {
      setAddingFavorite(false);
      setAdvancedOptions(true);
      setOptions(true);
    }
    setError("");
    // Remembered defaults apply to new entries, not an existing payment.
    if (existing) return;
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
  function submit(again = false, allowDuplicate = false) {
    setError("");
    try {
      if (id && !existing) throw new Error(zh.errors.missing);
      const cents = calculate(amount);
      const candidates =
        !existing && scope === "family" && type === "expense"
          ? repo.findDuplicateCandidates({
              type,
              amount: cents,
              accountId,
              occurredAt: date,
              occurredTime: time || null,
            })
          : [];
      if (candidates.length && !allowDuplicate) {
        setDuplicateMatches(candidates);
        setDuplicateAgain(again);
        return;
      }
      if (
        !submission.run(() =>
          run(() =>
            type === "transfer" &&
            (scope === "family" ||
              privacyMemberId(toId) ||
              data.accounts.find((a) => a.id === toId)?.scope === "family")
              ? repo.saveMemberTransfer({
                  id: existing?.id,
                  accountId,
                  toAccountId: toId,
                  amount: cents,
                  occurredAt: date,
                  occurredTime: time || null,
                  note,
                })
              : repo.saveTxn({
                  excludeBudget,
                  excludeTotals,
                  id: existing?.id,
                  type,
                  amount: cents,
                  accountId,
                  toAccountId: toId,
                  categoryId,
                  occurredAt: date,
                  note,
                  forWhom,
                  payerMemberId: type === "expense" ? payerMemberId : null,
                  tripId:
                    scope === "family" && type === "expense" ? tripId : null,
                  acceptDuplicateIds: allowDuplicate
                    ? candidates.map((c) => c.txn.id)
                    : [],
                  occurredTime: time || null,
                }),
          ),
        )
      )
        return;
      setDuplicateMatches([]);
      if (again) {
        setAmount("");
        setNote("");
        if (
          tripId &&
          !repo
            .snapshot()
            .trips?.some((t) => t.id === tripId && !t.deleted && !t.ended)
        )
          setTripId(null);
        setMessage(zh.saved);
      } else closeEntry();
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
            {(allAccounts || accounts.length > visibleAccounts.length) && (
              <Chip
                label={allAccounts ? "收起账户" : "全部账户"}
                selected={allAccounts}
                onPress={() => setAllAccounts(!allAccounts)}
              />
            )}
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
                width: 22,
                height: 22,
                borderRadius: 9,
                backgroundColor: t.card,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="ellipsis" size={17} color={t.blue} />
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
          <IconButton name="xmark" label={zh.close} onPress={closeEntry} />
          <View style={{ flex: 1 }}>
            <Segmented
              value={type}
              options={(["expense", "income", "transfer"] as const).map(
                (value) => ({ value, label: zh[value] }),
              )}
              onChange={(kind) => {
                setType(kind);
                if (
                  kind !== "transfer" &&
                  !accounts.some((a) => a.id === accountId)
                ) {
                  setAccountId(accounts.find((a) => !a.archived)?.id ?? "");
                }
                setCategoryId("");
                setExpanded("");
                setError("");
              }}
            />
          </View>
          <View style={{ width: 44 }} />
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
            <View style={{ gap: 10, paddingVertical: 8 }}>
              {(["from", "to"] as const).map((side) => {
                const selectedId = side === "from" ? accountId : toId;
                return (
                  <Pressable
                    key={side}
                    accessibilityRole="button"
                    accessibilityLabel={
                      side === "from" ? "选择转出账户" : "选择转入账户"
                    }
                    onPress={() => {
                      setTransferSide(side);
                      setTransferPicker(true);
                    }}
                    style={{
                      padding: 12,
                      gap: 4,
                      borderRadius: 22,
                      backgroundColor: transferSide === side ? t.soft : t.card,
                      borderWidth: 1,
                      borderColor: transferSide === side ? t.blue : t.line,
                    }}
                  >
                    <Txt size={13} color={t.muted}>
                      {side === "from" ? "转出账户" : "转入账户"}
                    </Txt>
                    <Txt size={18} bold>
                      {selectedId
                        ? (data.accounts.find((a) => a.id === selectedId)
                            ?.name ?? transferAccountName(data, selectedId))
                        : "请选择账户"}
                    </Txt>
                  </Pressable>
                );
              })}
              <Button
                secondary
                label="交换转入与转出"
                disabled={
                  !!privacyMemberId(toId) &&
                  (scope !== "private" || privacyMemberId(toId) !== data.meId)
                }
                onPress={() => {
                  setAccountId(toId);
                  setToId(accountId);
                }}
              />
              <Modal
                visible={transferPicker}
                transparent
                animationType={reducedMotion ? "none" : "fade"}
                onRequestClose={() => setTransferPicker(false)}
              >
                <View
                  style={{
                    flex: 1,
                    justifyContent: "flex-end",
                    backgroundColor: "#00000055",
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="关闭账户选择"
                    style={{ position: "absolute", inset: 0 }}
                    onPress={() => setTransferPicker(false)}
                  />
                  <View
                    accessibilityViewIsModal
                    style={{
                      backgroundColor: t.bg,
                      padding: 20,
                      paddingBottom: Math.max(20, insets.bottom),
                      borderTopLeftRadius: 24,
                      borderTopRightRadius: 24,
                      maxHeight: "70%",
                      gap: 12,
                    }}
                  >
                    <Row style={{ justifyContent: "space-between" }}>
                      <Txt bold size={18}>
                        {transferSide === "from" ? "转出账户" : "转入账户"}
                      </Txt>
                      <IconButton
                        name="xmark"
                        label="完成账户选择"
                        onPress={() => setTransferPicker(false)}
                      />
                    </Row>
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {" "}
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        {data.accounts
                          .filter(
                            (a) =>
                              !a.deleted &&
                              !a.archived &&
                              !["loan", "deposit", "prepaid"].includes(
                                a.kind,
                              ) &&
                              (a.scope === scope || a.scope === "family"),
                          )
                          .map((a) => (
                            <Chip
                              key={a.id}
                              label={
                                a.name +
                                " · " +
                                (data.members.find(
                                  (m) => m.id === a.ownerMemberId,
                                )?.name ?? "成员")
                              }
                              selected={
                                (transferSide === "from" ? accountId : toId) ===
                                a.id
                              }
                              onPress={() => {
                                transferSide === "from"
                                  ? setAccountId(a.id)
                                  : setToId(a.id);
                                setTransferPicker(false);
                              }}
                            />
                          ))}
                        {data.members
                          .filter(
                            (m) =>
                              !m.deleted &&
                              (transferSide === "to" ||
                                (scope === "private" && m.id === data.meId)),
                          )
                          .map((m) => (
                            <Chip
                              key={m.id}
                              label={
                                m.id === data.meId
                                  ? "我的隐私账户"
                                  : "对方的隐私账户"
                              }
                              selected={
                                (transferSide === "from" ? accountId : toId) ===
                                privacyAccountId(m.id)
                              }
                              onPress={() => {
                                transferSide === "from"
                                  ? setAccountId(privacyAccountId(m.id))
                                  : setToId(privacyAccountId(m.id));
                                setTransferPicker(false);
                              }}
                            />
                          ))}
                      </View>
                    </ScrollView>
                    <Txt size={12}>
                      隐私账户不显示余额、卡号或真实账户名称。
                    </Txt>
                  </View>
                </View>
              </Modal>
              <Txt size={12} color={t.muted}>
                内部转账不计收支和预算；点账户可更换。
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
              <Button
                secondary
                icon="plus"
                label="添加常用"
                onPress={() => {
                  setAddingFavorite(true);
                  selectMode("standard");
                  setMessage("选择一个分类，保存为常用记账模板");
                }}
              />
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
                accessibilityLabel="分类设置"
                onPress={() =>
                  router.push({
                    pathname: "/categories",
                    params: { kind: type === "income" ? "income" : "expense" },
                  })
                }
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
                  <Icon name="gearshape.fill" color={t.muted} size={24} />
                </View>
                <Txt size={11} color={t.muted}>
                  设置
                </Txt>
              </Pressable>
            </View>
          )}
        </ScrollView>
        <View style={{ gap: 6, paddingTop: 6 }}>
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {type !== "transfer" && accountStrip()}
            </View>
            <IconButton
              name="gearshape.fill"
              label="更多设置"
              onPress={() => setOptions(true)}
            />
          </Row>
          {type !== "transfer" &&
            (excludeBudget ||
              excludeTotals ||
              (scope === "family" && type === "expense" && tripId)) && (
              <Text numberOfLines={1} style={{ fontSize: 11, color: t.muted }}>
                {[
                  scope === "family" &&
                    type === "expense" &&
                    data.trips?.find((x) => x.id === tripId && !x.deleted)
                      ?.name,
                  excludeBudget && "不计预算",
                  excludeTotals && "不计收支",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            )}
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
              <EntryDateTime
                date={date}
                time={time}
                onChange={(nextDate, nextTime) => {
                  setDate(nextDate);
                  setTime(nextTime);
                }}
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
          visible={duplicateMatches.length > 0}
          transparent
          animationType="fade"
          onRequestClose={() => setDuplicateMatches([])}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,.35)",
              padding: 20,
            }}
          >
            <View
              style={{
                backgroundColor: t.bg,
                padding: 20,
                borderRadius: 24,
                maxHeight: "85%",
                gap: 14,
              }}
            >
              <Txt size={20} bold>
                {duplicateMatches.some((x) => x.strong)
                  ? zh.collaboration.duplicateTitle
                  : zh.collaboration.weakTitle}
              </Txt>
              <Txt size={13}>
                {duplicateMatches.some((x) => x.strong)
                  ? zh.collaboration.duplicateBody
                  : zh.collaboration.weakBody}
              </Txt>
              <ScrollView contentContainerStyle={{ gap: 16 }}>
                {duplicateMatches.map((x) => (
                  <View key={x.txn.id} style={{ gap: 8 }}>
                    <TxnMetadata data={data} txn={x.txn} full />
                    <Button
                      secondary
                      label={zh.collaboration.viewExisting}
                      onPress={() => {
                        setDuplicateMatches([]);
                        router.replace({
                          pathname: "/entry",
                          params: { id: x.txn.id },
                        });
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
              <Button
                label={zh.collaboration.stillAdd}
                onPress={() => submit(duplicateAgain, true)}
              />
              <Button
                secondary
                label={zh.cancel}
                onPress={() => setDuplicateMatches([])}
              />
            </View>
          </View>
        </Modal>
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
          onRequestClose={closeOptions}
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
              onPress={closeOptions}
              style={{ position: "absolute", inset: 0 }}
            />
            <View
              style={{
                maxHeight: "85%",
                width: "100%",
                maxWidth: 600,
                alignSelf: "center",
                padding: 20,
                paddingBottom: Math.max(insets.bottom, 20),
                gap: 12,
                backgroundColor: t.bg,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <IconButton
                  name="xmark"
                  label="关闭更多设置"
                  onPress={closeOptions}
                />
                <Txt bold size={18}>
                  {sharedOptions ? "关联行程" : "更多设置"}
                </Txt>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="完成设置"
                  onPress={() =>
                    sharedOptions ? setSharedOptions(false) : closeOptions()
                  }
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt color={t.blue}>完成</Txt>
                </Pressable>
              </Row>
              {sharedOptions ? (
                <SharedEntryFields
                  embedded
                  visible
                  onClose={() => setSharedOptions(false)}
                  tripId={tripId}
                  onTrip={setTripId}
                />
              ) : (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ gap: 14 }}
                >
                  {scope === "family" && type === "expense" && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={zh.collaboration.entryOptions}
                      onPress={() => setSharedOptions(true)}
                      style={{
                        minHeight: 52,
                        padding: 14,
                        borderRadius: 16,
                        backgroundColor: t.card,
                      }}
                    >
                      <Row>
                        <Icon name="suitcase.fill" color={t.muted} size={20} />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Txt>关联行程</Txt>
                          <Txt size={12} color={t.muted}>
                            {data.trips?.find(
                              (x) => x.id === tripId && !x.deleted,
                            )?.name ?? zh.collaboration.noTrip}
                          </Txt>
                        </View>
                        <Icon name="chevron.right" color={t.muted} size={16} />
                      </Row>
                    </Pressable>
                  )}
                  {type !== "transfer" &&
                    [
                      {
                        label: "不计入预算",
                        checked: excludeBudget,
                        toggle: () => setExcludeBudget(!excludeBudget),
                      },
                      {
                        label: "不计入收支",
                        checked: excludeTotals,
                        toggle: () => setExcludeTotals(!excludeTotals),
                      },
                    ].map((option) => (
                      <Pressable
                        key={option.label}
                        accessibilityRole="checkbox"
                        accessibilityLabel={option.label}
                        accessibilityState={{ checked: option.checked }}
                        onPress={option.toggle}
                        style={{
                          minHeight: 56,
                          padding: 14,
                          borderRadius: 16,
                          backgroundColor: t.card,
                        }}
                      >
                        <Row>
                          <Icon
                            name={
                              option.checked
                                ? "checkmark.circle.fill"
                                : "circle"
                            }
                            color={option.checked ? t.blue : t.muted}
                          />
                          <Txt>{option.label}</Txt>
                        </Row>
                      </Pressable>
                    ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      advancedOptions ? "收起其他操作" : "其他操作"
                    }
                    accessibilityState={{ expanded: advancedOptions }}
                    onPress={() => setAdvancedOptions(!advancedOptions)}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <Row style={{ justifyContent: "space-between" }}>
                      <Txt size={13} color={t.muted}>
                        {advancedOptions ? "收起其他操作" : "其他操作"}
                      </Txt>
                      <Icon name="chevron.down" size={16} color={t.muted} />
                    </Row>
                  </Pressable>
                  {advancedOptions && (
                    <>
                      <View
                        style={{
                          height: 1,
                          backgroundColor: t.line,
                          marginVertical: 2,
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
                              label={zh.finance.rent}
                              onPress={() => {
                                setOptions(false);
                                router.push({
                                  pathname: "/finance",
                                  params: { kind: "rent" },
                                });
                              }}
                            />
                          )}
                          {!!categoryId && type !== "transfer" && (
                            <>
                              <Txt size={13}>
                                保存当前分类、账户及已填的金额和备注，下次点一下即可带入。
                              </Txt>
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
                            confirmAction(
                              zh.deleteEntry,
                              zh.deleteEntryHint,
                              () => {
                                try {
                                  run(() => repo.deleteTxn(existing.id));
                                  closeEntry();
                                } catch (e) {
                                  setError((e as Error).message);
                                  setOptions(false);
                                }
                              },
                            )
                          }
                        />
                      )}
                    </>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}
