FROM node:22-bookworm-slim AS node

FROM oven/bun:1.4.2

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
    ca-certificates \
    curl \
    g++ \
    git \
    make \
    postgresql-client \
    procps \
    python3 \
    rsync \
    socat \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version \
    && bun --version \
    && git config --global --add safe.directory '*'

COPY entrypoint.sh /usr/local/bin/control-e2e
RUN chmod 0755 /usr/local/bin/control-e2e

WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/control-e2e"]
CMD ["run", "/e2e/plan.json"]
