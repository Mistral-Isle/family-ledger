import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { zh } from "../i18n/zh";
export async function saveReport(
  name: string,
  data: string | Uint8Array,
  mime: string,
) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(zh.backup.unsupported);
  const file = new File(Paths.cache, name);
  try {
    file.create({ overwrite: true });
    file.write(data);
    await Sharing.shareAsync(file.uri, {
      mimeType: mime,
      UTI: name.endsWith(".xlsx")
        ? "org.openxmlformats.spreadsheetml.sheet"
        : name.endsWith(".json")
          ? "public.json"
          : "public.comma-separated-values-text",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
