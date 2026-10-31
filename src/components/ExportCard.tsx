import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLedger } from "./LedgerProvider";
import { Button, Card, ErrorText, Icon, Row, Txt, useTheme } from "./ui";
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
        <Txt size={13}>已选 {selected.length} 项</Txt>
      </Row>
      <Txt size={13}>
        选择需要的报表，可多选。Excel 合并到一个文件；CSV 每项单独分享。
      </Txt>
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
            minHeight: 44,
            padding: 10,
            borderRadius: 12,
            backgroundColor: pressed ? t.soft : "transparent",
          })}
        >
          <Row>
            <Icon
              name={selected.includes(i) ? "checkmark.circle.fill" : "circle"}
              color={selected.includes(i) ? t.blue : t.muted}
            />
            <Txt>{name}</Txt>
          </Row>
        </Pressable>
      ))}
      <Button
        secondary
        disabled={busy}
        label={selected.length === names.length ? "取消全选" : "全选"}
        onPress={() =>
          setSelected(
            selected.length === names.length ? [] : names.map((_, i) => i),
          )
        }
      />
      <Button
        disabled={busy || !selected.length}
        label={busy ? "正在导出…" : "导出所选 Excel"}
        onPress={() => void save(true)}
      />
      <Button
        secondary
        disabled={busy || !selected.length}
        label="导出所选 CSV"
        onPress={() => void save(false)}
      />
      <ErrorText message={error} />
    </Card>
  );
}
