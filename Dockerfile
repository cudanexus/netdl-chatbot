FROM python:3.10-slim

# Install system runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency configuration
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Expose internal port
EXPOSE 5001

# Command to execute via gunicorn in production
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "server:app"]
