import { describe, expect, it } from 'vitest';
import { isInternalSystemEmail, isNonDeliverableEmail } from './index';

describe('isInternalSystemEmail', () => {
  it('matches every internal system domain', () => {
    expect(isInternalSystemEmail('metorial-x@123.system.metorial.net')).toBe(true);
    expect(isInternalSystemEmail('metorial-x@123.system.metorial.com')).toBe(true);
    expect(isInternalSystemEmail('metorial-cli-x@123.onboarding.metorial.net')).toBe(true);
    expect(isInternalSystemEmail('sa-x@123.service-accounts.metorial.net')).toBe(true);
  });

  it('does not match customer domains', () => {
    expect(isInternalSystemEmail('jane@metorial.net')).toBe(false);
    expect(isInternalSystemEmail('jane@notonboarding.metorial.net.example.com')).toBe(false);
  });
});

describe('isNonDeliverableEmail', () => {
  it('also matches reserved top-level domains', () => {
    expect(isNonDeliverableEmail('a@host.invalid')).toBe(true);
    expect(isNonDeliverableEmail('a@host.localhost')).toBe(true);
    expect(isNonDeliverableEmail('a@example.com')).toBe(false);
  });
});
