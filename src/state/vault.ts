import { create } from "zustand";
export const useVault = create<{
  unlocked: boolean;
  setUnlocked: (value: boolean) => void;
}>((set) => ({
  unlocked: false,
  setUnlocked: (unlocked) => set({ unlocked }),
}));
