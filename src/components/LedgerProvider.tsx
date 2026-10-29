import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ActivityIndicator, Text, View, Pressable } from "react-native";
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
  const [repo, setRepo] = useState<LedgerRepository>();
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const initialize = useCallback(() => {
    setError("");
    openLedger()
      .then((next) => {
        setRepo(next);
        setData(next.snapshot());
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(initialize, [initialize]);
  const refresh = useCallback(() => {
    if (repo) setData(repo.snapshot());
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
        <ActivityIndicator color="#648BD2" />
        <Text>{error || zh.loading}</Text>
        {!!error && (
          <Pressable onPress={initialize}>
            <Text>{zh.retry}</Text>
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
