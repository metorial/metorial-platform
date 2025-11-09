# --------- Builder stage ---------
FROM golang:1.24-bookworm AS builder

WORKDIR /app

RUN apt update && apt install -y make git curl unzip wget
RUN apt install -y ca-certificates curl
RUN update-ca-certificates

COPY ./src/services /app/src/services
COPY ./src/modules /app/src/modules
COPY ./src/mcp-engine /app/src/mcp-engine
COPY ./go.work /app/go.work
COPY ./go.work.sum /app/go.work.sum

WORKDIR /app/src/services/python-runner

RUN go mod download

RUN go build -o bin/python-runner cmd/main.go

# --------- Runner stage ---------
FROM debian:bookworm-slim

WORKDIR /app

# Install Python and essential build tools for compiling packages
RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
  python3-venv \
  python3-dev \
  build-essential \
  gcc \
  g++ \
  make \
  curl \
  ca-certificates \
  git \
  # Additional libraries commonly needed by Python packages
  libssl-dev \
  libffi-dev \
  libpq-dev \
  libjpeg-dev \
  libpng-dev \
  libxml2-dev \
  libxslt1-dev \
  zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

# Install uv for fast Python package management
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:${PATH}"

# Copy built binary
COPY --from=builder /app/src/services/python-runner/bin/python-runner .

RUN useradd -m -u 1001 mt-user

# Create deployments directory with proper permissions
RUN mkdir -p /app/deployments && chown -R mt-user:mt-user /app/deployments

# Copy uv to user-accessible location
RUN cp /root/.cargo/bin/uv /usr/local/bin/uv && chmod +x /usr/local/bin/uv

USER mt-user

EXPOSE 52001

ENV PORT=52001
ENV DEPLOY_DIR=/app/deployments

CMD ["./python-runner"]