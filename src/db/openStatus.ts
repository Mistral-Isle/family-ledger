import { create } from "zustand";
export const useDatabaseOpenStatus = create<{ phase: "opening" | "waiting" }>(
  () => ({ phase: "opening" }),
);
export function databaseOpenError(error: unknown) {
  // Drizzle wraps SQLite failures in a query error. Inspect the cause chain
  // so the actionable browser/database error is not hidden behind raw SQL.
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current != null && !seen.has(current) && messages.length < 8) {
    seen.add(current);
    messages.push(
      (current instanceof Error ? current.message : String(current)).replace(
        /^(?:Error:\s*)+/,
        "",
      ),
    );
    current = current instanceof Error ? current.cause : undefined;
  }
  const message = messages.join("\n");
  if (/SharedArrayBuffer|cross.origin.isolat/i.test(message))
    return "网页数据库需要跨源隔离。请通过项目的 npm start 或 npm run web 启动预览，再重新载入；本机数据会保留。";
  if (
    /Invalid VFS state|AccessHandlePoolVFS|NoModificationAllowedError|access handle|createSyncAccessHandle/i.test(
      message,
    )
  )
    return "网页数据库可能被其他账本标签占用，或上次打开未完成。请关闭其他账本标签，再重新载入。本机数据会保留。";
  return messages.at(-1) || "账本暂时无法打开，请重新载入。本机数据会保留。";
}
