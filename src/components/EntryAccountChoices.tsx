import { useState } from "react";
import { View } from "react-native";
import type { Account } from "../domain/types";
import { entryAccountGroups } from "../domain/entryAccounts";
import { useLedger } from "./LedgerProvider";
import { AccountChip } from "./AccountChip";
import { Button, Txt, useTheme } from "./ui";

export function EntryAccountChoices({ accounts, selectedId, onSelect }: {
  accounts: Account[]; selectedId: string; onSelect: (id: string) => void;
}) {
  const { data } = useLedger(), t = useTheme();
  const [more, setMore] = useState(false);
  const groups = entryAccountGroups(accounts, data.meId);
  const render = (a: Account, showOwner = false) => (
    <AccountChip key={a.id} kind={a.kind}
      label={`${a.name}${a.last4 ? ` ${a.last4}` : ""}${showOwner ? ` · ${data.members.find(m => m.id === a.ownerMemberId)?.name ?? "共同"}` : ""}`}
      selected={a.id === selectedId} onPress={() => onSelect(a.id)} />
  );
  return <View style={{ width: "100%", gap: 8 }}>
    <Txt size={13} bold color={t.muted}>我的账户</Txt>
    {groups.mine.map(a => render(a))}
    {!groups.mine.length && <Txt size={12} color={t.muted}>暂无自己的可用账户</Txt>}
    <Button secondary label={more ? "收起" : "更多"}
      onPress={() => setMore(!more)} />
    {more && <View style={{ gap: 8 }}>
      <Txt size={13} bold color={t.muted}>共享账户</Txt>
      {!groups.more.length && <Txt size={12} color={t.muted}>暂无其他可用的共享账户</Txt>}
      {groups.more.map(a => render(a, true))}
    </View>}
  </View>;
}
