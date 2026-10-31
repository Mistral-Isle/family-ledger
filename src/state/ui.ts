import { create } from "zustand";
import { thisMonth } from "../domain/date";
type Ui = {
  selectingTransactions: boolean;
  statsView: "expense" | "income" | "balance";
  statsRequest: number;
  openStats: (view: Ui["statsView"]) => void;
  appearance: "classic" | "warm" | "ink";
  setAppearance: (appearance: Ui["appearance"]) => void;
  month: string;
  setMonth: (month: string) => void;
  theme: "system" | "light" | "dark";
  setTheme: (theme: Ui["theme"]) => void;
};
export const useUi = create<Ui>((set) => ({
  selectingTransactions: false,
  statsView: "expense",
  statsRequest: 0,
  openStats: (statsView) =>
    set((s) => ({ statsView, statsRequest: s.statsRequest + 1 })),
  appearance: "classic",
  setAppearance: (appearance) => set({ appearance }),
  month: thisMonth(),
  setMonth: (month) => set({ month }),
  theme: "system",
  setTheme: (theme) => set({ theme }),
}));
