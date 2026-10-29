import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { bytesToHex, hexToBytes } from "@noble/ciphers/utils.js";
import type { Operation } from "./types";
export type SyncConfig = {
  url: string;
  username: string;
  password: string;
  ledgerId: string;
  keyHex: string;
  allowCreate?: boolean;
};
export function validateSyncConfig(c: SyncConfig) {
  const url = new URL(c.url);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !c.username ||
    !c.password ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(c.ledgerId) ||
    !/^([0-9a-f]{2}){32}$/i.test(c.keyHex)
  )
    throw new Error(
      "同步配置无效：需要 HTTPS 地址、账号密码、账本编号及 64 位恢复码",
    );
  return c;
}
export function encryptOperations(
  ops: Operation[],
  keyHex: string,
  ledgerId: string,
  nonce: Uint8Array,
) {
  if (ops.some((op) => "scope" in op.record && op.record.scope !== "family"))
    throw new Error("拒绝同步私有数据");
  const aad = new TextEncoder().encode("family-ledger-v1:" + ledgerId);
  const plain = new TextEncoder().encode(JSON.stringify(ops));
  const cipher = xchacha20poly1305(hexToBytes(keyHex), nonce, aad).encrypt(
    plain,
  );
  return JSON.stringify({
    version: 1,
    ledgerId,
    nonce: bytesToHex(nonce),
    cipher: bytesToHex(cipher),
  });
}
export function decryptOperations(
  text: string,
  keyHex: string,
  ledgerId: string,
): Operation[] {
  if (text.length > 20 * 1024 * 1024) throw new Error("同步文件过大");
  const file = JSON.parse(text);
  if (
    file.version !== 1 ||
    file.ledgerId !== ledgerId ||
    typeof file.nonce !== "string" ||
    file.nonce.length !== 48 ||
    typeof file.cipher !== "string"
  )
    throw new Error("同步文件格式不匹配");
  const plain = xchacha20poly1305(
    hexToBytes(keyHex),
    hexToBytes(file.nonce),
    new TextEncoder().encode("family-ledger-v1:" + ledgerId),
  ).decrypt(hexToBytes(file.cipher));
  const ops = JSON.parse(new TextDecoder().decode(plain));
  if (!Array.isArray(ops) || ops.length > 10000)
    throw new Error("同步日志格式无效");
  return ops;
}
export interface SyncStore {
  mkdir(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
  get(path: string): Promise<string>;
  put(path: string, text: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
}
export interface SyncRepository {
  syncDeviceId(): string;
  pendingOperations(): Operation[];
  ackOperations(ids: string[]): void;
  mergeOperations(ops: Operation[]): void;
  syncFiles(): string[];
  markSyncFile(path: string): void;
}
export async function synchronize(
  repo: SyncRepository,
  store: SyncStore,
  config: Pick<SyncConfig, "ledgerId" | "keyHex" | "allowCreate">,
  random: (n: number) => Uint8Array,
) {
  const root = config.ledgerId,
    device = repo.syncDeviceId();
  await store.mkdir(root);
  try {
    decryptOperations(
      await store.get(root + "/ledger.json"),
      config.keyHex,
      root,
    );
  } catch (e) {
    if (
      (e as { status?: number }).status !== 404 ||
      config.allowCreate === false
    )
      throw e;
    await store.put(
      root + "/ledger.json.tmp",
      encryptOperations([], config.keyHex, root, random(24)),
    );
    await store.move(root + "/ledger.json.tmp", root + "/ledger.json");
  }
  await store.mkdir(root + "/devices");
  await store.mkdir(root + "/devices/" + device);
  // Batch uploads stay bounded; acknowledge only after atomic MOVE succeeds.
  const pending = repo.pendingOperations();
  for (let i = 0; i < pending.length; i += 100) {
    const batch = pending.slice(i, i + 100),
      path = `${root}/devices/${device}/${batch[0]!.seq}-${batch.at(-1)!.seq}.ops`;
    await store.put(
      path + ".tmp",
      encryptOperations(batch, config.keyHex, root, random(24)),
    );
    await store.move(path + ".tmp", path);
    repo.ackOperations(batch.map((op) => op.opId));
  }
  const seen = new Set(repo.syncFiles());
  let count = 0;
  for (const peer of await store.list(root + "/devices")) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(peer)) continue;
    for (const file of await store.list(root + "/devices/" + peer)) {
      if (!/^\d+-\d+\.ops$/.test(file)) continue;
      const path = `${root}/devices/${peer}/${file}`;
      if (seen.has(path)) continue;
      const ops = decryptOperations(await store.get(path), config.keyHex, root);
      if (ops.some((op) => op.deviceId !== peer))
        throw new Error("设备目录与日志身份不一致");
      repo.mergeOperations(ops);
      repo.markSyncFile(path);
      count += ops.length;
    }
  }
  return { uploaded: pending.length, downloaded: count };
}
