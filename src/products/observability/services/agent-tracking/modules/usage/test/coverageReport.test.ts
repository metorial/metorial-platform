import { describe, expect, it } from 'vitest';
import type { SourceHealthDocument } from '@mtsrc/agent-tracking-store';
import { buildCoverage, buildSourceCoverage } from '../src/lib/coverageReport';

let range = { from: new Date('2026-11-01T00:00:00Z'), to: new Date('2026-11-08T00:00:00Z') };
let inside = new Date('2026-11-05T10:00:00Z');
let before = new Date('2026-10-20T10:00:00Z');

let health = (overrides: Partial<SourceHealthDocument> = {}): SourceHealthDocument => ({
  _id: 'in_1:dev_1:claude-code',
  organizationId: 'or_1',
  instanceId: 'in_1',
  deviceId: 'dev_1',
  family: 'claude-code',
  lastSeen: {},
  updatedAt: inside,
  ...overrides
});

let totals = {
  total: 0,
  withoutUsage: 0,
  withoutContext: 0,
  withoutRepo: 0,
  notFullyAttributed: 0
};

describe('buildSourceCoverage', () => {
  it('reads nested otel timestamps and picks the usage source by precedence', () => {
    let source = buildSourceCoverage({
      range,
      health: health({ lastSeen: { hook: inside, otel: { logs: inside, metrics: inside } } })
    });

    expect(source.otel).toEqual({ logs: true, spans: false, metrics: true });
    expect(source.usageSource).toBe('otel.logs');
    expect(source.desktopSeen).toBe(true);
    expect(source.lastSeen['otel.logs']).toEqual(inside);
    expect(source.lastSeenAt).toEqual(inside);
    expect(source.issues).toEqual([]);
  });

  it('flags a client whose source plan expects OTel when only hooks arrive', () => {
    let source = buildSourceCoverage({
      range,
      health: health({ lastSeen: { hook: inside } })
    });

    expect(source.usageSource).toBe('hook');
    expect(source.issues).toEqual(['otel_missing']);
  });

  it('flags hooks whose sessions never carry usage', () => {
    let source = buildSourceCoverage({
      range,
      health: health({ family: 'opencode', lastSeen: { hook: inside } }),
      sessions: {
        instanceId: 'in_1',
        actorKey: 'dev_1',
        family: 'opencode',
        sessions: 3,
        withoutUsage: 3
      }
    });

    expect(source.usageSource).toBe('hook');
    expect(source.issues).toEqual(['hooks_without_usage']);
  });

  it('ignores signals last seen before the range', () => {
    let source = buildSourceCoverage({
      range,
      health: health({ lastSeen: { hook: inside, otel: { logs: before } } })
    });

    expect(source.otel.logs).toBe(false);
    expect(source.lastSeen['otel.logs']).toEqual(before);
    expect(source.issues).toContain('otel_missing');
  });

  it('flags sources whose sessions all lack usage', () => {
    let source = buildSourceCoverage({
      range,
      health: health({ lastSeen: { otel: { logs: inside } } }),
      sessions: {
        instanceId: 'in_1',
        actorKey: 'dev_1',
        family: 'claude-code',
        sessions: 2,
        withoutUsage: 2
      }
    });

    expect(source.sessions).toBe(2);
    expect(source.sessionsWithoutUsage).toBe(2);
    expect(source.issues).toEqual(['sessions_without_usage']);
  });

  it('keeps vendor feeds as a usage source for any family', () => {
    let source = buildSourceCoverage({
      range,
      health: health({ family: 'kiro', lastSeen: { vendor: inside } })
    });

    expect(source.usageSource).toBe('vendor');
    expect(source.desktopSeen).toBe(false);
    expect(source.issues).toEqual([]);
  });
});

describe('buildCoverage', () => {
  it('joins session counts by instance, actor and family and computes shares', () => {
    let coverage = buildCoverage({
      range,
      health: [
        health({ lastSeen: { otel: { logs: before } }, updatedAt: before }),
        health({
          _id: 'in_1:usr_1:codex',
          deviceId: undefined,
          userId: 'usr_1',
          family: 'codex',
          lastSeen: { hook: inside }
        })
      ],
      sourceSessions: [
        {
          instanceId: 'in_1',
          actorKey: 'usr_1',
          family: 'codex',
          sessions: 3,
          withoutUsage: 1
        }
      ],
      sessions: {
        ...totals,
        total: 4,
        withoutUsage: 1,
        withoutRepo: 2,
        notFullyAttributed: 4
      },
      sessionlessSlices: 7
    });

    expect(coverage.sources.map(source => source.family)).toEqual(['codex', 'claude-code']);
    expect(coverage.sources[0]).toMatchObject({
      userId: 'usr_1',
      sessions: 3,
      sessionsWithoutUsage: 1
    });
    expect(coverage.sources[1]!.sessions).toBe(0);
    expect(coverage.misconfigured).toBe(1);
    expect(coverage.sessions.shares).toEqual({
      withoutUsage: 0.25,
      withoutContext: 0,
      withoutRepo: 0.5,
      notFullyAttributed: 1
    });
    expect(coverage.sessionlessSlices).toBe(7);
  });

  it('returns null shares without sessions', () => {
    let coverage = buildCoverage({
      range,
      health: [],
      sourceSessions: [],
      sessions: totals,
      sessionlessSlices: 0
    });

    expect(coverage.sources).toEqual([]);
    expect(coverage.sessions.shares.withoutUsage).toBeNull();
  });
});
