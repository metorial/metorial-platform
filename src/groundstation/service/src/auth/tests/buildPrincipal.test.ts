import { describe, expect, it } from 'vitest';
import type {
  Entity,
  Instance,
  Organization,
  Project
} from '../../../prisma/generated/client';
import {
  isIngestScopeArchived,
  sourcePrincipal,
  tokenPrincipal,
  type IngestSourceForPrincipal,
  type IngestTokenForPrincipal
} from '../buildPrincipal';

let now = new Date('2026-06-15T12:00:00.000Z');

let organization = {
  oid: 1n,
  id: 'gor_1',
  ref: 'org_1',
  name: 'Acme',
  hashKeyVersion: 2,
  contentKeyVersion: 3,
  settings: { allowedEmailDomains: ['acme.com'] },
  archivedAt: null,
  createdAt: now,
  updatedAt: now
} satisfies Organization;

let project = {
  oid: 2n,
  id: 'gpr_1',
  ref: 'proj_1',
  name: null,
  recordRetentionDays: 60,
  contentRetentionDays: 10,
  usageRetentionDays: 200,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  organizationOid: 1n
} satisfies Project;

let instance = {
  oid: 3n,
  id: 'gin_1',
  ref: 'inst_1',
  name: null,
  skewBoundSeconds: 600,
  backfillMaxAgeDays: 14,
  recordRetentionDays: 60,
  contentRetentionDays: 10,
  usageRetentionDays: 200,
  settings: { ephemeralDeviceIdleDays: 3 },
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  organizationOid: 1n,
  projectOid: 2n,
  project
} satisfies Instance & { project: Project };

let entity = (oid: bigint, id: string, kind: string): Entity => ({
  oid,
  id,
  kind,
  status: 'managed',
  source: null,
  ref: null,
  slug: null,
  name: null,
  attributes: {},
  needsReview: false,
  mergedIntoOid: null,
  firstSeenAt: null,
  lastSeenAt: null,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  organizationOid: 1n,
  scopeProjectOid: null,
  scopeInstanceOid: null
});

let token = (overrides: Partial<IngestTokenForPrincipal> = {}): IngestTokenForPrincipal => ({
  oid: 10n,
  id: 'git_1',
  prefix: 'prefix',
  secretHash: 'hash',
  name: 'laptop',
  contentPolicy: { defaultMode: 'full' },
  limits: { itemsPerSecond: 5 },
  allowedClients: ['codex'],
  allowedChannels: ['hook'],
  userRef: 'consumer_1',
  deviceRef: 'device_1',
  deviceMode: 'bound',
  agentRef: null,
  tags: [{ key: 'metorial.project', value: 'billing' }],
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: now,
  updatedAt: now,
  organizationOid: 1n,
  instanceOid: 3n,
  userEntityOid: 20n,
  deviceEntityOid: 21n,
  agentEntityOid: null,
  organization,
  instance,
  userEntity: entity(20n, 'gen_user', 'user'),
  deviceEntity: entity(21n, 'gen_device', 'device'),
  agentEntity: null,
  ...overrides
});

let source = (): IngestSourceForPrincipal => ({
  oid: 30n,
  id: 'gis_1',
  prefix: 'prefix',
  secretHash: 'hash',
  name: 'Cursor export',
  family: 'cursor',
  contentPolicy: { defaultMode: 'basic' },
  limits: {},
  allowedChannels: ['otlp.logs'],
  newUserLimitPerDay: 25,
  tags: [],
  lastUsedAt: null,
  revokedAt: null,
  createdAt: now,
  updatedAt: now,
  organizationOid: 1n,
  instanceOid: 3n,
  organization,
  instance
});

describe('tokenPrincipal', () => {
  it('carries the credential, policy, tags and scope of the token', () => {
    expect(tokenPrincipal(token())).toEqual({
      credential: { kind: 'token', id: 'git_1' },
      contentPolicy: { defaultMode: 'full' },
      limits: { itemsPerSecond: 5 },
      allowedClients: ['codex'],
      allowedChannels: ['hook'],
      tags: [{ key: 'metorial.project', value: 'billing' }],
      binding: {
        userId: 'gen_user',
        deviceId: 'gen_device',
        deviceMode: 'bound',
        agentId: undefined
      },
      organization: {
        id: 'gor_1',
        ref: 'org_1',
        hashKeyVersion: 2,
        contentKeyVersion: 3,
        settings: { allowedEmailDomains: ['acme.com'] }
      },
      project: { id: 'gpr_1', ref: 'proj_1' },
      instance: {
        id: 'gin_1',
        ref: 'inst_1',
        skewBoundSeconds: 600,
        backfillMaxAgeDays: 14,
        recordRetentionDays: 60,
        contentRetentionDays: 10,
        usageRetentionDays: 200,
        settings: { ephemeralDeviceIdleDays: 3 }
      }
    });
  });

  it('binds ephemeral tokens to the user only', () => {
    let principal = tokenPrincipal(
      token({ deviceMode: 'ephemeral', deviceRef: null, deviceEntity: null })
    );

    expect(principal.binding).toEqual({
      userId: 'gen_user',
      deviceId: undefined,
      deviceMode: 'ephemeral',
      agentId: undefined
    });
  });

  it('binds the agent entity when the token has one', () => {
    let principal = tokenPrincipal(
      token({ agentRef: 'client_1', agentEntity: entity(22n, 'gen_agent', 'agent') })
    );

    expect(principal.binding.agentId).toBe('gen_agent');
  });
});

describe('sourcePrincipal', () => {
  it('reports vendor identity with the source family and new-user limit', () => {
    let principal = sourcePrincipal(source());

    expect(principal.credential).toEqual({ kind: 'source', id: 'gis_1', family: 'cursor' });
    expect(principal.binding).toEqual({ deviceMode: 'vendor' });
    expect(principal.allowedClients).toEqual([]);
    expect(principal.allowedChannels).toEqual(['otlp.logs']);
    expect(principal.newUserLimitPerDay).toBe(25);
    expect(principal.instance.id).toBe('gin_1');
    expect(principal.organization.hashKeyVersion).toBe(2);
  });
});

describe('isIngestScopeArchived', () => {
  it('is false for live scopes', () => {
    expect(isIngestScopeArchived({ organization, instance })).toBe(false);
  });

  it.each([
    ['organization', { organization: { archivedAt: now }, instance }],
    ['project', { organization, instance: { ...instance, project: { archivedAt: now } } }],
    ['instance', { organization, instance: { ...instance, archivedAt: now } }]
  ])('is true when the %s is archived', (_, scope) => {
    expect(isIngestScopeArchived(scope)).toBe(true);
  });
});
