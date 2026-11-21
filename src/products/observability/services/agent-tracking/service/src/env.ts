import { defineSettings, setting } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

let agentTrackingRoles = ['ingest', 'api', 'worker'] as const;

export type AgentTrackingRole = (typeof agentTrackingRoles)[number];

let listenerSettings = defineSettings('listeners', {
  apiPort: setting(v.number({ modifiers: [v.integer()] }), {
    env: 'AGENT_TRACKING_API_PORT',
    audience: 'deployment',
    default: 52180,
    description: 'Port of the internal RPC listener (api role).'
  }),

  ingestPort: setting(v.number({ modifiers: [v.integer()] }), {
    env: 'AGENT_TRACKING_INGEST_PORT',
    audience: 'deployment',
    default: 52181,
    description: 'Port of the ingest listener (ingest role).'
  })
});

let processSettings = defineSettings('process', {
  roles: setting.list(v.enumOf(agentTrackingRoles), {
    env: 'AGENT_TRACKING_ROLES',
    audience: 'deployment',
    default: [...agentTrackingRoles],
    description:
      'Comma-separated roles this process runs: ingest (the ingest listener), api (the internal RPC listener), worker (queues, crons and startup jobs). Defaults to all three in one process; production runs one role per service.'
  })
});

let recordStoreSettings = defineSettings('recordStore', {
  host: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_MONGO_HOST',
    audience: 'deployment',
    description:
      'DocumentDB host. When set and AGENT_TRACKING_MONGO_URL is not, the record store URL is assembled from the AGENT_TRACKING_MONGO_* parts.'
  }),

  port: setting(v.number({ modifiers: [v.integer()] }), {
    env: 'AGENT_TRACKING_MONGO_PORT',
    audience: 'deployment',
    default: 27017,
    description: 'DocumentDB port.'
  }),

  username: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_MONGO_USERNAME',
    audience: 'deployment',
    secret: true,
    description: 'DocumentDB user.'
  }),

  password: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_MONGO_PASSWORD',
    audience: 'deployment',
    secret: true,
    description: 'DocumentDB password.'
  }),

  database: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_MONGO_DATABASE_NAME',
    audience: 'deployment',
    description: 'Database that holds the records, sessions and usage slices.'
  }),

  tlsCaFile: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_MONGO_TLS_CA_FILE',
    audience: 'deployment',
    description:
      'Path to the CA bundle that verifies the DocumentDB certificate. Without it the connection is encrypted but the certificate is not verified, as for the other DocumentDB and Postgres connections.'
  })
});

export let env = {
  listeners: listenerSettings,
  process: processSettings,
  recordStore: recordStoreSettings
};
