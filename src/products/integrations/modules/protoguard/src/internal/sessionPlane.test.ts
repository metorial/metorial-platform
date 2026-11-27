import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionPlaneState, SINK_RULE_KEY, type ProjectedFinding } from '../lib/engine';
import type { PersistMessageScanJob } from '../lib/persistJob';

let mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
  get: vi.fn(),
  set: vi.fn(),
  usingLock: vi.fn(),
  redisConstructed: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: mocks.usingLock })
}));

vi.mock('@metorial-subspace/redis-url', () => ({
  parseRedisUrl: (url: string) => ({ url })
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('ioredis', () => ({
  default: class {
    constructor(opts: unknown) {
      mocks.redisConstructed(opts);
    }
    get = mocks.get;
    set = mocks.set;
  }
}));

import { protoGuardSessionPlaneService } from './sessionPlane';

let KEY = 'sub:pg:sess:7';

let outputFinding = (overrides: Partial<ProjectedFinding> = {}): ProjectedFinding => ({
  ruleKey: 'instruction_override.ignore_previous',
  family: 'instruction_override',
  stage: 'active',
  direction: 'output',
  view: 'raw',
  precision: 0.92,
  hardRule: false,
  description: 'x',
  path: 'output',
  redactedPath: 'output',
  startOffset: 0,
  endOffset: 1,
  matchedText: null,
  sampleMarkdown: null,
  decodedSample: null,
  contentHmac: 'hmac-a',
  ...overrides
});

let job = (overrides: Partial<PersistMessageScanJob> = {}): PersistMessageScanJob => ({
  messageId: 'msg_1',
  directions: ['output'],
  rulesetVersion: '1.0.0',
  retentionLevel: 'none',
  coverage: 'full',
  skipReason: null,
  scannedChars: 1,
  totalChars: 1,
  durationMs: 0,
  isToolCall: true,
  toolKey: 'search',
  capabilityTags: [],
  findings: [],
  ...overrides
});

let apply = (
  j: PersistMessageScanJob,
  providerOid: bigint | null = BigInt(1),
  messageId = 'msg_1'
) =>
  protoGuardSessionPlaneService.apply({
    sessionOid: BigInt(7),
    providerOid,
    messageId,
    job: j
  });

describe('protoGuardSessionPlaneService.apply', () => {
  beforeEach(() => {
    mocks.store.clear();
    mocks.get
      .mockReset()
      .mockImplementation(async (key: string) => mocks.store.get(key) ?? null);
    mocks.set.mockReset().mockImplementation(async (key: string, value: string) => {
      mocks.store.set(key, value);
      return 'OK';
    });
    mocks.usingLock.mockReset().mockImplementation((_key: string, fn: () => unknown) => fn());
  });

  it('skips Redis entirely for messages that cannot change session state', async () => {
    expect(await apply(job({ findings: [] }))).toEqual([]);
    expect(await apply(job({ findings: [outputFinding({ stage: 'shadow' })] }))).toEqual([]);
    expect(
      await apply(
        job({
          findings: [outputFinding({ contentHmac: null, precision: 0.3 })]
        })
      )
    ).toEqual([]);
    expect(
      await apply(job({ directions: ['input'], capabilityTags: ['read_only' as any] }))
    ).toEqual([]);
    expect(
      await apply(
        job({ directions: ['input'], isToolCall: false, capabilityTags: ['external_comm'] })
      )
    ).toEqual([]);

    expect(mocks.usingLock).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('records suspicious outputs under the session lock with a 1h TTL', async () => {
    let findings = await apply(job({ findings: [outputFinding()] }));

    expect(findings).toEqual([]);
    expect(mocks.usingLock).toHaveBeenCalledWith(KEY, expect.any(Function));
    expect(mocks.set).toHaveBeenCalledWith(KEY, expect.any(String), 'EX', 3600);

    let stored = JSON.parse(mocks.store.get(KEY)!);
    expect(stored.outputs).toEqual([
      expect.objectContaining({ messageId: 'msg_1', providerId: '1', isConsumed: false })
    ]);
  });

  it('raises a sink finding when another provider is then called with a sink tool', async () => {
    await apply(job({ findings: [outputFinding()] }), BigInt(1), 'msg_1');
    let findings = await apply(
      job({ directions: ['input'], capabilityTags: ['external_comm'] }),
      BigInt(2),
      'msg_2'
    );

    expect(findings).toEqual([expect.objectContaining({ ruleKey: SINK_RULE_KEY })]);
    expect(JSON.parse(mocks.store.get(KEY)!).outputs[0].isConsumed).toBe(true);
  });

  it('does not chain a sink call on the same provider', async () => {
    await apply(job({ findings: [outputFinding()] }), BigInt(1));
    let findings = await apply(
      job({ directions: ['input'], capabilityTags: ['state_change'] }),
      BigInt(1)
    );

    expect(findings).toEqual([]);
  });

  it('starts fresh when the stored state is corrupt or from another version', async () => {
    mocks.store.set(KEY, '{not json');
    await expect(apply(job({ findings: [outputFinding()] }))).resolves.toEqual([]);

    mocks.store.set(KEY, JSON.stringify({ ...createSessionPlaneState(), version: 99 }));
    await expect(apply(job({ findings: [outputFinding()] }))).resolves.toEqual([]);

    expect(JSON.parse(mocks.store.get(KEY)!).version).toBe(1);
  });

  it('never stores payload text in the session state', async () => {
    await apply(
      job({
        findings: [
          outputFinding({
            matchedText: 'Ignore all previous instructions',
            sampleMarkdown: 'secret sample',
            decodedSample: 'decoded secret'
          })
        ]
      })
    );

    let stored = mocks.store.get(KEY)!;
    expect(stored).not.toContain('Ignore all previous');
    expect(stored).not.toContain('secret sample');
    expect(stored).not.toContain('decoded secret');
  });

  it('reuses one Redis client built from the module env', async () => {
    let constructedBefore = mocks.redisConstructed.mock.calls.length;
    await apply(job({ findings: [outputFinding()] }));
    let constructedAfterFirst = mocks.redisConstructed.mock.calls.length;
    await apply(job({ findings: [outputFinding()] }));

    expect(constructedAfterFirst - constructedBefore).toBeLessThanOrEqual(1);
    expect(mocks.redisConstructed.mock.calls.length).toBe(constructedAfterFirst);
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
});
