import { useState } from "react";
import { View } from "react-native";
import { useLedger } from "./LedgerProvider";
import { Button, ErrorText, Field, Txt, useTheme } from "./ui";

export function DetailBudgetSettings({ onDone }: { onDone?: () => void }) {
  const { repo, run } = useLedger();
  const t = useTheme();
  const [title, setTitle] = useState(
    () => repo.getDetailBudgetPreferences().title,
  );
  const [error, setError] = useState("");
  return (
    <View style={{ gap: 14 }}>
      <Txt bold size={18}>
        明细预算名称
      </Txt>
      <Field
        label="预算名称"
        value={title}
        onChangeText={setTitle}
        maxLength={30}
        placeholder="留空使用默认名称"
      />
      <Txt size={12} color={t.muted}>
        全部分类开启时默认“本月预算”，排除部分分类后默认“所选分类预算”。名称适用于所有月份。
      </Txt>
      <ErrorText message={error} />
      <Button
        label="保存名称"
        onPress={() => {
          try {
            run(() =>
              repo.setDetailBudgetPreferences({
                ...repo.getDetailBudgetPreferences(),
                title,
              }),
            );
            onDone?.();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
    </View>
  );
}
