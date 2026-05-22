# Build stage
FROM rust:1.91-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/src/systems/object-storage/service

COPY src/systems/object-storage/service/Cargo.toml src/systems/object-storage/service/Cargo.lock ./
COPY src/systems/object-storage/service/object-store/Cargo.toml ./object-store/
COPY src/systems/object-storage/service/object-store-backends/Cargo.toml ./object-store-backends/

RUN mkdir -p object-store/src object-store-backends/src && \
    echo "fn main() {}" > object-store/src/main.rs && \
    echo "pub fn dummy() {}" > object-store/src/lib.rs && \
    echo "pub fn dummy() {}" > object-store-backends/src/lib.rs && \
    cargo build --release && \
    rm -rf object-store/src object-store-backends/src

COPY src/systems/object-storage/service/object-store ./object-store
COPY src/systems/object-storage/service/object-store-backends ./object-store-backends

RUN rm -rf target/release/object-store-service target/release/deps/object_store_service* target/release/.fingerprint/object-store-* && \
    cargo build --release --bin object-store-service

FROM builder AS workspace

WORKDIR /app/src/systems/object-storage/service
CMD ["sleep", "infinity"]

# Production stage
FROM debian:trixie-slim AS runner

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 appuser

WORKDIR /app

COPY --from=builder /app/src/systems/object-storage/service/target/release/object-store-service /app/object-store-service

RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

EXPOSE 52010

ENV RUST_LOG=info
ENV OBJECT_STORE_BACKEND_TYPE=local
ENV OBJECT_STORE_BACKEND_ROOT_PATH=/app/data

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:52010/health || exit 1

CMD ["/app/object-store-service"]
