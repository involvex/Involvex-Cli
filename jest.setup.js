// Jest setup file for proper cleanup

// Ensure all timers are cleared after each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  jest.clearAllMocks();
  jest.restoreAllMocks();

  // Clear any remaining async operations
  if (typeof global.gc === 'function') {
    global.gc();
  }
});
