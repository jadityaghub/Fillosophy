"""
routes/extract.py — Fillosophy FastAPI Backend

Handles resume file uploads and text extraction.

POST /extract
    Accepts a PDF resume and a profile name, extracts all readable text
    from the PDF using pdfplumber, and returns the structured result.
"""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from utils.pdf_parser import extract_text_from_pdf

router = APIRouter()


@router.post(
    "/",
    summary="Upload a PDF resume and extract its text",
    response_description="Parsed text and metadata from the uploaded resume",
)
async def extract_resume(
    file: UploadFile = File(..., description="Resume PDF file"),
    profile_name: str = Form(..., description="Label for this profile, e.g. 'Academic'"),
) -> dict:
    """
    Accepts a multipart PDF upload and a profile name, extracts all readable
    text from the document, and returns a structured JSON response.

    Args:
        file:         The uploaded resume — must be a PDF.
        profile_name: Human-readable label to store this profile under.

    Returns:
        dict containing:
            status       — "parsed"
            profile_name — echoed label
            char_count   — total characters in the extracted text
            preview      — first 300 characters of the extracted text
            raw_text     — full extracted text string

    Raises:
        HTTP 400: File is not a PDF.
        HTTP 422: PDF contains no extractable text (e.g. scanned image).
        HTTP 500: Unexpected error during parsing.
    """
    # ── Step 1: log receipt ───────────────────────────────────
    print(f"[Fillosophy /extract] Received: {file.filename}, profile: {profile_name}")

    # ── Step 2: validate PDF ──────────────────────────────────
    is_pdf_mime     = (file.content_type or "").lower() == "application/pdf"
    is_pdf_filename = (file.filename or "").lower().endswith(".pdf")

    if not (is_pdf_mime or is_pdf_filename):
        print(
            f"[Fillosophy /extract] Rejected — not a PDF: "
            f"content_type={file.content_type!r}, filename={file.filename!r}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted.",
        )

    # ── Step 3: read bytes ────────────────────────────────────
    print(f"[Fillosophy /extract] Reading file bytes …")
    contents = await file.read()
    print(f"[Fillosophy /extract] Read {len(contents):,} bytes from '{file.filename}'")

    # ── Step 4 & 5: extract text, handle empty PDF ────────────
    try:
        print(f"[Fillosophy /extract] Running PDF text extraction …")
        extracted_text = extract_text_from_pdf(contents)

    except ValueError as exc:
        # No readable text found (scanned image, empty pages, etc.)
        print(f"[Fillosophy /extract] Extraction failed (no text): {exc}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    except Exception as exc:
        # Unexpected error (corrupt PDF, pdfplumber crash, etc.)
        print(f"[Fillosophy /extract] Unexpected error during extraction: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while parsing the PDF: {exc}",
        )

    # ── Step 6: return structured result ─────────────────────
    char_count = len(extracted_text)
    print(
        f"[Fillosophy /extract] Success — profile: '{profile_name}', "
        f"chars: {char_count:,}"
    )

    return {
        "status":       "parsed",
        "profile_name": profile_name,
        "char_count":   char_count,
        "preview":      extracted_text[:300],
        "raw_text":     extracted_text,
    }
