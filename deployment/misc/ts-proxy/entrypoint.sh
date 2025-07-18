#!/bin/sh
set -e

if [ -z "$TS_AUTHKEY" ]; then
  echo "ERROR: TS_AUTHKEY environment variable is not set."
  exit 1
fi

if [ -z "$SOURCE_ADDRESS" ]; then
  echo "ERROR: SOURCE_ADDRESS environment variable is not set."
  exit 1
fi

if [ -z "$DESTINATION_PORT" ]; then
  echo "ERROR: DESTINATION_PORT environment variable is not set."
  exit 1
fi

mkdir -p /usr/local/etc/haproxy

# Start with the base haproxy config header and frontend part (without backend servers)
cat <<EOF > /usr/local/etc/haproxy/haproxy.cfg
global
    log stdout format raw local0

defaults
    log global
    mode tcp
    option tcplog
    timeout connect 5s
    timeout client  1m
    timeout server  1m

frontend tsprxy_frontend
    bind *:${DESTINATION_PORT}
    mode tcp
    default_backend tsprxy_backend

backend tsprxy_backend
    mode tcp
EOF

# Split SOURCE_ADDRESS on comma and add each as a backend server
IFS=',' read -r -a servers <<< "$SOURCE_ADDRESS"
i=1
for server in "${servers[@]}"
do
  echo "    server tsprxy_server_$i $server check" >> /usr/local/etc/haproxy/haproxy.cfg
  i=$((i+1))
done

# Start tailscaled daemon in background
tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/var/run/tailscale/tailscaled.sock &
TS_PID=$!

# Wait a few seconds for tailscaled to start
sleep 5

tailscale up --auth-key="$TS_AUTHKEY"

# Optional: check if tailscaled is running
if ! tailscale status; then
  echo "tailscaled did not start properly"
  kill $TS_PID
  exit 1
fi

exec "$@"
