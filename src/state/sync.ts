import { create } from "zustand";
export const useSyncStatus = create<{
  busy: boolean;
  last: string;
  error: string;
  configured: boolean;
}>()(() => ({ busy: false, last: "", error: "", configured: false }));
