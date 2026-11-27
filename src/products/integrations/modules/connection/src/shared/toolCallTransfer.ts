import { createError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import type {
  ConduitResult,
  ConduitTransferResult
} from '@metorial-subspace/connection-utils';
import { db, type SessionMessage } from '@metorial-subspace/db';

let NATS_TOOL_CALL_PAYLOAD_LIMIT_BYTES = 3 * 1024 * 1024;
export let TOOL_CALL_OBJECT_STORAGE_MIN_BYTES = 8 * 1024 * 1024;
export let TOOL_CALL_PAYLOAD_TOO_LARGE_CODE = 'payload_too_large_for_retention' as const;

export let isLargeToolCallPayload = (payload: unknown) =>
  Buffer.byteLength(serialize.encode(payload)) >= NATS_TOOL_CALL_PAYLOAD_LIMIT_BYTES;

export let toolCallPayloadTooLargeError = (direction: 'request' | 'response') =>
  createError({
    status: 413,
    code: TOOL_CALL_PAYLOAD_TOO_LARGE_CODE,
    message: `The tool call ${direction} is too large to transfer under this session's data retention policy.`,
    hint: 'Use a smaller payload. Payloads of 3 MiB or more require full data retention.'
  });

export let toolCallResultForTransfer = (
  result: ConduitResult & { message: SessionMessage }
): ConduitTransferResult => {
  let message = result.message;
  let bodySize = (message.inputSize ?? 0) + (message.outputSize ?? 0);
  if (!message.isOffloadedToStorage && bodySize < NATS_TOOL_CALL_PAYLOAD_LIMIT_BYTES) {
    if (!isLargeToolCallPayload(result)) return result;

    // The response is also on the message record. Send one copy if that fits inline.
    if (result.output === message.output) {
      let compact = { ...result, output: null };
      if (!isLargeToolCallPayload(compact)) return compact;
    }
  }

  if (message.retentionLevel === 'full') {
    return { type: 'stored_tool_call_result', messageId: message.id };
  }

  return { ...result, message: { ...message, input: null, output: null } };
};

export let readToolCallTransferResult = async (d: {
  result: ConduitTransferResult;
  sessionOid: bigint;
  connectionOid: bigint;
}): Promise<ConduitResult> => {
  if (!('type' in d.result)) {
    let output = d.result.output ?? d.result.message?.output;
    return output && !d.result.output ? { ...d.result, output } : d.result;
  }

  let message = await db.sessionMessage.findUniqueOrThrow({
    where: {
      id: d.result.messageId,
      sessionOid: d.sessionOid,
      connectionOid: d.connectionOid,
      retentionLevel: 'full'
    },
    include: { toolCall: { include: { attachments: true } } }
  });

  if (message.isOffloadedToStorage) {
    let { getOffloadedSessionMessage } = await import('@metorial-subspace/connection-utils');
    let body = await getOffloadedSessionMessage(message, { live: true });
    if (!body?.output) throw new Error(`Stored tool call result ${message.id} is unavailable`);

    message = { ...message, input: body.input, output: body.output };
  }

  return {
    message,
    output: message.output,
    status: message.status,
    completedAt: message.completedAt
  };
};
