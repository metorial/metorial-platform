import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    sessionMessage: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  },
  getOffloadedSessionMessage: vi.fn(),
  getOffloadedSessionMessageSize: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({ db: mocks.db }));

vi.mock('./offload', () => ({
  getOffloadedSessionMessage: mocks.getOffloadedSessionMessage,
  getOffloadedSessionMessageSize: mocks.getOffloadedSessionMessageSize
}));

import { loadSessionMessageBodies } from './sessionMessageBodies';

let limitBytes = 1024;

let offloadedMessage = (sizes: { inputSize: number | null; outputSize: number | null }) => ({
  oid: 1n,
  id: 'smg_test',
  isOffloadedToStorage: true,
  ...sizes
});

describe('loadSessionMessageBodies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.sessionMessage.findMany.mockResolvedValue([]);
    mocks.db.sessionMessage.updateMany.mockResolvedValue({ count: 1 });
  });

  it('does not read the offloaded blob when the only small side is empty', async () => {
    let bodies = await loadSessionMessageBodies(
      [offloadedMessage({ inputSize: 0, outputSize: 50 * 1024 * 1024 })],
      { limitBytes }
    );

    expect(mocks.getOffloadedSessionMessage).not.toHaveBeenCalled();
    expect(mocks.getOffloadedSessionMessageSize).not.toHaveBeenCalled();
    expect(bodies.get(1n)).toMatchObject({
      input: null,
      inputOmitted: false,
      output: null,
      outputOmitted: true,
      outputSize: 50 * 1024 * 1024
    });
  });

  it('omits both sides when the offloaded blob exceeds the read budget', async () => {
    let bodies = await loadSessionMessageBodies(
      [offloadedMessage({ inputSize: 100, outputSize: 50 * 1024 * 1024 })],
      { limitBytes }
    );

    expect(mocks.getOffloadedSessionMessage).not.toHaveBeenCalled();
    expect(bodies.get(1n)).toMatchObject({
      input: null,
      inputOmitted: true,
      inputSize: 100,
      outputOmitted: true
    });
  });

  it('checks the blob size before reading legacy messages with unknown sizes', async () => {
    mocks.getOffloadedSessionMessageSize.mockResolvedValue(50 * 1024 * 1024);

    let bodies = await loadSessionMessageBodies(
      [offloadedMessage({ inputSize: null, outputSize: null })],
      { limitBytes }
    );

    expect(mocks.getOffloadedSessionMessage).not.toHaveBeenCalled();
    expect(bodies.get(1n)).toMatchObject({ inputOmitted: true, outputOmitted: true });
  });

  it('returns every body when there is no limit', async () => {
    let output = { type: 'mcp', data: { result: 'x'.repeat(5000) } };
    mocks.db.sessionMessage.findMany.mockImplementation(async (args: any) =>
      args.select.input ? [{ oid: 1n, input: null }] : [{ oid: 1n, output }]
    );

    let bodies = await loadSessionMessageBodies(
      [
        {
          oid: 1n,
          id: 'smg_test',
          isOffloadedToStorage: false,
          inputSize: 0,
          outputSize: 5040
        }
      ],
      { limitBytes: Number.POSITIVE_INFINITY }
    );

    expect(bodies.get(1n)).toMatchObject({ output, outputOmitted: false });
  });

  it('returns small offloaded bodies and omits the oversized side', async () => {
    mocks.getOffloadedSessionMessage.mockResolvedValue({
      v: 1,
      messageId: 'smg_test',
      input: { type: 'mcp', data: { id: 1 } },
      output: { type: 'mcp', data: { result: 'x'.repeat(2000) } }
    });

    let bodies = await loadSessionMessageBodies(
      [offloadedMessage({ inputSize: 30, outputSize: 2040 })],
      { limitBytes }
    );

    expect(mocks.getOffloadedSessionMessage).toHaveBeenCalledOnce();
    expect(bodies.get(1n)).toMatchObject({
      input: { type: 'mcp', data: { id: 1 } },
      inputOmitted: false,
      output: null,
      outputOmitted: true
    });
  });
});
