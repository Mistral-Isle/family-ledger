import { useDatabaseOpenStatus, databaseOpenError } from "../db/openStatus";
import { updateReminders } from "../services/reminders";
import { useUi } from "../state/ui";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Text,
  View,
  Pressable,
  Platform,
} from "react-native";
import { openLedger } from "../db/open";
import type { LedgerRepository } from "../db/repository";
import type { Snapshot } from "../domain/types";
import { zh } from "../i18n/zh";
type Context = {
  repo: LedgerRepository;
  data: Snapshot;
  refresh: () => void;
  run: (fn: () => void) => void;
};
const LedgerContext = createContext<Context | null>(null);
export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const phase = useDatabaseOpenStatus((s) => s.phase);
  const [repo, setRepo] = useState<LedgerRepository>();
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const initialize = useCallback(() => {
    setError("");
    openLedger()
      .then((next) => {
        useUi.getState().setTheme(next.getTheme());
        useUi.getState().setAppearance(next.getAppearance());
        setRepo(next);
        setData(next.snapshot());
        void updateReminders(next.snapshot(), next.remindersEnabled()).catch(
          () => {},
        );
      })
      .catch((e) => setError(databaseOpenError(e)));
  }, []);
  useEffect(initialize, [initialize]);
  const refresh = useCallback(() => {
    if (repo) {
      setData(repo.snapshot());
      if (repo.remindersEnabled())
        void updateReminders(repo.snapshot(), true).catch(() => {});
    }
  }, [repo]);
  if (!repo || !data)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          backgroundColor: "#F7F6F2",
        }}
      >
        {!error && <ActivityIndicator color="#648BD2" />}
        <Text
          style={{ textAlign: "center", paddingHorizontal: 24, maxWidth: 500 }}
        >
          {error ||
            (phase === "waiting" ? "账本已在另一个标签页打开" : zh.loading)}
        </Text>
        {!error && phase === "waiting" && (
          <Text
            style={{
              textAlign: "center",
              paddingHorizontal: 24,
              maxWidth: 500,
            }}
          >
            当前页面正在等待。关闭另一个账本标签后，这里会自动继续。
          </Text>
        )}
        {!!error && (
          <Pressable
            accessibilityRole="button"
            onPress={
              Platform.OS === "web"
                ? () => window.location.reload()
                : initialize
            }
            style={{ padding: 14 }}
          >
            <Text>{Platform.OS === "web" ? "重新载入" : zh.retry}</Text>
          </Pressable>
        )}
      </View>
    );
  return (
    <LedgerContext.Provider
      value={{
        repo,
        data,
        refresh,
        run: (fn) => {
          fn();
          refresh();
          if (repo.remindersEnabled())
            void updateReminders(repo.snapshot(), true).catch(() => {});
        },
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
}
export function useLedger() {
  const context = useContext(LedgerContext);
  if (!context) throw new Error("LedgerProvider missing");
  return context;
}
