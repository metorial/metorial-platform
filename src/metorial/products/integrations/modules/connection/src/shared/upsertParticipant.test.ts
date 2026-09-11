import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, getIdMock, upsertMock } = vi.hoisted(() => {
  let upsertMock = vi.fn(async (args: any) => ({
    ...args.create,
    oid: 1n
  }));

  return {
    db: {
      sessionParticipant: {
        upsert: upsertMock
      }
    },
    getIdMock: vi.fn(() => ({ id: 'spar_test' })),
    upsertMock
  };
});

vi.mock('@metorial-subspace/db', () => ({
  db,
  getId: getIdMock
}));

vi.mock('@lowerdeck/canonicalize', () => ({
  canonicalize: vi.fn(() => 'canonicalized')
}));

vi.mock('@lowerdeck/hash', () => ({
  Hash: {
    sha256: vi.fn(async () => 'client-hash')
  }
}));

import { upsertParticipant } from './upsertParticipant';

let session = {
  tenantOid: 10n,
  projectOid: 11n,
  environmentOid: 20n,
  instanceOid: 21n,
  identityActorOid: 100n,
  identityOid: 200n
} as any;

let unlinkedSession = {
  tenantOid: 10n,
  projectOid: null,
  environmentOid: 20n,
  instanceOid: null,
  identityActorOid: 100n,
  identityOid: 200n
} as any;

let provider = {
  oid: 300n,
  id: 'pro_test',
  name: 'Test Provider'
} as any;

describe('upsertParticipant', () => {
  beforeEach(() => {
    upsertMock.mockClear();
  });

  it('persists session identity for connection clients', async () => {
    await upsertParticipant({
      session,
      from: {
        type: 'connection_client',
        transport: 'mcp',
        participant: {
          identifier: 'claude-desktop',
          name: 'Claude Desktop'
        },
        agentInstance: { oid: 400n } as any
      }
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          identityActorOid: 100n,
          identityOid: 200n,
          agentInstanceOid: 400n
        }),
        update: expect.objectContaining({
          identityActorOid: 100n,
          identityOid: 200n
        })
      })
    );
  });

  it('does not persist session identity for provider participants', async () => {
    await upsertParticipant({
      session,
      from: {
        type: 'provider',
        provider
      }
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          providerOid: 300n,
          identityActorOid: undefined,
          identityOid: undefined
        }),
        update: {}
      })
    );
  });

  it('double-writes the mirrored project and instance oids on create', async () => {
    await upsertParticipant({
      session,
      from: {
        type: 'provider',
        provider
      }
    });

    let { create } = upsertMock.mock.calls[0]![0];

    expect(create.tenantOid).toBe(10n);
    expect(create.projectOid).toBe(11n);
    expect(create.environmentOid).toBe(20n);
    expect(create.instanceOid).toBe(21n);
  });

  it('keeps the legacy composite unique key free of mirrored oids', async () => {
    await upsertParticipant({
      session,
      from: {
        type: 'provider',
        provider
      }
    });

    expect(upsertMock.mock.calls[0]![0].where).toEqual({
      tenantOid_type_hash: {
        tenantOid: 10n,
        type: 'provider',
        hash: 'provider:pro_test'
      }
    });
  });

  it('writes null mirrored oids for an unlinked tenant and environment', async () => {
    await upsertParticipant({
      session: unlinkedSession,
      from: {
        type: 'provider',
        provider
      }
    });

    let { create } = upsertMock.mock.calls[0]![0];

    expect(create.projectOid).toBeNull();
    expect(create.instanceOid).toBeNull();
    expect(create.tenantOid).toBe(10n);
    expect(create.environmentOid).toBe(20n);
  });
});
