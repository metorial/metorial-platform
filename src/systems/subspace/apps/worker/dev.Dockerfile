FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Copy package.json files preserving directory structure
COPY apps/controller/package.json ./apps/controller/package.json
COPY apps/dev/package.json ./apps/dev/package.json
COPY apps/public/package.json ./apps/public/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY clients/slates/package.json ./clients/slates/package.json
COPY clients/shuttle/package.json ./clients/shuttle/package.json

COPY db/package.json ./db/package.json

COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY packages/conduit/package.json ./packages/conduit/package.json
COPY packages/connection-utils/package.json ./packages/connection-utils/package.json
COPY packages/list-utils/package.json ./packages/list-utils/package.json
COPY packages/presenters/package.json ./packages/presenters/package.json
COPY packages/redis-url/package.json ./packages/redis-url/package.json
COPY packages/retry-utils/package.json ./packages/retry-utils/package.json
COPY packages/store/package.json ./packages/store/package.json
COPY packages/generator/package.json ./packages/generator/package.json

COPY provider-backends/provider-slates/package.json ./provider-backends/provider-slates/package.json
COPY provider-backends/provider-shuttle/package.json ./provider-backends/provider-shuttle/package.json
COPY provider-backends/provider-native/package.json ./provider-backends/provider-native/package.json
COPY provider-backends/provider-utils/package.json ./provider-backends/provider-utils/package.json
COPY provider-backends/provider-manager/package.json ./provider-backends/provider-manager/package.json

COPY modules/agent/package.json ./modules/agent/package.json
COPY modules/auth/package.json ./modules/auth/package.json
COPY modules/catalog/package.json ./modules/catalog/package.json
COPY modules/connection/package.json ./modules/connection/package.json
COPY modules/deployment/package.json ./modules/deployment/package.json
COPY modules/identity/package.json ./modules/identity/package.json
COPY modules/provider-internal/package.json ./modules/provider-internal/package.json
COPY modules/custom-provider/package.json ./modules/custom-provider/package.json
COPY modules/search/package.json ./modules/search/package.json
COPY modules/session/package.json ./modules/session/package.json
COPY modules/tenant/package.json ./modules/tenant/package.json
COPY modules/callback/package.json ./modules/callback/package.json

RUN bun install

COPY . .

# In case we forgot to copy some package.json files
RUN bun install 

# Run in dev mode with hot reloading.
# `subspace-controller` performs schema/client initialization before this service starts.
CMD ["sh", "-c", "cd /app/apps/worker && bun start:dev"]