import { defineSettings, setting } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

let ingestSettings = defineSettings('ingest', {
  trustedProxyHops: setting(v.number({ modifiers: [v.integer()] }), {
    env: 'AGENT_TRACKING_TRUSTED_PROXY_HOPS',
    audience: 'deployment',
    default: 1,
    description:
      'Proxies in front of the ingest server that append to X-Forwarded-For; the client IP is the entry this many hops from the right (0 uses the socket address).'
  })
});

export let env = {
  ingest: ingestSettings
};
