// Only the dedicated demo server inserts this marker before the bundle loads.
// Runtime selection avoids Expo's transform cache carrying build-time flags across builds.
export const isBudgetDemo =
  typeof document !== "undefined" &&
  document
    .querySelector('meta[name="ledger-preview"]')
    ?.getAttribute("content") === "budget-demo";

// These two localhost servers are disposable UI previews, never installed ledgers.
export const isLocalPreview =
  typeof location !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(location.hostname) &&
  ["4173", "4175"].includes(location.port);
