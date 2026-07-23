FROM ubuntu:24.04

ARG TARGETARCH
ARG BUN_VERSION=1.2.15
ARG NODE_VERSION=22.17.0
ARG GO_VERSION=1.25.0
ARG RUST_VERSION=1.91.1
ARG AIR_VERSION=v1.65.3

ENV DEBIAN_FRONTEND=noninteractive \
    BUN_INSTALL=/opt/bun \
    CARGO_HOME=/opt/cargo \
    RUSTUP_HOME=/opt/rustup \
    GOPATH=/opt/go \
    SHELL=/bin/zsh \
    PATH=/opt/bun/bin:/opt/cargo/bin:/usr/local/go/bin:/opt/go/bin:${PATH}

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
    bash \
    build-essential \
    ca-certificates \
    clang \
    cmake \
    curl \
    git \
    iproute2 \
    jq \
    libclang-dev \
    libpq-dev \
    libssl-dev \
    lld \
    make \
    netcat-openbsd \
    openssh-client \
    pkg-config \
    postgresql-client \
    procps \
    protobuf-compiler \
    python3 \
    socat \
    unzip \
    xz-utils \
    zsh \
    && rm -rf /var/lib/apt/lists/*

RUN case "${TARGETARCH}" in \
    amd64) bun_arch="x64"; node_arch="x64"; go_arch="amd64" ;; \
    arm64) bun_arch="aarch64"; node_arch="arm64"; go_arch="arm64" ;; \
    *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl --fail --location --retry 3 \
    "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-${bun_arch}.zip" \
    --output /tmp/bun.zip \
    && unzip -q /tmp/bun.zip -d /tmp/bun \
    && mkdir -p "${BUN_INSTALL}/bin" \
    && install -m 0755 "/tmp/bun/bun-linux-${bun_arch}/bun" "${BUN_INSTALL}/bin/bun" \
    && ln -s "${BUN_INSTALL}/bin/bun" "${BUN_INSTALL}/bin/bunx" \
    && curl --fail --location --retry 3 \
    "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" \
    --output /tmp/node.tar.xz \
    && tar -C /usr/local --strip-components=1 -xJf /tmp/node.tar.xz \
    && curl --fail --location --retry 3 \
    "https://go.dev/dl/go${GO_VERSION}.linux-${go_arch}.tar.gz" \
    --output /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm -rf /tmp/bun /tmp/bun.zip /tmp/node.tar.xz /tmp/go.tar.gz

RUN curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
    https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path --profile minimal --default-toolchain "${RUST_VERSION}" \
    && rustup component add rustfmt clippy \
    && GOBIN=/usr/local/bin go install "github.com/air-verse/air@${AIR_VERSION}" \
    && npm install --global "total-control@latest" \
    && bun --version \
    && node --version \
    && npm --version \
    && command -v control \
    && go version \
    && rustc --version \
    && zsh --version \
    && air -v

COPY entrypoint.sh /usr/local/bin/workspace-entrypoint
RUN chmod 0755 /usr/local/bin/workspace-entrypoint \
    && printf '%s\n' \
    'export PATH=/opt/bun/bin:/opt/cargo/bin:/usr/local/go/bin:/opt/go/bin:$PATH' \
    >/etc/profile.d/control-toolchain.sh \
    && printf '%s\n' \
    'source /etc/profile.d/control-toolchain.sh' \
    'autoload -Uz compinit && compinit' \
    >/root/.zshrc \
    && mkdir -p /workspace /control-state /root/.vscode-server

WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/workspace-entrypoint"]
CMD ["sleep", "infinity"]
