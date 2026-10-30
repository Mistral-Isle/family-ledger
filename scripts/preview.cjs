const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const demo = process.argv.includes("--demo");
const root = path.resolve(demo ? "tmp/budget-demo-web" : "dist-web");
const port = Number(process.env.PORT || (demo ? 4175 : 4173));
const build = spawn(
  process.execPath,
  [
    path.resolve("scripts/expo.cjs"),
    "export",
    "--platform",
    "web",
    "--output-dir",
    root,
    "--max-workers",
    "2",
  ],
  { stdio: "inherit" },
);
build.on("exit", (code) => {
  if (code) process.exit(code);
  http
    .createServer((req, res) => {
      res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cache-Control", "no-cache");
      let pathname;
      try {
        pathname = decodeURIComponent(
          new URL(req.url, `http://localhost:${port}`).pathname,
        );
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      let file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep) && file !== root) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
        file = path.join(root, "index.html");
      const mime = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".json": "application/json",
      };
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] || "application/octet-stream",
      );
      if (demo && path.extname(file) === ".html") {
        res.end(
          fs
            .readFileSync(file, "utf8")
            .replace(
              "<head>",
              '<head><meta name="ledger-preview" content="budget-demo">',
            ),
        );
        return;
      }
      fs.createReadStream(file)
        .on("error", () => {
          res.writeHead(500);
          res.end();
        })
        .pipe(res);
    })
    .listen(port, "127.0.0.1", () =>
      console.log(`Ledger web preview: http://localhost:${port}`),
    );
});
