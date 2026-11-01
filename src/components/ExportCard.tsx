import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLedger } from "./LedgerProvider";
import { Card, ErrorText, Icon, Row, Txt, useTheme } from "./ui";
import { exportSheets, csvText, excelBytes } from "../domain/export";
import type { DateRange } from "../domain/reports";
import { saveReport } from "../services/reportFiles";
import { zh } from "../i18n/zh";
export function ExportCard({ range }: { range: DateRange }) {
  const { data } = useLedger(),
    t = useTheme();
  const [selected, setSelected] = useState([0, 1, 2, 3, 4]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const names = [
    zh.exports.details,
    zh.exports.categories,
    zh.exports.members,
    zh.exports.accounts,
    zh.exports.loans,
  ];
  async function save(excel: boolean) {
    if (!selected.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const sheets = exportSheets(data, range).filter((_, i) =>
        selected.includes(i),
      );
      if (excel)
        await saveReport(
          "family-" + range.start + "-" + range.end + ".xlsx",
          excelBytes(sheets),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      else
        for (const sheet of sheets)
          await saveReport(
            "family-" + range.start + "-" + sheet.name + ".csv",
            csvText(sheet),
            "text/csv;charset=utf-8",
          );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt bold>{zh.exports.title}</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selected.length === names.length ? "取消全选" : "全选"}
          disabled={busy}
          onPress={() => setSelected(selected.length === names.length ? [] : names.map((_, i) => i))}
          style={({ pressed }) => ({ minHeight: 32, justifyContent: "center", paddingHorizontal: 4, opacity: busy ? 0.4 : pressed ? 0.6 : 1 })}
        >
          <Txt size={12} color={t.blue}>{selected.length === names.length ? "取消全选" : "全选"} · {selected.length} 项</Txt>
        </Pressable>
      </Row>
      <Txt size={12} color={t.muted}>
        可多选 · Excel 合并文件，CSV 分项分享
      </Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {names.map((name, i) => (
        <Pressable
          key={name}
          accessibilityRole="checkbox"
          accessibilityLabel={name}
          accessibilityState={{ checked: selected.includes(i), disabled: busy }}
          disabled={busy}
          onPress={() =>
            setSelected((prev) =>
              prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
            )
          }
          style={({ pressed }) => ({
            minHeight: 36,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 18,
            backgroundColor: selected.includes(i) || pressed ? t.soft : "transparent",
            opacity: busy ? 0.4 : pressed ? 0.6 : 1,
          })}
        >
          <Row style={{ gap: 5 }}>
            <Icon
              name={selected.includes(i) ? "checkmark.circle.fill" : "circle"}
              color={selected.includes(i) ? t.blue : t.muted}
              size={17}
            />
            <Txt size={13} color={selected.includes(i) ? t.blue : t.muted}>{name}</Txt>
          </Row>
        </Pressable>
      ))}
      </View>
      <Row style={{ gap: 8 }}>
        {[true, false].map((excel) => (
          <Pressable key={String(excel)}
            accessibilityRole="button"
            accessibilityLabel={`导出所选 ${excel ? "Excel" : "CSV"}`}
            accessibilityState={{ disabled: busy || !selected.length }}
            disabled={busy || !selected.length}
            onPress={() => void save(excel)}
            style={({ pressed }) => ({ flex: 1, minHeight: 40, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 20,
              alignItems: "center", justifyContent: "center", backgroundColor: excel ? t.primary : t.soft,
              opacity: busy || !selected.length ? 0.4 : pressed ? 0.7 : 1 })}
          >
            <Txt size={13} bold color={excel ? t.onPrimary : t.buttonText}>{busy ? "正在导出…" : `导出 ${excel ? "Excel" : "CSV"}`}</Txt>
          </Pressable>
        ))}
      </Row>
      <ErrorText message={error} />
    </Card>
  );
}
