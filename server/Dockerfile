FROM node:22-bookworm-slim
WORKDIR /app

# Prisma needs openssl
RUN apt-get update -y \
 && apt-get install -y openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Install packages first (Docker caches this step if package files didn't change)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Our code
COPY tsconfig.json ./
COPY src ./src

USER node
EXPOSE 5000

# Create/update tables, then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && exec ./node_modules/.bin/tsx src/index.ts"]