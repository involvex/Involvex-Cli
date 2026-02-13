import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/*.test.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  testTimeout: 10000,
  maxWorkers: 1, // Reduce to single worker to avoid hanging
  forceExit: true, // Force exit after tests complete
  detectOpenHandles: false, // Disable open handle detection to avoid warnings
};

export default config;
