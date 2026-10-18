import { describe, expect, it } from 'vitest';
import {
  buildSessionlessClientKey,
  getSessionlessClientIdentity,
  normalizeClientIp
} from './clientKey';

let clientInfo = { name: 'ExampleClient', version: '1.0.0' };

let oauthClient = (foreignId: string, oauthRegistrationId: string) => ({
  name: 'OAuth Client',
  type: 'mcp_client_oauth' as const,
  foreignId,
  oauthRegistrationId
});

describe('normalizeClientIp', () => {
  it('strips the IPv4-mapped IPv6 prefix and normalizes case', () => {
    expect(normalizeClientIp(' ::FFFF:1.2.3.4 ')).toBe('1.2.3.4');
    expect(normalizeClientIp('2001:DB8::1')).toBe('2001:db8::1');
    expect(normalizeClientIp('::ffff:abcd')).toBe('::ffff:abcd');
    expect(normalizeClientIp(undefined)).toBe('');
  });
});

describe('getSessionlessClientIdentity', () => {
  it('falls back to unknown when clientInfo is missing', () => {
    expect(getSessionlessClientIdentity(undefined)).toEqual({
      name: 'unknown',
      version: '',
      identifier: 'unknown'
    });
    expect(getSessionlessClientIdentity(clientInfo).identifier).toBe('ExampleClient@1.0.0');
  });
});

describe('buildSessionlessClientKey', () => {
  let key = (d: Partial<Parameters<typeof buildSessionlessClientKey>[0]>) =>
    buildSessionlessClientKey({
      clientInfo,
      clientIp: '1.2.3.4',
      agentClient: undefined,
      ...d
    });

  it('is stable for the same client', async () => {
    expect(await key({})).toBe(await key({}));
    expect(await key({ clientIp: '::ffff:1.2.3.4' })).toBe(await key({}));
  });

  it('separates clients by name, version and IP', async () => {
    let base = await key({});

    expect(await key({ clientInfo: { name: 'Other', version: '1.0.0' } })).not.toBe(base);
    expect(await key({ clientInfo: { name: 'ExampleClient', version: '2.0.0' } })).not.toBe(
      base
    );
    expect(await key({ clientIp: '5.6.7.8' })).not.toBe(base);
  });

  it('separates agent clients even with identical clientInfo and IP', async () => {
    let first = await key({ agentClient: oauthClient('client_1', 'reg_1') });

    expect(first).not.toBe(await key({}));
    expect(await key({ agentClient: oauthClient('client_2', 'reg_1') })).not.toBe(first);
    expect(await key({ agentClient: oauthClient('client_1', 'reg_2') })).not.toBe(first);
    expect(
      await key({
        agentClient: { name: 'System', type: 'system_client', foreignId: 'client_1' }
      })
    ).not.toBe(first);
  });
});
