FROM node:20-bookworm-slim

# Install system dependencies: ffmpeg, python3, curl, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Copy application code
COPY . .

# Ensure storage directories exist
RUN mkdir -p /app/session /app/data /app/backups

EXPOSE 8080

CMD ["node", "index.js"]
