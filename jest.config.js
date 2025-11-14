module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: ['services/**/*.js', 'index.js', '!services/**/index.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  maxWorkers: 1, // Reduce to single worker to avoid hanging
  forceExit: true, // Force exit after tests complete
  detectOpenHandles: false, // Disable open handle detection to avoid warnings
};
