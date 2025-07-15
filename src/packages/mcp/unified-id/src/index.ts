import { base62 } from '@metorial/base62';
import type { SessionMessageType } from '@metorial/db';
import { MCP_IDS } from '@metorial/mcp-utils';

let PREFIX = MCP_IDS.UNIFIED;

export type Participant =
  | {
      type: 'server';
      id: string;
    }
  | {
      type: 'client';
      id: string;
    };

let extractUnifiedId = (id: string) =>
  JSON.parse(base62.decode(id.slice(PREFIX.length))) as [
    string,
    number,
    string,
    string | number
  ];

let parseUnifiedId = (id: string) => {
  if (!id || !id.startsWith(PREFIX)) return null;

  try {
    let [sessionId, type, participantId, originalId] = extractUnifiedId(id);

    return {
      sender: {
        type: type == 0 ? 'server' : 'client',
        ...(type == 0 ? { invocationId: participantId } : { connectionId: participantId })
      },
      sessionId,
      originalId
    };
  } catch (e) {
    console.error('Error parsing unified ID', e);
    return null;
  }
};

export class UnifiedID {
  constructor(private sessionId: string) {}

  static normalizeId(id: string | number | undefined | null) {
    if (typeof id != 'number' && typeof id != 'string') return undefined;

    if (typeof id == 'number') return id;

    let parsed = parseUnifiedId(id);
    if (!parsed) return id;

    return parsed.originalId;
  }

  serialize(d: { sender: Participant; originalId: string | number }) {
    if (typeof d.originalId == 'string' && d.originalId.startsWith(PREFIX)) {
      let parsed = parseUnifiedId(d.originalId);
      if (parsed && parsed.sessionId == this.sessionId) return d.originalId;
    }

    return (
      PREFIX +
      base62.encode(
        JSON.stringify([
          this.sessionId,
          d.sender.type == 'server' ? 0 : 1,
          d.sender.id,
          d.originalId
        ])
      )
    );
  }

  deserialize(id: string) {
    let parsed = parseUnifiedId(id);
    if (!parsed || parsed.sessionId !== this.sessionId) return id;

    return parsed.originalId;
  }
}

export let getUnifiedIdIfNeeded = (
  participantType: 'client' | 'server',
  message: {
    senderType: 'client' | 'server';
    originalId?: string | number | null;
    unifiedId?: string | null;
    type: SessionMessageType;
  }
) => {
  if (
    participantType != message.senderType &&
    message.type == 'request' &&
    message.unifiedId
  ) {
    return message.unifiedId;
  }

  return UnifiedID.normalizeId(message.originalId);
};
