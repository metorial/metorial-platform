#!/bin/bash

set -euo pipefail

NETWORK_NAME="mt-untrusted-net"
SUBNET="172.25.0.0/16"
GATEWAY="172.25.0.1"

# IPv4 ranges
BLOCKED_RANGES_V4=(
  "10.0.0.0/8"
  "172.16.0.0/12"
  "192.168.0.0/16"
  "100.64.0.0/10"
  "169.254.0.0/16"
  "127.0.0.0/8"
)

# Check if Docker network already exists
if docker network inspect "$NETWORK_NAME" &> /dev/null; then
  echo "Docker network '$NETWORK_NAME' already exists. Aborting."
  exit 1
fi

echo "[+] Creating Docker network '$NETWORK_NAME'..."
docker network create \
  --subnet="$SUBNET" \
  --gateway="$GATEWAY" \
  --ipv6=false \
  "$NETWORK_NAME"

# Check for root
if [[ "$EUID" -ne 0 ]]; then
  echo ""
  echo "WARNING: UNABLE TO APPLY IPTABLES RULES WITHOUT ROOT PRIVILEGES."
  echo "The network was created, but has not been secured with iptables rules."
  echo "Please run this script with 'sudo' to apply the necessary firewall rules."
  exit 0
fi

echo "[+] Applying iptables rules..."

# Accept all traffic from subnet to external IPs
iptables -C FORWARD -s "$SUBNET" -d 0.0.0.0/0 -j ACCEPT 2>/dev/null || \
iptables -A FORWARD -s "$SUBNET" -d 0.0.0.0/0 -j ACCEPT

for RANGE in "${BLOCKED_RANGES_V4[@]}"; do
  iptables -C FORWARD -s "$SUBNET" -d "$RANGE" -j DROP 2>/dev/null || \
  iptables -A FORWARD -s "$SUBNET" -d "$RANGE" -j DROP
done

echo "[+] Network and firewall configuration completed successfully."
