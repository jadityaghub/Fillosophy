# Fillosophy API Reference

This document outlines the REST API endpoints exposed by the Fillosophy FastAPI backend, used by the Chrome extension to extract resumes, match fields, and manage profiles.

---

## POST `/extract`
Parses an uploaded PDF resume and returns a structured JSON profile containing the extracted information.

**Request:**
- **Content-Type**: `multipart/form-data`
- **Body**: 
  - `file`: The resume PDF file (bytes).
  - `profile_name`: String (default: "personal"). The name to save the profile under.

**Response (200 OK):**
```json
{
  "status": "success",
  "profile_name": "personal",
  "profile": {
    "full_name": "Aditya Jain",
    "email": "aditya@example.com",
    "phone": "+91-9999999999",
    "degree": "B.Tech Computer Science",
    "cgpa": 9.2,
    "skills": ["Python", "FastAPI", "React", "SQL"]
  }
}
```

**Errors:**
- `400 Bad Request`: If the uploaded file is not a PDF or is empty.
- `422 Unprocessable Entity`: If `file` or `profile_name` is missing from the form data.
- `500 Internal Server Error`: If PDF parsing fails (e.g., corrupted file, no extractable text).
- `502 Bad Gateway`: If the AI profile extraction fails or returns malformed JSON.

---

## POST `/match`
Matches form fields detected on a web page to the active profile data using AI, returning confidence scores for each mapped field.

**Request:**
- **Content-Type**: `application/json`
- **Body**:
```json
{
  "profile_name": "personal",
  "profile": {
    "full_name": "Aditya Jain",
    "email": "aditya@example.com",
    "degree": "B.Tech Computer Science",
    "cgpa": 9.2,
    "skills": ["Python", "FastAPI"]
  },
  "fields": [
    "Full Name",
    "Email Address",
    "Percentage/CGPA",
    "Graduation Course"
  ]
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "total_fields": 4,
  "high_confidence": 3,
  "needs_review": 1,
  "mapping": {
    "Full Name": { "value": "Aditya Jain", "confidence": 98 },
    "Email Address": { "value": "aditya@example.com", "confidence": 95 },
    "Percentage/CGPA": { "value": 9.2, "confidence": 95 },
    "Graduation Course": { "value": "B.Tech Computer Science", "confidence": 65, "low_confidence": true }
  }
}
```

**Errors:**
- `400 Bad Request`: If the fields list or profile is empty.
- `422 Unprocessable Entity`: If the request JSON does not conform to the schema.
- `502 Bad Gateway`: If the AI matching call fails.

---

## POST `/profiles/import`
Directly imports and saves a JSON profile to the database (used when restoring a backed-up profile from the extension).

**Request:**
- **Content-Type**: `application/json`
- **Body**:
```json
{
  "profile_name": "academic",
  "profile_data": {
    "full_name": "Aditya Jain",
    "degree": "B.Tech"
  }
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "profile_name": "academic",
  "message": "Profile imported and saved"
}
```

**Errors:**
- `422 Unprocessable Entity`: Schema validation failure.
- `500 Internal Server Error`: Database insertion failure.

---

## GET `/profiles/list`
Lists the names of all saved profiles available on the backend server.

**Request:**
- No parameters.

**Response (200 OK):**
```json
{
  "status": "success",
  "count": 2,
  "profiles": [
    "personal",
    "academic"
  ]
}
```

**Errors:**
- `500 Internal Server Error`: Database retrieval failure.

---

## GET `/profiles/{name}`
Retrieves the complete structured data for a specific profile by its name.

**Request:**
- **Path Parameter**: `name` (string) - the identifier of the profile to fetch.

**Response (200 OK):**
```json
{
  "status": "success",
  "profile_name": "personal",
  "profile": {
    "full_name": "Aditya Jain",
    "email": "aditya@example.com"
  }
}
```

**Errors:**
- `404 Not Found`: If no profile with the specified name exists.
- `500 Internal Server Error`: Database connection failure.

---

## DELETE `/profiles/{name}`
Deletes a specific profile from the backend database.

**Request:**
- **Path Parameter**: `name` (string) - the identifier of the profile to delete.

**Response (200 OK):**
```json
{
  "status": "success",
  "profile_name": "personal",
  "message": "Profile personal deleted"
}
```

**Errors:**
- `404 Not Found`: If the profile does not exist.
- `500 Internal Server Error`: Database deletion failure.
