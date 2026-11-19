# syntax=docker/dockerfile:1.7
# Docker context is the OSS monorepo root (./oss).

FROM rust:1.91.1-slim AS chef

RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-chef --locked --version 0.1.71 && cargo install cargo-auditable --locked --version 0.7.7

WORKDIR /app/src/platform/services/object-storage

FROM chef AS planner

COPY src/lib/doctor/rust /app/src/lib/doctor/rust
COPY src/platform/services/object-storage/Cargo.toml src/platform/services/object-storage/Cargo.lock ./
COPY src/platform/services/object-storage/object-store ./object-store
COPY src/platform/services/object-storage/object-store-backends ./object-store-backends

RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder

COPY src/lib/doctor/rust /app/src/lib/doctor/rust
COPY --from=planner /app/src/platform/services/object-storage/recipe.json recipe.json

RUN --mount=type=cache,target=/usr/local/cargo/registry --mount=type=cache,target=/usr/local/cargo/git \
    cargo chef cook --release --recipe-path recipe.json

COPY src/platform/services/object-storage/Cargo.toml src/platform/services/object-storage/Cargo.lock ./
COPY src/platform/services/object-storage/object-store ./object-store
COPY src/platform/services/object-storage/object-store-backends ./object-store-backends

RUN --mount=type=cache,target=/usr/local/cargo/registry --mount=type=cache,target=/usr/local/cargo/git \
    cargo auditable build --release --bin object-store-service

FROM debian:trixie-slim AS runner

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 curl \
    && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 10001 appuser && useradd -m --uid 10001 --gid appuser appuser

WORKDIR /app

COPY --from=builder /app/src/platform/services/object-storage/target/release/object-store-service /app/object-store-service

RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER 10001:10001

VOLUME /app/data
VOLUME /app/config

EXPOSE 8080
EXPOSE 8081
EXPOSE 12121

ENV RUST_LOG=info

CMD ["/app/object-store-service"]
