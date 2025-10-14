ARG PACKAGE_NAME=@metorial/app-dashboard
ARG PACKAGE_DIRECTORY=src/frontend/apps/dashboard

FROM oven/bun:1.2.20-debian AS bun_base

# ------------------------
# BUILDER
# ------------------------
FROM bun_base AS builder

ARG PACKAGE_NAME
ARG PACKAGE_DIRECTORY
ARG METORIAL_ENV

ENV METORIAL_ENV=production

WORKDIR /app

# Copy all necessary source directories
COPY /src/frontend ./src/frontend
COPY /src/backend ./src/backend
COPY /src/packages ./src/packages
COPY /src/mcp-engine ./src/mcp-engine
COPY /src/services ./src/services

# Copy root configuration files
COPY /package.json ./package.json
COPY /turbo.json ./turbo.json
COPY /bun.lock ./bun.lock

ENV NODE_OPTIONS=--max_old_space_size=6144

RUN bun install

RUN apt-get update && apt-get install -y ca-certificates

# Generate Prisma clients and build dependencies first
RUN bun turbo run prisma:generate --concurrency=1 --log-prefix=task

# Build the frontend application
RUN bun turbo run frontend:build --filter=${PACKAGE_NAME} --concurrency=1 --log-prefix=task

# ------------------------
# SERVER SETUP
# ------------------------
FROM bun_base AS server_setup

WORKDIR /app

# Create a simple server package.json
RUN echo '{\n\
  "name": "frontend-server",\n\
  "version": "1.0.0",\n\
  "type": "module",\n\
  "dependencies": {\n\
  "express": "^4.18.2"\n\
  }\n\
  }' > package.json

RUN bun install

# Create the server file
RUN echo 'import express from "express";\n\
  import { fileURLToPath } from "url";\n\
  import { dirname, join } from "path";\n\
  \n\
  const __filename = fileURLToPath(import.meta.url);\n\
  const __dirname = dirname(__filename);\n\
  \n\
  const app = express();\n\
  const PORT = process.env.PORT || 3300;\n\
  const distPath = join(__dirname, "dist");\n\
  \n\
  // Serve static files from dist directory\n\
  app.use(express.static(distPath));\n\
  \n\
  // Catch-all route to serve index.html for client-side routing\n\
  app.get("*", (req, res) => {\n\
  res.sendFile(join(distPath, "index.html"));\n\
  });\n\
  \n\
  app.listen(PORT, "0.0.0.0", () => {\n\
  console.log(`Frontend server running on port ${PORT}`);\n\
  });' > server.js

# ------------------------
# RUNNER
# ------------------------
FROM bun_base AS runner

WORKDIR /app

ARG PACKAGE_DIRECTORY
ARG PACKAGE_NAME

ENV NODE_ENV=production
ENV TZ=UTC
ENV PACKAGE_DIRECTORY=${PACKAGE_DIRECTORY}
ENV PACKAGE_NAME=${PACKAGE_NAME}

ENV PORT=3300
EXPOSE 3300

RUN apt-get update && apt-get install -y curl wget ca-certificates

# Copy the built frontend files from builder
COPY --from=builder "/app/${PACKAGE_DIRECTORY}/dist" ./dist

# Copy the server setup from server_setup stage
COPY --from=server_setup /app/node_modules ./node_modules
COPY --from=server_setup /app/server.js ./server.js
COPY --from=server_setup /app/package.json ./package.json

CMD ["bun", "run", "server.js"]