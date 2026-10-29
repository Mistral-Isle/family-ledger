import { useEffect } from "react";
import { AppState } from "react-native";
import { useLedger } from "./LedgerProvider";
import { syncNow } from "../services/syncRuntime";
export function SyncRunner() {
  const { repo, data, refresh } = useLedger();
  useEffect(() => {
    void syncNow(repo, refresh).catch(() => {});
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow(repo, refresh).catch(() => {});
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active")
        void syncNow(repo, refresh).catch(() => {});
    }, 60000);
    return () => {
      listener.remove();
      clearInterval(timer);
    };
  }, [repo, refresh]);
  useEffect(() => {
    if (!data.pending) return;
    const timer = setTimeout(() => {
      void syncNow(repo, refresh).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [repo, data.pending, refresh]);
  return null;
}
