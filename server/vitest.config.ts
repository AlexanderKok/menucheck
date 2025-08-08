import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10000, // fail tests that take longer than 10s
    hookTimeout: 10000,
    teardownTimeout: 5000,
    bail: 1,            // stop after first failure
    watch: false,
    reporters: 'dot',
  },
});


