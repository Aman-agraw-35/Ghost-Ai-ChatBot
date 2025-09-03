FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir \
        langchain \
        langchain-core \
        langchain-community \
        langgraph \
        langchain-google-genai \
        tavily-python \
        fastapi \
        uvicorn[standard] \
        python-dotenv \
        starlette

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
