jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("drizzle-orm/expo-sqlite", () => ({ drizzle: jest.fn((x) => x) }));
jest.mock("drizzle-orm/expo-sqlite/migrator", () => ({ migrate: jest.fn() }));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => "uuid") }));
jest.mock("../src/db/repository", () => ({
  LedgerRepository: jest
    .fn()
    .mockImplementation(() => ({ initialize: jest.fn() })),
}));
jest.mock("../src/db/databaseLease", () => ({
  acquireDatabaseLease: jest.fn().mockResolvedValue(undefined),
}));
function setup() {
  jest.resetModules();
  const { openDatabaseAsync } = require("expo-sqlite"),
    { migrate } = require("drizzle-orm/expo-sqlite/migrator");
  const db = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };
  openDatabaseAsync.mockResolvedValue(db);
  migrate.mockResolvedValue(undefined);
  return {
    openDatabaseAsync,
    migrate,
    db,
    openLedger: require("../src/db/open").openLedger,
  };
}
test("concurrent opening shares one initialization and migration", async () => {
  const f = setup();
  let resolve!: (value: unknown) => void;
  f.openDatabaseAsync.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const a = f.openLedger(),
    b = f.openLedger();
  expect(a).toBe(b);
  await Promise.resolve();
  expect(f.openDatabaseAsync).toHaveBeenCalledTimes(1);
  resolve(f.db);
  const [ra, rb] = await Promise.all([a, b]);
  expect(ra).toBe(rb);
  expect(f.migrate).toHaveBeenCalledTimes(1);
  expect(await f.openLedger()).toBe(ra);
  expect(f.openDatabaseAsync).toHaveBeenCalledTimes(1);
});
test("failed migration closes its handle and subsequent retry opens cleanly", async () => {
  const f = setup();
  f.migrate.mockRejectedValueOnce(new Error("migration failure"));
  await expect(f.openLedger()).rejects.toThrow("migration failure");
  expect(f.db.closeAsync).toHaveBeenCalledTimes(1);
  await expect(f.openLedger()).resolves.toBeDefined();
  expect(f.openDatabaseAsync).toHaveBeenCalledTimes(2);
});
test("failed database open releases in-flight promise for retry", async () => {
  const f = setup();
  f.openDatabaseAsync.mockRejectedValueOnce(new Error("open failed"));
  await expect(f.openLedger()).rejects.toThrow("open failed");
  await expect(f.openLedger()).resolves.toBeDefined();
  expect(f.migrate).toHaveBeenCalledTimes(1);
});
