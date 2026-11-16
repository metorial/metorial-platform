FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends iptables iproute2 openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /harness
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund --loglevel=error

COPY harness.mjs case.cjs ./

ENTRYPOINT ["node", "/harness/harness.mjs"]
