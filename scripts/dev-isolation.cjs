// Expo's SPA HTML handler runs before Metro's enhanceMiddleware in SDK 57.
// Install headers at the Node HTTP request boundary so HTML, workers and HMR
// resources all receive them. Loaded only by this project's Expo start command.
const http = require("node:http");
const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, ...args) {
  if (event === "request") {
    const response = args[1];
    response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  }
  return originalEmit.call(this, event, ...args);
};
