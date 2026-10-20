import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => import('../../../../../../db/src/lib/unique'));

let { db, getIdMock, upsertMock, findUniqueMock } = vi.hoisted(() => {
  let upsertMock = vi.fn(async (args: any) => ({
    ...args.create,
    oid: 1n
  }));

  let findUniqueMock = vi.fn(async (_args: any): Promise<any> => null);

  return {
    db: {
      sessionParticipant: {
        upsert: upsertMock,
        update: vi.fn(),
        findUnique: findUniqueMock
      }
    },
    getIdMock: vi.fn(() => ({ id: 'spar_test' })),
    upsertMock,
    findUniqueMock
  };
});

vi.mock('@metorial-subspace/db', () => ({
  db,
  getId: getIdMock
}));

// The per-process participant cache would carry rows across cases; caching itself is
// covered by @lowerdeck/cache.
vi.mock('@lowerdeck/cache', () => ({
  createLocallyCachedFunction: (opts: any) => opts.provider
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
    upsertMock.mockReset();
    upsertMock.mockImplementation(async (args: any) => ({ ...args.create, oid: 1n }));
    db.sessionParticipant.update.mockReset();
    findUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue(null);
  });

  let clientFrom = {
    type: 'connection_client' as const,
    transport: 'mcp' as const,
    participant: { identifier: 'claude-desktop', name: 'Claude Desktop' },
    agentInstance: { oid: 400n } as any
  };

  let existingClient = {
    oid: 5n,
    identifier: 'claude-desktop',
    name: 'Claude Desktop',
    connectionType: 'mcp',
    payload: { identifier: 'claude-desktop', name: 'Claude Desktop' },
    agentInstanceOid: 400n,
    identityActorOid: 100n,
    identityOid: 200n
  };

  it('returns an unchanged connection client without writing', async () => {
    findUniqueMock.mockResolvedValue(existingClient);

    let participant = await upsertParticipant({ session, from: clientFrom });

    expect(participant).toBe(existingClient);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('writes a connection client whose identity changed', async () => {
    findUniqueMock.mockResolvedValue({ ...existingClient, identityOid: 999n });

    await upsertParticipant({ session, from: clientFrom });

    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it('recovers a concurrent client creation and applies the requested identity and transport', async () => {
    let error = Object.assign(new Error('duplicate participant'), { code: 'P2002' });
    upsertMock.mockRejectedValueOnce(error);
    db.sessionParticipant.update.mockResolvedValue(existingClient);
    findUniqueMock.mockResolvedValueOnce(null);

    let participant = await upsertParticipant({ session, from: clientFrom });

    expect(participant).toBe(existingClient);
    expect(db.sessionParticipant.update).toHaveBeenCalledWith({
      where: { tenantOid_type_hash: { tenantOid: 10n, type: 'agent', hash: 'client-hash' } },
      include: { identity: { select: { id: true } }, identityActor: { select: { id: true } } },
      data: expect.objectContaining({
        connectionType: 'mcp',
        agentInstanceOid: 400n,
        identityActorOid: 100n,
        identityOid: 200n
      })
    });
  });

  it.each(['provider', 'system', 'unknown'] as const)(
    'recovers a concurrent %s creation without changing it',
    async type => {
      upsertMock.mockRejectedValueOnce(
        Object.assign(new Error('duplicate'), { code: 'P2002' })
      );
      let existing = { oid: 50n, identity: null, identityActor: null };
      db.sessionParticipant.update.mockResolvedValueOnce(existing);

      let participant = await upsertParticipant({
        session,
        from: type === 'provider' ? { type, provider } : { type }
      });

      expect(participant).toBe(existing);
      expect(db.sessionParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantOid_type_hash: {
              tenantOid: 10n,
              type,
              hash: type === 'provider' ? 'provider:pro_test' : type
            }
          },
          data: {},
          include: {
            identity: { select: { id: true } },
            identityActor: { select: { id: true } }
          }
        })
      );
    }
  );

  it('preserves the original conflict when no matching client exists', async () => {
    let error = Object.assign(new Error('unrelated oid collision'), { code: 'P2002' });
    upsertMock.mockRejectedValueOnce(error);
    db.sessionParticipant.update.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { code: 'P2025' })
    );

    await expect(upsertParticipant({ session, from: clientFrom })).rejects.toBe(error);
  });

  it('preserves a static participant conflict when recovery finds no matching row', async () => {
    let error = Object.assign(new Error('duplicate'), { code: 'P2002' });
    upsertMock.mockRejectedValueOnce(error);
    db.sessionParticipant.update.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { code: 'P2025' })
    );

    await expect(upsertParticipant({ session, from: { type: 'system' } })).rejects.toBe(error);
  });

  it('propagates errors raised while applying a concurrent client update', async () => {
    upsertMock.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 'P2002' }));
    let error = Object.assign(new Error('foreign key'), { code: 'P2003' });
    db.sessionParticipant.update.mockRejectedValueOnce(error);

    await expect(upsertParticipant({ session, from: clientFrom })).rejects.toBe(error);
  });

  it('propagates non-unique errors without recovery', async () => {
    let error = Object.assign(new Error('foreign key'), { code: 'P2003' });
    upsertMock.mockRejectedValueOnce(error);

    await expect(upsertParticipant({ session, from: clientFrom })).rejects.toBe(error);

    expect(db.sessionParticipant.update).not.toHaveBeenCalled();
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
