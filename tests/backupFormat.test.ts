import { createHash } from "node:crypto";
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_: string, text: string) =>
    createHash("sha256").update(text).digest("hex"),
}));
import { packBackup, unpackBackup } from "../src/services/backupFormat";
test("backup envelope round trip and checksum rejects modified content", async () => {
  const payload = '{"备注":"早餐"}';
  const packed = await packBackup(payload);
  expect(await unpackBackup(packed)).toBe(payload);
  const changed = JSON.parse(packed);
  changed.payload += " ";
  await expect(unpackBackup(JSON.stringify(changed))).rejects.toThrow();
  await expect(unpackBackup("{")).rejects.toThrow();
  await expect(
    unpackBackup(JSON.stringify({ ...JSON.parse(packed), version: 2 })),
  ).rejects.toThrow();
});
