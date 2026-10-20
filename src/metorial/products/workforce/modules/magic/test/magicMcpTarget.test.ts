import { beforeEach, describe, expect, it, vi } from 'vitest';

let db = vi.hoisted(() => ({
  magicMcpServer: { findFirst: vi.fn() },
  magicMcpEndpoint: { findFirst: vi.fn() },
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
    db.magicMcpServer.findFirst.mockResolvedValue(null);
    db.magicMcpEndpoint.findFirst.mockResolvedValue(null);
    db.magicMcpServerAlias.findUnique.mockResolvedValue(null);
  });

  it.each([
    { type: 'server', model: 'magicMcpServer', target: server },
    { type: 'endpoint', model: 'magicMcpEndpoint', target: endpoint }
  ] as const)('resolves a $type ID before considering aliases or slugs', async entry => {
    db[entry.model].findFirst
      .mockResolvedValueOnce(entry.target)
      .mockResolvedValueOnce(entry.target);

    let result = await resolveMagicMcpTargetByIdOrAlias(entry.target.id);

    expect(result).toEqual({ type: entry.type, target: entry.target });
    expect(db.magicMcpServerAlias.findUnique).not.toHaveBeenCalled();
    expect(db.magicMcpServer.findFirst.mock.calls[0]).toEqual([
      { where: { id: entry.target.id, status: 'active' } }
    ]);
    expect(db.magicMcpEndpoint.findFirst.mock.calls[0]).toEqual([
      { where: { id: entry.target.id, status: 'active' } }
    ]);
    expect(db[entry.model].findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { oid: entry.target.oid, status: 'active' },
        relationLoadStrategy: 'query'
      })
    );
  });

  it('resolves an alias without loading endpoint relations', async () => {
    db.magicMcpServerAlias.findUnique.mockResolvedValue({ serverOid: server.oid });
    db.magicMcpServer.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(server);

    let result = await resolveMagicMcpTargetByIdOrAlias('notion-alias');

    expect(result).toEqual({ type: 'server', target: server });
    expect(db.magicMcpServerAlias.findUnique).toHaveBeenCalledWith({
      where: { slug: 'notion-alias', server: { status: 'active' } }
    });
    expect(db.magicMcpEndpoint.findFirst.mock.calls).toEqual([
      [{ where: { id: 'notion-alias', status: 'active' } }],
      [{ where: { slug: 'notion-alias', status: 'active' } }]
    ]);
    expect(db.magicMcpServer.findFirst).toHaveBeenLastCalledWith({
      where: { oid: server.oid, status: 'active' },
      include: { aliases: true, instance: true, subspaceSession: true },
      relationLoadStrategy: 'query'
    });
  });

  it('loads only connection relations for the matching endpoint slug', async () => {
    db.magicMcpEndpoint.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(endpoint)
      .mockResolvedValueOnce(endpoint);

    let result = await resolveMagicMcpTargetByIdOrAlias('endpoint-slug');

    expect(result).toEqual({ type: 'endpoint', target: endpoint });
    expect(db.magicMcpEndpoint.findFirst.mock.calls).toEqual([
      [{ where: { id: 'endpoint-slug', status: 'active' } }],
      [{ where: { slug: 'endpoint-slug', status: 'active' } }],
      [
        {
          where: { oid: endpoint.oid, status: 'active' },
          include: {
            consumerProfile: true,
            instance: true,
            servers: { include: { magicMcpServer: true } },
            subspaceSession: true
          },
          relationLoadStrategy: 'query'
        }
      ]
    ]);
    expect(db.magicMcpServer.findFirst).toHaveBeenCalledTimes(1);
  });

  it('rejects ambiguous IDs before loading either target', async () => {
    db.magicMcpServer.findFirst.mockResolvedValue(server);
    db.magicMcpEndpoint.findFirst.mockResolvedValue(endpoint);

    await expect(resolveMagicMcpTargetByIdOrAlias('shared-id')).rejects.toThrow(
      'identifier is ambiguous'
    );

    expect(db.magicMcpServer.findFirst).toHaveBeenCalledTimes(1);
    expect(db.magicMcpEndpoint.findFirst).toHaveBeenCalledTimes(1);
    expect(db.magicMcpServerAlias.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an alias and slug collision before loading either target', async () => {
    db.magicMcpServerAlias.findUnique.mockResolvedValue({ serverOid: server.oid });
    db.magicMcpEndpoint.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(endpoint);

    await expect(resolveMagicMcpTargetByIdOrAlias('shared-slug')).rejects.toThrow(
      'identifier is ambiguous'
    );

    expect(db.magicMcpServer.findFirst).toHaveBeenCalledTimes(1);
    expect(db.magicMcpEndpoint.findFirst).toHaveBeenCalledTimes(2);
  });

  it.each([
    { type: 'server', model: 'magicMcpServer', target: server },
    { type: 'endpoint', model: 'magicMcpEndpoint', target: endpoint }
  ] as const)('does not return a $type archived between lookup and loading', async entry => {
    db[entry.model].findFirst.mockResolvedValueOnce(entry.target).mockResolvedValueOnce(null);

    let result = await resolveMagicMcpTargetByIdOrAliasSafe(entry.target.id);

    expect(result).toBeNull();
    expect(db[entry.model].findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { oid: entry.target.oid, status: 'active' } })
    );
    expect(db.magicMcpServerAlias.findUnique).not.toHaveBeenCalled();
  });

  it('returns null for a missing or inactive target without loading relations', async () => {
    expect(await resolveMagicMcpTargetByIdOrAliasSafe('missing')).toBeNull();

    expect(db.magicMcpServer.findFirst.mock.calls).toEqual([
      [{ where: { id: 'missing', status: 'active' } }]
    ]);
    expect(db.magicMcpEndpoint.findFirst.mock.calls).toEqual([
      [{ where: { id: 'missing', status: 'active' } }],
      [{ where: { slug: 'missing', status: 'active' } }]
    ]);
  });

  it('throws when a required target is missing', async () => {
    await expect(resolveMagicMcpTargetByIdOrAlias('missing')).rejects.toThrow();
  });
});
