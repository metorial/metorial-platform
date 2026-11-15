import { describe, expect, it } from 'vitest';
import { buildDraft, unitPrincipal } from '@mtsrc/agent-tracking-dialects/test/build';
import {
  buildInferKey,
  correlationKey,
  isInferable,
  orphanKey,
  recordActor,
  recordCorrelations
} from '../src/lib/keys';

let event = (overrides: Parameters<typeof buildDraft>[0]['ctx'] = {}) =>
  buildDraft({
    kind: 'event',
    type: 'model.request',
    identity: crypto.randomUUID(),
    client: { family: 'claude-code' },
    ctx: overrides
  });

describe('buildInferKey', () => {
  it('prefers the device over the user', () => {
    expect(
      buildInferKey({
        instanceId: 'atin_1',
        family: 'claude-code',
        actor: { userId: 'aten_user', deviceId: 'aten_device' }
      })
    ).toBe('atin_1:claude-code:aten_device');

    expect(
      buildInferKey({ instanceId: 'atin_1', family: 'codex', actor: { userId: 'aten_user' } })
    ).toBe('atin_1:codex:aten_user');
  });

  it('has no key without an actor', () => {
    expect(
      buildInferKey({ instanceId: 'atin_1', family: 'cursor', actor: {} })
    ).toBeUndefined();
  });
});

describe('recordActor', () => {
  it('uses the stamped attribution first', () => {
    let record = event();
    record.attribution = { user_id: 'aten_stamped', device_id: 'aten_stamped_device' };

    expect(recordActor(record, unitPrincipal())).toEqual({
      userId: 'aten_stamped',
      deviceId: 'aten_stamped_device',
      agentId: undefined
    });
  });

  it('falls back to the token binding, with the device only when it is bound', () => {
    let record = event();

    expect(recordActor(record, unitPrincipal({ binding: { agentId: 'aten_agent' } }))).toEqual(
      {
        userId: 'aten_user_unit',
        deviceId: 'aten_device_unit',
        agentId: 'aten_agent'
      }
    );

    expect(
      recordActor(record, unitPrincipal({ binding: { deviceMode: 'ephemeral' } })).deviceId
    ).toBeUndefined();
  });

  it('does not borrow the binding for source records', () => {
    let record = event();
    record.ingest.credential_kind = 'source';

    expect(recordActor(record, unitPrincipal())).toEqual({
      userId: undefined,
      deviceId: undefined,
      agentId: undefined
    });
  });
});

describe('correlations', () => {
  it('reads trace, request, turn and generation ids', () => {
    let record = event({
      trace: { traceId: 'trace_1' },
      requestId: 'req_1',
      turnId: 'turn_1',
      generationId: 'aten_1'
    });

    expect(recordCorrelations(record)).toEqual([
      { type: 'trace', value: 'trace_1' },
      { type: 'request', value: 'req_1' },
      { type: 'turn', value: 'turn_1' },
      { type: 'generation', value: 'aten_1' }
    ]);
  });

  it('keys links and orphans per instance', () => {
    let correlation = { type: 'request', value: 'req_1' } as const;

    expect(correlationKey('atin_1', correlation)).toBe('atin_1:request:req_1');
    expect(orphanKey('atin_1', correlation)).toBe('orphan:atin_1:request:req_1');
  });
});

describe('isInferable', () => {
  it('only infers sessions for event records that are not aggregates', () => {
    expect(isInferable(event())).toBe(true);

    let aggregate = event();
    aggregate.source.role = 'aggregate';
    expect(isInferable(aggregate)).toBe(false);

    let measurement = buildDraft({
      kind: 'measurement',
      type: 'tokens',
      identity: 'metric',
      client: { family: 'claude-code' }
    });
    expect(isInferable(measurement)).toBe(false);
  });
});
