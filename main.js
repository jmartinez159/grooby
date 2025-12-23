const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let pythonProcess = null;

const PY_HOST = '127.0.0.1';
const PY_PORT = 8000;

// --- 1. Python Process Management ---

function startPythonSubprocess() {
    let command, args;

    if (app.isPackaged) {
        // Production: spawn the bundled server.exe
        const exePath = path.join(process.resourcesPath, 'backend', 'server.exe');
        console.log(`Starting bundled server at: ${exePath}`);
        command = exePath;
        args = [];
    } else {
        // Development: spawn python directly
        const scriptPath = path.join(__dirname, 'backend', 'server.py');
        console.log(`Starting Python process at: ${scriptPath}`);
        command = 'python';
        args = [scriptPath];
    }

    // Spawn the process
    pythonProcess = spawn(command, args);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[Backend Data]: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        const message = data.toString();
        // Smart Filter: If it's just an INFO log, print it normally.
        // Only label it an ERROR if it doesn't look like a standard log.
        if (message.includes('INFO:')) {
            console.log(`[Backend Status]: ${message}`);
        } else {
            console.error(`[Backend Error]: ${message}`);
        }
    });

    pythonProcess.on('close', (code) => {
        console.log(`Backend process exited with code ${code}`);
    });
}

function killPythonSubprocess() {
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
        console.log('Killed Python process');
    }
}

// --- 2. Electron Window Management ---

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // For simplicity in this specific internal tool
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// --- 3. App Lifecycle ---

app.on('ready', () => {
    startPythonSubprocess();
    createWindow();
});

app.on('will-quit', () => {
    killPythonSubprocess();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});