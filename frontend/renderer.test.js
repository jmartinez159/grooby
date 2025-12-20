/**
 * =============================================================================
 * UNIT TESTS FOR RENDERER.JS
 * =============================================================================
 * 
 * This test file provides comprehensive unit test coverage for the frontend
 * renderer.js module. It tests all exported functions in isolation using
 * Jest's mocking capabilities.
 * 
 * TEST STRATEGY:
 * ---------------
 * 1. Mock the DOM environment (Jest's jsdom provides this)
 * 2. Mock external dependencies (fetch, Electron webUtils, alert)
 * 3. Test each function in isolation
 * 4. Verify state changes and DOM updates
 * 5. Test edge cases and error conditions
 * 
 * COVERAGE TARGET: >95% line coverage
 * 
 * INDUSTRY BEST PRACTICES FOLLOWED:
 * -----------------------------------
 * 1. Arrange-Act-Assert (AAA) pattern for clear test structure
 * 2. Descriptive test names explaining scenario and expected outcome
 * 3. beforeEach/afterEach for consistent test setup and teardown
 * 4. Mocking external dependencies for isolated unit tests
 * 5. Testing both happy path and error conditions
 * 6. Comprehensive comments explaining the purpose of each test
 * 
 * =============================================================================
 */

// =============================================================================
// TEST SETUP AND MOCKS
// =============================================================================

/**
 * Mock the global fetch function before requiring the module.
 * 
 * WHY MOCK FETCH:
 * ----------------
 * The processFile function makes HTTP requests to the backend.
 * In unit tests, we don't want to make real network requests because:
 * - Tests should be fast and not depend on network
 * - Tests should be deterministic (real network can fail)
 * - We want to test how the code handles various responses
 */
global.fetch = jest.fn();

/**
 * Mock the global alert function.
 * 
 * WHY MOCK ALERT:
 * ----------------
 * The processFile function uses alert() to notify users when no file
 * is selected. In jsdom, alert() is not implemented, so we mock it
 * to prevent errors and to verify it's called correctly.
 */
global.alert = jest.fn();

/**
 * HTML template for setting up the DOM.
 * Extracted to a constant for reuse across tests.
 */
const DOM_TEMPLATE = `
    <div class="glass-card">
        <div class="drop-zone" id="dropZone">
            <p id="dropText">Drag & Drop Excel File or Click to Browse</p>
            <input type="file" id="fileInput" accept=".xlsx" />
        </div>
        <button id="runBtn">Run Processor</button>
        <div id="statusArea" class="status"></div>
    </div>
`;

/**
 * Set up the DOM before requiring the module.
 * 
 * WHY SET UP DOM FIRST:
 * ----------------------
 * The renderer.js module attaches event listeners on DOMContentLoaded.
 * By setting up the DOM before requiring the module, we ensure the
 * module can find all the elements it needs.
 */
document.body.innerHTML = DOM_TEMPLATE;

// Import the module after setting up mocks and DOM
const {
    setProcessingState,
    getProcessingState,
    processFile,
    resetProcessingState,
    setWebUtils,
    initializeUI
} = require('./renderer');

// =============================================================================
// MOCK WEBUTILS FOR TESTING
// =============================================================================

/**
 * Mock webUtils object that simulates Electron's webUtils.getPathForFile.
 * 
 * In the actual Electron environment, webUtils.getPathForFile(file) returns
 * the absolute file path. In tests, we return a predictable mock path.
 */
const mockWebUtils = {
    getPathForFile: jest.fn((file) => `/mock/path/${file.name}`)
};

// Inject the mock webUtils into the module
setWebUtils(mockWebUtils);

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Creates a mock File object for testing file input scenarios.
 * 
 * PURPOSE:
 * ---------
 * The processFile function reads from the file input element.
 * This helper creates a mock File object that can be assigned
 * to the input's files property.
 * 
 * @param {string} name - The file name
 * @param {string} content - The file content
 * @returns {File} A mock File object
 */
function createMockFile(name = 'test.xlsx', content = 'test content') {
    return new File([content], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Sets up a mock file in the file input element.
 * 
 * PURPOSE:
 * ---------
 * Helper function to simulate a user selecting a file via the file input.
 * Uses Object.defineProperty because FileList is read-only.
 * 
 * @param {File} file - The mock file to use
 */
function setMockFileInput(file) {
    const fileInput = document.getElementById('fileInput');

    // Create a mock FileList (FileList is read-only, so we use defineProperty)
    Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true
    });
}

/**
 * Clears the file input (simulates no file selected).
 */
function clearFileInput() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        Object.defineProperty(fileInput, 'files', {
            value: [],
            writable: false,
            configurable: true
        });
    }
}

/**
 * Creates a mock successful API response.
 * 
 * @param {boolean} changesFound - Whether changes were found
 * @returns {object} Mock response configuration for fetch
 */
function createSuccessResponse(changesFound = true) {
    return {
        ok: true,
        json: () => Promise.resolve({
            status: 'success',
            message: 'Processing complete',
            changes_found: changesFound,
            processed_file: '/path/to/file.xlsx'
        })
    };
}

/**
 * Creates a mock error API response.
 * 
 * @param {string} errorMessage - The error message to return
 * @returns {object} Mock response configuration for fetch
 */
function createErrorResponse(errorMessage = 'Server error') {
    return {
        ok: false,
        json: () => Promise.resolve({
            detail: errorMessage
        })
    };
}

/**
 * Resets the DOM to initial state.
 * This is called in afterEach to ensure clean state between tests.
 */
function resetDOM() {
    const btn = document.getElementById('runBtn');
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('processing');
    }

    const statusArea = document.getElementById('statusArea');
    if (statusArea) {
        statusArea.style.display = '';
        statusArea.className = 'status';
        statusArea.innerText = '';
    }

    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.classList.remove('dragover');
        dropZone.classList.remove('has-file');
    }

    const dropText = document.getElementById('dropText');
    if (dropText) {
        dropText.innerText = 'Drag & Drop Excel File or Click to Browse';
    }
}

// =============================================================================
// TEST SUITE: setProcessingState()
// =============================================================================

describe('setProcessingState()', () => {
    /**
     * Reset state before each test to ensure test isolation.
     * This is critical for accurate testing - each test should start
     * from a known, consistent state.
     */
    beforeEach(() => {
        resetProcessingState();
        resetDOM();
    });

    /**
     * =========================================================================
     * TEST: Should set isProcessing to true when called with true
     * =========================================================================
     * 
     * SCENARIO: Starting file processing
     * EXPECTED: isProcessing flag should be true
     */
    test('should set isProcessing to true when called with true', () => {
        // Arrange: Initial state should be false
        expect(getProcessingState()).toBe(false);

        // Act: Set processing state to true
        setProcessingState(true);

        // Assert: State should now be true
        expect(getProcessingState()).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Should set isProcessing to false when called with false
     * =========================================================================
     * 
     * SCENARIO: File processing complete, resetting state
     * EXPECTED: isProcessing flag should be false
     */
    test('should set isProcessing to false when called with false', () => {
        // Arrange: Set initial state to true
        setProcessingState(true);
        expect(getProcessingState()).toBe(true);

        // Act: Set processing state to false
        setProcessingState(false);

        // Assert: State should now be false
        expect(getProcessingState()).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Should disable the button when processing is true
     * =========================================================================
     * 
     * SCENARIO: Processing starts, button should become disabled
     * EXPECTED: Button's disabled property should be true
     * 
     * WHY THIS MATTERS:
     * ------------------
     * This is the primary UI protection against concurrent uploads.
     * A disabled button cannot be clicked, preventing additional requests.
     */
    test('should disable the button when processing is true', () => {
        // Arrange: Get button reference
        const btn = document.getElementById('runBtn');
        expect(btn.disabled).toBe(false);

        // Act: Start processing
        setProcessingState(true);

        // Assert: Button should be disabled
        expect(btn.disabled).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Should enable the button when processing is false
     * =========================================================================
     * 
     * SCENARIO: Processing complete, button should become enabled
     * EXPECTED: Button's disabled property should be false
     */
    test('should enable the button when processing is false', () => {
        // Arrange: Set button to disabled state
        const btn = document.getElementById('runBtn');
        setProcessingState(true);
        expect(btn.disabled).toBe(true);

        // Act: End processing
        setProcessingState(false);

        // Assert: Button should be enabled
        expect(btn.disabled).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Should add 'processing' CSS class when processing is true
     * =========================================================================
     * 
     * SCENARIO: Processing starts, visual feedback should be shown
     * EXPECTED: Button should have 'processing' class for styling
     */
    test('should add processing CSS class when processing is true', () => {
        // Arrange: Get button reference
        const btn = document.getElementById('runBtn');
        expect(btn.classList.contains('processing')).toBe(false);

        // Act: Start processing
        setProcessingState(true);

        // Assert: Button should have processing class
        expect(btn.classList.contains('processing')).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Should remove 'processing' CSS class when processing is false
     * =========================================================================
     * 
     * SCENARIO: Processing complete, visual feedback should be removed
     * EXPECTED: Button should not have 'processing' class
     */
    test('should remove processing CSS class when processing is false', () => {
        // Arrange: Set processing state to true
        const btn = document.getElementById('runBtn');
        setProcessingState(true);
        expect(btn.classList.contains('processing')).toBe(true);

        // Act: End processing
        setProcessingState(false);

        // Assert: Button should not have processing class
        expect(btn.classList.contains('processing')).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Should handle missing button gracefully
     * =========================================================================
     * 
     * SCENARIO: Button element doesn't exist in DOM
     * EXPECTED: Function should not throw an error
     * 
     * WHY THIS MATTERS:
     * ------------------
     * Defensive programming - the function should not crash if the DOM
     * is in an unexpected state. This could happen during edge cases
     * like DOM manipulation or testing scenarios.
     */
    test('should handle missing button gracefully', () => {
        // Arrange: Remove the button from DOM
        const btn = document.getElementById('runBtn');
        const parent = btn.parentElement;
        btn.remove();

        // Act & Assert: Should not throw
        expect(() => setProcessingState(true)).not.toThrow();
        expect(getProcessingState()).toBe(true);

        // Cleanup: Restore button
        const newBtn = document.createElement('button');
        newBtn.id = 'runBtn';
        newBtn.textContent = 'Run Processor';
        parent.appendChild(newBtn);
    });
});

// =============================================================================
// TEST SUITE: getProcessingState()
// =============================================================================

describe('getProcessingState()', () => {
    beforeEach(() => {
        resetProcessingState();
    });

    /**
     * =========================================================================
     * TEST: Should return false initially
     * =========================================================================
     * 
     * SCENARIO: Application just started, no processing happening
     * EXPECTED: getProcessingState() returns false
     */
    test('should return false initially', () => {
        expect(getProcessingState()).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Should return true after setting to true
     * =========================================================================
     * 
     * SCENARIO: Processing has started
     * EXPECTED: getProcessingState() returns true
     */
    test('should return true after setProcessingState(true)', () => {
        setProcessingState(true);
        expect(getProcessingState()).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Should return false after setting to false
     * =========================================================================
     * 
     * SCENARIO: Processing was started then completed
     * EXPECTED: getProcessingState() returns false
     */
    test('should return false after setProcessingState(false)', () => {
        setProcessingState(true);
        setProcessingState(false);
        expect(getProcessingState()).toBe(false);
    });
});

// =============================================================================
// TEST SUITE: resetProcessingState()
// =============================================================================

describe('resetProcessingState()', () => {
    /**
     * =========================================================================
     * TEST: Should reset state to false
     * =========================================================================
     * 
     * SCENARIO: State was true, reset is called
     * EXPECTED: State should be false after reset
     * 
     * WHY THIS MATTERS:
     * ------------------
     * This function is critical for test isolation. Without it, tests
     * would affect each other, leading to flaky tests.
     */
    test('should reset isProcessing to false', () => {
        // Arrange: Set state to true
        setProcessingState(true);
        expect(getProcessingState()).toBe(true);

        // Act: Reset state
        resetProcessingState();

        // Assert: State should be false
        expect(getProcessingState()).toBe(false);
    });
});

// =============================================================================
// TEST SUITE: processFile()
// =============================================================================

describe('processFile()', () => {
    beforeEach(() => {
        // Reset all state and mocks before each test
        resetProcessingState();
        jest.clearAllMocks();
        resetDOM();
        clearFileInput();
    });

    /**
     * =========================================================================
     * TEST: Should alert if no file is selected
     * =========================================================================
     * 
     * SCENARIO: User clicks "Run Processor" without selecting a file
     * EXPECTED: Alert should be shown, no processing should occur
     */
    test('should alert if no file is selected', async () => {
        // Arrange: No file in input (already cleared in beforeEach)

        // Act: Call processFile
        await processFile();

        // Assert: Alert should be called with appropriate message
        expect(global.alert).toHaveBeenCalledWith('Please select a file first!');

        // Assert: Processing state should still be false
        expect(getProcessingState()).toBe(false);

        // Assert: No fetch should have been made
        expect(global.fetch).not.toHaveBeenCalled();
    });

    /**
     * =========================================================================
     * TEST: Should exit immediately if already processing
     * =========================================================================
     * 
     * SCENARIO: User double-clicks the button rapidly
     * EXPECTED: Second call should return immediately without processing
     * 
     * WHY THIS MATTERS:
     * ------------------
     * This is the core concurrent upload protection. The guard clause
     * at the start of processFile() prevents re-entry.
     */
    test('should exit immediately if already processing', async () => {
        // Arrange: Set processing state to true
        setProcessingState(true);
        setMockFileInput(createMockFile());

        // Act: Call processFile while already processing
        await processFile();

        // Assert: No fetch should have been made
        expect(global.fetch).not.toHaveBeenCalled();

        // Assert: No alert should have been shown
        expect(global.alert).not.toHaveBeenCalled();
    });

    /**
     * =========================================================================
     * TEST: Should show success message when changes are found
     * =========================================================================
     * 
     * SCENARIO: Backend processes file and finds changes
     * EXPECTED: Success message mentioning changes should be shown
     */
    test('should show success message when changes are found', async () => {
        // Arrange: Set up file and mock successful response with changes
        setMockFileInput(createMockFile());
        global.fetch.mockResolvedValueOnce(createSuccessResponse(true));

        // Act: Process the file
        await processFile();

        // Assert: Status should show success with changes
        const statusArea = document.getElementById('statusArea');
        expect(statusArea.innerText).toContain('Success');
        expect(statusArea.innerText).toContain('Changes detected');
        expect(statusArea.classList.contains('success')).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Should show success message when no changes are found
     * =========================================================================
     * 
     * SCENARIO: Backend processes file but finds no changes
     * EXPECTED: Success message mentioning no changes should be shown
     */
    test('should show success message when no changes are found', async () => {
        // Arrange: Set up file and mock successful response without changes
        setMockFileInput(createMockFile());
        global.fetch.mockResolvedValueOnce(createSuccessResponse(false));

        // Act: Process the file
        await processFile();

        // Assert: Status should show success without changes
        const statusArea = document.getElementById('statusArea');
        expect(statusArea.innerText).toContain('Success');
        expect(statusArea.innerText).toContain('No changes');
        expect(statusArea.classList.contains('success')).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Should show error message on server error
     * =========================================================================
     * 
     * SCENARIO: Backend returns an error response
     * EXPECTED: Error message should be displayed to user
     */
    test('should show error message on server error', async () => {
        // Arrange: Set up file and mock error response
        setMockFileInput(createMockFile());
        global.fetch.mockResolvedValueOnce(createErrorResponse('File processing failed'));

        // Act: Process the file
        await processFile();

        // Assert: Status should show error
        const statusArea = document.getElementById('statusArea');
        expect(statusArea.innerText).toContain('Error');
        expect(statusArea.innerText).toContain('File processing failed');
        expect(statusArea.classList.contains('error')).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Should show error message on network failure
     * =========================================================================
     * 
     * SCENARIO: Network request fails (e.g., backend not running)
     * EXPECTED: Error message should be displayed to user
     */
    test('should show error message on network failure', async () => {
        // Arrange: Set up file and mock network failure
        setMockFileInput(createMockFile());
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        // Act: Process the file
        await processFile();

        // Assert: Status should show error
        const statusArea = document.getElementById('statusArea');
        expect(statusArea.innerText).toContain('Error');
        expect(statusArea.innerText).toContain('Network error');
        expect(statusArea.classList.contains('error')).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Should reset processing state after successful processing
     * =========================================================================
     * 
     * SCENARIO: File processing completes successfully
     * EXPECTED: Processing state should be false (button re-enabled)
     */
    test('should reset processing state after success', async () => {
        // Arrange: Set up file and mock successful response
        setMockFileInput(createMockFile());
        global.fetch.mockResolvedValueOnce(createSuccessResponse(true));

        // Act: Process the file
        await processFile();

        // Assert: Processing state should be false
        expect(getProcessingState()).toBe(false);

        // Assert: Button should be enabled
        const btn = document.getElementById('runBtn');
        expect(btn.disabled).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Should reset processing state after error
     * =========================================================================
     * 
     * SCENARIO: File processing fails with an error
     * EXPECTED: Processing state should be false (button re-enabled)
     * 
     * WHY THIS MATTERS:
     * ------------------
     * The finally block ensures the lock is always released, even on error.
     * This prevents the UI from being permanently locked.
     */
    test('should reset processing state after error', async () => {
        // Arrange: Set up file and mock error response
        setMockFileInput(createMockFile());
        global.fetch.mockRejectedValueOnce(new Error('Test error'));

        // Act: Process the file
        await processFile();

        // Assert: Processing state should be false
        expect(getProcessingState()).toBe(false);

        // Assert: Button should be enabled
        const btn = document.getElementById('runBtn');
        expect(btn.disabled).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Should show "Processing..." message during processing
     * =========================================================================
     * 
     * SCENARIO: Processing starts
     * EXPECTED: Status area should show "Processing..." message
     */
    test('should show processing message during processing', async () => {
        // Arrange: Set up file and mock delayed response
        setMockFileInput(createMockFile());

        // Use a promise that we control to simulate "during processing"
        let resolveResponse;
        const responsePromise = new Promise((resolve) => {
            resolveResponse = resolve;
        });
        global.fetch.mockReturnValueOnce(responsePromise);

        // Act: Start processing (don't await)
        const processPromise = processFile();

        // Assert: Status should show processing message
        const statusArea = document.getElementById('statusArea');
        expect(statusArea.style.display).toBe('block');
        expect(statusArea.innerText).toContain('Processing');

        // Cleanup: Resolve the promise to complete the test
        resolveResponse(createSuccessResponse(true));
        await processPromise;
    });

    /**
     * =========================================================================
     * TEST: Should handle unknown error gracefully
     * =========================================================================
     * 
     * SCENARIO: Backend returns error without detail message
     * EXPECTED: Should show "Unknown error" message
     */
    test('should handle error without detail message', async () => {
        // Arrange: Set up file and mock error response without detail
        setMockFileInput(createMockFile());
        global.fetch.mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({})
        });

        // Act: Process the file
        await processFile();

        // Assert: Status should show unknown error
        const statusArea = document.getElementById('statusArea');
        expect(statusArea.innerText).toContain('Unknown error');
    });

    /**
     * =========================================================================
     * TEST: Should call fetch with correct parameters
     * =========================================================================
     * 
     * SCENARIO: File is processed
     * EXPECTED: Fetch should be called with correct URL and body
     */
    test('should call fetch with correct parameters', async () => {
        // Arrange: Set up file
        const mockFile = createMockFile('myfile.xlsx');
        setMockFileInput(mockFile);
        global.fetch.mockResolvedValueOnce(createSuccessResponse(true));

        // Act: Process the file
        await processFile();

        // Assert: Fetch should be called with correct parameters
        expect(global.fetch).toHaveBeenCalledWith(
            'http://127.0.0.1:8000/process-file',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: expect.stringContaining('file_path')
            })
        );

        // Assert: webUtils.getPathForFile should be called
        expect(mockWebUtils.getPathForFile).toHaveBeenCalledWith(mockFile);
    });
});

// =============================================================================
// TEST SUITE: setWebUtils()
// =============================================================================

describe('setWebUtils()', () => {
    /**
     * =========================================================================
     * TEST: Should allow injection of mock webUtils
     * =========================================================================
     * 
     * SCENARIO: Tests need to inject mock webUtils
     * EXPECTED: Mock should be used when processFile is called
     */
    test('should allow injection of mock webUtils', async () => {
        // Arrange: Create a custom mock
        const customMock = {
            getPathForFile: jest.fn(() => '/custom/mock/path.xlsx')
        };
        setWebUtils(customMock);

        setMockFileInput(createMockFile());
        global.fetch.mockResolvedValueOnce(createSuccessResponse(true));
        resetProcessingState();

        // Act: Process file
        await processFile();

        // Assert: Custom mock should be used
        expect(customMock.getPathForFile).toHaveBeenCalled();

        // Cleanup: Restore original mock
        setWebUtils(mockWebUtils);
    });
});

// =============================================================================
// TEST SUITE: initializeUI()
// =============================================================================

describe('initializeUI()', () => {
    /**
     * Setup: Reset DOM and call initializeUI before each test.
     * 
     * WHY RE-INITIALIZE:
     * -------------------
     * Each test needs fresh event listeners. By resetting the DOM and
     * calling initializeUI, we ensure consistent test behavior.
     */
    beforeEach(() => {
        // Reset DOM to pristine state
        document.body.innerHTML = DOM_TEMPLATE;
        resetProcessingState();
        jest.clearAllMocks();

        // Initialize UI to set up event listeners
        initializeUI();
    });

    /**
     * =========================================================================
     * TEST: Should return true when all elements exist
     * =========================================================================
     * 
     * SCENARIO: DOM is properly set up with all required elements
     * EXPECTED: initializeUI returns true
     */
    test('should return true when all elements exist', () => {
        // Arrange: DOM is already set up in beforeEach
        document.body.innerHTML = DOM_TEMPLATE;

        // Act: Initialize UI
        const result = initializeUI();

        // Assert: Should return true
        expect(result).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Should return false when button is missing
     * =========================================================================
     * 
     * SCENARIO: DOM is missing the run button
     * EXPECTED: initializeUI returns false
     */
    test('should return false when button is missing', () => {
        // Arrange: Remove button from DOM
        document.getElementById('runBtn').remove();

        // Act: Re-initialize (will fail due to missing button)
        document.body.innerHTML = `
            <div class="drop-zone" id="dropZone">
                <p id="dropText">Drag & Drop</p>
                <input type="file" id="fileInput" />
            </div>
            <div id="statusArea"></div>
        `;
        const result = initializeUI();

        // Assert: Should return false
        expect(result).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Should return false when dropZone is missing
     * =========================================================================
     * 
     * SCENARIO: DOM is missing the drop zone
     * EXPECTED: initializeUI returns false
     */
    test('should return false when dropZone is missing', () => {
        // Arrange: DOM without dropZone
        document.body.innerHTML = `
            <button id="runBtn">Run</button>
            <p id="dropText">Drag & Drop</p>
            <input type="file" id="fileInput" />
            <div id="statusArea"></div>
        `;

        // Act: Initialize
        const result = initializeUI();

        // Assert: Should return false
        expect(result).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: File input change should update drop zone text
     * =========================================================================
     * 
     * SCENARIO: User selects a file
     * EXPECTED: Drop zone should show file name and have 'has-file' class
     */
    test('file input change should update drop zone text', () => {
        // Arrange: Get elements
        const fileInput = document.getElementById('fileInput');
        const dropText = document.getElementById('dropText');
        const dropZone = document.getElementById('dropZone');

        // Set up mock file
        const mockFile = createMockFile('selected-file.xlsx');
        Object.defineProperty(fileInput, 'files', {
            value: [mockFile],
            writable: false,
            configurable: true
        });

        // Act: Dispatch change event
        fileInput.dispatchEvent(new Event('change'));

        // Assert: Drop text should show file name
        expect(dropText.innerText).toContain('Selected:');
        expect(dropText.innerText).toContain('selected-file.xlsx');

        // Assert: Drop zone should have 'has-file' class
        expect(dropZone.classList.contains('has-file')).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Empty file input should reset drop zone
     * =========================================================================
     * 
     * SCENARIO: User clears the file selection
     * EXPECTED: Drop zone should return to default state
     */
    test('empty file input should reset drop zone', () => {
        // Arrange: First select a file
        const fileInput = document.getElementById('fileInput');
        const dropText = document.getElementById('dropText');
        const dropZone = document.getElementById('dropZone');

        const mockFile = createMockFile('myfile.xlsx');
        Object.defineProperty(fileInput, 'files', {
            value: [mockFile],
            writable: false,
            configurable: true
        });
        fileInput.dispatchEvent(new Event('change'));

        // Verify file was selected
        expect(dropZone.classList.contains('has-file')).toBe(true);

        // Act: Clear the file
        Object.defineProperty(fileInput, 'files', {
            value: [],
            writable: false,
            configurable: true
        });
        fileInput.dispatchEvent(new Event('change'));

        // Assert: Drop text should show default message
        expect(dropText.innerText).toContain('Drag & Drop');

        // Assert: Drop zone should not have 'has-file' class
        expect(dropZone.classList.contains('has-file')).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Dragover event should add 'dragover' class
     * =========================================================================
     * 
     * SCENARIO: User drags file over drop zone
     * EXPECTED: Drop zone should have 'dragover' class for visual feedback
     */
    test('dragover should add dragover class', () => {
        // Arrange: Get drop zone
        const dropZone = document.getElementById('dropZone');
        expect(dropZone.classList.contains('dragover')).toBe(false);

        // Act: Dispatch dragover event
        dropZone.dispatchEvent(new Event('dragover'));

        // Assert: Should have dragover class
        expect(dropZone.classList.contains('dragover')).toBe(true);
    });

    /**
     * =========================================================================
     * TEST: Dragleave event should remove 'dragover' class
     * =========================================================================
     * 
     * SCENARIO: User drags file away from drop zone
     * EXPECTED: Drop zone should not have 'dragover' class
     */
    test('dragleave should remove dragover class', () => {
        // Arrange: Add dragover class first
        const dropZone = document.getElementById('dropZone');
        dropZone.dispatchEvent(new Event('dragover'));
        expect(dropZone.classList.contains('dragover')).toBe(true);

        // Act: Dispatch dragleave event
        dropZone.dispatchEvent(new Event('dragleave'));

        // Assert: Should not have dragover class
        expect(dropZone.classList.contains('dragover')).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Drop event should remove 'dragover' class
     * =========================================================================
     * 
     * SCENARIO: User drops file on drop zone
     * EXPECTED: Drop zone should not have 'dragover' class
     */
    test('drop should remove dragover class', () => {
        // Arrange: Add dragover class first
        const dropZone = document.getElementById('dropZone');
        dropZone.dispatchEvent(new Event('dragover'));
        expect(dropZone.classList.contains('dragover')).toBe(true);

        // Act: Dispatch drop event
        dropZone.dispatchEvent(new Event('drop'));

        // Assert: Should not have dragover class
        expect(dropZone.classList.contains('dragover')).toBe(false);
    });

    /**
     * =========================================================================
     * TEST: Button click should trigger processFile
     * =========================================================================
     * 
     * SCENARIO: User clicks Run Processor button
     * EXPECTED: processFile should be called (verified via alert for no file)
     */
    test('button click should trigger processFile', async () => {
        // Arrange: Clear file input so alert will be triggered
        clearFileInput();
        const btn = document.getElementById('runBtn');

        // Act: Click button
        btn.click();

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 10));

        // Assert: Alert should be called (processFile was triggered)
        expect(global.alert).toHaveBeenCalledWith('Please select a file first!');
    });
});
