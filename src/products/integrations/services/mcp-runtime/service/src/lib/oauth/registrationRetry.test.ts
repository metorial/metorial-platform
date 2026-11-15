import { subDays, subHours } from 'date-fns';
import { describe, expect, it } from 'vitest';
import {
  getRegistrationBlocker,
  isStaleRegistration,
  isTransientRegistrationError,
  MAX_REGISTRATION_ATTEMPTS
} from './registrationRetry';

let connection = (partial: Partial<Parameters<typeof getRegistrationBlocker>[0]['connection']> = {}) => ({
  status: 'active' as const,
  discoveryStatus: 'failed' as const,
  registrationOid: null,
  secretOid: null,
  registrationAttemptCount: 0,
  ...partial
});

let blocker = (
  partial: Partial<Parameters<typeof getRegistrationBlocker>[0]['connection']> = {},
  counts: { boundTokenCount?: number; boundAuthConfigCount?: number } = {}
) =>
  getRegistrationBlocker({
    connection: connection(partial),
    boundTokenCount: counts.boundTokenCount ?? 0,
    boundAuthConfigCount: counts.boundAuthConfigCount ?? 0
  });

describe('getRegistrationBlocker', () => {
  it('allows a failed connection without credentials', () => {
    expect(blocker()).toBeNull();
  });

  it('refuses connections that already have a registered client', () => {
    expect(blocker({ registrationOid: 1n })).toBe('already_registered');
  });

  it('refuses connections using manually provided credentials', () => {
    expect(blocker({ secretOid: 1n })).toBe('manual_credentials');
  });

  it('refuses connections that already have tokens or auth configs bound', () => {
    expect(blocker({}, { boundTokenCount: 1 })).toBe('has_bound_credentials');
    expect(blocker({}, { boundAuthConfigCount: 1 })).toBe('has_bound_credentials');
  });

  it('refuses inactive and already succeeded connections', () => {
    expect(blocker({ status: 'inactive' })).toBe('connection_inactive');
    expect(blocker({ discoveryStatus: 'succeeded' })).toBe('already_succeeded');
  });

  it('stops once the attempt budget is used up', () => {
    expect(blocker({ registrationAttemptCount: MAX_REGISTRATION_ATTEMPTS - 1 })).toBeNull();
    expect(blocker({ registrationAttemptCount: MAX_REGISTRATION_ATTEMPTS })).toBe(
      'attempts_exhausted'
    );
  });
});

describe('isStaleRegistration', () => {
  it('treats registrations older than three days as stale', () => {
    expect(isStaleRegistration({ createdAt: subDays(new Date(), 4) })).toBe(true);
  });

  it('keeps recent registrations', () => {
    expect(isStaleRegistration({ createdAt: subHours(new Date(), 12) })).toBe(false);
    expect(isStaleRegistration({ createdAt: subDays(new Date(), 2) })).toBe(false);
  });
});

describe('isTransientRegistrationError', () => {
  it('treats missing responses, rate limits and server errors as transient', () => {
    expect(isTransientRegistrationError({ status: null })).toBe(true);
    expect(isTransientRegistrationError({})).toBe(true);
    expect(isTransientRegistrationError({ status: 429 })).toBe(true);
    expect(isTransientRegistrationError({ status: 500 })).toBe(true);
    expect(isTransientRegistrationError({ status: 503 })).toBe(true);
  });

  it('treats provider validation errors as permanent', () => {
    expect(isTransientRegistrationError({ status: 400 })).toBe(false);
    expect(isTransientRegistrationError({ status: 401 })).toBe(false);
    expect(isTransientRegistrationError({ status: 404 })).toBe(false);
  });
});
