// =============================================================================
// ELECTRON DEPENDENCY HANDLING
// =============================================================================
// 
// The webUtils module is only available in Electron's renderer process.
// During Jest tests, we mock this dependency. The conditional check allows
// the code to load without throwing errors in the test environment.
// =============================================================================

let webUtils = null;
try {
    // Attempt to require Electron's webUtils
    // This will succeed in the Electron renderer process
    webUtils = require('electron').webUtils;
} catch (e) {
    // In Jest environment, Electron is not available
    // webUtils will be mocked in tests
    webUtils = null;
}

/**
 * Sets the webUtils dependency (for testing purposes).
 * 
 * PURPOSE:
 * --------
 * This function allows unit tests to inject a mock webUtils object.
 * This follows the Dependency Injection pattern for testability.
 * 
 * @param {object} mockWebUtils - Mock webUtils object with getPathForFile method
 */
function setWebUtils(mockWebUtils) {
    webUtils = mockWebUtils;
}

// =============================================================================
// PROCESSING STATE MANAGEMENT
// =============================================================================
// 
// This module implements a "processing lock" pattern to prevent concurrent file
// uploads. This is a defensive UI pattern that ensures:
// 
// 1. SINGLE REQUEST GUARANTEE: Only one file can be processed at a time
// 2. USER FEEDBACK: Visual indicators show when processing is in progress
// 3. RACE CONDITION PREVENTION: Multiple rapid clicks cannot trigger multiple
//    API requests that could corrupt the Excel file
// 
// The state is managed through a simple boolean flag (`isProcessing`) that acts
// as a mutex/lock for the processing operation.
// =============================================================================

/**
 * Global processing state flag.
 * 
 * This flag acts as a mutex to prevent concurrent file processing operations.
 * When `true`, the UI is locked and additional processing requests are blocked.
 * When `false`, the UI is ready to accept a new processing request.
 * 
 * @type {boolean}
 */
let isProcessing = false;

/**
 * Resets the processing state to its initial value.
 * 
 * PURPOSE:
 * --------
 * This function is primarily used in unit tests to ensure test isolation.
 * Each test should start with a clean state to avoid test interdependencies.
 * 
 * WHY THIS IS NEEDED:
 * --------------------
 * Since `isProcessing` is a module-level variable, it persists between tests
 * unless explicitly reset. Without this function, a test that sets isProcessing
 * to true could affect subsequent tests.
 * 
 * BEST PRACTICE:
 * ---------------
 * This follows the "test reset" pattern common in enterprise applications.
 * It's only exported for testing purposes and should not be used in production.
 */
function resetProcessingState() {
    isProcessing = false;
}

/**
 * Sets the processing state and updates the UI accordingly.
 * 
 * This function encapsulates all UI changes related to processing state,
 * following the Single Responsibility Principle. It handles:
 * - Updating the global processing flag
 * - Enabling/disabling the run button
 * - Applying visual styling to indicate the disabled state
 * 
 * By centralizing these operations, we ensure consistency and make the code
 * more testable - we only need to verify this function behaves correctly.
 * 
 * @param {boolean} processing - Whether a file is currently being processed
 */
function setProcessingState(processing) {
    // Update the global state flag
    isProcessing = processing;

    // Get reference to the run button
    const btn = document.getElementById('runBtn');

    if (btn) {
        // Disable/enable the button based on processing state
        // When disabled, the button will not respond to click events
        btn.disabled = processing;

        // Add/remove a CSS class for visual feedback
        // This allows custom styling in CSS (e.g., grayed out appearance)
        if (processing) {
            btn.classList.add('processing');
        } else {
            btn.classList.remove('processing');
        }
    }
}

/**
 * Checks if a file processing operation is currently in progress.
 * 
 * This getter function provides read-only access to the processing state,
 * which is useful for:
 * - E2E tests that need to verify the processing state
 * - Other modules that might need to check if processing is active
 * 
 * @returns {boolean} True if a file is currently being processed
 */
function getProcessingState() {
    return isProcessing;
}

// Expose the state getter globally for E2E testing
// This follows the "test hook" pattern where we expose minimal internal state
// for testing purposes while keeping the main API clean
window.getProcessingState = getProcessingState;

/**
 * Main file processing function.
 * 
 * This function orchestrates the entire file processing workflow:
 * 1. Validates that a file is selected
 * 2. Acquires the processing lock (prevents concurrent operations)
 * 3. Sends the file to the backend for processing
 * 4. Updates the UI with the result
 * 5. Releases the processing lock (allows new operations)
 * 
 * CONCURRENT ACCESS PROTECTION:
 * The function checks `isProcessing` at the start and returns immediately
 * if another operation is in progress. This is a "fail-fast" pattern that
 * prevents queueing or race conditions.
 * 
 * ERROR HANDLING:
 * The processing lock is released in a `finally` block to ensure it's
 * always released, even if an error occurs. This prevents the UI from
 * becoming permanently locked due to an unhandled exception.
 */
async function processFile() {
    // =========================================================================
    // GUARD CLAUSE: Prevent concurrent processing
    // =========================================================================
    // If we're already processing a file, exit immediately.
    // This is the key protection against concurrent uploads - any clicks
    // while processing is active are simply ignored.
    if (isProcessing) {
        console.log('[Renderer] Processing already in progress, ignoring click');
        return;
    }

    const fileInput = document.getElementById('fileInput');
    const statusArea = document.getElementById('statusArea');

    // =========================================================================
    // VALIDATION: Ensure a file is selected
    // =========================================================================
    if (fileInput.files.length === 0) {
        alert("Please select a file first!");
        return;
    }

    // =========================================================================
    // ACQUIRE LOCK: Enter processing state
    // =========================================================================
    // This disables the button and sets the visual indicators.
    // From this point until the finally block, no other processing can start.
    setProcessingState(true);

    // In Electron (with nodeIntegration), we can use webUtils to get the path
    const filePath = webUtils.getPathForFile(fileInput.files[0]);

    // Update status area to show processing is in progress
    statusArea.style.display = 'block';
    statusArea.className = 'status';
    statusArea.innerText = "Processing... please wait.";

    try {
        // =====================================================================
        // API REQUEST: Send file to backend for processing
        // =====================================================================
        const response = await fetch('http://127.0.0.1:8000/process-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath })
        });

        const data = await response.json();

        // =====================================================================
        // RESULT HANDLING: Update UI based on response
        // =====================================================================
        if (response.ok) {
            statusArea.className = 'status success';
            statusArea.innerText = data.changes_found
                ? `Success! Changes detected and highlighted in file.`
                : `Success! No changes were detected.`;
        } else {
            throw new Error(data.detail || "Unknown error");
        }
    } catch (error) {
        // =====================================================================
        // ERROR HANDLING: Display error message to user
        // =====================================================================
        statusArea.className = 'status error';
        statusArea.innerText = `Error: ${error.message}`;
    } finally {
        // =====================================================================
        // RELEASE LOCK: Exit processing state
        // =====================================================================
        // This MUST be in a finally block to ensure the lock is always released,
        // even if an unexpected error occurs. Without this, the UI could become
        // permanently locked in a "processing" state.
        setProcessingState(false);
    }
}

/**
 * Initializes the UI by setting up event listeners.
 * 
 * PURPOSE:
 * --------
 * This function encapsulates all the UI initialization logic, making it
 * testable. By extracting this from the DOMContentLoaded handler, we can:
 * - Call it directly in unit tests
 * - Verify event listeners are set up correctly
 * - Achieve higher code coverage
 * 
 * WHAT IT SETS UP:
 * -----------------
 * 1. Click handler on Run button (triggers processFile)
 * 2. Change handler on file input (updates drop zone text)
 * 3. Drag and drop visual feedback handlers
 * 
 * @returns {boolean} True if initialization was successful, false otherwise
 */
function initializeUI() {
    const btn = document.getElementById('runBtn');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dropText = document.getElementById('dropText');

    // Check if all required elements exist
    if (!btn || !dropZone || !fileInput || !dropText) {
        console.warn('[Renderer] Could not find all required DOM elements');
        return false;
    }

    // Set up click handler for the Run button
    btn.addEventListener('click', processFile);

    // Sync Input change to Drop Zone visual
    // This handler updates the drop zone text to show the selected file name
    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) {
            const fileName = fileInput.files[0].name;
            dropText.innerText = `Selected: ${fileName}`;
            dropZone.classList.add('has-file');
        } else {
            dropText.innerText = "Drag & Drop Excel File or Click to Browse";
            dropZone.classList.remove('has-file');
        }
    });

    // Drag & Drop Visual Feedback
    // Note: The actual drop is handled by the input element covering the div,
    // but these events help with styling the parent div.

    // Dragover: User is dragging something over the drop zone
    dropZone.addEventListener('dragover', (e) => {
        dropZone.classList.add('dragover');
    });

    // Dragleave: User moved the drag outside the drop zone
    dropZone.addEventListener('dragleave', (e) => {
        dropZone.classList.remove('dragover');
    });

    // Drop: User dropped something on the drop zone
    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('dragover');
    });

    return true;
}

// UI Interaction Logic
// Call initializeUI when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
});

// =============================================================================
// MODULE EXPORTS (FOR TESTING)
// =============================================================================
// 
// These exports enable unit testing of individual functions in isolation.
// In the Electron renderer process, these exports are unused (the code is
// loaded via a <script> tag), but Jest can import them for testing.
// 
// WHAT WE EXPORT:
// ----------------
// - setProcessingState: Core function that manages UI state
// - getProcessingState: Read-only accessor for processing state
// - processFile: Main processing function (for integration-style unit tests)
// - resetProcessingState: Test utility to reset state between tests
// 
// BEST PRACTICE:
// ---------------
// Only export what is necessary for testing. Internal helper functions
// should remain private to maintain encapsulation.
// =============================================================================

// Check if we're in a CommonJS environment (Node.js/Jest) vs browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setProcessingState,
        getProcessingState,
        processFile,
        resetProcessingState,
        setWebUtils,
        initializeUI
    };
}
