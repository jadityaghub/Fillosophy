# Fillosophy

> AI-powered resume-based smart form autofill — Chrome Extension + FastAPI backend.

---

## Project Structure

```
Fillosophy/
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── content/
│   │   └── content.js
│   ├── background/
│   │   └── service_worker.js
│   ├── utils/
│   │   └── storage.js
│   └── icons/                  # Add icon16.png, icon48.png, icon128.png
│
└── backend/                    # Python FastAPI backend
    ├── main.py
    ├── requirements.txt
    ├── routes/
    │   ├── extract.py          # POST /extract — resume upload & parsing
    │   └── match.py            # POST /match  — field-to-profile matching
    ├── utils/
    │   ├── pdf_parser.py       # PDF / DOCX text extraction
    │   └── ai_client.py        # LLM integration (extraction + matching)
    └── database/
        └── profiles.py         # Profile persistence layer
```

---

## Getting Started

### Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Add your icons to `extension/icons/` (16×16, 48×48, 128×128 px PNGs)

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env             # then fill in your AI API key

# Run the dev server
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

## Environment Variables

| Variable                | Description                          | Default         |
|-------------------------|--------------------------------------|-----------------|
| `FILLOSOPHY_AI_MODEL`   | LLM model identifier                 | `gpt-4o-mini`   |
| `OPENAI_API_KEY`        | OpenAI API key (if using OpenAI)     | —               |
| `ANTHROPIC_API_KEY`     | Anthropic API key (if using Claude)  | —               |
| `GEMINI_API_KEY`        | Google Gemini API key                | —               |

---

## API Endpoints

| Method | Path       | Description                              |
|--------|------------|------------------------------------------|
| GET    | `/`        | Health check                             |
| POST   | `/extract` | Upload resume → returns structured profile |
| POST   | `/match`   | Match form fields → returns fill values  |

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Extension  | Chrome MV3, Vanilla JS, CSS       |
| Backend    | Python 3.12+, FastAPI, Uvicorn    |
| Parsing    | pdfplumber, python-docx           |
| AI         | OpenAI / Anthropic / Gemini (TBD) |
| Storage    | chrome.storage.local (ext), In-memory → DB (backend) |
