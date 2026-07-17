# Fillosophy Backend — Production Dockerfile
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Copy dependency files
COPY requirements.txt /app/

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY . /app/

# Create directory for persistent SQLite data
RUN mkdir -p /data

# Crucial redirect: Run from /data so SQLite database (fillosophy.db) is 
# created on the persistent volume, and add /app to PYTHONPATH so python
# can find our app code.
WORKDIR /data
ENV PYTHONPATH=/app

# Default port
ENV PORT=8000
EXPOSE 8000

# Start FastAPI backend with dynamic port assignment for Render/Railway compatibility
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
