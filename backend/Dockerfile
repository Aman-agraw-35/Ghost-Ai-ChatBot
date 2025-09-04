FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies:
# 1) install anything listed in requirements.txt
# 2) then install additional packages separately (as you requested)
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir \
        langchain \
        langchain-core \
        langchain-community \
        langgraph \
        langchain-google-genai \
        tavily-python \
        fastapi \
        "uvicorn[standard]" \
        python-dotenv \
        starlette \
        sqlalchemy

# Copy application code
COPY . .

# Expose port (documentation / readability)
EXPOSE 8000

# Command to run the application
# - uses PORT env var if present, otherwise 8000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
