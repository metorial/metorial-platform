let isProd = process.env.NODE_ENV === 'production';

export const SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT = 1000 * 60 * 15;

export const DEFAULT_SESSION_EXPIRATION_DAYS = 14;
export const UNINITIALIZED_SESSION_EXPIRATION_MINUTES = 30;

export const PING_INTERVAL_MS = isProd ? 1000 * 60 : 1000 * 10;
export const CONNECTION_INACTIVITY_TIMEOUT_MS = isProd ? 1000 * 60 * 2 : 1000 * 15;

export const PING_MESSAGE_ID_PREFIX = 'mt/ping/';
