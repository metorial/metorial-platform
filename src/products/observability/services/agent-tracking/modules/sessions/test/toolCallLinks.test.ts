import type { ToolCallLinkDocument } from '@mtsrc/agent-tracking-store';
import { describe, expect, it } from 'vitest';
import {
  ambiguousToolCallPairs,
  maxSummaryMetorialIds,
  metorialSummaryOf,
  stampOps,
  toolCallLinkId,
  toolCallLinkOps,
  usableToolCallLinks,
  type ToolCallLinkInput
} from '../src/lib/toolCallLinks';
import { toolCallRepoOps } from '../src/lib/toolCallRepos';
import type { SessionMcpToolCallRef, ToolCallRecord } from '../src/lib/toolCalls';

let scope = {
  organizationId: 'ator_1',
  projectId: 'atpr_1',
  instanceId: 'atin_1',
  recordRetentionDays: 90
};

let session = { _id: 'session-1', organizationId: 'ator_1', instanceId: 'atin_1' };

let calledAt = new Date('2026-11-27T10:00:00Z');

let now = new Date('2026-11-27T10:05:00Z');

let link = (
  toolCallId: string,
  metorial: Partial<ToolCallLinkInput['metorial']> = {}
): ToolCallLinkInput => ({
  clientFamily: 'claude-code',
  toolCallId,
  calledAt,
  metorial: {
    toolCallId: `tcal_${toolCallId}`,
    providerId: 'pro_1',
    toolKey: 'search',
    ...metorial
  }
});

let stored = (
  toolCallId: string,
  metorial: Partial<ToolCallLinkInput['metorial']> | null = {}
): ToolCallLinkDocument =>
  ({
    _id: toolCallLinkId({ instanceId: 'atin_1', clientFamily: 'claude-code', toolCallId }),
    organizationId: 'ator_1',
    projectId: 'atpr_1',
    instanceId: 'atin_1',
    clientFamily: 'claude-code',
    toolCallId,
    ...(metorial
      ? { metorial: { ...link(toolCallId, metorial).metorial, calledAt } }
      : { conflict: true }),
    createdAt: now,
    expiresAt: now
  }) as ToolCallLinkDocument;

let call = (
  toolCallId: string,
  state: Partial<Omit<SessionMcpToolCallRef, 'clientFamily' | 'toolCallId'>> = {}
): SessionMcpToolCallRef => ({
  clientFamily: 'claude-code',
  toolCallId,
  stamped: false,
  unstamped: true,
  missingToolKey: false,
  ...state
});

let record = (toolCallId: string, sessionKey = session._id) =>
  ({ ctx: { toolCallId, sessionKey }, metorial: undefined }) as unknown as ToolCallRecord;

describe('toolCallLinkOps', () => {
  it('inserts each link once and expires it with the records of its instance', () => {
    let ops = toolCallLinkOps({
      scope,
      links: [
        link('toolu_1'),
        { ...link('toolu_2'), calledAt: new Date('2026-01-01T00:00:00Z') }
      ],
      now
    });

    expect(ops.inserts).toHaveLength(1);
    expect(ops.inserts[0]!.updateOne.filter).toEqual({ _id: 'atin_1:claude-code:toolu_1' });
    expect(ops.inserts[0]!.updateOne.update.$setOnInsert).toMatchObject({
      organizationId: 'ator_1',
      projectId: 'atpr_1',
      metorial: {
        toolCallId: 'tcal_toolu_1',
        providerId: 'pro_1',
        toolKey: 'search',
        calledAt
      },
      expiresAt: new Date('2027-02-25T10:00:00Z')
    });
  });

  it('marks a pair another Metorial call claims as a conflict and fills a missing tool key', () => {
    let { updates } = toolCallLinkOps({ scope, links: [link('toolu_1')], now });

    expect(updates.map(update => update.updateOne.update)).toEqual([
      { $set: { conflict: true }, $unset: { metorial: '' } },
      { $set: { 'metorial.toolKey': 'search' } }
    ]);
    expect(updates[0]!.updateOne.filter).toMatchObject({
      conflict: { $ne: true },
      'metorial.toolCallId': { $ne: 'tcal_toolu_1' }
    });
  });

  it('carries no tool key while Detailed Tool Reporting is off', () => {
    let withoutKey = link('toolu_1');
    delete withoutKey.metorial.toolKey;

    let ops = toolCallLinkOps({ scope, links: [withoutKey], now });

    expect(ops.inserts[0]!.updateOne.update.$setOnInsert.metorial).not.toHaveProperty(
      'toolKey'
    );
    expect(ops.updates).toHaveLength(1);
  });

  it('clamps ids the way ingest does, so overlong ids still meet their records', () => {
    let long = `toolu_${'x'.repeat(400)}`;
    let ops = toolCallLinkOps({
      scope,
      links: [
        {
          ...link(long, { toolCallId: `tcal_${'y'.repeat(400)}`, toolKey: 'k'.repeat(300) }),
          clientFamily: 'f'.repeat(300)
        }
      ],
      now
    });
    let inserted = ops.inserts[0]!.updateOne.update.$setOnInsert;

    expect(ops.inserts[0]!.updateOne.filter._id).toBe(
      `atin_1:${'f'.repeat(256)}:${long.slice(0, 256)}`
    );
    expect(inserted.clientFamily).toHaveLength(256);
    expect(inserted.toolCallId).toHaveLength(256);
    expect(inserted.metorial.toolCallId).toHaveLength(256);
    expect(inserted.metorial.toolKey).toHaveLength(256);
  });
});

describe('stampOps', () => {
  it('stamps calls that are behind their link and leaves stamped ones alone', () => {
    let ops = stampOps({
      session,
      calls: [
        call('toolu_1'),
        call('toolu_2', { stamped: true, unstamped: false }),
        call('toolu_3', { stamped: true, unstamped: false, missingToolKey: true })
      ],
      links: [stored('toolu_1'), stored('toolu_2'), stored('toolu_3')]
    });

    expect(ops.map(op => op.updateMany.filter['ctx.toolCallId'])).toEqual([
      'toolu_1',
      'toolu_3'
    ]);
    expect(ops[0]!.updateMany).toMatchObject({
      filter: { 'ctx.sessionKey': 'session-1', 'metorial.toolKey': { $ne: 'search' } },
      update: {
        $set: {
          metorial: { toolCallId: 'tcal_toolu_1', providerId: 'pro_1', toolKey: 'search' }
        }
      }
    });
  });

  it('takes the stamp back from a call whose link is a conflict or blocked', () => {
    let ops = stampOps({
      session,
      calls: [call('toolu_1', { stamped: true }), call('toolu_2')],
      links: [stored('toolu_1', null), stored('toolu_2', null)]
    });

    expect(ops).toEqual([
      {
        updateMany: {
          filter: expect.objectContaining({
            'ctx.toolCallId': 'toolu_1',
            metorial: { $exists: true }
          }),
          update: { $unset: { metorial: '' } }
        }
      }
    ]);
  });

  it('stamps nothing for a link of a call the session does not have', () => {
    expect(
      stampOps({ session, calls: [call('toolu_2')], links: [stored('toolu_1')] })
    ).toEqual([]);
  });
});

describe('ambiguousToolCallPairs', () => {
  let pairs = (records: ToolCallRecord[]) =>
    ambiguousToolCallPairs({
      session,
      links: [stored('toolu_1')],
      readPairs: async () => records,
      readCall: async () => records
    });

  it('blocks a pair that occurs in another session too, or more often than one call can', async () => {
    expect((await pairs([record('toolu_1')])).ambiguous.size).toBe(0);
    expect(
      (await pairs([record('toolu_1'), record('toolu_1', 'session-2')])).ambiguous
    ).toEqual(new Set(['claude-code\u0000toolu_1']));
    expect(
      (await pairs(Array.from({ length: 9 }, () => record('toolu_1')))).ambiguous.size
    ).toBe(1);
  });

  it('lets a blocked link stamp nothing', () => {
    let links = usableToolCallLinks({
      links: [stored('toolu_1')],
      ambiguous: new Set(['claude-code\u0000toolu_1'])
    });

    expect(links[0]).not.toHaveProperty('metorial');
  });
});

describe('metorialSummaryOf', () => {
  it('collects the providers and tools used as sorted sets with a bound', () => {
    expect(
      metorialSummaryOf([
        stored('toolu_1', { providerId: 'pro_b', toolKey: 'search' }),
        stored('toolu_2', { providerId: 'pro_a', toolKey: 'create' }),
        stored('toolu_3', { providerId: 'pro_b', toolKey: 'search' }),
        stored('toolu_4', null)
      ])
    ).toEqual({ providerIds: ['pro_a', 'pro_b'], toolKeys: ['create', 'search'] });

    let many = Array.from({ length: maxSummaryMetorialIds + 5 }, (_, index) =>
      stored(`toolu_${index}`, { providerId: `pro_${1000 + index}` })
    );
    expect(metorialSummaryOf(many)!.providerIds).toHaveLength(maxSummaryMetorialIds);
    expect(metorialSummaryOf([stored('toolu_1', null)])).toBeUndefined();
  });
});

describe('toolCallRepoOps', () => {
  let ops = (repoIds: string[], current: (string | null)[]) =>
    toolCallRepoOps({
      session: { ...session, context: { repoIds } as never },
      repoIds: current
    });

  it('gives every tool call the repository of a session with exactly one', () => {
    expect(ops(['aten_repo_a'], [null, 'aten_repo_b'])).toEqual([
      {
        updateMany: {
          filter: {
            organizationId: 'ator_1',
            instanceId: 'atin_1',
            'ctx.sessionKey': 'session-1',
            type: 'tool.call',
            'attribution.repoId': { $ne: 'aten_repo_a' }
          },
          update: { $set: { 'attribution.repoId': 'aten_repo_a' } }
        }
      }
    ]);
  });

  it('removes the repository when the session has none or several', () => {
    for (let repoIds of [[], ['aten_repo_a', 'aten_repo_b']]) {
      expect(ops(repoIds, ['aten_repo_a'])[0]!.updateMany.update).toEqual({
        $unset: { 'attribution.repoId': '' }
      });
    }
  });

  it('writes nothing when every tool call already has it', () => {
    expect(ops(['aten_repo_a'], ['aten_repo_a'])).toEqual([]);
    expect(ops([], [null])).toEqual([]);
  });
});
