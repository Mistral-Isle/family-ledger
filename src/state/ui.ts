import { create } from "zustand";
import { thisMonth } from "../domain/date";
type Ui = {
  month: string;
  setMonth: (month: string) => void;
  theme: "system" | "light" | "dark";
  setTheme: (theme: Ui["theme"]) => void;
};
export const useUi = create<Ui>((set) => ({
  month: thisMonth(),
  setMonth: (month) => set({ month }),
  theme: "system",
  setTheme: (theme) => set({ theme }),
}));
