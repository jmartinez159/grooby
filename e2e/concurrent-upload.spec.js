/**
 * =============================================================================
 * CONCURRENT UPLOAD E2E TEST SUITE
 * =============================================================================
 * 
 * This test file verifies that the application correctly handles scenarios where
 * a user attempts to upload multiple files concurrently (e.g., by rapidly clicking
 * the "Run Processor" button multiple times).
 * 
 * BACKGROUND:
 * ------------
 * In web applications that process files, a common bug is allowing multiple
 * concurrent processing requests when the user clicks a button rapidly. This can
 * cause:
 *   - Race conditions where multiple processes modify the same file
 *   - Data corruption in the output file
 *   - Server overload from duplicate requests
 *   - Confusing UI states with mixed success/error messages
 * 
 * SOLUTION BEING TESTED:
 * -----------------------
 * The application implements a "processing lock" pattern where:
 *   1. When processing starts, the button becomes disabled
 *   2. Any additional click events are ignored while processing
 *   3. The button is re-enabled only after processing completes (success or failure)
 * 
 * TEST STRATEGY:
 * ---------------
 * These tests use Playwright's route interception to simulate slow backend
 * responses. This allows us to test concurrent scenarios without actually
 * waiting for real file processing, making tests fast and deterministic.
 * 
 * INDUSTRY BEST PRACTICES FOLLOWED:
 * -----------------------------------
 * 1. Arrange-Act-Assert pattern for clear test structure
 * 2. Descriptive test names that explain the scenario and expected outcome
 * 3. Isolation between tests (each test launches a fresh app instance)
 * 4. Mock external dependencies (backend API) for deterministic results
 * 5. Comprehensive comments explaining the "why" behind each step
 * 
 * =============================================================================
 */

const { test, _electron: electron, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// =============================================================================
// TEST CONFIGURATION CONSTANTS
// =============================================================================

/**
 * Path to the main Electron entry point.
 * Using path.join ensures cross-platform compatibility (Windows vs Unix).
 */
const MAIN_JS_PATH = path.join(__dirname, '../main.js');

/**
 * The backend API endpoint that processes files.
 * This is the URL we will intercept in our tests to simulate various scenarios.
 */
const PROCESS_FILE_ENDPOINT = 'http://127.0.0.1:8000/process-file';

/**
 * Simulated delay for "slow" backend responses in milliseconds.
 * This value should be long enough to allow multiple click attempts
 * but short enough to keep tests fast.
 */
const SLOW_RESPONSE_DELAY_MS = 2000;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a temporary Excel file for testing file upload functionality.
 * 
 * PURPOSE:
 * --------
 * E2E tests need a real file to simulate the file selection workflow.
 * This helper creates a minimal file that can be "uploaded" via the file input.
 * 
 * IMPLEMENTATION NOTES:
 * ----------------------
 * - We write to the OS temp directory to avoid polluting the project
 * - The file is a simple text file with .xlsx extension (sufficient for testing
 *   the upload flow - the backend will validate the actual content)
 * - Returns the absolute path which is needed by Playwright's setInputFiles
 * 
 * @returns {string} Absolute path to the created test file
 */
function createTestExcelFile() {
    // Use OS temp directory for test artifacts
    const tempDir = require('os').tmpdir();
    const testFilePath = path.join(tempDir, 'test-concurrent-upload.xlsx');

    // Create a minimal file (content doesn't matter for UI tests)
    // The backend will either process it or return an error, both are valid
    fs.writeFileSync(testFilePath, 'test content for concurrent upload test');

    return testFilePath;
}

/**
 * Cleans up the test file after tests complete.
 * 
 * PURPOSE:
 * --------
 * Good test hygiene requires cleaning up artifacts to prevent disk buildup
 * and avoid interference between test runs.
 * 
 * @param {string} filePath - Path to the file to delete
 */
function cleanupTestFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        // Log but don't fail the test if cleanup fails
        console.warn(`Warning: Could not clean up test file: ${error.message}`);
    }
}

/**
 * Sets up a route handler to intercept and delay backend responses.
 * 
 * PURPOSE:
 * --------
 * To test concurrent upload protection, we need the backend to respond slowly
 * so we have time to attempt multiple clicks. This function intercepts the
 * API request and adds an artificial delay before responding.
 * 
 * WHY MOCKING IS IMPORTANT:
 * --------------------------
 * 1. Makes tests deterministic (no dependency on backend speed)
 * 2. Allows testing edge cases (slow responses, errors, timeouts)
 * 3. Tests run faster because we control the timing
 * 4. Tests work even if the backend isn't running
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} delayMs - How long to delay the response
 * @param {object} responseBody - The JSON body to return
 */
async function setupSlowResponseMock(page, delayMs, responseBody) {
    // Intercept all requests to the process-file endpoint
    await page.route(PROCESS_FILE_ENDPOINT, async (route) => {
        // Log the interception for debugging
        console.log(`[Mock] Intercepted request to ${PROCESS_FILE_ENDPOINT}`);
        console.log(`[Mock] Delaying response by ${delayMs}ms`);

        // Simulate a slow backend by waiting before responding
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Return a successful response
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(responseBody)
        });

        console.log('[Mock] Response sent');
    });
}

// =============================================================================
// TEST SUITE: Concurrent Upload Protection
// =============================================================================

test.describe('Concurrent Upload Protection', () => {
    /**
     * =========================================================================
     * TEST: Button should be disabled during file processing
     * =========================================================================
     * 
     * SCENARIO:
     * ----------
     * User selects a file and clicks "Run Processor". While the backend is
     * processing the file, the button should be disabled to prevent additional
     * clicks.
     * 
     * VERIFICATION:
     * --------------
     * 1. Button starts as enabled (before processing)
     * 2. After clicking, button becomes disabled
     * 3. Status area shows "Processing..." message
     * 4. After processing completes, button becomes enabled again
     * 
     * WHY THIS MATTERS:
     * ------------------
     * This is the primary defense against concurrent uploads. If the button
     * remains enabled during processing, users could accidentally (or
     * intentionally) trigger multiple processing requests.
     */
    test('button should be disabled during file processing', async () => {
        // =====================================================================
        // ARRANGE: Set up the test environment
        // =====================================================================

        // Create a test file that we'll "upload"
        const testFilePath = createTestExcelFile();

        // Launch the Electron application
        const electronApp = await electron.launch({
            args: [MAIN_JS_PATH],
        });

        // Get the main window
        const window = await electronApp.firstWindow();

        // Set up the mock BEFORE any user interaction
        // This ensures the slow response is in place when we click the button
        await setupSlowResponseMock(window, SLOW_RESPONSE_DELAY_MS, {
            status: 'success',
            message: 'Processing complete',
            changes_found: true,
            processed_file: testFilePath
        });

        try {
            // =================================================================
            // ARRANGE: Verify initial state
            // =================================================================

            // Get references to the key UI elements
            const runBtn = window.locator('#runBtn');
            const fileInput = window.locator('#fileInput');
            const statusArea = window.locator('#statusArea');

            // ASSERTION: Button should be enabled before processing
            // The 'disabled' property should be false (or not present)
            await expect(runBtn).toBeEnabled();

            // =================================================================
            // ACT: Simulate file selection
            // =================================================================

            // Use Playwright's setInputFiles to simulate selecting a file
            // This is the programmatic equivalent of the user clicking the
            // file input and selecting a file from the dialog
            await fileInput.setInputFiles(testFilePath);

            // ASSERTION: Verify the file was selected (drop zone should update)
            const dropText = window.locator('#dropText');
            await expect(dropText).toContainText('Selected:');

            // =================================================================
            // ACT: Click the Run Processor button
            // =================================================================

            // Click the button to start processing
            await runBtn.click();

            // =================================================================
            // ASSERT: Verify button is disabled during processing
            // =================================================================

            // Wait a small amount of time for the click handler to execute
            // The button should be disabled almost immediately after click
            await window.waitForTimeout(100);

            // ASSERTION: Button should now be disabled
            // This is the key protection - users cannot click again
            await expect(runBtn).toBeDisabled();

            // ASSERTION: Status should show processing message
            await expect(statusArea).toBeVisible();
            await expect(statusArea).toContainText('Processing');

            // ASSERTION: Button should have the 'processing' CSS class
            // This provides visual feedback (grayed out appearance)
            await expect(runBtn).toHaveClass(/processing/);

            // =================================================================
            // ASSERT: Verify button is re-enabled after processing completes
            // =================================================================

            // Wait for the mock response to complete (slightly longer than delay)
            await window.waitForTimeout(SLOW_RESPONSE_DELAY_MS + 500);

            // ASSERTION: Button should be enabled again after processing
            await expect(runBtn).toBeEnabled();

            // ASSERTION: Button should no longer have 'processing' class
            await expect(runBtn).not.toHaveClass(/processing/);

            // ASSERTION: Status should show success message
            await expect(statusArea).toContainText('Success');

        } finally {
            // =================================================================
            // CLEANUP: Close the app and remove test file
            // =================================================================
            await electronApp.close();
            cleanupTestFile(testFilePath);
        }
    });

    /**
     * =========================================================================
     * TEST: Multiple rapid clicks should only trigger one processing request
     * =========================================================================
     * 
     * SCENARIO:
     * ----------
     * User selects a file and rapidly clicks the "Run Processor" button
     * multiple times (simulating an impatient user or accidental double-click).
     * 
     * EXPECTED BEHAVIOR:
     * -------------------
     * Only the first click should trigger a processing request. All subsequent
     * clicks should be ignored because:
     *   1. The button is disabled after the first click
     *   2. The isProcessing flag prevents re-entry into processFile()
     * 
     * VERIFICATION:
     * --------------
     * We count the number of API requests made. Only one request should be sent
     * regardless of how many times the button is clicked.
     * 
     * WHY THIS MATTERS:
     * ------------------
     * This test verifies the race condition protection. Even if the button
     * disable happens asynchronously, the isProcessing flag in JavaScript
     * should prevent multiple requests.
     */
    test('multiple rapid clicks should only trigger one processing request', async () => {
        // =====================================================================
        // ARRANGE: Set up request counting
        // =====================================================================

        // Counter to track how many API requests are made
        let requestCount = 0;

        const testFilePath = createTestExcelFile();

        const electronApp = await electron.launch({
            args: [MAIN_JS_PATH],
        });

        const window = await electronApp.firstWindow();

        // Set up a route handler that counts requests AND responds slowly
        await window.route(PROCESS_FILE_ENDPOINT, async (route) => {
            // Increment the counter for each request
            requestCount++;
            console.log(`[Mock] Request #${requestCount} received`);

            // Simulate slow processing
            await new Promise(resolve => setTimeout(resolve, SLOW_RESPONSE_DELAY_MS));

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'success',
                    message: 'Processing complete',
                    changes_found: false,
                    processed_file: testFilePath
                })
            });
        });

        try {
            // =================================================================
            // ARRANGE: Select a file
            // =================================================================

            const runBtn = window.locator('#runBtn');
            const fileInput = window.locator('#fileInput');

            await fileInput.setInputFiles(testFilePath);

            // =================================================================
            // ACT: Rapidly click the button multiple times
            // =================================================================

            // Click the button 5 times as fast as possible
            // This simulates an impatient user or accidental double-clicks
            const CLICK_COUNT = 5;

            console.log(`[Test] Clicking button ${CLICK_COUNT} times rapidly...`);

            for (let i = 0; i < CLICK_COUNT; i++) {
                // Use force: true to bypass disabled state check
                // This tests that even if clicks somehow get through to the
                // click handler, the isProcessing flag will prevent re-entry
                await runBtn.click({ force: true, timeout: 100 }).catch(() => {
                    // Ignore errors from clicking disabled button
                    console.log(`[Test] Click ${i + 1} was blocked (button disabled)`);
                });
            }

            // =================================================================
            // ASSERT: Wait for processing to complete and verify request count
            // =================================================================

            // Wait for the processing to complete
            await window.waitForTimeout(SLOW_RESPONSE_DELAY_MS + 1000);

            // CRITICAL ASSERTION: Only ONE request should have been made
            console.log(`[Test] Total requests made: ${requestCount}`);
            expect(requestCount).toBe(1);

        } finally {
            // =================================================================
            // CLEANUP
            // =================================================================
            await electronApp.close();
            cleanupTestFile(testFilePath);
        }
    });

    /**
     * =========================================================================
     * TEST: Processing state should reset after error
     * =========================================================================
     * 
     * SCENARIO:
     * ----------
     * User selects a file and clicks "Run Processor", but the backend returns
     * an error. The button should be re-enabled so the user can try again.
     * 
     * EXPECTED BEHAVIOR:
     * -------------------
     * 1. Button is disabled during processing (same as success case)
     * 2. When error response is received, error message is displayed
     * 3. Button is re-enabled so user can retry
     * 
     * WHY THIS MATTERS:
     * ------------------
     * If the button stays disabled after an error, the user would be stuck
     * and unable to retry. The finally block in processFile() ensures the
     * lock is always released, even on error.
     */
    test('button should be re-enabled after processing error', async () => {
        // =====================================================================
        // ARRANGE
        // =====================================================================

        const testFilePath = createTestExcelFile();

        const electronApp = await electron.launch({
            args: [MAIN_JS_PATH],
        });

        const window = await electronApp.firstWindow();

        // Set up a mock that returns an ERROR response (after a delay)
        await window.route(PROCESS_FILE_ENDPOINT, async (route) => {
            // Simulate processing delay before error
            await new Promise(resolve => setTimeout(resolve, 500));

            // Return a 500 error response
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    detail: 'Simulated backend error for testing'
                })
            });
        });

        try {
            // =================================================================
            // ARRANGE: Select file and verify initial state
            // =================================================================

            const runBtn = window.locator('#runBtn');
            const fileInput = window.locator('#fileInput');
            const statusArea = window.locator('#statusArea');

            await fileInput.setInputFiles(testFilePath);
            await expect(runBtn).toBeEnabled();

            // =================================================================
            // ACT: Click the button to start processing
            // =================================================================

            await runBtn.click();

            // ASSERTION: Button should be disabled during processing
            await window.waitForTimeout(100);
            await expect(runBtn).toBeDisabled();

            // =================================================================
            // ASSERT: Wait for error and verify button is re-enabled
            // =================================================================

            // Wait for the error response
            await window.waitForTimeout(1000);

            // ASSERTION: Button should be enabled again after error
            await expect(runBtn).toBeEnabled();

            // ASSERTION: Error message should be displayed
            await expect(statusArea).toBeVisible();
            await expect(statusArea).toContainText('Error');

            // ASSERTION: Status should have error styling
            await expect(statusArea).toHaveClass(/error/);

        } finally {
            // =================================================================
            // CLEANUP
            // =================================================================
            await electronApp.close();
            cleanupTestFile(testFilePath);
        }
    });

    /**
     * =========================================================================
     * TEST: Processing state is exposed via window.getProcessingState()
     * =========================================================================
     * 
     * SCENARIO:
     * ----------
     * Verify that the processing state can be queried programmatically via
     * the test hook exposed on the window object.
     * 
     * PURPOSE:
     * ---------
     * This tests the "test hook" pattern where internal state is exposed
     * specifically for testing purposes. This is a common pattern in
     * enterprise applications.
     * 
     * VERIFICATION:
     * --------------
     * 1. window.getProcessingState() returns false before processing
     * 2. window.getProcessingState() returns true during processing
     * 3. window.getProcessingState() returns false after processing
     */
    test('processing state should be queryable via test hook', async () => {
        // =====================================================================
        // ARRANGE
        // =====================================================================

        const testFilePath = createTestExcelFile();

        const electronApp = await electron.launch({
            args: [MAIN_JS_PATH],
        });

        const window = await electronApp.firstWindow();

        // Set up slow response mock
        await setupSlowResponseMock(window, SLOW_RESPONSE_DELAY_MS, {
            status: 'success',
            message: 'Processing complete',
            changes_found: true,
            processed_file: testFilePath
        });

        try {
            // =================================================================
            // ASSERT: Initial state should be false (not processing)
            // =================================================================

            const initialState = await window.evaluate(() => {
                return window.getProcessingState();
            });

            expect(initialState).toBe(false);
            console.log('[Test] Initial processing state: false ✓');

            // =================================================================
            // ACT: Select file and start processing
            // =================================================================

            const fileInput = window.locator('#fileInput');
            const runBtn = window.locator('#runBtn');

            await fileInput.setInputFiles(testFilePath);
            await runBtn.click();

            // Wait a moment for the processing to start
            await window.waitForTimeout(100);

            // =================================================================
            // ASSERT: State should be true during processing
            // =================================================================

            const processingState = await window.evaluate(() => {
                return window.getProcessingState();
            });

            expect(processingState).toBe(true);
            console.log('[Test] During processing state: true ✓');

            // =================================================================
            // ASSERT: State should be false after processing completes
            // =================================================================

            // Wait for processing to complete
            await window.waitForTimeout(SLOW_RESPONSE_DELAY_MS + 500);

            const finalState = await window.evaluate(() => {
                return window.getProcessingState();
            });

            expect(finalState).toBe(false);
            console.log('[Test] Final processing state: false ✓');

        } finally {
            // =================================================================
            // CLEANUP
            // =================================================================
            await electronApp.close();
            cleanupTestFile(testFilePath);
        }
    });
});
