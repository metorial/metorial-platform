import { describe, expect, it } from 'vitest';
import {
  clientAgentEntityInput,
  consumerEntityInput,
  deviceEntityInput,
  normalizeEmail
} from '../src/lib/mapping';

let organization = { id: 'org_1' };

let createConsumer = (overrides: Record<string, any> = {}) => ({
  id: 'con_1',
  name: 'Ada Lovelace',
  email: ' Ada@Example.com ',
  isServiceAccount: false,
  profiles: [
    { id: 'cop_1', email: 'ada@example.com', status: 'active' as const },
    { id: 'cop_2', email: 'ada.work@example.com', status: 'active' as const },
    { id: 'cop_3', email: 'old@example.com', status: 'deleted' as const }
  ],
  instanceConsumers: [{ email: 'ADA@example.com' }, { email: 'ada+alias@example.com' }],
  ...overrides
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it('drops empty and malformed values', () => {
    expect(normalizeEmail('')).toBeUndefined();
    expect(normalizeEmail('   ')).toBeUndefined();
    expect(normalizeEmail('not-an-email')).toBeUndefined();
    expect(normalizeEmail(null)).toBeUndefined();
    expect(normalizeEmail(undefined)).toBeUndefined();
  });
});

describe('consumerEntityInput', () => {
  it('maps a consumer to a managed user with every known email and active profile', () => {
    let input = consumerEntityInput({ organization, consumer: createConsumer() });

    expect(input).toEqual({
      organizationId: 'org_1',
      kind: 'user',
      source: 'metorial.consumer',
      ref: 'con_1',
      name: 'Ada Lovelace',
      attributes: {},
      identifiers: [
        { type: 'email', value: 'ada@example.com' },
        { type: 'email', value: 'ada.work@example.com' },
        { type: 'email', value: 'ada+alias@example.com' },
        { type: 'profile', value: 'cop_1' },
        { type: 'profile', value: 'cop_2' }
      ]
    });
  });

  it('leaves out deleted profiles and their emails', () => {
    let input = consumerEntityInput({ organization, consumer: createConsumer() });

    expect(input.identifiers).not.toContainEqual({ type: 'profile', value: 'cop_3' });
    expect(input.identifiers).not.toContainEqual({ type: 'email', value: 'old@example.com' });
  });

  it('marks service accounts and skips their generated emails', () => {
    let input = consumerEntityInput({
      organization,
      consumer: createConsumer({
        isServiceAccount: true,
        email: 'sa-key@900.service-accounts.metorial.net',
        profiles: [
          {
            id: 'cop_sa',
            email: 'sa-key@900.service-accounts.metorial.net',
            status: 'active'
          }
        ],
        instanceConsumers: [{ email: 'sa-key@900.service-accounts.metorial.net' }]
      })
    });

    expect(input.attributes).toEqual({ type: 'service' });
    expect(input.identifiers).toEqual([{ type: 'profile', value: 'cop_sa' }]);
  });

  it('omits an empty name', () => {
    let input = consumerEntityInput({ organization, consumer: createConsumer({ name: '' }) });

    expect(input.name).toBeUndefined();
  });
});

describe('deviceEntityInput', () => {
  it('maps a device with its installation id', () => {
    let input = deviceEntityInput({
      organization,
      consumerDevice: {
        id: 'codv_1',
        name: "Ada's MacBook Pro",
        os: 'macos',
        arch: 'aarch64',
        appVersion: '0.2.0',
        installationId: 'install-0123456789abcdef'
      }
    });

    expect(input).toEqual({
      organizationId: 'org_1',
      kind: 'device',
      source: 'metorial.device',
      ref: 'codv_1',
      name: "Ada's MacBook Pro",
      attributes: { os: 'macos', arch: 'aarch64', appVersion: '0.2.0' },
      identifiers: [{ type: 'install:metorial', value: 'install-0123456789abcdef' }]
    });
  });
});

describe('clientAgentEntityInput', () => {
  it('maps a detected client to an organization-wide agent keyed by family', () => {
    let input = clientAgentEntityInput({
      organization,
      client: { name: 'Claude Code', mcpClientType: { key: 'claude-code' } }
    });

    expect(input).toEqual({
      organizationId: 'org_1',
      kind: 'agent',
      source: 'metorial.client',
      ref: 'claude-code',
      name: 'Claude Code',
      attributes: {},
      identifiers: [{ type: 'client_family', value: 'claude-code' }]
    });
  });
});
