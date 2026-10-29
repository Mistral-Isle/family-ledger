module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2022",
          module: "commonjs",
          esModuleInterop: true,
          strict: true,
          ignoreDeprecations: "6.0",
        },
      },
    ],
  },
};
