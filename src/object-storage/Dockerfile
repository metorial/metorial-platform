# syntax=docker/dockerfile:1.7
# Docker context is the OSS monorepo root (./oss).

FROM rust:1.91-slim AS chef

RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-chef --locked --version 0.1.71

WORKDIR /app

FROM chef AS planner

COPY src/object-storage/Cargo.toml src/object-storage/Cargo.lock ./
COPY src/object-storage/object-store ./object-store
COPY src/object-storage/object-store-backends ./object-store-backends

RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder

COPY --from=planner /app/recipe.json recipe.json

RUN --mount=type=cache,target=/usr/local/cargo/registry --mount=type=cache,target=/usr/local/cargo/git \
    cargo chef cook --release --recipe-path recipe.json

COPY src/object-storage/Cargo.toml src/object-storage/Cargo.lock ./
COPY src/object-storage/object-store ./object-store
COPY src/object-storage/object-store-backends ./object-store-backends

RUN --mount=type=cache,target=/usr/local/cargo/registry --mount=type=cache,target=/usr/local/cargo/git \
    cargo build --release --bin object-store-service

FROM debian:trixie-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 appuser

WORKDIR /app

COPY --from=builder /app/target/release/object-store-service /app/object-store-service

RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

VOLUME /app/data
VOLUME /app/config

EXPOSE 8080

ENV RUST_LOG=info

CMD ["/app/object-store-service"]
