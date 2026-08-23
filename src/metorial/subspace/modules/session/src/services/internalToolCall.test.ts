import { beforeEach, describe, expect, it, vi } from 'vitest';

let { createLock, manager, db, messageOutputToToolCall, assertSessionInternalAdapter } =
  vi.hoisted(() => ({
    createLock: vi.fn(() => ({
      usingLock: async (_key: string, fn: () => Promise<any>) => fn()
    })),
    manager: {
      create: vi.fn(),
      setConnection: vi.fn(),
      initialize: vi.fn(),
      callTool: vi.fn()
    },
    db: {
      sessionConnection: { findFirst: vi.fn(), update: vi.fn() },
      session: { updateMany: vi.fn() },
      sessionEvent: { create: vi.fn() },
      toolCall: { findFirstOrThrow: vi.fn() }
    },
    messageOutputToToolCall: vi.fn(),
    assertSessionInternalAdapter: vi.fn()
  }));

vi.mock('@lowerdeck/lock', () => ({ createLock }));
vi.mock('@metorial-subspace/db', () => ({
  db,
  getId: vi.fn(() => ({ oid: 6n, id: 'sev_1' })),
  messageOutputToToolCall
}));
vi.mock('@metorial-subspace/module-connection', () => ({ SenderManager: manager }));
vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ id: 'sol_1', oid: 1 }))
}));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('./_shared/internalAdapter', () => ({ assertSessionInternalAdapter }));

import { internalToolCallService } from './internalToolCall';

let session = {
  id: 'ses_1',
  oid: 1n,
  tenantOid: 2n,
  environmentOid: 3n,
  adapterGlobalOid: 4n,
  isInternal: true
};

let input = {
  tenant: { id: 'ten_1', oid: 2n },
  environment: { id: 'env_1', oid: 3n },
  session,
  adapter: { identifier: 'adapter' },
  client: { identifier: 'worker', name: 'Worker', privateMetadata: { source: 'test' } },
  key: 'provider_search',
  input: { query: 'hello' }
};

describe('internalToolCallService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    manager.create.mockResolvedValue(manager);
    manager.initialize.mockResolvedValue({ id: 'scn_1' });
    manager.callTool.mockResolvedValue({
      status: 'succeeded',
      output: { type: 'tool.result', data: { result: 'ok' } },
      message: {
        id: 'smg_1',
        oid: 5n,
        status: 'succeeded',
        createdAt: new Date('2026-01-01'),
        completedAt: new Date('2026-01-01')
      }
    });
    db.sessionConnection.findFirst.mockResolvedValue(null);
    db.toolCall.findFirstOrThrow.mockResolvedValue({
      id: 'tcl_1',
      toolKey: 'provider_search'
    });
    messageOutputToToolCall.mockResolvedValue({ result: 'ok' });
  });

  it('uses a system-participant direct connection and returns basic telemetry', async () => {
    await expect(internalToolCallService.call(input as any)).resolves.toEqual({
      result: {
        status: 'success',
        output: { result: 'ok' }
      },
      message: {
        id: 'smg_1',
        oid: 5n,
        status: 'succeeded',
        createdAt: new Date('2026-01-01'),
        completedAt: new Date('2026-01-01')
      },
      connection: { id: 'scn_1' }
    });

    expect(assertSessionInternalAdapter).toHaveBeenCalledWith({
      session,
      adapter: input.adapter
    });
    expect(manager.initialize).toHaveBeenCalledWith({
      client: {
        identifier: 'metorial#worker',
        name: 'Worker',
        privateMetadata: { source: 'test' }
      },
      mcpTransport: 'none',
      isManualConnection: true,
      allowReservedClientIdentifier: true,
      systemIdentifier: expect.stringMatching(/^int-tc:ses_1:worker:\d{4}-\d{2}-\d{2}$/)
    });
    expect(manager.callTool).toHaveBeenCalledWith({
      toolId: 'provider_search',
      input: { type: 'tool.call', data: { query: 'hello' } },
      waitForResponse: true,
      transport: 'tool_call'
    });
    expect(db.sessionConnection.findFirst).toHaveBeenCalledWith({
      where: {
        systemIdentifier: expect.stringMatching(/^int-tc:ses_1:worker:\d{4}-\d{2}-\d{2}$/),
        status: 'active',
        isManuallyDisabled: false
      },
      include: { participant: true }
    });
  });

  it('reuses the connection belonging to the same caller', async () => {
    db.sessionConnection.findFirst.mockResolvedValue({
      id: 'scn_existing',
      state: 'connected'
    });

    await internalToolCallService.call(input as any);

    expect(manager.initialize).not.toHaveBeenCalled();
    expect(manager.setConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scn_existing' })
    );
  });

  it('reconnects a disconnected connection with the same identifier', async () => {
    let disconnected = { oid: 7n, id: 'scn_disconnected', state: 'disconnected' };
    db.sessionConnection.findFirst.mockResolvedValue(disconnected);
    db.sessionConnection.update.mockResolvedValue({
      ...disconnected,
      state: 'connected'
    });

    await internalToolCallService.call(input as any);

    expect(db.sessionConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 7n },
        data: expect.objectContaining({ state: 'connected' })
      })
    );
    expect(db.sessionEvent.create).not.toHaveBeenCalled();
  });

  it('does not initialize a connection when the internal adapter is rejected', async () => {
    assertSessionInternalAdapter.mockRejectedValueOnce(new Error('adapter mismatch'));

    await expect(internalToolCallService.call(input as any)).rejects.toThrow(
      'adapter mismatch'
    );

    expect(manager.create).not.toHaveBeenCalled();
    expect(manager.initialize).not.toHaveBeenCalled();
  });
});
