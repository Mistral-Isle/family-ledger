import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Popover } from "./HelpBubble";
import { AccountIcon } from "./AccountIcon";
import { Chip, Icon, Txt, styles, useTheme } from "./ui";
import { useLedger } from "./LedgerProvider";
import { isHoldingAccount } from "../domain/rentAccounts";

/** Field-sized selector box, matching amount and date inputs. */
export function PickerBox({
  label,
  leading,
  text,
  onPress,
}: {
  label: string;
  leading?: ReactNode;
  text: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  const box = (
    <View
      style={{
        alignSelf: "stretch",
        minHeight: 46,
        paddingHorizontal: 12,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: t.line,
        backgroundColor: t.card,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      {leading}
      <Txt style={{ flex: 1 }}>{text}</Txt>
      <Icon name="chevron.down" size={11} color={t.muted} />
    </View>
  );
  return (
    <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
      <Txt size={12} color={t.muted}>
        {label}
      </Txt>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} ${text}`}
          onPress={onPress}
        >
          {box}
        </Pressable>
      ) : (
        box
      )}
    </View>
  );
}

/** Everyday family accounts only; rent and deposit holdings are never offered. */
export function AccountField({
  label,
  value,
  onChange,
  noneLabel,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  /** Offer leaving the account empty, shown with this label. */
  noneLabel?: string;
}) {
  const { data } = useLedger();
  const t = useTheme();
  const accounts = data.accounts.filter(
    (a) =>
      !a.deleted &&
      !a.archived &&
      a.scope === "family" &&
      a.kind !== "loan" &&
      !isHoldingAccount(a),
  );
  const selected = accounts.find((a) => a.id === value);
  return (
    <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
      <Txt size={12} color={t.muted}>
        {label}
      </Txt>
      <Popover
        label={label}
        align="start"
        triggerContent={
          <View style={{ alignSelf: "stretch" }}>
            <View
              style={{
                minHeight: 46,
                paddingHorizontal: 12,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: t.line,
                backgroundColor: t.card,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              {selected && <AccountIcon kind={selected.kind} size={24} />}
              <Txt style={{ flex: 1 }}>
                {selected?.name ??
                  (noneLabel && !value ? noneLabel : "选择账户")}
              </Txt>
              <Icon name="chevron.down" size={11} color={t.muted} />
            </View>
          </View>
        }
      >
        {(close) => (
          <View style={styles.wrap}>
            {!!noneLabel && (
              <Chip
                label={noneLabel}
                selected={!value}
                onPress={() => {
                  onChange("");
                  close();
                }}
              />
            )}
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                selected={a.id === value}
                onPress={() => {
                  onChange(a.id);
                  close();
                }}
              />
            ))}
          </View>
        )}
      </Popover>
    </View>
  );
}
