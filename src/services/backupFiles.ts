import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Picker from "expo-document-picker";
import { limit } from "./backupFormat";
import { zh } from "../i18n/zh";
export async function saveBackupFile(text: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(zh.backup.unsupported);
  const file = new File(Paths.cache, `ledger-${Date.now()}.json`);
  try {
    file.create();
    file.write(text);
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      UTI: "public.json",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
export async function readBackupFile(): Promise<string | null> {
  const result = await Picker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = new File(result.assets[0]!.uri);
  try {
    if (file.size > limit) throw new Error(zh.backup.tooLarge);
    return await file.text();
  } finally {
    if (file.exists) file.delete();
  }
}
