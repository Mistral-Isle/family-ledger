import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Heading,
  Icon,
  IconButton,
  Page,
  Row,
  Txt,
  useTheme,
  blue,
  coral,
  styles,
  confirmAction,
} from "../components/ui";
import { calculate, formatMoney, moneyInput } from "../domain/money";
import { today } from "../domain/date";
import type { Favorite, Txn } from "../domain/types";
import { zh } from "../i18n/zh";

export default function Entry() {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = data.txns.find((txn) => txn.id === id && !txn.deleted);
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
        data.accounts.some((a) => a.id === p && !a.archived),
      ) ??
      data.accounts.find((a) => !a.archived)?.id ??
      "",
  );
  const [toId, setToId] = useState(existing?.toAccountId ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [expanded, setExpanded] = useState(
    data.categories.find((c) => c.id === existing?.categoryId)?.parentId ?? "",
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [date, setDate] = useState(existing?.occurredAt ?? today());
  const [forWhom, setForWhom] = useState<Txn["forWhom"]>(
    existing?.forWhom ?? "both",
  );
  const [allAccounts, setAllAccounts] = useState(false);
  const [mode, setMode] = useState(data.preferences.mode);
  const [error, setError] = useState("");
  const [favoriteForm, setFavoriteForm] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [message, setMessage] = useState("");
  const accounts = data.accounts
    .filter(
      (a) =>
        a.scope === "family" &&
        !a.deleted &&
        (!a.archived ||
          a.id === existing?.accountId ||
          a.id === existing?.toAccountId),
    )
    .sort((a, b) => a.sort - b.sort);
  const visibleAccounts = allAccounts
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
          forWhom,
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
      setFavoriteForm(false);
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
    if (key === "=") {
      try {
        setAmount(moneyInput(calculate(amount)));
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    if (amount.length < 36) setAmount(amount + key);
  }
  function accountStrip(destination = false) {
    return (
      <View style={{ gap: 9 }}>
        <Txt size={11} color={t.muted}>
          {type === "transfer"
            ? destination
              ? zh.to
              : zh.from
            : zh.accountHint}
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
        >
          {visibleAccounts.map((account) => (
            <Chip
              key={account.id}
              label={`${account.name}${account.last4 ? ` ${account.last4}` : ""}`}
              selected={account.id === (destination ? toId : accountId)}
              onPress={() =>
                destination ? setToId(account.id) : setAccountId(account.id)
              }
            />
          ))}
          <IconButton
            name="ellipsis"
            label={zh.moreAccounts}
            onPress={() => setAllAccounts(!allAccounts)}
          />
          {accounts.length === 0 && (
            <Button
              secondary
              label={zh.addAccount}
              onPress={() => router.push("/account")}
            />
          )}
        </ScrollView>
      </View>
    );
  }
  return (
    <Page>
      <Heading
        title={existing ? zh.editEntry : zh.newEntry}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Row style={{ gap: 7 }}>
          {(["expense", "income", "transfer"] as const).map((kind) => (
            <Chip
              key={kind}
              label={zh[kind]}
              selected={type === kind}
              onPress={() => {
                setType(kind);
                setCategoryId("");
                setExpanded("");
                setError("");
              }}
            />
          ))}
        </Row>
        <Txt size={10} color={t.muted}>
          {zh.family}
        </Txt>
      </Row>
      <View style={{ paddingVertical: 3, gap: 5 }}>
        <Txt size={12} color={t.muted}>
          {zh.amount}
        </Txt>
        <Row style={{ gap: 8 }}>
          <Txt size={29} color={t.muted}>
            {zh.currency}
          </Txt>
          <TextInput
            accessibilityLabel={zh.amount}
            value={amount}
            placeholder="0.00"
            placeholderTextColor={t.muted}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={{
              fontSize: 42,
              fontWeight: "600",
              color: t.text,
              flex: 1,
              padding: 0,
              minHeight: 58,
            }}
          />
        </Row>
        <Txt size={11} color={t.muted}>
          {selectedCategory?.name ??
            (type === "transfer" ? zh.transfer : zh.chooseCategory)}{" "}
          · {date}
        </Txt>
      </View>
      {accountStrip()}
      {type === "transfer" ? (
        accountStrip(true)
      ) : (
        <>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt size={12} bold>
              {zh.categories}
            </Txt>
            <Row style={{ gap: 5 }}>
              <Chip
                label={zh.standard}
                selected={mode === "standard"}
                onPress={() => selectMode("standard")}
              />
              <Chip
                label={zh.daily}
                selected={mode === "daily"}
                onPress={() => selectMode("daily")}
              />
            </Row>
          </Row>
          {mode === "daily" ? (
            <View style={styles.wrap}>
              {data.preferences.favorites
                .filter((f) => {
                  const c = data.categories.find((c) => c.id === f.categoryId);
                  const p = data.categories.find((p) => p.id === c?.parentId);
                  return (
                    c &&
                    !c.hidden &&
                    !c.deleted &&
                    !p?.hidden &&
                    c.kind === type
                  );
                })
                .map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => applyFavorite(f)}
                    onLongPress={() =>
                      confirmAction(zh.removeFavorite, f.label, () =>
                        run(() =>
                          repo.updatePreferences({
                            favorites: data.preferences.favorites.filter(
                              (x) => x.id !== f.id,
                            ),
                          }),
                        ),
                      )
                    }
                    style={{
                      width: "47%",
                      padding: 16,
                      gap: 5,
                      borderRadius: 16,
                      backgroundColor:
                        categoryId === f.categoryId ? t.soft : t.card,
                      borderWidth: 1,
                      borderColor: categoryId === f.categoryId ? blue : t.line,
                    }}
                  >
                    <Txt bold>{f.label}</Txt>
                    <Txt size={11} color={t.muted}>
                      {data.accounts.find((a) => a.id === f.accountId)?.name}
                    </Txt>
                    <Txt size={18} bold color={t.blue}>
                      {f.amount ? formatMoney(f.amount) : zh.amount}
                    </Txt>
                  </Pressable>
                ))}
              {!data.preferences.favorites.length && (
                <Txt size={12} color={t.muted}>
                  {zh.noFavorites}
                </Txt>
              )}
              <Chip
                label={zh.allCategories}
                onPress={() => selectMode("standard")}
              />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <View style={styles.wrap}>
                {roots.map((root) => (
                  <Pressable
                    key={root.id}
                    accessibilityRole="button"
                    accessibilityLabel={root.name}
                    onPress={() => {
                      setExpanded(root.id);
                      if (
                        !data.categories.some(
                          (c) =>
                            c.parentId === root.id && !c.deleted && !c.hidden,
                        )
                      )
                        selectCategory(root.id);
                    }}
                    style={{
                      width: "22%",
                      alignItems: "center",
                      paddingVertical: 12,
                      gap: 7,
                      borderRadius: 16,
                      backgroundColor: expanded === root.id ? t.soft : t.card,
                      borderWidth: 1,
                      borderColor: expanded === root.id ? blue : t.line,
                    }}
                  >
                    <Icon name={root.icon} color={root.color} />
                    <Txt
                      size={11}
                      color={expanded === root.id ? t.blue : t.text}
                    >
                      {root.name}
                    </Txt>
                  </Pressable>
                ))}
              </View>
              {children.length > 0 && (
                <Card style={{ padding: 13, backgroundColor: t.soft }}>
                  <View style={styles.wrap}>
                    {children.map((child) => (
                      <Chip
                        key={child.id}
                        label={child.name}
                        selected={categoryId === child.id}
                        onPress={() => selectCategory(child.id)}
                      />
                    ))}
                  </View>
                </Card>
              )}
            </View>
          )}
        </>
      )}
      <View style={{ gap: 13 }}>
        <Field
          label={zh.note}
          value={note}
          onChangeText={setNote}
          placeholder={zh.notePlaceholder}
          maxLength={500}
        />
        <Row style={{ alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <Field
              label={zh.date}
              placeholder={zh.datePlaceholder}
              value={date}
              onChangeText={setDate}
              maxLength={10}
            />
          </View>
          <IconButton
            name="plus"
            label={zh.today}
            onPress={() => setDate(today())}
          />
        </Row>
        <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <Txt size={12} color={t.muted}>
            {zh.forWhom}
          </Txt>
          <Row style={{ gap: 6 }}>
            {(["me", "partner", "both"] as const).map((who) => (
              <Chip
                key={who}
                label={zh[who]}
                selected={forWhom === who}
                onPress={() => setForWhom(who)}
              />
            ))}
          </Row>
        </Row>
      </View>
      {!!categoryId && type !== "transfer" && (
        <View style={{ gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFavoriteForm(!favoriteForm)}
          >
            <Row>
              <Icon name="star.fill" size={15} color={t.muted} />
              <Txt size={12} color={t.muted}>
                {zh.addFavoriteHint}
              </Txt>
            </Row>
          </Pressable>
          {favoriteForm && (
            <Card style={{ gap: 12 }}>
              <Field
                label={zh.favoriteName}
                value={favoriteName}
                onChangeText={setFavoriteName}
                placeholder={selectedCategory?.name}
              />
              <Button secondary label={zh.addFavorite} onPress={addFavorite} />
            </Card>
          )}
        </View>
      )}
      <ErrorText message={error} />
      {!!message && (
        <Txt size={12} color={t.green}>
          {message}
        </Txt>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          "1",
          "2",
          "3",
          "⌫",
          "4",
          "5",
          "6",
          "+",
          "7",
          "8",
          "9",
          "−",
          ".",
          "0",
          "00",
          "=",
        ].map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k}
            onPress={() => key(k)}
            style={({ pressed }) => ({
              width: "23%",
              height: 48,
              borderRadius: 13,
              backgroundColor: pressed ? t.soft : t.card,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: t.line,
            })}
          >
            <Txt
              size={20}
              color={["+", "−", "="].includes(k) ? t.blue : t.text}
            >
              {k}
            </Txt>
          </Pressable>
        ))}
      </View>
      <Row>
        {!existing && (
          <View style={{ flex: 1 }}>
            <Button
              secondary
              label={zh.continue}
              onPress={() => submit(true)}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button label={zh.done} onPress={() => submit()} />
        </View>
      </Row>
      {existing && (
        <Button
          secondary
          icon="trash"
          label={zh.remove}
          onPress={() =>
            confirmAction(zh.deleteEntry, zh.deleteEntryHint, () => {
              run(() => repo.deleteTxn(existing.id));
              router.back();
            })
          }
        />
      )}
    </Page>
  );
}
