const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 0,
    workers: 1, // Electron app testing usually requires running serially
    use: {
        headless: false, // Electron apps always run with UI
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        video: 'on-first-retry',
    },
});
