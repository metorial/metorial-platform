FROM oven/bun:1

WORKDIR /app

# Copy package files from the OSS workspace root
COPY package.json bun.lock* ./
COPY src/systems/subspace/package.json ./package.json
COPY src/systems/subspace/bun.lock ./bun.lock

# Copy package.json files preserving the Subspace workspace layout
COPY src/systems/subspace/apps/controller/package.json ./apps/controller/package.json
COPY src/systems/subspace/apps/dev/package.json ./apps/dev/package.json
COPY src/systems/subspace/apps/public/package.json ./apps/public/package.json
COPY src/systems/subspace/apps/worker/package.json ./apps/worker/package.json

COPY src/systems/subspace/db/package.json ./db/package.json

COPY src/systems/subspace/packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY src/systems/subspace/packages/conduit/package.json ./packages/conduit/package.json
COPY src/systems/subspace/packages/connection-utils/package.json ./packages/connection-utils/package.json
COPY src/systems/subspace/packages/list-utils/package.json ./packages/list-utils/package.json
COPY src/systems/subspace/packages/presenters/package.json ./packages/presenters/package.json
COPY src/systems/subspace/packages/redis-url/package.json ./packages/redis-url/package.json
COPY src/systems/subspace/packages/retry-utils/package.json ./packages/retry-utils/package.json
COPY src/systems/subspace/packages/store/package.json ./packages/store/package.json
COPY src/systems/subspace/packages/generator/package.json ./packages/generator/package.json

COPY src/systems/subspace/provider-backends/provider-slates/package.json ./provider-backends/provider-slates/package.json
COPY src/systems/subspace/provider-backends/provider-shuttle/package.json ./provider-backends/provider-shuttle/package.json
COPY src/systems/subspace/provider-backends/provider-native/package.json ./provider-backends/provider-native/package.json
COPY src/systems/subspace/provider-backends/provider-utils/package.json ./provider-backends/provider-utils/package.json
COPY src/systems/subspace/provider-backends/provider-manager/package.json ./provider-backends/provider-manager/package.json

COPY src/systems/subspace/modules/agent/package.json ./modules/agent/package.json
COPY src/systems/subspace/modules/auth/package.json ./modules/auth/package.json
COPY src/systems/subspace/modules/catalog/package.json ./modules/catalog/package.json
COPY src/systems/subspace/modules/connection/package.json ./modules/connection/package.json
COPY src/systems/subspace/modules/deployment/package.json ./modules/deployment/package.json
COPY src/systems/subspace/modules/identity/package.json ./modules/identity/package.json
COPY src/systems/subspace/modules/provider-internal/package.json ./modules/provider-internal/package.json
COPY src/systems/subspace/modules/custom-provider/package.json ./modules/custom-provider/package.json
COPY src/systems/subspace/modules/search/package.json ./modules/search/package.json
COPY src/systems/subspace/modules/session/package.json ./modules/session/package.json
COPY src/systems/subspace/modules/tenant/package.json ./modules/tenant/package.json
COPY src/systems/subspace/modules/callback/package.json ./modules/callback/package.json

COPY src/systems/_clients/slates/package.json ./clients/slates/package.json
COPY src/systems/_clients/shuttle/package.json ./clients/shuttle/package.json

RUN bun install

COPY src/systems/subspace/. .
COPY src/systems/_clients/slates ./clients/slates
COPY src/systems/_clients/shuttle ./clients/shuttle

RUN bun install

# Run in dev mode with hot reloading.
# `subspace-controller` performs schema/client initialization before this service starts.
CMD ["sh", "-c", "cd /app/apps/worker && bun start:dev"]
