#!/bin/sh

if [ -n "$API_DOPPLER_TOKEN" ]; then
  export DOPPLER_TOKEN="$API_DOPPLER_TOKEN"
else
  export DOPPLER_TOKEN="$(cat /run/secrets/api_doppler_token)"
fi

exec "$@"
