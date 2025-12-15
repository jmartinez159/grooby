const { webUtils } = require('electron');

async function processFile() {
    const fileInput = document.getElementById('fileInput');
    const statusArea = document.getElementById('statusArea');

    if (fileInput.files.length === 0) {
        alert("Please select a file first!");
        return;
    }

    // In Electron (with nodeIntegration), we can use webUtils to get the path
    const filePath = webUtils.getPathForFile(fileInput.files[0]);

    statusArea.style.display = 'block';
    statusArea.className = 'status';
    statusArea.innerText = "Processing... please wait.";

    try {
        const response = await fetch('http://127.0.0.1:8000/process-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath })
        });

        const data = await response.json();

        if (response.ok) {
            statusArea.className = 'status success';
            statusArea.innerText = data.changes_found
                ? `Success! Changes detected and highlighted in file.`
                : `Success! No changes were detected.`;
        } else {
            throw new Error(data.detail || "Unknown error");
        }
    } catch (error) {
        statusArea.className = 'status error';
        statusArea.innerText = `Error: ${error.message}`;
    }
}

// Bind the button when the DOM is loaded to avoid inline onclick
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('button');
    if (btn) {
        btn.addEventListener('click', processFile);
    }
});
