import { digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto";
import { zh } from "../i18n/zh";
export const limit = 20 * 1024 * 1024;
export async function packBackup(payload: string) {
  const checksum = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    payload,
  );
  const text = JSON.stringify({
    format: "family-ledger-backup",
    version: 1,
    checksum,
    payload,
  });
  if (new TextEncoder().encode(text).length > limit)
    throw new Error(zh.backup.tooLarge);
  return text;
}
export async function unpackBackup(text: string) {
  if (new TextEncoder().encode(text).length > limit)
    throw new Error(zh.backup.tooLarge);
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error(zh.backup.invalid);
  }
  if (!file || file.format !== "family-ledger-backup")
    throw new Error(zh.backup.invalid);
  if (file.version !== 1) throw new Error(zh.backup.version);
  if (
    typeof file.payload !== "string" ||
    typeof file.checksum !== "string" ||
    (await digestStringAsync(CryptoDigestAlgorithm.SHA256, file.payload)) !==
      file.checksum
  )
    throw new Error(zh.backup.invalid);
  return file.payload as string;
}
