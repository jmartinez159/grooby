# Groobi

> **Desktop application for automated Excel change detection and highlighting**

![Electron](https://img.shields.io/badge/Electron-39.2.7-47848F?logo=electron&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Latest-009688?logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/License-Private-red)

Groobi is a cross-platform desktop application that automatically detects and highlights changes between Excel spreadsheet sheets. Built with Electron for a beautiful native experience and Python for powerful data processing, it provides **100% local data privacy** — your files never leave your machine.

---

## ✨ Features

- **🔍 Automatic Change Detection** — Compares sheets within Excel files to identify modified rows
- **🎨 Visual Highlighting** — Automatically highlights changed rows in yellow for easy review
- **🔒 Complete Data Privacy** — All processing happens locally; no data is sent to external servers
- **💾 Atomic File Operations** — Safe file saving prevents data corruption during unexpected shutdowns
- **🎯 Drag & Drop Interface** — Modern glassmorphism UI with intuitive file selection
- **🛡️ Smart Column Filtering** — Automatically ignores noisy columns that change too frequently
- **📦 One-Click Installation** — Bundled as a standalone Windows installer

---

## 📸 Screenshots

*Groobi features a modern glassmorphism UI with animated gradient backgrounds*

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Electron 39.2.7, HTML5, CSS3, JavaScript |
| **Backend** | Python 3.x, FastAPI, Uvicorn |
| **Data Processing** | Pandas, OpenPyXL |
| **Packaging** | Electron Builder, PyInstaller |
| **Testing** | Jest, Pytest, Playwright |

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.x or higher) — [Download](https://nodejs.org/)
- **Python** (3.8 or higher) — [Download](https://www.python.org/downloads/)
- **Git** (optional, for cloning) — [Download](https://git-scm.com/)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/groobi.git
cd groobi
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Install Python Dependencies

```bash
# Create a virtual environment (recommended)
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Run in Development Mode

```bash
npm start
```

This launches the Electron app, which automatically starts the Python backend server on `127.0.0.1:8000`.

---

## 📁 Project Structure

```
groobi/
├── main.js                 # Electron main process
├── package.json            # Node.js dependencies and scripts
├── electron-builder.json   # Electron Builder configuration
├── requirements.txt        # Python dependencies
│
├── frontend/               # Electron renderer (UI)
│   ├── index.html          # Main UI with glassmorphism design
│   ├── renderer.js         # Frontend JavaScript logic
│   └── renderer.test.js    # Frontend unit tests
│
├── backend/                # Python FastAPI backend
│   ├── server.py           # FastAPI server entry point
│   ├── index.py            # Core Excel processing logic
│   ├── file_utils.py       # Atomic file operation utilities
│   ├── test_*.py           # Backend unit tests
│   └── backend.spec        # PyInstaller specification
│
├── e2e/                    # End-to-end tests
│   └── *.spec.ts           # Playwright test files
│
├── jest.config.js          # Jest test configuration
└── playwright.config.js    # Playwright test configuration
```

---

## 📖 How It Works

### Processing Flow

1. **File Selection** — User drags/drops or browses for an `.xlsx` file
2. **Sheet Detection** — Finds sheets matching date pattern (e.g., `12.23`, `12.24`)
3. **Column Mapping** — Identifies common columns between the two most recent sheets
4. **Noise Filtering** — Excludes columns with >50% change rate (configurable)
5. **Signature Generation** — Creates unique signatures for each row
6. **Change Detection** — Compares signatures to find new/modified rows
7. **Highlighting** — Applies yellow highlighting to changed rows (atomic save)

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check for Electron to verify backend is ready |
| `/process-file` | POST | Process an Excel file and highlight changes |

---

## 🧪 Testing

Groobi includes comprehensive test coverage with unit and end-to-end tests.

### Run All Tests

```bash
# Run frontend unit tests with coverage
npm run test:unit

# Run backend unit tests with coverage
cd backend
pytest --cov=. --cov-report=html

# Run end-to-end tests
npx playwright test
```

### Test Coverage Goals

| Component | Target Coverage |
|-----------|-----------------|
| Python Backend | >90% line coverage |
| Frontend (renderer.js) | >95% line coverage |
| E2E Tests | Core user flows |

---

## 📦 Building for Production

### Build the Complete Application

```bash
# Build Python backend to executable
npm run build:python

# Build Electron application (includes Python backend)
npm run build

# Or build everything at once
npm run build
```

### Build Output

After building, you'll find the installer in the `dist/` directory:
- `Groobi Setup x.x.x.exe` — Windows NSIS installer

### Build Configuration

The build process is configured in:
- `electron-builder.json` — Electron packaging settings
- `backend/backend.spec` — PyInstaller bundling settings

---

## ⚙️ Configuration

### Adjustable Parameters

Edit `backend/index.py` to customize:

```python
# Columns to always ignore during comparison
IGNORED_COLUMNS = ['LOT #']

# Maximum change ratio before a column is considered "noisy"
NOISE_THRESHOLD = 0.5  # 50%
```

---

## 🔒 Security & Privacy

Groobi is designed with privacy as a core principle:

- ✅ **100% Local Processing** — All data stays on your machine
- ✅ **No Network Calls** — The application does not communicate with external servers
- ✅ **Atomic Saves** — File operations use temp files to prevent corruption
- ✅ **Git-Ignored Data** — Excel files are excluded from version control by default

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write unit tests for new features
- Maintain >90% code coverage
- Follow existing code style
- Update documentation as needed

---

## 🐛 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Backend not starting | Ensure Python is in PATH and dependencies are installed |
| "File not found" error | Check that the file path contains no special characters |
| No changes detected | Verify the Excel file has at least 2 date-formatted sheets |
| Build fails | Run `npm install` and `pip install -r requirements.txt` again |

### Logs

- Backend logs appear in the Electron console (View → Toggle Developer Tools)
- Check the terminal for Python process output during development

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 📞 Support

For issues and feature requests, please [open an issue](https://github.com/yourusername/groobi/issues) on GitHub.

---

<div align="center">
  <sub>Built with ❤️ using Electron + Python</sub>
</div>
