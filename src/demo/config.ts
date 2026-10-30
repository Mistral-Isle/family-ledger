// Only the dedicated demo server inserts this marker before the bundle loads.
// Runtime selection avoids Expo's transform cache carrying build-time flags across builds.
export const isBudgetDemo =
  typeof document !== "undefined" &&
  document
    .querySelector('meta[name="ledger-preview"]')
    ?.getAttribute("content") === "budget-demo";
