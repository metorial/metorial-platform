import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { SessionDocument } from '../../store/derivedModels';
import {
  attributionFields,
  baseSliceOf,
  buildSessionlessSlices,
  buildSessionSlices,
  isSessionlessKey,
  parseSessionlessKey,
  sessionlessKey,
  type SliceAttribution
} from '../slices';
import { FACTS_VERSION } from '../versions';
import type { BaseSlice } from '../write';

let dayMs = 24 * 60 * 60 * 1000;
let now = new Date('2026-11-12T00:00:00Z');
let startedAt = new Date('2026-11-10T09:05:00Z');

let baseSlice = (overrides: Partial<BaseSlice> = {}): BaseSlice => ({
  bucket: new Date('2026-11-10T09:00:00Z'),
  bucketMinutes: 15,
  modelId: 'claude-sonnet-4-5',
  sessionsStarted: 1,
  turns: 2,
  requests: 3,
  failedRequests: 0,
  toolCalls: 4,
  tokens: { inputUncached: 100, output: 20, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
  costReported: [],
  costUsd: mongoose.Types.Decimal128.fromString('0.42'),
  lines: { added: 10, removed: 2 },
  ...overrides
});

let session = {
  _id: 'ses_1',
  organizationId: 'org_1',
  projectId: 'prj_1',
  instanceId: 'ins_1',
  rootSessionKey: 'ses_root',
  startedAt,
  expiresAt: new Date(startedAt.getTime() + 90 * dayMs),
  client: { family: 'claude-code', version: '2.1.0' },
  observed: {
    userId: 'ada',
    deviceId: 'mac',
    agentId: 'agt',
    clientUserIds: [],
    clientInstallationIds: []
  },
  context: {
    workspaceIds: ['ws_1'],
    repoIds: ['repo_1', 'repo_2'],
    ticketRefs: [],
    tags: [],
    pathStored: false
  }
} as unknown as SessionDocument;

let attribution: SliceAttribution = {
  version: 3,
  dimIds: ['ada', 'mac', 'team_a', 'team_b', 'prj_1', 'ins_1'],
  entries: [
    { kind: 'user', entityId: 'ada', role: 'principal', source: 'observed', weight: 1 },
    { kind: 'device', entityId: 'mac', source: 'observed', weight: 1 },
    { kind: 'team', entityId: 'team_a', source: 'derived', weight: 0.25 },
    { kind: 'team', entityId: 'team_b', source: 'derived', weight: 0.75 }
  ]
};

describe('sessionless keys', () => {
  it('round-trips the instance and bucket', () => {
    let bucket = new Date('2026-11-10T00:00:00Z');
    let key = sessionlessKey('ins_1', bucket);

    expect(key).toBe('sessionless:ins_1:2026-11-10T00:00:00.000Z');
    expect(isSessionlessKey(key)).toBe(true);
    expect(parseSessionlessKey(key)).toEqual({ instanceId: 'ins_1', bucket });
    expect(parseSessionlessKey('ses_1')).toBeNull();
    expect(parseSessionlessKey('sessionless:ins_1:nope')).toBeNull();
  });
});

describe('buildSessionSlices', () => {
  it('writes one document per bucket, model and subagent with the session dims', () => {
    let documents = buildSessionSlices({
      session,
      attribution,
      now,
      slices: [
        baseSlice(),
        baseSlice({ modelId: 'gpt-5', sessionsStarted: 0 }),
        baseSlice({ subagentId: 'agt_sub', sessionsStarted: 0 }),
        baseSlice({ bucket: new Date('2026-11-10T09:15:00Z'), sessionsStarted: 0 })
      ]
    });

    expect(new Set(documents.map(document => document._id)).size).toBe(4);
    expect(documents[0]).toMatchObject({
      organizationId: 'org_1',
      projectId: 'prj_1',
      instanceId: 'ins_1',
      sessionKey: 'ses_1',
      rootSessionKey: 'ses_root',
      userId: 'ada',
      deviceId: 'mac',
      agentId: 'agt',
      workspaceIds: ['ws_1'],
      repoIds: ['repo_1', 'repo_2'],
      client: { family: 'claude-code', version: '2.1.0' },
      dims: [
        { kind: 'team', id: 'team_a', w: 0.25 },
        { kind: 'team', id: 'team_b', w: 0.75 }
      ],
      dimIds: attribution.dimIds,
      attributionVersion: 3,
      factsVersion: FACTS_VERSION,
      sessionsStarted: 1,
      computedAt: now
    });
  });

  it('keeps slice ids stable so rewrites replace documents in place', () => {
    let first = buildSessionSlices({ session, attribution, now, slices: [baseSlice()] });
    let second = buildSessionSlices({
      session,
      attribution: { ...attribution, version: 4 },
      now: new Date(),
      slices: [baseSlice({ turns: 9 })]
    });

    expect(second[0]!._id).toBe(first[0]!._id);
  });

  it('expires each slice the retention period after its bucket', () => {
    let [document] = buildSessionSlices({ session, attribution, now, slices: [baseSlice()] });
    let bucket = new Date('2026-11-10T09:00:00Z');

    expect(document!.expiresAt.getTime() - bucket.getTime()).toBe(
      session.expiresAt!.getTime() - startedAt.getTime()
    );
  });

  it('round-trips the metrics through baseSliceOf', () => {
    let [document] = buildSessionSlices({ session, attribution, now, slices: [baseSlice()] });

    expect(baseSliceOf(document!)).toMatchObject(baseSlice());
  });
});

describe('buildSessionlessSlices', () => {
  it('keys documents by identity and never counts a session', () => {
    let key = sessionlessKey('ins_1', new Date('2026-11-10T00:00:00Z'));
    let documents = buildSessionlessSlices({
      key,
      scope: { organizationId: 'org_1', projectId: 'prj_1', instanceId: 'ins_1' },
      usageRetentionDays: 30,
      now,
      slices: [
        { slice: baseSlice({ userId: 'ada', client: { family: 'cursor' } }), attribution },
        { slice: baseSlice({ userId: 'grace' }), attribution }
      ]
    });

    expect(documents).toHaveLength(2);
    expect(documents[0]!._id).not.toBe(documents[1]!._id);
    expect(documents[0]).toMatchObject({
      sessionlessKey: key,
      userId: 'ada',
      client: { family: 'cursor' },
      sessionsStarted: 0
    });
    expect(documents[0]!.sessionKey).toBeUndefined();
    expect(documents[1]!.client).toEqual({ family: 'unknown' });
    expect(documents[0]!.expiresAt).toEqual(
      new Date(new Date('2026-11-10T09:00:00Z').getTime() + 30 * dayMs)
    );
  });
});

describe('attributionFields', () => {
  it('rewrites only the attribution columns', () => {
    expect(Object.keys(attributionFields(attribution)).sort()).toEqual([
      'attributionVersion',
      'dimIds',
      'dims'
    ]);
  });
});
