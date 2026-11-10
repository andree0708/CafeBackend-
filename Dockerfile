FROM node:20-alpine

# Prisma auto-detects the OpenSSL version via the openssl CLI. Without it,
# detection fails and the schema engine binary cannot start on Alpine/musl.
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY package*.json ./
RUN npm ci

# Generate the Prisma client for the container platform.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Keep a copy of the schema outside the volume that persists SQLite data.
RUN cp prisma/schema.prisma /app/schema.prisma.bak

ENV NODE_ENV=production
EXPOSE 3000

# Restore the schema (the volume hides it), create/update tables and start.
CMD ["sh", "-c", "cp /app/schema.prisma.bak /app/prisma/schema.prisma && npx prisma db push --skip-generate && if [ \"$SEED_ON_START\" = \"true\" ]; then npm run db:seed; fi && node src/index.js"]
