import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { collections, setupScope, store } from '../attribution/fixtures';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import { cleanDatabase } from '@mtsrc/agent-tracking-db/test/setup';
import { coverageService } from '@mtsrc/agent-tracking-module-usage';
import { sessionlessKey } from '@mtsrc/agent-tracking-module-usage';

let range = { from: new Date('2026-11-01T00:00:00Z'), to: new Date('2026-11-08T00:00:00Z') };
let inside = new Date('2026-11-05T10:00:00Z');

describe('coverageService', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await store.close();
  });

  it('reports sources, session shares and sessionless slices for an organization', async () => {
    let scope = await setupScope();
    let { sourceHealth, usageSlices } = await collections();

    await sourceHealth.insertMany([
      {
        _id: `${scope.instance.id}:dev_a:claude-code`,
        organizationId: scope.organization.id,
        instanceId: scope.instance.id,
        deviceId: 'dev_a',
        family: 'claude-code',
        lastSeen: { hook: inside, otel: { logs: inside } },
        clientVersion: '2.1.0',
        updatedAt: inside
      },
      {
        _id: `${scope.instance.id}:dev_b:claude-code`,
        organizationId: scope.organization.id,
        instanceId: scope.instance.id,
        deviceId: 'dev_b',
        family: 'claude-code',
        lastSeen: { hook: inside },
        updatedAt: inside
      },
      {
        _id: `${scope.instance.id}:dev_c:codex`,
        organizationId: scope.organization.id,
        instanceId: scope.instance.id,
        deviceId: 'dev_c',
        family: 'codex',
        lastSeen: { otel: { logs: new Date('2026-10-01T00:00:00Z') } },
        updatedAt: new Date('2026-10-01T00:00:00Z')
      }
    ]);

    let withUsage = {
      hasUsage: true,
      hasContext: true,
      hasRepo: true,
      fullyAttributed: true,
      usageSource: 'otel.logs'
    };
    let withoutUsage = {
      hasUsage: false,
      hasContext: true,
      hasRepo: false,
      fullyAttributed: false
    };

    await scope.session({
      startedAt: inside,
      observed: { deviceId: 'dev_a' },
      coverage: withUsage
    });
    await scope.session({
      startedAt: inside,
      observed: { deviceId: 'dev_b' },
      coverage: withoutUsage
    });
    await scope.session({
      startedAt: inside,
      observed: { deviceId: 'dev_b' },
      coverage: withoutUsage
    });
    await scope.session({
      startedAt: new Date('2026-10-01T00:00:00Z'),
      observed: { deviceId: 'dev_a' },
      coverage: withoutUsage
    });

    await usageSlices.insertOne({
      _id: `sessionless-slice-${scope.organization.id}`,
      organizationId: scope.organization.id,
      projectId: scope.project.id,
      instanceId: scope.instance.id,
      bucket: inside,
      bucketMinutes: 15,
      sessionlessKey: sessionlessKey(scope.instance.id, inside),
      workspaceIds: [],
      repoIds: [],
      dims: [],
      dimIds: [],
      client: { family: 'kiro' }
    } as never);

    let coverage = await coverageService.getCoverage({
      organization: scope.organization,
      range
    });

    expect(coverage.sources.map(source => source.deviceId).sort()).toEqual(['dev_a', 'dev_b']);

    let devA = coverage.sources.find(source => source.deviceId == 'dev_a')!;
    expect(devA).toMatchObject({
      usageSource: 'otel.logs',
      clientVersion: '2.1.0',
      sessions: 1,
      sessionsWithoutUsage: 0,
      issues: []
    });

    let devB = coverage.sources.find(source => source.deviceId == 'dev_b')!;
    expect(devB.sessions).toBe(2);
    expect(devB.issues).toEqual(['otel_missing', 'hooks_without_usage']);

    expect(coverage.misconfigured).toBe(1);
    expect(coverage.sessions).toMatchObject({
      total: 3,
      withoutUsage: 2,
      withoutRepo: 2,
      notFullyAttributed: 2,
      withoutContext: 0
    });
    expect(coverage.sessionlessSlices).toBe(1);
  });

  it('narrows to the requested instances and isolates organizations', async () => {
    let scope = await setupScope();
    let other = await createTestScope();
    let { sourceHealth } = await collections();

    for (let [organizationId, instanceId] of [
      [scope.organization.id, scope.instance.id],
      [other.organization.id, other.instance.id]
    ]) {
      await sourceHealth.insertOne({
        _id: `${instanceId}:dev:claude-code`,
        organizationId: organizationId!,
        instanceId: instanceId!,
        deviceId: 'dev',
        family: 'claude-code',
        lastSeen: { otel: { logs: inside } },
        updatedAt: inside
      });
    }

    let mine = await coverageService.getCoverage({
      organization: scope.organization,
      scope: { instanceIds: [scope.instance.ref] },
      range
    });
    expect(mine.sources.map(source => source.instanceId)).toEqual([scope.instance.id]);

    await expect(
      coverageService.getCoverage({
        organization: scope.organization,
        scope: { instanceIds: [other.instance.id] },
        range
      })
    ).rejects.toThrow();
  });

  it('rejects inverted and oversized ranges', async () => {
    let scope = await setupScope();

    await expect(
      coverageService.getCoverage({
        organization: scope.organization,
        range: { from: range.to, to: range.from }
      })
    ).rejects.toThrow('range.to');

    await expect(
      coverageService.getCoverage({
        organization: scope.organization,
        range: { from: new Date('2024-01-01T00:00:00Z'), to: range.to }
      })
    ).rejects.toThrow('400 days');
  });
});
