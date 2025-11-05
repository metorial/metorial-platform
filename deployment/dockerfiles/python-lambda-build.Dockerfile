FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    zip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI
RUN pip install --no-cache-dir awscli

# Create working directory
WORKDIR /build

# Copy build script
COPY oss/deployment/dockerfiles/scripts/python-lambda-build.sh /build.sh
RUN chmod +x /build.sh

# Set entrypoint
ENTRYPOINT ["/build.sh"]