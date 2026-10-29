import { getRandomBytes } from "expo-crypto";
import {
  synchronize,
  validateSyncConfig,
  type SyncConfig,
} from "../domain/sync";
import type { LedgerRepository } from "../db/repository";
import { WebDAVStore } from "./webdav";
import { loadSyncConfig, saveSyncConfig, clearSyncConfig } from "./syncConfig";
import { useSyncStatus } from "../state/sync";
let serial: Promise<unknown> = Promise.resolve();
let active: Promise<void> | null = null;
export function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = serial.catch(() => {}).then(fn);
  serial = next;
  return next;
}
export function syncNow(repo: LedgerRepository, refresh: () => void) {
  if (active) return active;
  active = withSyncLock(async () => {
    const config = await loadSyncConfig();
    useSyncStatus.setState({ configured: !!config });
    if (!config) return;
    useSyncStatus.setState({ busy: true, error: "" });
    try {
      await synchronize(repo, new WebDAVStore(config), config, getRandomBytes);
      refresh();
      useSyncStatus.setState({ last: new Date().toISOString() });
    } catch (e) {
      refresh();
      useSyncStatus.setState({ error: (e as Error).message });
      throw e;
    } finally {
      useSyncStatus.setState({ busy: false });
    }
  }).finally(() => {
    active = null;
  });
  return active;
}
export function configureSync(
  repo: LedgerRepository,
  config: SyncConfig,
  joining: boolean,
  name: string,
) {
  return withSyncLock(async () => {
    validateSyncConfig(config);
    if (!name.trim() || name.trim().length > 30)
      throw new Error("请填写成员名称");
    const previous = await loadSyncConfig();
    if (
      previous &&
      previous.ledgerId !== config.ledgerId &&
      !repo.canJoinFamily()
    )
      throw new Error("切换家庭需要新账本，请先备份现有数据");
    if (joining && !repo.canJoinFamily())
      throw new Error("加入家庭需要没有流水、计划或小金库的新账本");
    // Check persistence before changing the empty local family during joining.
    await saveSyncConfig(config);
    try {
      if (joining) repo.prepareJoin(name);
      else repo.renameMe(name);
      if (!previous || previous.ledgerId !== config.ledgerId)
        repo.resetSyncUploads();
    } catch (e) {
      if (previous) await saveSyncConfig(previous);
      else await clearSyncConfig();
      throw e;
    }
    useSyncStatus.setState({ configured: true, error: "" });
  });
}

export function disconnectSync() {
  return withSyncLock(async () => {
    await clearSyncConfig();
    useSyncStatus.setState({
      configured: false,
      busy: false,
      error: "",
      last: "",
    });
  });
}
