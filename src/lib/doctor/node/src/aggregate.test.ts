import { describe, expect, it } from 'vitest';
import {
  collectReports,
  mergeReports,
  type DoctorTarget,
  type ReplicaReport
} from './aggregate';
import { parseReport } from './parse';
import { readFixture } from './test/fixtures';
import type { Report } from './types';

let kmsFailure = readFixture<Report>('reports/kms-failure.json');
let allPass = readFixture<Report>('reports/all-pass.json');
let dependencySkip = readFixture<Report>('reports/dependency-skip.json');

let targets: DoctorTarget[] = [
  { name: 'core-api', host: 'core-api-doctor', port: 12121 },
  { name: 'worker', host: 'worker-doctor', port: 12121 },
  { name: 'secret-store', host: 'secret-store-doctor', port: 12121 }
];

let replica = (
  component: string,
  address: string,
  report: Report | null,
  outcome: ReplicaReport['outcome'] = report ? 'ok' : 'unreachable'
): ReplicaReport => ({
  component,
  address,
  outcome,
  report: report ? { ...report, component } : null,
  error: report ? null : 'connect ECONNREFUSED',
  durationMs: 1
});

let withInstance = (report: Report, instance: string): Report => ({ ...report, instance });

describe('collectReports', () => {
  it('fetches every resolved replica and classifies outcomes', async () => {
    let requested: string[] = [];
    let responses: Record<string, () => Response> = {
      '10.0.0.1': () => Response.json(allPass),
      '10.0.0.2': () => new Response('not found', { status: 404 }),
      '10.0.0.3': () => Response.json({ error: 'doctor crashed' }, { status: 503 }),
      '10.0.0.4': () => Response.json({ doctor: 1 }),
      '::1': () => Response.json(allPass)
    };

    let replicas = await collectReports(
      [
        { name: 'core-api', host: 'core-api-doctor', port: 12121 },
        { name: 'worker', host: 'worker-doctor', port: 9090, path: '/v1/doctor' },
        { name: 'search', host: 'search-doctor', port: 12121 },
        { name: 'gone', host: 'gone-doctor', port: 12121 }
      ],
      {
        fresh: true,
        resolve: async host => {
          if (host == 'core-api-doctor') return ['10.0.0.1', '10.0.0.2', '::1'];
          if (host == 'worker-doctor') return ['10.0.0.3', '10.0.0.4', '10.0.0.5'];
          if (host == 'search-doctor') return [];
          throw Object.assign(new Error('getaddrinfo ENOTFOUND gone-doctor'), {
            code: 'ENOTFOUND'
          });
        },
        fetch: (async (url: string) => {
          requested.push(url);
          let host = new URL(url).hostname.replace(/^\[|\]$/g, '');
          let response = responses[host];
          if (!response) {
            throw new TypeError('fetch failed', {
              cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
            });
          }
          return response();
        }) as typeof fetch
      }
    );

    expect(requested).toContain('http://10.0.0.1:12121/doctor?fresh=1');
    expect(requested).toContain('http://[::1]:12121/doctor?fresh=1');
    expect(requested).toContain('http://10.0.0.3:9090/v1/doctor?fresh=1');
    expect(replicas.map(item => [item.component, item.address, item.outcome])).toEqual([
      ['core-api', '10.0.0.1', 'ok'],
      ['core-api', '10.0.0.2', 'unsupported'],
      ['core-api', '::1', 'ok'],
      ['worker', '10.0.0.3', 'invalid_response'],
      ['worker', '10.0.0.4', 'invalid_response'],
      ['worker', '10.0.0.5', 'unreachable'],
      ['search', 'search-doctor', 'unreachable'],
      ['gone', 'gone-doctor', 'unreachable']
    ]);
    expect(replicas[0]!.report).toEqual(parseReport(allPass));
    expect(replicas[3]!.error).toBe('doctor crashed');
    expect(replicas[7]!.error).toBe('getaddrinfo ENOTFOUND gone-doctor');
  });

  it('shows what answered instead of a doctor report', async () => {
    let [result] = await collectReports([{ name: 'proxied', host: '10.0.0.8', port: 12121 }], {
      fetch: (async () =>
        new Response('upstream connect error or disconnect/reset before headers', {
          status: 503
        })) as unknown as typeof fetch
    });

    expect(result!.outcome).toBe('invalid_response');
    expect(result!.error).toBe(
      'HTTP 503 without a doctor report: upstream connect error or disconnect/reset before headers'
    );
  });

  it('reports timeouts', async () => {
    let [result] = await collectReports([{ name: 'slow', host: '10.0.0.9', port: 1 }], {
      timeoutMs: 10,
      fetch: ((_: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason))
        )) as typeof fetch
    });

    expect(result!.outcome).toBe('timeout');
  });

  it('does not wait forever for a hostname that never resolves', async () => {
    let started = Date.now();
    let replicas = await collectReports(
      [
        { name: 'hung', host: 'hung-doctor', port: 1 },
        { name: 'core-api', host: '10.0.0.1', port: 12121 }
      ],
      {
        timeoutMs: 20,
        resolve: async host =>
          host == 'hung-doctor' ? new Promise<string[]>(() => {}) : [host],
        fetch: (async () => Response.json(allPass)) as unknown as typeof fetch
      }
    );

    expect(replicas.map(item => [item.component, item.outcome])).toEqual([
      ['hung', 'timeout'],
      ['core-api', 'ok']
    ]);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('mergeReports', () => {
  it('dedupes issues by target and lists where they were seen', () => {
    let shared = {
      ...dependencySkip.checks[0]!,
      status: 'fail' as const,
      message: 'refused'
    };
    let merged = mergeReports(
      [
        replica(
          'core-api',
          '10.0.0.1',
          withInstance({ ...allPass, checks: [shared] }, 'core-api-a')
        ),
        replica('worker', '10.0.0.2', withInstance(dependencySkip, 'worker-a')),
        replica('secret-store', '10.0.0.3', withInstance(kmsFailure, 'secret-store-a'))
      ],
      targets
    );

    let postgres = merged.issues.find(issue => issue.id == 'postgres.core.connect')!;
    expect(postgres.status).toBe('fail');
    expect(postgres.seenFrom).toEqual([
      { component: 'core-api', instance: 'core-api-a' },
      { component: 'worker', instance: 'worker-a' }
    ]);
    expect(merged.issues.map(issue => issue.id)).toEqual([
      'kms.system-key.access',
      'postgres.core.connect',
      'queues.backlog'
    ]);
    expect(merged.blocking).toBe(true);
    expect(merged.counts).toEqual({ critical: 2, warning: 1, info: 0, passed: 1, skipped: 1 });
  });

  it('keeps target-less issues apart per component', () => {
    let failing = {
      ...allPass,
      checks: [{ ...allPass.checks[0]!, status: 'fail' as const, message: 'missing setting' }]
    };
    let merged = mergeReports(
      [replica('core-api', 'a', failing), replica('worker', 'b', failing)],
      targets.slice(0, 2)
    );

    expect(merged.issues.map(issue => issue.key)).toEqual([
      'config.settings|@core-api',
      'config.settings|@worker'
    ]);
  });

  it('reports unreachable, partially reachable and outdated components', () => {
    let merged = mergeReports(
      [
        replica('core-api', '10.0.0.1', allPass),
        replica('core-api', '10.0.0.2', null),
        replica('worker', '10.0.0.3', null, 'unsupported'),
        replica('secret-store', '10.0.0.4', null, 'timeout')
      ],
      [...targets, { name: 'search', host: 'search', port: 1, optional: true }]
    );

    expect(merged.components.map(item => [item.name, item.state])).toEqual([
      ['core-api', 'degraded'],
      ['worker', 'degraded'],
      ['secret-store', 'unreachable'],
      ['search', 'unreachable']
    ]);
    expect(merged.issues.map(issue => [issue.id, issue.severity])).toEqual([
      ['components.secret-store.reachable', 'critical'],
      ['components.core-api.replicas', 'warning'],
      ['components.search.reachable', 'warning'],
      ['components.worker.doctor-supported', 'warning'],
      ['redis.ping', 'warning']
    ]);
    expect(merged.blocking).toBe(true);
  });

  it('treats unreachable components as pending while starting', () => {
    let merged = mergeReports(
      [replica('core-api', '10.0.0.1', allPass), replica('worker', '10.0.0.2', null)],
      [...targets.slice(0, 2), { name: 'search', host: 'search', port: 1 }],
      { pendingUnreachable: true }
    );

    expect(merged.pending).toEqual(['worker', 'search']);
    expect(merged.issues.some(issue => issue.id.startsWith('components.'))).toBe(false);
    expect(merged.blocking).toBe(false);
  });

  it('does not block on warnings or info', () => {
    let merged = mergeReports([replica('core-api', '10.0.0.1', allPass)], targets.slice(0, 1));

    expect(merged.blocking).toBe(false);
    expect(merged.counts).toEqual({ critical: 0, warning: 1, info: 0, passed: 2, skipped: 0 });
  });
});
