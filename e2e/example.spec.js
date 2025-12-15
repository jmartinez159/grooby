const { test, _electron: electron, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test('launch app and verify Glassmorphism UI', async () => {
    // Launch Electron app
    const electronApp = await electron.launch({
        args: [path.join(__dirname, '../main.js')],
    });

    // Get the first window
    const window = await electronApp.firstWindow();

    // Verify Title
    const title = await window.title();
    expect(title).toBe('Grooby Excel Processor');

    // Verify Glass Card exists
    const card = await window.locator('.glass-card');
    await expect(card).toBeVisible();

    // Verify Drop Zone exists
    const dropZone = await window.locator('.drop-zone');
    await expect(dropZone).toBeVisible();
    await expect(dropZone).toContainText('Drag & Drop Excel File');

    // Verify Button
    const btn = await window.locator('#runBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run Processor');

    // Close app
    await electronApp.close();
});

test('upload file workflow (Mocked)', async () => {
    // Launch
    const electronApp = await electron.launch({
        args: [path.join(__dirname, '../main.js')],
    });
    const window = await electronApp.firstWindow();

    // Click button without file -> Should trigger alert
    // Note: Playwright automatically dismisses dialogs, 
    // so we verify the status area does NOT show "Processing..."
    await window.click('#runBtn');

    const status = await window.locator('#statusArea');
    await expect(status).toBeHidden();
    // Or check emptiness
    const text = await status.innerText();
    expect(text).toBe('');

    await electronApp.close();
});
