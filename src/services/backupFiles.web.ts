import * as Picker from "expo-document-picker";
import { limit } from "./backupFormat";
import { zh } from "../i18n/zh";
export async function saveBackupFile(text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `ledger-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readBackupFile(): Promise<string | null> {
  const result = await Picker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    base64: false,
  });
  if (result.canceled) return null;
  const file = result.assets[0]!.file;
  if (!file) throw new Error(zh.backup.invalid);
  if (file.size > limit) throw new Error(zh.backup.tooLarge);
  return file.text();
}
