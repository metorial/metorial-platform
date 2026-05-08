import { beforeEach, describe, expect, it, vi } from 'vitest';

let findFirst = vi.fn();
let findUnique = vi.fn();
let listenToAssistantRunDeltas = vi.fn();

vi.mock('@metorial/db', () => ({
  db: {
    assistantRequest: {
      findFirst,
      findUnique
    }
  },
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn()
}));

vi.mock('../src/lib/run/redisDeltas', () => ({
  listenToAssistantRunDeltas
}));

vi.mock('../src/definitions/assistants', () => ({
  assistants: {}
}));

vi.mock('../src/queues/processRequest', () => ({
  processAssistantRequestQueue: {
    add: vi.fn()
  }
}));

vi.mock('../src/queues/generateConversationTitle', () => ({
  generateAssistantConversationTitleQueue: {
    add: vi.fn()
  }
}));

describe('assistant request deltas', () => {
  beforeEach(() => {
    vi.resetModules();
    findFirst.mockReset();
    findUnique.mockReset();
    listenToAssistantRunDeltas.mockReset();
  });

  it('waits for the run to exist before subscribing to request deltas', async () => {
    let close = vi.fn(async () => {});

    findFirst.mockResolvedValue({
      oid: 1n,
      id: 'asq_1',
      runs: [],
      conversation: {
        organizationOid: 11n,
        instanceOid: 22n,
        createdByActorOid: 33n
      }
    });
    findUnique
      .mockResolvedValueOnce({
        oid: 1n,
        id: 'asq_1',
        runs: [],
        conversation: {
          organizationOid: 11n,
          instanceOid: 22n,
          createdByActorOid: 33n
        }
      })
      .mockResolvedValueOnce({
        oid: 1n,
        id: 'asq_1',
        runs: [{ id: 'arun_1' }],
        conversation: {
          organizationOid: 11n,
          instanceOid: 22n,
          createdByActorOid: 33n
        }
      });
    listenToAssistantRunDeltas.mockResolvedValue(close);

    let { assistantRequestService } = await import('../src/services/request');
    let onMessage = vi.fn();

    let unsubscribe = await assistantRequestService.listenToAssistantRequestDeltas({
      organization: { oid: 11n } as any,
      instance: { oid: 22n } as any,
      actor: { oid: 33n } as any,
      requestId: 'asq_1',
      pollIntervalMs: 0,
      onMessage
    });

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(listenToAssistantRunDeltas).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'arun_1',
        onMessage
      })
    );

    await unsubscribe();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
