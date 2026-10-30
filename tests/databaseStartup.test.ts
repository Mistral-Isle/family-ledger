import { spawn } from "node:child_process";
import { get } from "node:http";
import path from "node:path";
import { databaseOpenError } from "../src/db/openStatus";

test("web startup rejects missing isolation before opening the database", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "crossOriginIsolated",
  );
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    configurable: true,
    value: false,
  });
  try {
    const { acquireDatabaseLease } =
      await import("../src/db/databaseLease.web");
    await expect(acquireDatabaseLease()).rejects.toThrow("跨源隔离");
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "crossOriginIsolated", descriptor);
    else Reflect.deleteProperty(globalThis, "crossOriginIsolated");
  }
});

test("wrapped migration failures expose the actionable cause instead of SQL", () => {
  const error = new Error("Failed to run CREATE TABLE", {
    cause: new Error("SharedArrayBuffer is not defined"),
  });
  expect(databaseOpenError(error)).toContain("跨源隔离");
  expect(databaseOpenError(error)).not.toContain("CREATE TABLE");
  expect(
    databaseOpenError(
      new Error("query", { cause: new Error("Invalid VFS state") }),
    ),
  ).toContain("其他账本标签");
  expect(
    databaseOpenError(new Error("query", { cause: new Error("disk full") })),
  ).toBe("disk full");
});

test("development HTTP boundary applies isolation headers even to early HTML handlers", async () => {
  const child = spawn(
    process.execPath,
    [
      "--require",
      path.resolve("scripts/dev-isolation.cjs"),
      "-e",
      `const server=require('node:http').createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('preview')});server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    const port = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`server exited ${code}`)));
      child.stdout!.once("data", (data) =>
        resolve(Number(data.toString().trim())),
      );
    });
    for (const route of ["/", "/stats", "/worker.js"]) {
      const headers = await new Promise<
        import("node:http").IncomingHttpHeaders
      >((resolve, reject) => {
        const request = get(`http://127.0.0.1:${port}${route}`, (response) => {
          response.resume();
          resolve(response.headers);
        });
        request.on("error", reject);
      });
      expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
      expect(headers["cross-origin-embedder-policy"]).toBe("credentialless");
      expect(headers["content-type"]).toBe("text/html");
    }
  } finally {
    child.kill();
  }
});
