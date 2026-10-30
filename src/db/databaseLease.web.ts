import { useDatabaseOpenStatus } from "./openStatus";
let lease: Promise<void> | undefined;
export function acquireDatabaseLease(): Promise<void> {
  if (lease) return lease;
  if (
    !globalThis.crossOriginIsolated ||
    typeof SharedArrayBuffer === "undefined"
  )
    return Promise.reject(
      new Error(
        "网页数据库需要跨源隔离。请通过项目的 npm start 或 npm run web 启动预览，再重新载入；本机数据会保留。",
      ),
    );
  if (!globalThis.navigator?.locks)
    return Promise.reject(
      new Error("此浏览器不支持网页数据库协调，请使用新版浏览器打开本机预览。"),
    );
  useDatabaseOpenStatus.setState({ phase: "waiting" });
  lease = new Promise<void>((resolve, reject) => {
    // Do not release on blur/pagehide: the SQLite worker still owns OPFS handles.
    // The browser releases this lease and those handles when the document closes.
    void navigator.locks
      .request(
        "family-ledger:expo-sqlite-opfs",
        { mode: "exclusive" },
        async () => {
          useDatabaseOpenStatus.setState({ phase: "opening" });
          resolve();
          await new Promise<void>(() => {});
        },
      )
      .catch(reject);
  });
  return lease;
}
