FROM node:20-slim

# Install dependencies for Puppeteer/Baileys
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/whatsapp-blast/package.json ./artifacts/whatsapp-blast/
COPY lib/db/package.json ./lib/db/
COPY lib/api-client-react/package.json ./lib/api-client-react/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build libraries and apps
RUN pnpm run build

EXPOSE 3000

# Start script will be handled by docker-compose
CMD ["pnpm", "start"]
