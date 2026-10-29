// expo-sqlite 57.0.4 writes a byte count through Uint8Array.set(Uint32Array),
// truncating counts above 255. The reader expects a four-byte Uint32 header.
// This patch only affects the web worker bridge; Expo Go native code is unchanged.
const fs = require("node:fs");
const path = require("node:path");
const moduleRoot = path.dirname(require.resolve("expo-sqlite/package.json"));
const filename = path.join(moduleRoot, "web/WorkerChannel.ts");
const original = "resultArray.set(new Uint32Array([length]), 0);";
const fixed = "new Uint32Array(resultBuffer, 0, 1)[0] = length;";
const source = fs.readFileSync(filename, "utf8");
if (source.includes(original)) {
  fs.writeFileSync(filename, source.replace(original, fixed));
  console.log("Applied expo-sqlite web Uint32 length header fix.");
} else if (!source.includes(fixed)) {
  throw new Error(
    "expo-sqlite web bridge changed; review the compatibility patch before continuing.",
  );
}
