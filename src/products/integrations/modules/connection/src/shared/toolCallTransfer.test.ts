import { serialize } from '@lowerdeck/serialize';
import type { ConduitResult } from '@metorial-subspace/connection-utils';
import type { SessionMessage } from '@metorial-subspace/db';
import { describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findUniqueOrThrow: vi.fn(),
  getOffloadedSessionMessage: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: { sessionMessage: { findUniqueOrThrow: mocks.findUniqueOrThrow } }
}));

vi.mock('@metorial-subspace/connection-utils', () => ({
  getOffloadedSessionMessage: mocks.getOffloadedSessionMessage
}));

import {
  isLargeToolCallPayload,
  readToolCallTransferResult,
  toolCallResultForTransfer
} from './toolCallTransfer';

let scope = { sessionOid: 7n, connectionOid: 9n };

let resultWithOutput = (text: string): ConduitResult & { message: SessionMessage } => {
  let output: PrismaJson.SessionMessageOutput = { type: 'tool.result', data: { text } };
  let completedAt = new Date();
  let message = {
    id: 'msg_tool',
    retentionLevel: 'full',
    isOffloadedToStorage: false,
    output,
    status: 'succeeded',
    completedAt
  } as SessionMessage;

  return { message, output, status: 'succeeded', completedAt };
};

describe('tool call result transfer', () => {
  it('measures the serialized UTF-8 payload at the 3 MiB boundary', () => {
    let payload = { text: 'é'.repeat(1024 * 1024) };
    let remaining = 3 * 1024 * 1024 - Buffer.byteLength(serialize.encode(payload));

    expect(isLargeToolCallPayload({ text: payload.text + 'a'.repeat(remaining - 1) })).toBe(
      false
    );
    expect(isLargeToolCallPayload({ text: payload.text + 'a'.repeat(remaining) })).toBe(true);
  });

  it('keeps small responses inline', async () => {
    let result = resultWithOutput('small');
    let transfer = toolCallResultForTransfer(result);

    expect(transfer).toBe(result);
    await expect(readToolCallTransferResult({ ...scope, result: transfer })).resolves.toBe(
      result
    );
  });

  it.each([false, true])('hydrates a stored result (offloaded: %s)', async offloaded => {
    let result = resultWithOutput('a'.repeat(3 * 1024 * 1024));
    let input: PrismaJson.SessionMessageInput = { type: 'tool.call', data: { query: 'x' } };
    let row = {
      ...result.message,
      input: offloaded ? null : input,
      output: offloaded ? null : result.output,
      isOffloadedToStorage: offloaded
    };
    mocks.findUniqueOrThrow.mockResolvedValueOnce(row);
    mocks.getOffloadedSessionMessage.mockReset();
    if (offloaded) {
      mocks.getOffloadedSessionMessage.mockResolvedValueOnce({ input, output: result.output });
    }

    let transfer = toolCallResultForTransfer({ ...result, message: row });
    expect(transfer).toEqual({ type: 'stored_tool_call_result', messageId: row.id });

    let hydrated = await readToolCallTransferResult({ ...scope, result: transfer });
    expect(mocks.findUniqueOrThrow).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { ...scope, id: row.id, retentionLevel: 'full' } })
    );
    expect(mocks.getOffloadedSessionMessage).toHaveBeenCalledTimes(offloaded ? 1 : 0);
    expect(hydrated).toMatchObject({
      ...result,
      message: { input, output: result.output, isOffloadedToStorage: offloaded }
    });
  });

  it.each(['full', 'intent_only'] as const)(
    'sends one copy of an inline response when duplication would exceed the limit (%s)',
    async retentionLevel => {
      let result = resultWithOutput('a'.repeat(2 * 1024 * 1024));
      result.message.retentionLevel = retentionLevel;

      let transfer = toolCallResultForTransfer(result);
      expect(isLargeToolCallPayload(transfer)).toBe(false);
      expect(transfer).toMatchObject({ output: null, message: { output: result.output } });
      await expect(
        readToolCallTransferResult({ ...scope, result: transfer })
      ).resolves.toEqual(result);
    }
  );
});
