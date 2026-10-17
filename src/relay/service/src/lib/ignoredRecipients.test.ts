import { describe, expect, it } from 'vitest';
import { filterIgnoredEmailRecipients, isIgnoredEmailRecipient } from './ignoredRecipients';

describe('isIgnoredEmailRecipient', () => {
  it('ignores service account addresses', () => {
    expect(isIgnoredEmailRecipient('sa-abc@900.service-accounts.metorial.net')).toBe(true);
    expect(isIgnoredEmailRecipient('sa-abc@service-accounts.metorial.net')).toBe(true);
  });

  it('ignores legacy service account addresses', () => {
    expect(isIgnoredEmailRecipient('sa-abc@service-accounts.metorial.invalid')).toBe(true);
  });

  it('ignores reserved internal top-level domains', () => {
    expect(isIgnoredEmailRecipient('deleted_1@deleted.local')).toBe(true);
    expect(isIgnoredEmailRecipient('user@host.metorial.internal')).toBe(true);
    expect(isIgnoredEmailRecipient('user@host.invalid')).toBe(true);
    expect(isIgnoredEmailRecipient('user@localhost')).toBe(true);
  });

  it('keeps regular addresses', () => {
    expect(isIgnoredEmailRecipient('customer@example.com')).toBe(false);
    expect(isIgnoredEmailRecipient('user@metorial.com')).toBe(false);
    expect(isIgnoredEmailRecipient('user@service-accounts.metorial.com')).toBe(false);
    expect(isIgnoredEmailRecipient('not-an-email')).toBe(false);
  });

  it('is case insensitive and trims whitespace', () => {
    expect(isIgnoredEmailRecipient(' SA-ABC@900.Service-Accounts.Metorial.NET ')).toBe(true);
  });
});

describe('filterIgnoredEmailRecipients', () => {
  it('drops ignored recipients and keeps the rest', () => {
    expect(
      filterIgnoredEmailRecipients([
        'customer@example.com',
        'sa-abc@900.service-accounts.metorial.net',
        'deleted_1@deleted.local'
      ])
    ).toEqual(['customer@example.com']);
  });
});
