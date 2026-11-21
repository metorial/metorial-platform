import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerConfig: { findMany: vi.fn() },
  providerAuthConfig: { findMany: vi.fn() },
  integrationInstance: { findMany: vi.fn(), findFirst: vi.fn() },
  subspaceIdentityActor: { findUnique: vi.fn(), findFirst: vi.fn() },
  coreIdentityActor: { findUnique: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerConfig: mocks.providerConfig,
    providerAuthConfig: mocks.providerAuthConfig,
    integrationInstance: mocks.integrationInstance,
    identityActor: mocks.subspaceIdentityActor
  }
}));

vi.mock('./metorialDb', () => ({
  metorialDb: { identityActor: mocks.coreIdentityActor }
}));

vi.mock('./metorialFacing', () => ({
  resolveMetorialFacing: vi.fn()
}));

import type { OwnershipAccessor } from './ownershipAccess';
import {
  assertCanAttachSubspaceResourcesToCoreParent,
  assertConsumerCanAttachSubspaceResources
} from './ownershipAttach';

let serverOwnerCoreOid = 100n;
let serverOwnerOid = 10n;
let otherConsumerOid = 11n;
let personOid = 20n;
let serverIntegrationInstanceOid = 70n;

let actorTypes = new Map<bigint, string>([
  [serverOwnerOid, 'consumer'],
  [otherConsumerOid, 'consumer'],
  [personOid, 'person']
]);

let tenant = () => ({ oid: 1n });

let ownedServer = { ownerActorOid: serverOwnerCoreOid };
let unownedServer = { ownerActorOid: null };

let authConfig = (d: Record<string, unknown> = {}) => ({
  id: 'pac_1',
  ownerActorOid: null,
  owningIntegrationInstanceOid: null,
  ...d
});

let config = (d: Record<string, unknown> = {}) => ({
  id: 'pcf_1',
  ownerActorOid: null,
  owningIntegrationInstanceOid: null,
  ...d
});

let attachAuthConfig = (d: {
  server?: { ownerActorOid: bigint | null };
  authConfig: Record<string, unknown>;
  parentIntegrationInstanceId?: string;
}) => {
  mocks.providerAuthConfig.findMany.mockResolvedValue([d.authConfig]);

  return assertConsumerCanAttachSubspaceResources({
    tenant: tenant(),
    parent: d.server ?? ownedServer,
    parentIntegrationInstanceId: d.parentIntegrationInstanceId,
    providerAuthConfigIds: ['pac_1']
  });
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.providerConfig.findMany.mockResolvedValue([]);
  mocks.providerAuthConfig.findMany.mockResolvedValue([]);
  mocks.integrationInstance.findMany.mockResolvedValue([]);
  mocks.integrationInstance.findFirst.mockImplementation(
    async ({ where }: { where: { id: string } }) =>
      where.id === 'ini_server' ? { oid: serverIntegrationInstanceOid } : null
  );
  mocks.coreIdentityActor.findUnique.mockImplementation(
    async ({ where }: { where: { oid: bigint } }) =>
      where.oid === serverOwnerCoreOid ? { id: 'actor_server_owner' } : null
  );
  mocks.subspaceIdentityActor.findFirst.mockImplementation(
    async ({ where }: { where: { id: string } }) =>
      where.id === 'actor_server_owner' ? { oid: serverOwnerOid } : null
  );
  mocks.subspaceIdentityActor.findUnique.mockImplementation(
    async ({ where }: { where: { oid: bigint } }) => {
      let type = actorTypes.get(where.oid);
      return type ? { type } : null;
    }
  );
});

describe('assertConsumerCanAttachSubspaceResources', () => {
  it('rejects an auth config without an owner', async () => {
    await expect(attachAuthConfig({ authConfig: authConfig() })).rejects.toMatchObject({
      data: { code: 'ownership_restricted' }
    });
  });

  it('rejects a config without an owner', async () => {
    mocks.providerConfig.findMany.mockResolvedValue([config()]);

    await expect(
      assertConsumerCanAttachSubspaceResources({
        tenant: tenant(),
        parent: ownedServer,
        providerConfigIds: ['pcf_1']
      })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });

  it('allows resources owned by the owner of the server', async () => {
    mocks.providerConfig.findMany.mockResolvedValue([
      config({ ownerActorOid: serverOwnerOid })
    ]);
    mocks.providerAuthConfig.findMany.mockResolvedValue([
      authConfig({ ownerActorOid: serverOwnerOid })
    ]);

    await expect(
      assertConsumerCanAttachSubspaceResources({
        tenant: tenant(),
        parent: ownedServer,
        providerConfigIds: ['pcf_1'],
        providerAuthConfigIds: ['pac_1']
      })
    ).resolves.toBeUndefined();
  });

  it.each([
    ['another consumer', otherConsumerOid],
    ['a non-consumer actor', personOid]
  ])('rejects an auth config owned by %s', async (_name, ownerActorOid) => {
    await expect(
      attachAuthConfig({ authConfig: authConfig({ ownerActorOid }) })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });

  it('rejects an owned auth config on a server without an owner', async () => {
    await expect(
      attachAuthConfig({
        server: unownedServer,
        authConfig: authConfig({ ownerActorOid: serverOwnerOid })
      })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });

  it("allows an unowned auth config that belongs to the server's own integration instance", async () => {
    await expect(
      attachAuthConfig({
        server: unownedServer,
        parentIntegrationInstanceId: 'ini_server',
        authConfig: authConfig({ owningIntegrationInstanceOid: serverIntegrationInstanceOid })
      })
    ).resolves.toBeUndefined();

    expect(mocks.integrationInstance.findFirst.mock.calls[0]![0].where).toEqual({
      id: 'ini_server',
      tenantOid: 1n
    });
  });

  it('rejects an unowned auth config that belongs to another integration instance', async () => {
    await expect(
      attachAuthConfig({
        parentIntegrationInstanceId: 'ini_server',
        authConfig: authConfig({ owningIntegrationInstanceOid: 71n })
      })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });

  it("rejects another consumer's auth config even inside the server's integration instance", async () => {
    await expect(
      attachAuthConfig({
        parentIntegrationInstanceId: 'ini_server',
        authConfig: authConfig({
          ownerActorOid: otherConsumerOid,
          owningIntegrationInstanceOid: serverIntegrationInstanceOid
        })
      })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });

  it('allows the unowned config the provider inherits', async () => {
    mocks.providerConfig.findMany.mockResolvedValue([config()]);

    await expect(
      assertConsumerCanAttachSubspaceResources({
        tenant: tenant(),
        parent: ownedServer,
        providerConfigIds: ['pcf_1'],
        inheritedProviderConfigIds: ['pcf_1', undefined]
      })
    ).resolves.toBeUndefined();
  });

  it('rejects an inherited config that another consumer owns', async () => {
    mocks.providerConfig.findMany.mockResolvedValue([
      config({ ownerActorOid: otherConsumerOid })
    ]);

    await expect(
      assertConsumerCanAttachSubspaceResources({
        tenant: tenant(),
        parent: ownedServer,
        providerConfigIds: ['pcf_1'],
        inheritedProviderConfigIds: ['pcf_1']
      })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });

  it('does not treat an inherited config id as an inherited auth config', async () => {
    mocks.providerAuthConfig.findMany.mockResolvedValue([authConfig({ id: 'pcf_1' })]);

    await expect(
      assertConsumerCanAttachSubspaceResources({
        tenant: tenant(),
        parent: ownedServer,
        providerAuthConfigIds: ['pcf_1'],
        inheritedProviderConfigIds: ['pcf_1']
      })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });

  it('only loads resources inside the tenant', async () => {
    await attachAuthConfig({
      authConfig: authConfig({ ownerActorOid: serverOwnerOid })
    });

    expect(mocks.providerAuthConfig.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['pac_1'] }, tenantOid: 1n }
    });
  });

  it('passes when nothing is attached', async () => {
    await expect(
      assertConsumerCanAttachSubspaceResources({
        tenant: tenant(),
        parent: ownedServer,
        providerConfigIds: [null],
        providerAuthConfigIds: [undefined]
      })
    ).resolves.toBeUndefined();

    expect(mocks.providerConfig.findMany).not.toHaveBeenCalled();
    expect(mocks.providerAuthConfig.findMany).not.toHaveBeenCalled();
  });
});

describe('assertConsumerCanAttachSubspaceResources on a server without an owner', () => {
  it('allows an unowned auth config', async () => {
    await expect(
      attachAuthConfig({ server: unownedServer, authConfig: authConfig() })
    ).resolves.toBeUndefined();
  });

  it.each([
    ['a consumer', otherConsumerOid],
    ['a non-consumer actor', personOid]
  ])('rejects an auth config owned by %s', async (_name, ownerActorOid) => {
    await expect(
      attachAuthConfig({ server: unownedServer, authConfig: authConfig({ ownerActorOid }) })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });
});

describe('assertConsumerCanAttachSubspaceResources on a server whose owner cannot be resolved', () => {
  it('rejects an unowned auth config', async () => {
    await expect(
      attachAuthConfig({ server: { ownerActorOid: 999n }, authConfig: authConfig() })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });
});

describe('assertCanAttachSubspaceResourcesToCoreParent', () => {
  let accessor = (d: Partial<OwnershipAccessor>): OwnershipAccessor => ({
    kind: 'member',
    ownActorOids: [],
    ownActorIds: [],
    isRestrictedByProject: true,
    isEnforced: true,
    allowSystemOwned: false,
    ...d
  });

  it.each(['member', 'api'] as const)(
    'keeps unowned resources attachable for %s callers when ownership is enforced',
    async kind => {
      mocks.providerConfig.findMany.mockResolvedValue([config()]);
      mocks.providerAuthConfig.findMany.mockResolvedValue([authConfig()]);

      await expect(
        assertCanAttachSubspaceResourcesToCoreParent({
          accessor: accessor({ kind }),
          tenant: { oid: 1n },
          parent: ownedServer,
          providerConfigIds: ['pcf_1'],
          providerAuthConfigIds: ['pac_1']
        })
      ).resolves.toBeUndefined();
    }
  );

  it("rejects another consumer's resource for member callers when ownership is enforced", async () => {
    mocks.providerAuthConfig.findMany.mockResolvedValue([
      authConfig({ ownerActorOid: otherConsumerOid })
    ]);

    await expect(
      assertCanAttachSubspaceResourcesToCoreParent({
        accessor: accessor({}),
        tenant: { oid: 1n },
        parent: ownedServer,
        providerAuthConfigIds: ['pac_1']
      })
    ).rejects.toMatchObject({ data: { code: 'ownership_restricted' } });
  });

  it('skips the check when ownership is not enforced', async () => {
    await expect(
      assertCanAttachSubspaceResourcesToCoreParent({
        accessor: accessor({ isEnforced: false }),
        tenant: { oid: 1n },
        parent: ownedServer,
        providerAuthConfigIds: ['pac_1']
      })
    ).resolves.toBeUndefined();

    expect(mocks.providerAuthConfig.findMany).not.toHaveBeenCalled();
  });
});
