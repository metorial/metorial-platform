import { describe, expect, it } from 'vitest';
import {
  createSessionPlaneState,
  deriveCapabilityTags,
  recordSessionOutput,
  recordSessionToolCall,
  SINK_PRECISION,
  SINK_RULE_KEY,
  type SessionFindingInput,
  type SessionPlaneState
} from './session';

let finding = (overrides: Partial<SessionFindingInput> = {}): SessionFindingInput => ({
  ruleKey: 'instruction_override.ignore_previous',
  family: 'instruction_override',
  precision: 0.9,
  stage: 'active',
  contentHmac: 'hmac-1',
  ...overrides
});

let output = (
  state: SessionPlaneState,
  messageId: string,
  findings: SessionFindingInput[],
  providerId: string | null = 'prov_a'
) => recordSessionOutput(state, { messageId, providerId, findings });

describe('recordSessionOutput', () => {
  it('tracks suspicious outputs only', () => {
    let state = createSessionPlaneState();

    state = output(state, 'm1', [finding({ precision: 0.3 })]).state;
    state = output(state, 'm2', [finding({ stage: 'shadow' })]).state;
    expect(state.outputs).toEqual([]);

    state = output(state, 'm3', [
      finding(),
      finding({ ruleKey: 'b.rule', family: 'b' })
    ]).state;
    expect(state.outputs).toEqual([
      {
        messageId: 'm3',
        providerId: 'prov_a',
        ruleKeys: ['b.rule', 'instruction_override.ignore_previous'],
        isConsumed: false
      }
    ]);
  });

  it('keeps only the most recent outputs', () => {
    let state = createSessionPlaneState();
    for (let index = 0; index < 30; index++) {
      state = output(state, `m${index}`, [finding({ contentHmac: null })]).state;
    }

    expect(state.outputs).toHaveLength(20);
    expect(state.outputs[0]!.messageId).toBe('m10');
  });

  it('escalates the same content once it repeats three times', () => {
    let state = createSessionPlaneState();

    let first = output(state, 'm1', [finding({ precision: 0.6 })]);
    let second = output(first.state, 'm2', [finding({ precision: 0.6 })]);
    let third = output(second.state, 'm3', [finding({ precision: 0.6 })]);
    let fourth = output(third.state, 'm4', [finding({ precision: 0.6 })]);

    expect(first.findings).toEqual([]);
    expect(second.findings).toEqual([]);
    expect(third.findings).toEqual([
      {
        ruleKey: 'instruction_override.repeated_in_session',
        family: 'instruction_override',
        precision: expect.closeTo(0.8),
        hardRule: false,
        description: 'The same flagged content appeared 3 times in this session.',
        contentHmac: 'hmac-1'
      }
    ]);
    expect(fourth.findings).toEqual([]);
  });

  it('counts an HMAC once per message and caps the boosted precision', () => {
    let state = createSessionPlaneState();
    let twice = [finding({ precision: 0.9 }), finding({ precision: 0.85, ruleKey: 'x.y' })];

    state = output(state, 'm1', twice).state;
    state = output(state, 'm2', twice).state;
    expect(state.hmacCounts['hmac-1']).toBe(2);

    let { findings } = output(state, 'm3', twice);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.precision).toBe(0.95);
  });

  it('does not count shadow findings or findings without an HMAC', () => {
    let state = createSessionPlaneState();
    for (let index = 0; index < 5; index++) {
      let next = output(state, `m${index}`, [
        finding({ stage: 'shadow' }),
        finding({ contentHmac: null })
      ]);
      expect(next.findings).toEqual([]);
      state = next.state;
    }

    expect(state.hmacCounts).toEqual({});
  });

  it('bounds the tracked HMACs', () => {
    let state = createSessionPlaneState();
    for (let index = 0; index < 250; index++) {
      state = output(state, `m${index}`, [finding({ contentHmac: `h${index}` })]).state;
    }

    expect(Object.keys(state.hmacCounts)).toHaveLength(200);
    expect(state.hmacCounts.h0).toBeUndefined();
    expect(state.hmacCounts.h249).toBe(1);
  });

  it('does not mutate the previous state', () => {
    let state = createSessionPlaneState();
    let snapshot = JSON.stringify(state);

    output(state, 'm1', [finding()]);

    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('recordSessionToolCall', () => {
  it('fires when a suspicious output is followed by a sink on another provider', () => {
    let state = output(createSessionPlaneState(), 'm1', [finding()], 'prov_web').state;

    let result = recordSessionToolCall(state, {
      providerId: 'prov_mail',
      capabilityTags: ['external_comm']
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleKey: SINK_RULE_KEY,
        family: 'injection_followed_by_sink',
        precision: SINK_PRECISION,
        contentHmac: null
      })
    ]);
    expect(result.state.outputs[0]!.isConsumed).toBe(true);
  });

  it('fires at most once per source output', () => {
    let state = output(createSessionPlaneState(), 'm1', [finding()], 'prov_web').state;
    let call = { providerId: 'prov_mail', capabilityTags: ['state_change' as const] };

    let first = recordSessionToolCall(state, call);
    let second = recordSessionToolCall(first.state, call);

    expect(first.findings).toHaveLength(1);
    expect(second.findings).toEqual([]);
  });

  it('ignores non-sink tools and the same provider', () => {
    let state = output(createSessionPlaneState(), 'm1', [finding()], 'prov_web').state;

    expect(
      recordSessionToolCall(state, { providerId: 'prov_x', capabilityTags: ['reads_private'] })
        .findings
    ).toEqual([]);
    expect(
      recordSessionToolCall(state, {
        providerId: 'prov_web',
        capabilityTags: ['external_comm']
      }).findings
    ).toEqual([]);
  });

  it('uses the most recent unconsumed source', () => {
    let state = createSessionPlaneState();
    state = output(state, 'old', [finding({ ruleKey: 'a.old', family: 'a' })], 'prov_1').state;
    state = output(state, 'new', [finding({ ruleKey: 'b.new', family: 'b' })], 'prov_2').state;

    let result = recordSessionToolCall(state, {
      providerId: 'prov_3',
      capabilityTags: ['state_change']
    });

    expect(result.findings[0]!.description).toContain('b.new');
    expect(result.state.outputs.map(entry => entry.isConsumed)).toEqual([false, true]);
  });
});

describe('deriveCapabilityTags', () => {
  let mcp = (annotations: Record<string, unknown>) => ({
    mcpToolType: { type: 'mcp.tool', annotations }
  });

  it('only uses explicit hints', () => {
    expect(deriveCapabilityTags(null)).toEqual([]);
    expect(deriveCapabilityTags(mcp({}))).toEqual([]);
    expect(
      deriveCapabilityTags({
        mcpToolType: { type: 'other', annotations: { destructiveHint: true } }
      })
    ).toEqual([]);
  });

  it('maps MCP annotations to tags', () => {
    expect(deriveCapabilityTags(mcp({ readOnlyHint: true, openWorldHint: true }))).toEqual([
      'reads_private'
    ]);
    expect(deriveCapabilityTags(mcp({ destructiveHint: true, openWorldHint: true }))).toEqual([
      'external_comm',
      'state_change'
    ]);
    expect(deriveCapabilityTags(mcp({ readOnlyHint: false }))).toEqual(['state_change']);
  });

  it('lets explicit tags win over annotations', () => {
    expect(
      deriveCapabilityTags({ tags: { readOnly: true }, ...mcp({ readOnlyHint: false }) })
    ).toEqual(['reads_private']);
  });
});
