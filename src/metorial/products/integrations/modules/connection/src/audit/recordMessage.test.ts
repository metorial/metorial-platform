import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  instance: { findUnique: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({ db: { instance: mocks.instance } }));
// Only the recorder is swapped: the resource definitions this module validates against
// come from the same package and must stay real, so the payloads are checked for real.
vi.mock('@metorial/audit-stash', async importOriginal => ({
  ...((await importOriginal()) as object),
  createAuditRecorder: () => ({ recordEvent: mocks.recordEvent, recordEvents: vi.fn() })
}));

import { isAuditableMessage, recordMessageAuditEvent } from './recordMessage';

let message = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'msg_1',
    status: 'succeeded',
    type: 'tool_call',
    source: 'client',
    transport: 'mcp',
    failureReason: 'none',
    isProductive: true,
    retentionLevel: 'full',
    instanceOid: 3n,
    methodOrToolKey: 'tools/call',
    input: { secret: 'do not log me' },
    output: { secret: 'nor me' },
    session: { id: 'ses_1' },
    sessionProvider: {
      id: 'spv_1',
      tag: 'github',
      provider: { id: 'prv_1', name: 'GitHub' }
    },
    connection: { id: 'sco_1' },
    senderParticipant: {
      id: 'spa_1',
      type: 'agent',
      name: 'Claude',
      identityOid: null,
      identityActorOid: null,
      identity: null,
      identityActor: { id: 'ida_1' }
    },
    toolCall: {
      id: 'tlc_1',
      toolKey: 'create_issue',
      rationale: 'the user asked for a bug report',
      operation: 'create issue in acme/api'
    },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    completedAt: new Date('2026-01-01T00:00:02Z'),
    ...overrides
  }) as any;

let callOf = (index = 0) => mocks.recordEvent.mock.calls[index]!;
let payloadOf = () => callOf()[3].payload;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.instance.findUnique.mockResolvedValue({ organizationOid: 1n });
});

describe('data plane message audit', () => {
  it('never records the input or output, even at full retention', async () => {
    await recordMessageAuditEvent(message());

    let payload = payloadOf();
    expect(payload).not.toHaveProperty('input');
    expect(payload).not.toHaveProperty('output');
    expect(JSON.stringify(payload)).not.toContain('do not log me');
    expect(JSON.stringify(payload)).not.toContain('nor me');
  });

  it('records the tool, rationale and operation at full and intent_only', async () => {
    for (let retentionLevel of ['full', 'intent_only']) {
      mocks.recordEvent.mockClear();
      await recordMessageAuditEvent(message({ retentionLevel }));

      let payload = payloadOf();
      expect(payload.retentionLevel).toBe(retentionLevel);
      expect(payload.methodOrToolKey).toBe('tools/call');
      expect(payload.toolCall).toEqual({
        id: 'tlc_1',
        toolKey: 'create_issue',
        rationale: 'the user asked for a bug report',
        operation: 'create issue in acme/api'
      });
    }
  });

  it('withholds the tool and the rationale at none, but still records the message', async () => {
    await recordMessageAuditEvent(message({ retentionLevel: 'none' }));

    expect(mocks.recordEvent).toHaveBeenCalledTimes(1);
    let payload = payloadOf();
    expect(payload.retentionLevel).toBe('none');
    expect(payload.methodOrToolKey).toBeNull();
    expect(payload.toolCall).toBeNull();

    // what survives at none: that it happened, on which session, against which provider
    expect(payload.id).toBe('msg_1');
    expect(payload.sessionId).toBe('ses_1');
    expect(payload.sessionProvider).toEqual({
      id: 'spv_1',
      tag: 'github',
      provider: { id: 'prv_1', name: 'GitHub' }
    });
  });

  it('attributes the entry to the identity actor behind the participant', async () => {
    await recordMessageAuditEvent(message());

    let [scope] = callOf();
    expect(scope.organizationOid).toBe(1n);
    expect(scope.instanceOid).toBe(3n);
    expect(scope.actor.type).toBe('resource_actor');
    expect(scope.actor.id).toBe('ida_1');
    expect(scope.actor.metadata.participantId).toBe('spa_1');
  });

  it('stamps the entry with the message time, not the time it was finalised', async () => {
    await recordMessageAuditEvent(message());

    expect(callOf()[3].recordedAt).toEqual(
      new Date('2026-01-01T00:00:00Z')
    );
  });

  it('skips mcp control traffic but keeps every tool call', () => {
    expect(isAuditableMessage({ isProductive: true, toolCall: null })).toBe(true);
    expect(isAuditableMessage({ isProductive: false, toolCall: { id: 'tlc_1' } })).toBe(true);
    expect(isAuditableMessage({ isProductive: false, toolCall: null })).toBe(false);
  });

  it('records nothing for a session with no Metorial instance behind it', async () => {
    await recordMessageAuditEvent(message({ instanceOid: null }));

    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });

  it('never lets an audit failure escape into message finalisation', async () => {
    mocks.instance.findUnique.mockRejectedValue(new Error('redis is down'));

    await expect(recordMessageAuditEvent(message())).resolves.toBeUndefined();
  });
});
