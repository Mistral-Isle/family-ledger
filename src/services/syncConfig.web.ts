import type { SyncConfig } from "../domain/sync";
let current: SyncConfig | null = null;
export async function loadSyncConfig() {
  return current;
}
export async function saveSyncConfig(config: SyncConfig) {
  current = { ...config };
}

export async function clearSyncConfig() {
  current = null;
}
