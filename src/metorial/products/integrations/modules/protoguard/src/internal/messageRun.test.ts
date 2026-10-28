import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectedFinding } from '../lib/engine';
import type { PersistMessageScanJob } from '../lib/persistJob';

let state = vi.hoisted(() => ({
  message: null as any,
  run: null as any,
  instances: [] as any[],
  suppressions: [] as any[],
  duplicate: null as any,
  nextOid: 100
}));

let mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  getAllowedScope: vi.fn(),
  fire: vi.fn(),
  createFromProtoGuardAlert: vi.fn(),
  recordAudit: vi.fn(),
  applySessionPlane: vi.fn(),
  usingLock: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  instanceCreateMany: vi.fn(),
  instanceUpdateMany: vi.fn(),
  suppressionFindMany: vi.fn(),
  alertFindFirst: vi.fn(),
  alertCreate: vi.fn(),
  alertUpdate: vi.fn()
}));

vi.mock('./monitoringAccess', () => ({
  protoGuardMonitoringAccessService: { getAllowedScope: mocks.getAllowedScope }
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fire } }));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: mocks.usingLock })
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('@metorial-subspace/module-monitor', () => ({
  getProtoGuardConfigForEvaluation: mocks.getConfig,
  alertInternalService: { createFromProtoGuardAlert: mocks.createFromProtoGuardAlert }
}));

vi.mock('./alertAudit', () => ({
  recordProtoGuardAlertAuditEvent: mocks.recordAudit
}));

vi.mock('./sessionPlane', () => ({
  protoGuardSessionPlaneService: { apply: mocks.applySessionPlane }
}));

let FILTERS = new Map([
  [
    'instruction_override',
    {
      oid: BigInt(1),
      key: 'instruction_override',
      issueType: 'prompt_injection',
      severity: 'high',
      alertConfidenceThreshold: 0.8
    }
  ],
  [
    'role_hijack',
    {
      oid: BigInt(2),
      key: 'role_hijack',
      issueType: 'role_hijack',
      severity: 'high',
      alertConfidenceThreshold: 0.8
    }
  ]
]);

vi.mock('../lib/filterRegistry', () => ({
  syncProtoGuardFilters: async () => FILTERS
}));

vi.mock('@metorial-subspace/db', () => ({
  getId: (model: string) => {
    let oid = state.nextOid++;
    return { oid: BigInt(oid), id: `${model}_${oid}` };
  },
  db: {
    sessionMessage: { findUnique: async () => state.message },
    protoGuardRun: {
      findUnique: async () => state.run,
      create: async (args: any) => {
        mocks.runCreate(args);
        state.run = { ...args.data, alert: null };
        return state.run;
      },
      update: async (args: any) => {
        mocks.runUpdate(args);
        state.run = { ...state.run, ...args.data };
        return state.run;
      }
    },
    protoGuardAlertInstance: {
      createMany: async (args: any) => {
        mocks.instanceCreateMany(args);
        state.instances.push(...args.data.map((row: any) => ({ alertOid: null, ...row })));
      },
      findMany: async (args: any) =>
        state.instances
          .filter(instance => instance.runOid == args.where.runOid)
          .sort((a, b) => b.confidence - a.confidence),
      updateMany: async (args: any) => {
        mocks.instanceUpdateMany(args);
        for (let instance of state.instances) {
          if (instance.runOid != args.where.runOid) continue;
          if (args.where.alertOid === null && instance.alertOid != null) continue;
          instance.alertOid = args.data.alertOid;
        }
      }
    },
    protoGuardSuppression: {
      findMany: async (args: any) => {
        mocks.suppressionFindMany(args);
        let now = Date.now();
        return state.suppressions.filter(
          suppression =>
            suppression.status == 'active' &&
            (suppression.expiresAt == null || suppression.expiresAt.getTime() > now)
        );
      }
    },
    protoGuardAlert: {
      findFirst: async (args: any) => {
        mocks.alertFindFirst(args);
        return state.duplicate;
      },
      create: async (args: any) => {
        mocks.alertCreate(args);
        return { ...args.data, createdAt: new Date('2026-01-01') };
      },
      update: async (args: any) => mocks.alertUpdate(args)
    }
  }
}));

import { protoGuardMessageRunService } from './messageRun';

let config = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  alertProbabilityThreshold: 0.8,
  alertFilterCountThreshold: 2,
  filters: [...FILTERS.values()].map(filter => ({
    key: filter.key,
    enabled: true,
    stage: 'active',
    scoreWeight: 3,
    alertConfidenceThreshold: 0.8
  })),
  ...overrides
});

let finding = (overrides: Partial<ProjectedFinding> = {}): ProjectedFinding => ({
  ruleKey: 'instruction_override.ignore_previous',
  family: 'instruction_override',
  stage: 'active',
  direction: 'output',
  view: 'raw',
  precision: 0.92,
  hardRule: false,
  description: 'Attempts to ignore previous instructions.',
  path: 'output.result.content[0].text',
  redactedPath: 'output.result.content[0].text',
  startOffset: 0,
  endOffset: 32,
  matchedText: 'Ignore all previous instructions',
  sampleMarkdown: '**output**\n\n<mark>Ignore all previous instructions</mark>',
  decodedSample: null,
  contentHmac: 'hmac-a',
  ...overrides
});

let job = (overrides: Partial<PersistMessageScanJob> = {}): PersistMessageScanJob => ({
  messageId: 'msg_1',
  directions: ['output'],
  rulesetVersion: '1.0.0',
  retentionLevel: 'full',
  coverage: 'full',
  skipReason: null,
  scannedChars: 100,
  totalChars: 100,
  durationMs: 3,
  isToolCall: true,
  toolKey: 'search',
  capabilityTags: [],
  findings: [finding()],
  ...overrides
});

let persist = (j: PersistMessageScanJob = job()) =>
  protoGuardMessageRunService.persistMessageScan({ job: j });

describe('protoGuardMessageRunService.persistMessageScan', () => {
  beforeEach(() => {
    for (let mock of Object.values(mocks)) mock.mockReset();

    state.message = {
      oid: BigInt(50),
      id: 'msg_1',
      sessionOid: BigInt(51),
      connectionOid: BigInt(52),
      providerRunOid: null,
      tenantOid: BigInt(53),
      projectOid: BigInt(54),
      environmentOid: BigInt(55),
      instanceOid: BigInt(56),
      solutionOid: BigInt(57),
      sessionProvider: { providerOid: BigInt(58) }
    };
    state.run = null;
    state.instances = [];
    state.suppressions = [];
    state.duplicate = null;

    mocks.getAllowedScope.mockResolvedValue({ organization: { id: 'org_1' } });
    mocks.getConfig.mockResolvedValue(config());
    mocks.applySessionPlane.mockResolvedValue([]);
    mocks.usingLock.mockImplementation((_key: string, fn: () => unknown) => fn());
  });

  it('does nothing when the message is gone', async () => {
    state.message = null;
    await persist();

    expect(mocks.getConfig).not.toHaveBeenCalled();
    expect(mocks.runCreate).not.toHaveBeenCalled();
  });

  it('drops queued findings after a downgrade without creating runs or alerts', async () => {
    mocks.getAllowedScope.mockResolvedValue(null);

    await persist();

    expect(mocks.applySessionPlane).not.toHaveBeenCalled();
    expect(mocks.runCreate).not.toHaveBeenCalled();
    expect(mocks.instanceCreateMany).not.toHaveBeenCalled();
    expect(mocks.createFromProtoGuardAlert).not.toHaveBeenCalled();
    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('meters completed scans with an idempotency key', async () => {
    await persist(job({ findings: [] }));

    expect(mocks.fire).toHaveBeenCalledWith('protoguard.scan.completed:after', {
      organizationId: 'org_1',
      scanKey: 'msg_1-output'
    });
  });

  it('does not meter skipped scans', async () => {
    await persist(job({ coverage: 'skipped', skipReason: 'backpressure', findings: [] }));

    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('does nothing when ProtoGuard was disabled after the scan', async () => {
    mocks.getConfig.mockResolvedValue(config({ enabled: false }));
    await persist();

    expect(mocks.applySessionPlane).not.toHaveBeenCalled();
    expect(mocks.runCreate).not.toHaveBeenCalled();
  });

  it('stores the run under the message lock and raises a new alert', async () => {
    await persist();

    expect(mocks.usingLock).toHaveBeenCalledWith('msg_1', expect.any(Function));
    expect(mocks.runCreate.mock.calls[0]![0].data).toMatchObject({
      status: 'completed',
      coverage: 'full',
      messageOid: BigInt(50),
      tenantOid: BigInt(53)
    });
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0]).toMatchObject({
      filterOid: BigInt(1),
      issueType: 'prompt_injection',
      isSuppressed: false,
      confidenceThreshold: 0.8,
      metadata: { family: 'instruction_override', hardRule: false }
    });

    expect(state.run).toMatchObject({ matchedInstanceCount: 1, probability: 0.92 });
    expect(mocks.alertCreate).toHaveBeenCalledTimes(1);
    expect(mocks.alertCreate.mock.calls[0]![0].data).toMatchObject({
      occurrenceCount: 1,
      issueTypes: ['prompt_injection'],
      dedupKey: expect.stringMatching(/^[0-9a-f]{64}$/)
    });
    expect(mocks.createFromProtoGuardAlert).toHaveBeenCalledWith({
      protoGuardAlertId: mocks.alertCreate.mock.calls[0]![0].data.id
    });
    expect(mocks.recordAudit).toHaveBeenCalledTimes(1);
    expect(mocks.recordAudit.mock.calls[0]![0].findings).toEqual([
      expect.objectContaining({
        ruleKey: 'instruction_override.ignore_previous',
        redactedPath: 'output.result.content[0].text'
      })
    ]);
  });

  it('does not alert below the thresholds', async () => {
    await persist(job({ findings: [finding({ precision: 0.3 })] }));

    expect(state.instances).toHaveLength(1);
    expect(mocks.alertCreate).not.toHaveBeenCalled();
    expect(mocks.createFromProtoGuardAlert).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('drops findings whose family is not in the registry', async () => {
    await persist(job({ findings: [finding({ family: 'retired_family' })] }));

    expect(mocks.instanceCreateMany).not.toHaveBeenCalled();
    expect(mocks.alertCreate).not.toHaveBeenCalled();
  });

  it('merges a second scan of the same message into the existing run', async () => {
    state.run = {
      oid: BigInt(70),
      id: 'run_70',
      status: 'completed',
      coverage: 'full',
      skipReason: null,
      scannedChars: 10,
      totalChars: 20,
      durationMs: 4,
      alert: null
    };

    await persist(
      job({
        coverage: 'partial',
        skipReason: 'time_budget',
        scannedChars: 5,
        totalChars: 50,
        durationMs: 6,
        findings: []
      })
    );

    expect(mocks.runCreate).not.toHaveBeenCalled();
    expect(mocks.runUpdate.mock.calls[0]![0]).toMatchObject({
      where: { oid: BigInt(70) },
      data: {
        status: 'completed',
        coverage: 'partial',
        skipReason: 'time_budget',
        scannedChars: 15,
        totalChars: 70,
        durationMs: 10
      }
    });
  });

  it('keeps the first skip reason and upgrades a skipped run once a scan completes', async () => {
    state.run = {
      oid: BigInt(70),
      id: 'run_70',
      status: 'skipped',
      coverage: 'skipped',
      skipReason: 'backpressure',
      scannedChars: 0,
      totalChars: 20,
      durationMs: 0,
      alert: null
    };

    await persist(job({ coverage: 'full', skipReason: null, findings: [] }));

    expect(mocks.runUpdate.mock.calls[0]![0].data).toMatchObject({
      status: 'completed',
      coverage: 'skipped',
      skipReason: 'backpressure'
    });
  });

  it('keeps a completed run completed when a later direction was skipped', async () => {
    state.run = {
      oid: BigInt(70),
      id: 'run_70',
      status: 'completed',
      coverage: 'full',
      skipReason: null,
      scannedChars: 10,
      totalChars: 10,
      durationMs: 1,
      alert: null
    };

    await persist(job({ coverage: 'skipped', skipReason: 'backpressure', findings: [] }));

    expect(mocks.runUpdate.mock.calls[0]![0].data).toMatchObject({
      status: 'completed',
      coverage: 'skipped',
      skipReason: 'backpressure'
    });
  });

  it('creates a skipped run for a skipped scan', async () => {
    await persist(job({ coverage: 'skipped', skipReason: 'scan_failed', findings: [] }));

    expect(mocks.runCreate.mock.calls[0]![0].data).toMatchObject({
      status: 'skipped',
      skipReason: 'scan_failed'
    });
  });

  describe('suppressions', () => {
    let suppression = (overrides: Record<string, unknown> = {}) => ({
      status: 'active',
      expiresAt: null,
      filterOid: BigInt(1),
      providerOid: null,
      toolKey: null,
      contentHmac: null,
      ...overrides
    });

    let persistSuppressed = async (overrides: Record<string, unknown>) => {
      state.suppressions = [suppression(overrides)];
      await persist();
      return state.instances[0]!.isSuppressed as boolean;
    };

    it('only reads active, unexpired suppressions of the tenant', async () => {
      await persist();

      expect(mocks.suppressionFindMany.mock.calls[0]![0].where).toMatchObject({
        tenantOid: BigInt(53),
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]
      });
    });

    it('treats null fields as wildcards', async () => {
      expect(await persistSuppressed({})).toBe(true);
    });

    it('matches on filter', async () => {
      expect(await persistSuppressed({ filterOid: BigInt(2) })).toBe(false);
    });

    it('matches on provider', async () => {
      expect(await persistSuppressed({ providerOid: BigInt(58) })).toBe(true);
    });

    it('rejects a different provider', async () => {
      expect(await persistSuppressed({ providerOid: BigInt(99) })).toBe(false);
    });

    it('matches on tool key', async () => {
      expect(await persistSuppressed({ toolKey: 'search' })).toBe(true);
    });

    it('rejects a different tool key', async () => {
      expect(await persistSuppressed({ toolKey: 'other' })).toBe(false);
    });

    it('matches on content hmac', async () => {
      expect(await persistSuppressed({ contentHmac: 'hmac-a' })).toBe(true);
    });

    it('rejects a different content hmac', async () => {
      expect(await persistSuppressed({ contentHmac: 'hmac-b' })).toBe(false);
    });

    it('ignores expired suppressions', async () => {
      expect(await persistSuppressed({ expiresAt: new Date(Date.now() - 1000) })).toBe(false);
    });

    it('honours suppressions that have not expired yet', async () => {
      expect(await persistSuppressed({ expiresAt: new Date(Date.now() + 60_000) })).toBe(true);
    });

    it('stores suppressed instances without counting them towards an alert', async () => {
      state.suppressions = [suppression()];
      await persist();

      expect(state.instances).toHaveLength(1);
      expect(state.run).toMatchObject({ matchedInstanceCount: 0, probability: 0 });
      expect(mocks.alertCreate).not.toHaveBeenCalled();
      expect(mocks.recordAudit).not.toHaveBeenCalled();
    });
  });

  it('stores shadow findings without counting them', async () => {
    await persist(job({ findings: [finding({ stage: 'shadow' })] }));

    expect(state.instances).toHaveLength(1);
    expect(state.instances[0]!.stage).toBe('shadow');
    expect(state.run).toMatchObject({ matchedInstanceCount: 0 });
    expect(mocks.alertCreate).not.toHaveBeenCalled();
  });

  it('bumps a duplicate alert within 24h without a new monitor alert or audit event', async () => {
    state.duplicate = { oid: BigInt(900), id: 'alert_900' };
    await persist();

    expect(mocks.alertFindFirst.mock.calls[0]![0].where).toMatchObject({
      tenantOid: BigInt(53),
      dedupKey: expect.any(String)
    });
    let since = mocks.alertFindFirst.mock.calls[0]![0].where.lastSeenAt.gte as Date;
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(Date.now() - since.getTime()).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);

    expect(mocks.alertUpdate).toHaveBeenCalledWith({
      where: { oid: BigInt(900) },
      data: { occurrenceCount: { increment: 1 }, lastSeenAt: expect.any(Date) }
    });
    expect(mocks.alertCreate).not.toHaveBeenCalled();
    expect(mocks.createFromProtoGuardAlert).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('derives the same dedup key for the same content in another message', async () => {
    await persist();
    let firstKey = mocks.alertCreate.mock.calls[0]![0].data.dedupKey;

    state.run = null;
    state.instances = [];
    state.message = { ...state.message, oid: BigInt(60), id: 'msg_2' };
    await persist(job({ messageId: 'msg_2' }));

    expect(mocks.alertCreate.mock.calls[1]![0].data.dedupKey).toBe(firstKey);

    state.run = null;
    state.instances = [];
    await persist(job({ findings: [finding({ contentHmac: 'hmac-other' })] }));

    expect(mocks.alertCreate.mock.calls[2]![0].data.dedupKey).not.toBe(firstKey);
  });

  it('extends the alert the run already has without a new audit event', async () => {
    state.run = {
      oid: BigInt(70),
      id: 'run_70',
      status: 'completed',
      coverage: 'full',
      skipReason: null,
      scannedChars: 10,
      totalChars: 10,
      durationMs: 1,
      alert: { oid: BigInt(800), id: 'alert_800', createdAt: new Date('2026-01-01') }
    };
    state.instances = [
      {
        oid: BigInt(1),
        runOid: BigInt(70),
        alertOid: BigInt(800),
        issueType: 'prompt_injection',
        stage: 'active',
        isSuppressed: false,
        confidence: 0.92,
        contentHmac: 'hmac-a',
        metadata: { family: 'instruction_override', hardRule: false }
      }
    ];

    await persist(
      job({
        directions: ['input'],
        findings: [finding({ family: 'role_hijack', ruleKey: 'role_hijack.you_are_now' })]
      })
    );

    expect(mocks.alertFindFirst).not.toHaveBeenCalled();
    expect(mocks.alertCreate).not.toHaveBeenCalled();
    expect(mocks.alertUpdate).toHaveBeenCalledWith({
      where: { oid: BigInt(800) },
      data: { issueTypes: ['prompt_injection', 'role_hijack'], lastSeenAt: expect.any(Date) }
    });
    expect(mocks.instanceUpdateMany).toHaveBeenCalledWith({
      where: { runOid: BigInt(70), alertOid: null },
      data: { alertOid: BigInt(800) }
    });
    expect(state.instances.every(instance => instance.alertOid == BigInt(800))).toBe(true);
    expect(mocks.createFromProtoGuardAlert).toHaveBeenCalledWith({
      protoGuardAlertId: 'alert_800'
    });
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('truncates the alert sample at 8000 chars', async () => {
    await persist(job({ findings: [finding({ sampleMarkdown: 'x'.repeat(20_000) })] }));

    expect(mocks.alertCreate.mock.calls[0]![0].data.sampleMarkdown).toHaveLength(8000);
  });

  it('falls back to the redacted path and rule description below full retention', async () => {
    await persist(
      job({
        retentionLevel: 'none',
        findings: [
          finding({
            matchedText: null,
            sampleMarkdown: null,
            path: 'output.result.structuredContent.*',
            redactedPath: 'output.result.structuredContent.*',
            description: 'Attempts to ignore previous instructions.'
          })
        ]
      })
    );

    expect(mocks.alertCreate.mock.calls[0]![0].data.sampleMarkdown).toBe(
      '**output.result.structuredContent.***\n\nAttempts to ignore previous instructions.'
    );
  });

  it('stores session-plane findings and skips tool-definition findings', async () => {
    mocks.applySessionPlane.mockResolvedValue([
      {
        ruleKey: 'injection_followed_by_sink.sink_call',
        family: 'role_hijack',
        precision: 0.5,
        hardRule: false,
        description: 'Session finding.',
        contentHmac: 'hmac-s'
      }
    ]);

    await persist(
      job({
        findings: [
          finding({ direction: 'tool_definition' as any }),
          finding({ precision: 0.3 })
        ]
      })
    );

    expect(mocks.applySessionPlane).toHaveBeenCalledWith({
      sessionOid: BigInt(51),
      providerOid: BigInt(58),
      messageId: 'msg_1',
      job: expect.any(Object)
    });
    expect(state.instances.map(instance => instance.direction).sort()).toEqual([
      'output',
      'session'
    ]);
    expect(state.instances.find(instance => instance.direction == 'session')).toMatchObject({
      path: 'session',
      matchedText: null,
      contentHmac: 'hmac-s'
    });
  });
});
