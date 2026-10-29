import { useState } from "react";
import { View } from "react-native";
import { useLedger } from "./LedgerProvider";
import { Button, Card, Chip, ErrorText, Txt, styles } from "./ui";
import { exportSheets, csvText, excelBytes } from "../domain/export";
import type { DateRange } from "../domain/reports";
import { saveReport } from "../services/reportFiles";
import { zh } from "../i18n/zh";
export function ExportCard({ range }: { range: DateRange }) {
  const { data } = useLedger();
  const [sheet, setSheet] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const names = [
    zh.exports.details,
    zh.exports.categories,
    zh.exports.members,
    zh.exports.accounts,
    zh.exports.loans,
  ];
  async function save(excel: boolean) {
    setBusy(true);
    setError("");
    try {
      const sheets = exportSheets(data, range);
      await saveReport(
        `family-${range.start}-${range.end}${excel ? "" : "-" + sheet}.${excel ? "xlsx" : "csv"}`,
        excel ? excelBytes(sheets) : csvText(sheets[sheet]!),
        excel
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv;charset=utf-8",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Txt bold>{zh.exports.title}</Txt>
      <Txt size={12}>{zh.exports.hint}</Txt>
      <Button
        disabled={busy}
        label={zh.exports.excel}
        onPress={() => void save(true)}
      />
      <View style={styles.wrap}>
        {names.map((name, i) => (
          <Chip
            key={name}
            label={name}
            selected={sheet === i}
            onPress={() => setSheet(i)}
          />
        ))}
      </View>
      <Button
        disabled={busy}
        secondary
        label={zh.exports.csv}
        onPress={() => void save(false)}
      />
      <ErrorText message={error} />
    </Card>
  );
}
