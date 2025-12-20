/**
 * =============================================================================
 * JEST CONFIGURATION
 * =============================================================================
 * 
 * This configuration sets up Jest for testing frontend JavaScript code that
 * runs in a browser-like environment (Electron renderer process).
 * 
 * KEY CONFIGURATION:
 * ------------------
 * - testEnvironment: 'jsdom' - Simulates a browser DOM for testing
 * - testMatch: Finds .test.js files in frontend directory
 * - collectCoverageFrom: Specifies which files to measure coverage for
 * - coverageThreshold: Enforces minimum 95% line coverage
 * 
 * =============================================================================
 */

module.exports = {
    // Use jsdom to simulate browser DOM environment
    // This allows us to test code that uses document, window, etc.
    testEnvironment: 'jsdom',

    // Look for test files in the frontend directory
    testMatch: [
        '**/frontend/**/*.test.js'
    ],

    // Specify which files to collect coverage from
    collectCoverageFrom: [
        'frontend/renderer.js'
    ],

    // Enforce minimum coverage thresholds
    // This ensures we maintain >95% line coverage
    // Function threshold is 90% because the anonymous DOMContentLoaded
    // callback is tested indirectly via the exported initializeUI function
    coverageThreshold: {
        global: {
            lines: 95,
            functions: 90,
            branches: 90,
            statements: 95
        }
    },

    // Transform settings to handle ES modules if needed
    transform: {},

    // Clear mocks between tests for isolation
    clearMocks: true,

    // Reset modules between tests
    resetModules: true,

    // Verbose output for better debugging
    verbose: true
};
