FROM debian:bookworm-slim

# Install haproxy and bash (for scripting)
RUN apt-get update && apt-get install -y --no-install-recommends haproxy bash curl ca-certificates
RUN update-ca-certificates
RUN curl -fsSL https://tailscale.com/install.sh | sh

RUN rm -rf /var/lib/apt/lists/*

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["bash", "/usr/local/bin/entrypoint.sh"]

CMD ["haproxy", "-f", "/usr/local/etc/haproxy/haproxy.cfg"]
