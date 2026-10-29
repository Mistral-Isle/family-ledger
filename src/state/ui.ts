import { create } from "zustand";
import { thisMonth } from "../domain/date";
type Ui = {
  appearance: "classic" | "warm" | "ink";
  setAppearance: (appearance: Ui["appearance"]) => void;
  month: string;
  setMonth: (month: string) => void;
  theme: "system" | "light" | "dark";
  setTheme: (theme: Ui["theme"]) => void;
};
export const useUi = create<Ui>((set) => ({
  appearance: "classic",
  setAppearance: (appearance) => set({ appearance }),
  month: thisMonth(),
  setMonth: (month) => set({ month }),
  theme: "system",
  setTheme: (theme) => set({ theme }),
}));
