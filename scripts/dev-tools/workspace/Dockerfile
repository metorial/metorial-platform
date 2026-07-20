FROM node:22-bookworm

ARG TARGETARCH
ARG BUN_VERSION=1.2.15
ARG GO_VERSION=1.25.0
ARG RUST_VERSION=1.91.1
ARG AIR_VERSION=v1.65.3

ENV DEBIAN_FRONTEND=noninteractive \
    BUN_INSTALL=/opt/bun \
    CARGO_HOME=/opt/cargo \
    RUSTUP_HOME=/opt/rustup \
    GOPATH=/opt/go \
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
    && rm -rf /var/lib/apt/lists/*

RUN case "${TARGETARCH}" in \
        amd64) bun_arch="x64"; go_arch="amd64" ;; \
        arm64) bun_arch="aarch64"; go_arch="arm64" ;; \
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
        "https://go.dev/dl/go${GO_VERSION}.linux-${go_arch}.tar.gz" \
        --output /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm -rf /tmp/bun /tmp/bun.zip /tmp/go.tar.gz

RUN curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
        https://sh.rustup.rs \
        | sh -s -- -y --no-modify-path --profile minimal --default-toolchain "${RUST_VERSION}" \
    && rustup component add rustfmt clippy \
    && GOBIN=/usr/local/bin go install "github.com/air-verse/air@${AIR_VERSION}" \
    && bun --version \
    && node --version \
    && npm --version \
    && go version \
    && rustc --version \
    && air -v

COPY entrypoint.sh /usr/local/bin/workspace-entrypoint
RUN chmod 0755 /usr/local/bin/workspace-entrypoint \
    && printf '%s\n' \
        'export PATH=/opt/bun/bin:/opt/cargo/bin:/usr/local/go/bin:/opt/go/bin:$PATH' \
        >/etc/profile.d/control-toolchain.sh \
    && mkdir -p /workspace

WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/workspace-entrypoint"]
CMD ["sleep", "infinity"]
