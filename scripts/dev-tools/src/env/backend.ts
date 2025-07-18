import { HOSTNAME, METORIAL_SOURCE } from '../const';
import type { Env } from './types';

let DB_PREFIX = `metorial-${METORIAL_SOURCE}`;

export let backendEnv: Env = [
  { key: 'EMAIL_SES_ACCESS_KEY_ID', isRequired: false },
  { key: 'EMAIL_SES_SECRET_ACCESS_KEY', isRequired: false },
  { key: 'EMAIL_SES_REGION', isRequired: false },

  { key: 'EMAIL_FROM' },
  { key: 'EMAIL_FROM_NAME' },

  {
    key: 'DATABASE_URL',
    defaultValue: `postgres://postgres:postgres@localhost:35432/${DB_PREFIX}`
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
    key: 'REDIS_URL',
    defaultValue: `redis://localhost:36379/0`
  },
  {
    key: 'MEILISEARCH_HOST',
    defaultValue: `http://localhost:37700`
  },
  {
    key: 'USAGE_MONGO_URL',
    defaultValue: `mongodb://mongo:mongo@vulcan:32707/metorial-usage?authSource=admin`,
    isEnterprise: true
  },
  { key: 'ETCD_ENDPOINTS', defaultValue: `http://localhost:32379` },
  {
    key: 'ENGINE_DATABASE_DSN',
    defaultValue: `host=localhost user=postgres password=postgres dbname=${DB_PREFIX}-engine port=35432 sslmode=disable`
  },

  {
    key: 'ENGINE_MANAGER_ADDRESSES',
    defaultValue: `localhost:50050`
  },

  { key: 'AUTH_TICKET_SECRET', defaultValue: `auth-ticket-secret` },
  {
    key: 'AUTH_INVISIBLE_TURNSTILE_SECRET_KEY',
    defaultValue: `1x0000000000000000000000000000000AA`
  },
  { key: 'AUTH_INVISIBLE_TURNSTILE_SITE_KEY', defaultValue: `1x00000000000000000000BB` },

  { key: 'ENCRYPTION_SECRET', defaultValue: `encryption-secret` },

  { key: 'API_URL', defaultValue: `http://${HOSTNAME}:4310` },
  { key: 'APP_URL', defaultValue: `http://${HOSTNAME}:4300` },
  { key: 'ID_API_HOST', defaultValue: `http://${HOSTNAME}:4321`, isEnterprise: true },
  { key: 'BILLING_API_URL', defaultValue: `http://${HOSTNAME}:4320`, isEnterprise: true },
  { key: 'MCP_URL', defaultValue: `http://${HOSTNAME}:4311` },
  { key: 'PROVIDER_OAUTH_URL', defaultValue: `http://${HOSTNAME}:4313`, isEnterprise: true },
  { key: 'AUTH_FRONTEND_HOST', defaultValue: `http://${HOSTNAME}:4301`, isEnterprise: true },
  { key: 'DASHBOARD_FRONTEND_HOST', defaultValue: `http://${HOSTNAME}:4300` },
  { key: 'COOKIE_DOMAIN', defaultValue: `${HOSTNAME}`, isEnterprise: true },

  { key: 'EARLY_ACCESS_XATA_API_KEY', isEnterprise: true },

  { key: 'RESEND_API_KEY', isEnterprise: true },
  { key: 'BREVO_API_KEY', isEnterprise: true },

  { key: 'LEMON_SQUEEZY_DEV_STORE_ID', isEnterprise: true },
  { key: 'LEMON_SQUEEZY_DEV_API_KEY', isEnterprise: true },
  { key: 'LEMON_SQUEEZY_DEV_WEBHOOK_SECRET', isEnterprise: true },

  { key: 'SUPPORT_CRISP_WEBSITE_ID', isEnterprise: true },
  { key: 'SUPPORT_CRISP_TOKEN_ID', isEnterprise: true },
  { key: 'SUPPORT_CRISP_TOKEN_KEY', isEnterprise: true },

  { key: 'OAUTH_GITHUB_CLIENT_ID', isEnterprise: true },
  { key: 'OAUTH_GITHUB_CLIENT_SECRET', isEnterprise: true },
  { key: 'OAUTH_GITHUB_REDIRECT_URI', isEnterprise: true },
  { key: 'OAUTH_GOOGLE_CLIENT_ID', isEnterprise: true },
  { key: 'OAUTH_GOOGLE_CLIENT_SECRET', isEnterprise: true },
  { key: 'OAUTH_GOOGLE_REDIRECT_URI', isEnterprise: true },

  { key: 'ENTERPRISE_FILES_DATABASE_URL', isEnterprise: true },
  { key: 'ENTERPRISE_FILES_SIGNATURE_PASSWORD', isEnterprise: true },
  { key: 'ENTERPRISE_FILES_HOST', isEnterprise: true },

  { key: 'STATSIG_API_KEY', isEnterprise: true },
  { key: 'STATSIG_ENVIRONMENT', isEnterprise: true }
];
