import { HOSTNAME, METORIAL_SOURCE } from '../const';
import type { Env } from './type';

let DB_PREFIX = `metorial-${METORIAL_SOURCE}`;

export let backendEnv: Env = [
  { key: 'EMAIL_SES_ACCESS_KEY_ID', isRequired: false },
  { key: 'EMAIL_SES_SECRET_ACCESS_KEY', isRequired: false },
  { key: 'EMAIL_SES_REGION', isRequired: false },

  { key: 'EMAIL_FROM' },
  { key: 'EMAIL_FROM_NAME' },

  {
    key: 'CONSUMER_TOKEN_SECRET',
    defaultValue: 'consumer-token-secret'
  },
  {
    key: 'CONSUMER_SESSION_SECRET',
    defaultValue: 'consumer-token-secret'
  },

  {
    key: 'SIGNED_DOWNLOAD_URL_TOKEN_SECRET',
    defaultValue: 'dev-cargo-download-token-secret'
  },
  {
    key: 'CARGO_REGION',
    defaultValue: 'dev'
  },
  {
    key: 'DOWNLOAD_PUBLIC_URL',
    defaultValue: `http://${HOSTNAME}:4318`
  },

  {
    key: 'PORTAL_HOST_TEMPLATE',
    defaultValue: 'http://localhost:4304/{portalId}'
  },
  {
    key: 'PORTAL_REDIRECT_DOMAINS',
    defaultValue: 'localhost'
  },

  {
    key: 'DATABASE_URL',
    defaultValue: `postgres://postgres:postgres@localhost:35432/${DB_PREFIX}`
  },
  {
    key: 'SUBSPACE_DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/subspace'
  },
  {
    key: 'CARGO_DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/cargo'
  },
  {
    key: 'CARGO_SYNC_CLAIM_METORIAL_OWNERSHIP',
    defaultValue: 'false'
  },
  {
    key: 'PAYMENT_DATABASE_URL',
    defaultValue: `postgres://postgres:postgres@localhost:35432/${DB_PREFIX}-payment`,
    isEnterprise: true
  },
  {
    key: 'FEDERATION_CORE_DATABASE_URL',
    defaultValue: `postgres://postgres:postgres@localhost:35432/${DB_PREFIX}-federation`,
    isEnterprise: true
  },
  {
    key: 'GLOBAL_DATABASE_URL',
    defaultValue: `postgres://postgres:postgres@localhost:35432/${DB_PREFIX}-global`
  },

  {
    key: 'REDIS_URL',
    defaultValue: `redis://localhost:36379/0`
  },
  {
    key: 'USAGE_MONGO_URL',
    defaultValue: `mongodb://mongo:mongo@localhost:32707/metorial-usage?authSource=admin`,
    isEnterprise: true
  },

  {
    key: 'CARGO_API_URL',
    defaultValue: 'http://localhost:52150/metorial-cargo'
  },
  {
    key: 'SYNTHESIS_API_URL',
    defaultValue: 'http://localhost:52160/metorial-synthesis'
  },

  { key: 'PROVIDER_OAUTH_TICKET_SECRET', defaultValue: `provider-oauth-ticket-secret` },

  { key: 'AUTH_TICKET_SECRET', defaultValue: `auth-ticket-secret` },

  { key: 'ENCRYPTION_SECRET', defaultValue: `encryption-secret` },

  { key: 'OBJECT_STORAGE_URL', defaultValue: 'http://services:52010' },
  { key: 'FILES_BUCKET_NAME', defaultValue: 'mte-files' },

  {
    key: 'USAGE_MONGO_URI',
    defaultValue: 'mongodb://mongo:mongo@localhost:32707/?authSource=admin'
  },

  {
    key: 'API_URL',
    defaultValue: `http://${HOSTNAME}:4310`
  },
  {
    key: 'FILES_URL',
    defaultValue: `http://${HOSTNAME}:4318`
  },
  { key: 'APP_URL', defaultValue: `http://${HOSTNAME}:4300` },
  { key: 'BILLING_API_URL', defaultValue: `http://${HOSTNAME}:4320`, isEnterprise: true },
  { key: 'FEDERATION_API_HOST', defaultValue: `http://${HOSTNAME}:4321`, isEnterprise: true },
  { key: 'ADMIN_API_URL', defaultValue: `http://${HOSTNAME}:4322`, isEnterprise: true },

  { key: 'DASHBOARD_FRONTEND_HOST', defaultValue: `http://${HOSTNAME}:4300` },

  {
    key: 'PORTALS_URL',
    defaultValue: `http://${HOSTNAME}:4304`
  },
  {
    key: 'PORTAL_API_PORT',
    defaultValue: '4315'
  },

  { key: 'COOKIE_DOMAIN', defaultValue: `${HOSTNAME}`, isEnterprise: true },

  { key: 'LEMON_SQUEEZY_DEV_STORE_ID', isEnterprise: true },
  { key: 'LEMON_SQUEEZY_DEV_API_KEY', isEnterprise: true },
  { key: 'LEMON_SQUEEZY_DEV_WEBHOOK_SECRET', isEnterprise: true },

  { key: 'STRIPE_DEV_SECRET_API_KEY', isEnterprise: true },
  { key: 'STRIPE_DEV_PUBLISHABLE_API_KEY', isEnterprise: true },
  { key: 'STRIPE_DEV_WEBHOOK_SECRET', isEnterprise: true },

  { key: 'STATSIG_API_KEY', isEnterprise: true },
  { key: 'STATSIG_ENVIRONMENT', isEnterprise: true },

  { key: 'AWS_ACCESS_KEY_ID' },
  { key: 'AWS_SECRET_ACCESS_KEY' },
  { key: 'AWS_REGION' },
  { key: 'AWS_ACCOUNT_ID' },

  { key: 'BILLING_ENABLED', isEnterprise: true, defaultValue: 'true' },
  { key: 'SUPPORT_ENABLED', isEnterprise: true, defaultValue: 'true' },
  { key: 'CHROME_SIDEBAR_DOCS_ENABLED', isEnterprise: true, defaultValue: 'true' },
  { key: 'CHROME_ONBOARDING_ENABLED', isEnterprise: true, defaultValue: 'true' },
  { key: 'CHROME_SIDEBAR_CHANGELOG_ENABLED', isEnterprise: true, defaultValue: 'true' },

  {
    key: 'HORIZON_INTERNAL_URL',
    isEnterprise: true,
    defaultValue: 'http://localhost:52133/metorial-horizon-internal/api'
  },
  {
    key: 'HORIZON_OUTPOST_URL',
    isEnterprise: true,
    defaultValue: 'http://localhost:52131'
  },
  { key: 'HORIZON_APP_ID', isEnterprise: true, defaultValue: `metorial-enterprise-dev` },
  { key: 'HORIZON_SIGNING_SECRET', isEnterprise: true, defaultValue: 'secret' },

  {
    key: 'ARES_INTERNAL_URL',
    defaultValue: 'http://localhost:52123/metorial-ares-internal/api'
  },
  {
    key: 'ARES_AUTH_URL',
    defaultValue: 'http://localhost:52120'
  },

  {
    key: 'RELAY_URL',
    defaultValue: 'http://services:52110/metorial-relay'
  },
  {
    key: 'EMAIL_NAME',
    defaultValue: 'Metorial DEV'
  },
  {
    key: 'EMAIL_ADDRESS',
    defaultValue: 'dev@metorial.com'
  },

  { key: 'SUBSPACE_SOLUTION', defaultValue: 'metorial-dev' },
  { key: 'SUBSPACE_URL', defaultValue: 'http://localhost:52070/subspace-controller' },
  {
    key: 'SUBSPACE_CONNECTION_URL',
    defaultValue: 'http://localhost:52072'
  },
  {
    key: 'VOYAGER_URL',
    defaultValue: 'http://localhost:52060/metorial-voyager'
  },
  {
    key: 'ORIGIN_URL',
    defaultValue: `http://${HOSTNAME}:52090/metorial-origin`
  },
  {
    key: 'CODE_BUCKET_SERVICE_URL',
    defaultValue: `${HOSTNAME}:5050`
  },
  {
    key: 'NEBULA_API_URL',
    defaultValue: 'http://localhost:52170/metorial-nebula'
  },
  { key: 'AI_GATEWAY_API_KEY', isRequired: false },
  { key: 'SCOUT_URL', isRequired: false },
  { key: 'SCOUT_TOKEN', isRequired: false },

  { key: 'EXTERNAL_MULTI_REGION_ENDPOINT', defaultValue: 'http://localhost:4323' },
  { key: 'INTERNAL_MULTI_REGION_ENDPOINT', defaultValue: 'http://localhost:4323' }
];
