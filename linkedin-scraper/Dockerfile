# ──────────────────────────────────────────────────────────────────────────────
# Railway deployment config for the LinkedIn scraper service
#
# Deploy: connect your GitHub repo at railway.app and select this Dockerfile.
# Set the environment variables below in the Railway "Variables" panel.
# ──────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# Install system deps for Playwright / Chromium
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxcb1 libxkbcommon0 libx11-6 libxcomposite1 libxdamage1 \
    libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m playwright install --with-deps chromium

COPY . .

# Default: run the scheduler (every 6 h loop)
# Override with CMD ["python", "main.py", "--once"] for one-shot cron runs
CMD ["python", "main.py"]
