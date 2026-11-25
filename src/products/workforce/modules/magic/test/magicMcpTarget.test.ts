import { beforeEach, describe, expect, it, vi } from 'vitest';

let db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  magicMcpServer: { findFirst: vi.fn() },
  magicMcpEndpoint: { findFirst: vi.fn(), findUnique: vi.fn() },
  magicMcpServerAlias: { findUnique: vi.fn() }
}));

vi.mock('@metorial/db', () => ({ db }));

import {
  resolveMagicMcpTargetByIdOrAlias,
  resolveMagicMcpTargetByIdOrAliasSafe
} from '../src/lib/magicMcpTarget';

let server = {
  oid: 1n,
  id: 'mgsr_1',
  status: 'active',
  instance: { oid: 10n },
  aliases: [],
  subspaceSession: null
};

let endpoint = {
  oid: 2n,
  id: 'mgep_1',
  status: 'active',
  instance: { oid: 10n },
  consumerProfile: null,
  servers: [{ magicMcpServer: server }],
  subspaceSession: []
};

describe('magic MCP target resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$queryRaw.mockResolvedValue([]);
    db.magicMcpServer.findFirst.mockResolvedValue(null);
    db.magicMcpEndpoint.findFirst.mockResolvedValue(null);
    db.magicMcpEndpoint.findUnique.mockResolvedValue(null);
    db.magicMcpServerAlias.findUnique.mockResolvedValue(null);
  });

  it.each([
    { type: 'server', model: 'magicMcpServer', target: server },
    { type: 'endpoint', model: 'magicMcpEndpoint', target: endpoint }
  ] as const)('resolves a $type ID before considering aliases or slugs', async entry => {
    db.$queryRaw.mockResolvedValue([{ type: entry.type, oid: entry.target.oid }]);
    db[entry.model].findFirst.mockResolvedValue(entry.target);

    let result = await resolveMagicMcpTargetByIdOrAlias(entry.target.id);

    expect(result).toEqual({ type: entry.type, target: entry.target });
    expect(db.magicMcpServerAlias.findUnique).not.toHaveBeenCalled();
    expect(db.magicMcpEndpoint.findUnique).not.toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalledExactlyOnceWith(
      expect.any(Array),
      entry.target.id,
      entry.target.id
    );
    expect(db[entry.model].findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { oid: entry.target.oid, status: 'active', isSystemOwned: false },
        relationLoadStrategy: 'query'
      })
    );
  });

  it('resolves an alias without loading endpoint relations', async () => {
    db.magicMcpServerAlias.findUnique.mockResolvedValue({ serverOid: server.oid });
    db.magicMcpServer.findFirst.mockResolvedValue(server);

    let result = await resolveMagicMcpTargetByIdOrAlias('notion-alias');

    expect(result).toEqual({ type: 'server', target: server });
    expect(db.magicMcpServerAlias.findUnique).toHaveBeenCalledWith({
      where: { slug: 'notion-alias', server: { status: 'active', isSystemOwned: false } },
      select: { serverOid: true }
    });
    expect(db.magicMcpEndpoint.findUnique).toHaveBeenCalledWith({
      where: { slug: 'notion-alias', status: 'active', isSystemOwned: false },
      select: { oid: true }
    });
    expect(db.magicMcpEndpoint.findFirst).not.toHaveBeenCalled();
    expect(db.magicMcpServer.findFirst).toHaveBeenLastCalledWith({
      where: { oid: server.oid, status: 'active', isSystemOwned: false },
      include: { aliases: true, instance: true, subspaceSession: true },
      relationLoadStrategy: 'query'
    });
  });

  it('loads only connection relations for the matching endpoint slug', async () => {
    db.magicMcpEndpoint.findUnique.mockResolvedValue({ oid: endpoint.oid });
    db.magicMcpEndpoint.findFirst.mockResolvedValue(endpoint);

    let result = await resolveMagicMcpTargetByIdOrAlias('endpoint-slug');

    expect(result).toEqual({ type: 'endpoint', target: endpoint });
    expect(db.magicMcpEndpoint.findUnique).toHaveBeenCalledWith({
      where: { slug: 'endpoint-slug', status: 'active', isSystemOwned: false },
      select: { oid: true }
    });
    expect(db.magicMcpEndpoint.findFirst).toHaveBeenCalledExactlyOnceWith({
      where: { oid: endpoint.oid, status: 'active', isSystemOwned: false },
      include: {
        consumerProfile: true,
        instance: true,
        servers: { include: { magicMcpServer: true } },
        subspaceSession: true
      },
      relationLoadStrategy: 'query'
    });
    expect(db.magicMcpServer.findFirst).not.toHaveBeenCalled();
  });

  it('rejects ambiguous IDs before loading either target', async () => {
    db.$queryRaw.mockResolvedValue([
      { type: 'server', oid: server.oid },
      { type: 'endpoint', oid: endpoint.oid }
    ]);

    await expect(resolveMagicMcpTargetByIdOrAlias('shared-id')).rejects.toThrow(
      'identifier is ambiguous'
    );

    expect(db.magicMcpServer.findFirst).not.toHaveBeenCalled();
    expect(db.magicMcpEndpoint.findFirst).not.toHaveBeenCalled();
    expect(db.magicMcpEndpoint.findUnique).not.toHaveBeenCalled();
    expect(db.magicMcpServerAlias.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an alias and slug collision before loading either target', async () => {
    db.magicMcpServerAlias.findUnique.mockResolvedValue({ serverOid: server.oid });
    db.magicMcpEndpoint.findUnique.mockResolvedValue({ oid: endpoint.oid });

    await expect(resolveMagicMcpTargetByIdOrAlias('shared-slug')).rejects.toThrow(
      'identifier is ambiguous'
    );

    expect(db.magicMcpServer.findFirst).not.toHaveBeenCalled();
    expect(db.magicMcpEndpoint.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    { type: 'server', model: 'magicMcpServer', target: server },
    { type: 'endpoint', model: 'magicMcpEndpoint', target: endpoint }
  ] as const)('does not return a $type archived between lookup and loading', async entry => {
    db.$queryRaw.mockResolvedValue([{ type: entry.type, oid: entry.target.oid }]);

    let result = await resolveMagicMcpTargetByIdOrAliasSafe(entry.target.id);

    expect(result).toBeNull();
    expect(db[entry.model].findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { oid: entry.target.oid, status: 'active', isSystemOwned: false }
      })
    );
    expect(db.magicMcpServerAlias.findUnique).not.toHaveBeenCalled();
  });

  it('returns null for a missing or inactive target without loading relations', async () => {
    expect(await resolveMagicMcpTargetByIdOrAliasSafe('missing')).toBeNull();

    expect(db.magicMcpServerAlias.findUnique).toHaveBeenCalledTimes(1);
    expect(db.magicMcpEndpoint.findUnique).toHaveBeenCalledTimes(1);
    expect(db.magicMcpServer.findFirst).not.toHaveBeenCalled();
    expect(db.magicMcpEndpoint.findFirst).not.toHaveBeenCalled();
  });

  it('throws when a required target is missing', async () => {
    await expect(resolveMagicMcpTargetByIdOrAlias('missing')).rejects.toThrow();
  });
});
