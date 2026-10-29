module.exports = {
  testEnvironment: "node",
  transformIgnorePatterns: ["/node_modules/(?!@noble/ciphers/)"],
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2022",
          allowJs: true,
          module: "commonjs",
          esModuleInterop: true,
          strict: true,
          ignoreDeprecations: "6.0",
        },
      },
    ],
  },
};
