import { useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntryKeyboard } from "./EntryKeyboard";
import { ErrorText, IconButton, Row, Txt, useTheme } from "./ui";
import { calculate, moneyInput, moneyKey } from "../domain/money";

/** Shared calculator for amounts; never invokes a system text keyboard. */
export function MoneyField({
  label,
  value = "",
  onChangeText,
  editable = true,
  placeholder,
  style,
}: TextInputProps & { label: string }) {
  const t = useTheme(),
    insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const [replaceNext, setReplaceNext] = useState(true);
  const finish = () => {
    try {
      if (value.trim()) onChangeText?.(moneyInput(calculate(value)));
      setOpen(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <Txt size={12} color={t.muted}>
        {label}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={value || placeholder || "输入金额"}
        disabled={!editable}
        onPress={() => {
          Keyboard.dismiss();
          setError("");
          setReplaceNext(true);
          setOpen(true);
        }}
        style={{
          minHeight: 46,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: t.line,
          backgroundColor: t.card,
          justifyContent: "center",
        }}
      >
        <Txt style={StyleSheet.flatten(style)} color={value ? t.text : t.muted}>
          {value || placeholder || "0.00"}
        </Txt>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={finish}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#00000055",
            paddingTop: insets.top + 12,
          }}
        >
          <Pressable
            accessibilityLabel="完成金额输入"
            onPress={finish}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            style={{
              backgroundColor: t.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: "hidden",
              padding: 16,
              paddingBottom: Math.max(insets.bottom, 16),
              gap: 10,
              maxHeight: "100%",
              width: "100%",
              maxWidth: 600,
              alignSelf: "center",
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <Txt bold style={{ flex: 1 }}>
                {label}
              </Txt>
              <IconButton name="xmark" label="完成金额输入" onPress={finish} />
            </Row>
            <ScrollView style={{ maxHeight: 90 }}>
              <Txt size={32} bold>
                {value || "0"}
              </Txt>
            </ScrollView>
            <ErrorText message={error} />
            <EntryKeyboard
              onKey={(key) => {
                setError("");
                onChangeText?.(
                  moneyKey(
                    replaceNext && /^[\d.]$/.test(key) ? "" : value,
                    key,
                  ),
                );
                setReplaceNext(false);
              }}
              onSave={finish}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
