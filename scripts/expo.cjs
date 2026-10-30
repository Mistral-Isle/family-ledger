const { spawn } = require("node:child_process");
const path = require("node:path");
// Keep CLI caches in this workspace and avoid writing anonymous telemetry IDs.
const child = spawn(
  process.execPath,
  [
    ...(process.argv[2] === "start"
      ? ["--require", path.join(__dirname, "dev-isolation.cjs")]
      : []),
    require.resolve("expo/bin/cli"),
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: "1",
      __UNSAFE_EXPO_HOME_DIRECTORY: path.resolve(".cache/expo"),
      DOTSLASH_CACHE: path.resolve(".cache/dotslash"),
    },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
