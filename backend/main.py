# Fillosophy — FastAPI Backend Entry Point
"""
main.py

Entry point for the Fillosophy API server.
Configures the FastAPI app, CORS middleware, startup hooks, and routers.

Run locally:
    uvicorn main:app --reload --port 8000

Interactive docs:
    http://localhost:8000/docs   (Swagger UI)
    http://localhost:8000/redoc  (ReDoc)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.extract import router as extract_router
from routes.match import router as match_router
from database.profiles import init_db

# ─── App instance ─────────────────────────────────────────────
app = FastAPI(
    title="Fillosophy API",
    description=(
        "Backend for Fillosophy — an AI-powered Chrome Extension that reads "
        "your resume and autofills web forms intelligently."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS middleware ───────────────────────────────────────────
# Chrome extensions send requests from chrome-extension:// origins.
# allow_origins=["*"] is required for local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Startup ───────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    """Initialise the SQLite database on server start."""
    init_db()

# ─── Routers ──────────────────────────────────────────────────
app.include_router(extract_router, prefix="/extract", tags=["Extract"])
app.include_router(match_router,   prefix="/match",   tags=["Match"])


# ─── Root / health-check ──────────────────────────────────────
@app.get("/", tags=["Health"], summary="Health check")
async def root() -> dict:
    """
    Returns a simple status message confirming the backend is reachable.
    Used by the Chrome extension on startup to verify connectivity.
    """
    return {"status": "Fillosophy backend is running"}
