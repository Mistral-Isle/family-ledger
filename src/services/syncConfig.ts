import * as SecureStore from "expo-secure-store";
import type { SyncConfig } from "../domain/sync";
const key = "family-ledger-sync-v1";
export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const raw = await SecureStore.getItemAsync(key);
  return raw ? JSON.parse(raw) : null;
}
export async function saveSyncConfig(config: SyncConfig) {
  await SecureStore.setItemAsync(key, JSON.stringify(config), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSyncConfig() {
  await SecureStore.deleteItemAsync(key);
}
