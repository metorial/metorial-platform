import { addHours, addDays } from 'date-fns';
import type {
  RemoteOAuthConnectionDiscoveryStatus,
  RemoteOAuthConnectionStatus
} from '../../../prisma/generated/client';

/** Auto-registration is retried once per cron run until this many attempts failed. */
export let MAX_REGISTRATION_ATTEMPTS = 10;

/** Slightly below 24h so a daily cron never skips a connection because of drift. */
export let REGISTRATION_RETRY_INTERVAL_HOURS = 20;

/** Age at which an auto-registered client is replaced on the next deployment. */
export let STALE_REGISTRATION_DAYS = 3;

export let getRegistrationRetryCutoff = (now = new Date()) =>
  addHours(now, -REGISTRATION_RETRY_INTERVAL_HOURS);

export let getStaleRegistrationCutoff = (now = new Date()) =>
  addDays(now, -STALE_REGISTRATION_DAYS);

export let isStaleRegistration = (registration: { createdAt: Date }, now = new Date()) =>
  registration.createdAt.getTime() < getStaleRegistrationCutoff(now).getTime();

/**
 * Transient failures are worth retrying, permanent ones (invalid client
 * metadata, unsupported registration) will fail the same way every time.
 */
export let isTransientRegistrationError = (d: { status?: number | null }) => {
  if (d.status == null) return true;
  if (d.status == 408 || d.status == 425 || d.status == 429) return true;
  return d.status >= 500;
};

export type RegistrationBlocker =
  | 'connection_inactive'
  | 'already_succeeded'
  | 'already_registered'
  | 'manual_credentials'
  | 'has_bound_credentials'
  | 'attempts_exhausted';

/**
 * Re-registering a connection swaps the client the provider knows about, which
 * would break every token that was issued to the previous client. Only
 * connections without any bound credentials may be registered.
 */
export let getRegistrationBlocker = (d: {
  connection: {
    status: RemoteOAuthConnectionStatus;
    discoveryStatus: RemoteOAuthConnectionDiscoveryStatus;
    registrationOid: bigint | null;
    secretOid: bigint | null;
    registrationAttemptCount: number;
  };
  boundTokenCount: number;
  boundAuthConfigCount: number;
}): RegistrationBlocker | null => {
  if (d.connection.status != 'active') return 'connection_inactive';
  if (d.connection.discoveryStatus == 'succeeded') return 'already_succeeded';
  if (d.connection.registrationOid != null) return 'already_registered';
  if (d.connection.secretOid != null) return 'manual_credentials';
  if (d.boundTokenCount > 0 || d.boundAuthConfigCount > 0) return 'has_bound_credentials';
  if (d.connection.registrationAttemptCount >= MAX_REGISTRATION_ATTEMPTS)
    return 'attempts_exhausted';

  return null;
};
