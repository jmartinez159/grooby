const { webUtils } = require('electron');

// Logic to process the file
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

// UI Interaction Logic
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('runBtn');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dropText = document.getElementById('dropText');

    if (btn) {
        btn.addEventListener('click', processFile);
    }

    // Sync Input change to Drop Zone visual
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
    dropZone.addEventListener('dragover', (e) => {
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('dragover');
    });
});
