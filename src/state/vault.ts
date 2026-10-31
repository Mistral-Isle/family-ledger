import { create } from "zustand";
import { VaultAuthentication } from "../domain/vaultAuthentication";
export const useVault = create<{
  unlocked: boolean;
  setUnlocked: (value: boolean) => void;
}>((set) => ({
  unlocked: false,
  setUnlocked: (unlocked) => set({ unlocked }),
}));
export const vaultAuthentication = new VaultAuthentication((unlocked) => useVault.getState().setUnlocked(unlocked));
