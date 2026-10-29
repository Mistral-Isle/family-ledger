import { create } from "zustand";
export const useDatabaseOpenStatus = create<{ phase: "opening" | "waiting" }>(
  () => ({ phase: "opening" }),
);
export function databaseOpenError(error: unknown) {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).replace(/^(?:Error:\s*)+/, "");
  if (
    /Invalid VFS state|AccessHandlePoolVFS|NoModificationAllowedError|access handle|createSyncAccessHandle/i.test(
      message,
    )
  )
    return "网页数据库可能被其他账本标签占用，或上次打开未完成。请关闭其他账本标签，再重新载入。本机数据会保留。";
  return message;
}
