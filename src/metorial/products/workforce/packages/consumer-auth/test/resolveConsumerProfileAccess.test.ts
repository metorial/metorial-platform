import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    consumerGroup: { findMany: vi.fn() }
  },
  ensureConsumerProfileActor: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db: mocks.db }));

vi.mock('@metorial/config', () => ({
  getConfig: () => ({ encryptionSecret: 'test-secret' })
}));

vi.mock('@metorial-platform-systems/ares-client', () => ({
  createAresInternalClient: vi.fn()
}));

vi.mock('@metorial/module-resource-actor', () => ({
  resourceActorService: { ensureConsumerProfileActor: mocks.ensureConsumerProfileActor }
}));

import { resolveConsumerProfileAccess } from '../src/index';

let organization = { oid: 1n };
let project = { oid: 2n };
let instance = { oid: 3n };
let context = { ip: '127.0.0.1', ua: 'test' };
let resourceActor = { oid: 4n, projectOid: project.oid };
let group = { oid: 6n, accessTagOid: 7n, isDefault: true, ssoGroupIds: [], profiles: [] };

let consumerProfileFor = (resourceActors: unknown[]) =>
  ({
    oid: 5n,
    id: 'cpf_1',
    instanceOid: instance.oid,
    surfaceOid: 8n,
    ssoGroupIds: [],
    resourceActors,
    surface: { isInternal: false }
  }) as any;

describe('resolveConsumerProfileAccess', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.db.consumerGroup.findMany.mockResolvedValue([group]);
  });

  it('reuses the resource actor of the project and builds a consumer audit scope', async () => {
    let access = await resolveConsumerProfileAccess({
      consumerProfile: consumerProfileFor([resourceActor]),
      organization,
      project,
      instance,
      context
    });

    expect(access).toMatchObject({
      accessTags: [7n],
      resourceActor,
      auditScope: {
        organizationOid: organization.oid,
        instanceOid: instance.oid,
        actor: { type: 'consumer_profile', id: 'cpf_1' },
        context
      }
    });
    expect(mocks.ensureConsumerProfileActor).not.toHaveBeenCalled();
  });

  it('creates the resource actor when the profile has none for the project', async () => {
    mocks.ensureConsumerProfileActor.mockResolvedValue(resourceActor);
    let consumerProfile = consumerProfileFor([{ oid: 9n, projectOid: 99n }]);

    let access = await resolveConsumerProfileAccess({
      consumerProfile,
      organization,
      project,
      instance,
      context
    });

    expect(access.resourceActor).toBe(resourceActor);
    expect(mocks.ensureConsumerProfileActor).toHaveBeenCalledWith({
      project,
      consumerProfile
    });
  });
});
