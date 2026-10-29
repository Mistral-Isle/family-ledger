const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.maxWorkers = 2;
config.resolver.blockList = [/[\\/]\.cache[\\/]/, /[\\/]tmp[\\/]/];
config.resolver.assetExts.push("wasm");
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return middleware(req, res, next);
  },
};
module.exports = config;
