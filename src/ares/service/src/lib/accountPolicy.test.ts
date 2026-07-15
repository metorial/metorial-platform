import { describe, expect, it } from 'vitest';
import {
  doesAuthAttemptMatchClient,
  getAccountEmailAuthFlow,
  getAccountSsoClientId,
  getInitialSsoTenantEnrollment,
  isAccountDomainConnectionAllowed,
  isSsoTenantAssignableToAccount,
  isValidAccountDomain,
  normalizeAccountDomain
} from './accountPolicy';

describe('account domain policy', () => {
  it('normalizes caller-provided domains', () => {
    expect(normalizeAccountDomain('  Example.COM ')).toBe('example.com');
  });

  it('accepts hostnames and rejects malformed account domains', () => {
    expect(isValidAccountDomain('example.com')).toBe(true);
    expect(isValidAccountDomain('sso.example.com')).toBe(true);
    expect(isValidAccountDomain('xn--bcher-kva.example')).toBe(true);
    expect(isValidAccountDomain('@example.com')).toBe(false);
    expect(isValidAccountDomain('example.com.')).toBe(false);
    expect(isValidAccountDomain('bad domain.example')).toBe(false);
    expect(isValidAccountDomain('-example.com')).toBe(false);
  });

  it('keeps app tenants active and stages account tenants as disabled', () => {
    expect(getInitialSsoTenantEnrollment('app')).toBe('app');
    expect(getInitialSsoTenantEnrollment('account')).toBe('disabled');
  });

  it('uses the account client for account SSO redirects', () => {
    expect(getAccountSsoClientId('app-client', 'account-client')).toBe('account-client');
    expect(getAccountSsoClientId('app-client', null)).toBe('app-client');
  });

  it('forces eligible account SSO and falls back to email without it', () => {
    expect(getAccountEmailAuthFlow(true, 1)).toBe('sso_redirect');
    expect(getAccountEmailAuthFlow(true, 2)).toBe('sso_selection');
    expect(getAccountEmailAuthFlow(true, 0)).toBe('email');
    expect(getAccountEmailAuthFlow(false, 3)).toBe('email');
  });

  it('only assigns disabled or already-owned tenants to an account', () => {
    expect(
      isSsoTenantAssignableToAccount({
        enrollment: 'disabled',
        accountOid: null
      })
    ).toBe(true);
    expect(
      isSsoTenantAssignableToAccount({
        enrollment: 'account',
        accountOid: 1n,
        targetAccountOid: 1n
      })
    ).toBe(true);
    expect(
      isSsoTenantAssignableToAccount({
        enrollment: 'app',
        accountOid: null,
        targetAccountOid: 1n
      })
    ).toBe(false);
    expect(
      isSsoTenantAssignableToAccount({
        enrollment: 'account',
        accountOid: 2n,
        targetAccountOid: 1n
      })
    ).toBe(false);
  });

  it('requires authorization attempts to match app and account client context', () => {
    expect(
      doesAuthAttemptMatchClient({
        attemptAppOid: 1n,
        attemptAccountOid: 2n,
        clientAppOid: 1n,
        clientAccountOid: 2n
      })
    ).toBe(true);
    expect(
      doesAuthAttemptMatchClient({
        attemptAppOid: 1n,
        attemptAccountOid: 2n,
        clientAppOid: 1n,
        clientAccountOid: null
      })
    ).toBe(false);
    expect(
      doesAuthAttemptMatchClient({
        attemptAppOid: 1n,
        attemptAccountOid: null,
        clientAppOid: 1n,
        clientAccountOid: 2n
      })
    ).toBe(false);
  });

  it('allows every connection when no restrictions exist', () => {
    expect(
      isAccountDomainConnectionAllowed({
        tenantOid: 1n,
        connectionOid: 2n,
        allowedTenantOids: [],
        allowedConnectionOids: []
      })
    ).toBe(true);
  });

  it('uses the union of tenant and connection restrictions', () => {
    expect(
      isAccountDomainConnectionAllowed({
        tenantOid: 1n,
        connectionOid: 2n,
        allowedTenantOids: [1n],
        allowedConnectionOids: []
      })
    ).toBe(true);
    expect(
      isAccountDomainConnectionAllowed({
        tenantOid: 1n,
        connectionOid: 2n,
        allowedTenantOids: [],
        allowedConnectionOids: [2n]
      })
    ).toBe(true);
    expect(
      isAccountDomainConnectionAllowed({
        tenantOid: 1n,
        connectionOid: 2n,
        allowedTenantOids: [3n],
        allowedConnectionOids: [4n]
      })
    ).toBe(false);
  });
});
