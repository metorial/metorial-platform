import { describe, expect, it } from 'vitest';
import { check, type CheckDefinition } from './check';
import { parseReport } from './parse';
import { createDoctor } from './runner';

let delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

let base = { category: 'runtime', severity: 'critical' } as const;

let counted = (ms = 30) => {
  let calls = { count: 0 };
  let definition = check({
    ...base,
    id: 'counted',
    title: 'Counted',
    run: async ctx => {
      calls.count++;
      await delay(ms);
      return ctx.pass();
    }
  });

  return { calls, definition };
};

let doctorWith = (
  checks: CheckDefinition[],
  options: Partial<Parameters<typeof createDoctor>[0]> = {}
) =>
  createDoctor({
    component: 'test',
    instance: 'test-0',
    releaseVersion: '1.0.0',
    buildVersion: null,
    channel: 'release',
    checks,
    ...options
  });

describe('report', () => {
  it('produces a valid canonical report', async () => {
    let doctor = doctorWith(
      [
        check({
          ...base,
          id: 'a.pass',
          title: 'A',
          run: ctx => ctx.pass('fine', { latencyMs: 3 })
        }),
        check({
          ...base,
          id: 'a.fail',
          title: 'B',
          target: 'postgres://u:p@db:5432/x',
          resolution: { summary: 'Fix it.' },
          run: ctx => {
            ctx.fail({ message: 'broken', details: { password: 'x' } });
          }
        })
      ],
      { fingerprints: { installationSecret: 'abc' }, publicUrl: 'https://example.com' }
    );

    let report = await doctor.run();

    expect(parseReport(JSON.parse(JSON.stringify(report)))).toEqual(report);
    expect(report).toMatchObject({
      doctor: 1,
      component: 'test',
      instance: 'test-0',
      releaseVersion: '1.0.0',
      buildVersion: null,
      fingerprints: { installationSecret: 'abc' },
      cached: false
    });
    expect(report.checks.map(item => [item.id, item.status])).toEqual([
      ['a.pass', 'pass'],
      ['a.fail', 'fail']
    ]);
    expect(report.checks[0]!.resolution).toBeNull();
    expect(report.checks[1]).toMatchObject({
      target: 'postgres://u:***@db:5432/x',
      resolution: { summary: 'Fix it.', steps: [], docs: null },
      details: { password: '***' }
    });
  });

  it('defaults to pass when a check records nothing', async () => {
    let report = await doctorWith([
      check({ ...base, id: 'quiet', title: 'Quiet', run: () => {} })
    ]).run();
    expect(report.checks[0]).toMatchObject({ status: 'pass', message: 'OK' });
  });

  it('reports thrown errors with a described error', async () => {
    let report = await doctorWith([
      check({
        ...base,
        id: 'throws',
        title: 'Throws',
        run: () => {
          throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:6379'), {
            code: 'ECONNREFUSED'
          });
        }
      })
    ]).run();

    expect(report.checks[0]).toMatchObject({
      status: 'error',
      message: 'connect ECONNREFUSED 10.0.0.1:6379',
      details: { error: { kind: 'connection_refused', code: 'ECONNREFUSED' } }
    });
    expect(report.checks[0]!.resolution?.summary).toContain('Nothing is listening');
  });

  it('times checks out and aborts their signal', async () => {
    let aborted = false;
    let report = await doctorWith([
      check({
        ...base,
        id: 'slow',
        title: 'Slow',
        timeoutMs: 20,
        run: async ctx => {
          ctx.signal.addEventListener('abort', () => (aborted = true));
          await delay(200);
          return ctx.pass();
        }
      })
    ]).run();

    expect(report.checks[0]).toMatchObject({
      status: 'timeout',
      message: 'Timed out after 20ms.'
    });
    expect(aborted).toBe(true);
  });

  it('does not leak a rejection from a check that fails after its timeout', async () => {
    let unhandled: unknown[] = [];
    let onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      let report = await doctorWith([
        check({
          ...base,
          id: 'slow',
          title: 'Slow',
          timeoutMs: 10,
          run: ctx =>
            new Promise((_, reject) =>
              ctx.signal.addEventListener('abort', () => reject(new Error('aborted')))
            )
        })
      ]).run();

      await delay(30);

      expect(report.checks[0]).toMatchObject({ status: 'timeout' });
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('enforces the run budget across checks', async () => {
    let started = Date.now();
    let report = await doctorWith(
      [
        check({ ...base, id: 'one', title: 'One', run: () => delay(40) }),
        check({ ...base, id: 'two', title: 'Two', dependsOn: ['one'], run: () => delay(200) })
      ],
      { runBudgetMs: 80 }
    ).run();

    expect(report.checks.map(item => item.status)).toEqual(['pass', 'timeout']);
    expect(Date.now() - started).toBeLessThan(150);
  });

  it('limits concurrency', async () => {
    let active = 0;
    let peak = 0;
    let checks = Array.from({ length: 10 }, (_, index) =>
      check({
        ...base,
        id: `c${index}`,
        title: `C${index}`,
        run: async () => {
          active++;
          peak = Math.max(peak, active);
          await delay(10);
          active--;
        }
      })
    );

    await doctorWith(checks, { concurrency: 3 }).run();
    expect(peak).toBe(3);
  });

  it('skips checks whose dependency failed, transitively', async () => {
    let report = await doctorWith([
      check({ ...base, id: 'db.connect', title: 'Connect', run: ctx => ctx.fail('down') }),
      check({
        ...base,
        id: 'db.schema',
        title: 'Schema',
        dependsOn: ['db.connect'],
        run: ctx => ctx.pass()
      }),
      check({
        ...base,
        id: 'db.data',
        title: 'Data',
        dependsOn: ['db.schema'],
        run: ctx => ctx.pass()
      }),
      check({ ...base, id: 'db.warned', title: 'Warned', run: ctx => ctx.warn('slow') }),
      check({
        ...base,
        id: 'db.after-warn',
        title: 'After',
        dependsOn: ['db.warned'],
        run: ctx => ctx.pass()
      })
    ]).run();

    expect(report.checks.map(item => [item.id, item.status])).toEqual([
      ['db.connect', 'fail'],
      ['db.schema', 'skip'],
      ['db.data', 'skip'],
      ['db.warned', 'warn'],
      ['db.after-warn', 'pass']
    ]);
    expect(report.checks[1]).toMatchObject({
      message: 'Skipped because db.connect did not pass.',
      details: { dependsOn: ['db.connect'] }
    });
  });

  it('gives checks access to dependency results', async () => {
    let report = await doctorWith([
      check({
        ...base,
        id: 'first',
        title: 'First',
        run: ctx => ctx.pass('ok', { value: 42 })
      }),
      check({
        ...base,
        id: 'second',
        title: 'Second',
        dependsOn: ['first'],
        run: ctx => ctx.pass(`saw ${ctx.dependency('first')?.details?.value}`)
      })
    ]).run();

    expect(report.checks[1]!.message).toBe('saw 42');
  });

  it('reports unknown dependencies and cycles as errors', async () => {
    let report = await doctorWith([
      check({
        ...base,
        id: 'orphan',
        title: 'Orphan',
        dependsOn: ['missing'],
        run: ctx => ctx.pass()
      }),
      check({ ...base, id: 'a', title: 'A', dependsOn: ['b'], run: ctx => ctx.pass() }),
      check({ ...base, id: 'b', title: 'B', dependsOn: ['a'], run: ctx => ctx.pass() }),
      check({ ...base, id: 'c', title: 'C', dependsOn: ['a'], run: ctx => ctx.pass() })
    ]).run();

    expect(report.checks.map(item => [item.id, item.status])).toEqual([
      ['orphan', 'error'],
      ['a', 'error'],
      ['b', 'error'],
      ['c', 'skip']
    ]);
    expect(report.checks[1]!.message).toBe('Dependency cycle: a → b → a.');
  });

  it('reuses results within minIntervalMs, also for fresh runs', async () => {
    let calls = 0;
    let doctor = doctorWith(
      [
        check({
          ...base,
          id: 'expensive',
          title: 'Expensive',
          minIntervalMs: 60_000,
          run: ctx => {
            calls++;
            return ctx.pass();
          }
        })
      ],
      { cacheTtlMs: 0, freshMinIntervalMs: 0 }
    );

    let first = await doctor.run();
    let second = await doctor.run({ fresh: true });

    expect(calls).toBe(1);
    expect(first.checks[0]!.cachedAt).toBeNull();
    expect(second.checks[0]!.cachedAt).toEqual(expect.any(String));
    expect(second.runId).not.toBe(first.runId);
  });

  it('rejects invalid and duplicate check ids', () => {
    let doctor = doctorWith([]);
    let valid = check({ ...base, id: 'ok', title: 'OK', run: () => {} });

    expect(() => doctor.register({ ...valid, id: 'Bad.Id' })).toThrow(
      'Invalid doctor check id'
    );
    doctor.register(valid);
    expect(() => doctor.register(valid)).toThrow('Duplicate doctor check id');
  });

  it.each([
    ['invalid id', 'Bad.Id', 'Invalid doctor check id'],
    ['existing duplicate', 'existing', 'Duplicate doctor check id'],
    ['batch duplicate', 'new', 'Duplicate doctor check id']
  ])('rejects the entire batch for %s', async (_, rejectedId, message) => {
    let definition = check({ ...base, id: 'existing', title: 'Existing', run: () => {} });
    let doctor = doctorWith([definition], { cacheTtlMs: 0, freshMinIntervalMs: 0 });
    let first = { ...definition, id: 'new' };

    expect(() => doctor.register(first, { ...definition, id: rejectedId })).toThrow(message);
    expect((await doctor.run()).checks.map(item => item.id)).toEqual(['existing']);

    doctor.register(first, { ...definition, id: 'other' });

    expect((await doctor.run()).checks.map(item => item.id)).toEqual([
      'existing',
      'new',
      'other'
    ]);
  });
});

describe('debouncing', () => {
  it('runs once for six concurrent requests', async () => {
    let { calls, definition } = counted();
    let doctor = doctorWith([definition]);

    let reports = await Promise.all(Array.from({ length: 6 }, () => doctor.run()));

    expect(calls.count).toBe(1);
    expect(new Set(reports.map(report => report.runId)).size).toBe(1);
    expect(reports.every(report => !report.cached)).toBe(true);
  });

  it('serves the cache within the TTL', async () => {
    let { calls, definition } = counted(1);
    let doctor = doctorWith([definition], { cacheTtlMs: 1_000 });

    let first = await doctor.run();
    await delay(5);
    let second = await doctor.run();

    expect(calls.count).toBe(1);
    expect(second).toMatchObject({ runId: first.runId, cached: true });
    expect(second.ageMs).toBeGreaterThan(0);
  });

  it('runs again after the TTL', async () => {
    let { calls, definition } = counted(1);
    let doctor = doctorWith([definition], { cacheTtlMs: 10 });

    await doctor.run();
    await delay(20);
    await doctor.run();

    expect(calls.count).toBe(2);
  });

  it('joins a run in flight for fresh requests', async () => {
    let { calls, definition } = counted(40);
    let doctor = doctorWith([definition]);

    let first = doctor.run();
    await delay(5);
    let fresh = doctor.run({ fresh: true });

    expect((await first).runId).toBe((await fresh).runId);
    expect(calls.count).toBe(1);
  });

  it('serves fresh requests from a run that just finished', async () => {
    let { calls, definition } = counted(1);
    let doctor = doctorWith([definition], { freshMinIntervalMs: 1_000 });

    let first = await doctor.run();
    let fresh = await doctor.run({ fresh: true });

    expect(calls.count).toBe(1);
    expect(fresh).toMatchObject({ runId: first.runId, cached: true });
  });

  it('runs fresh requests after freshMinIntervalMs', async () => {
    let { calls, definition } = counted(1);
    let doctor = doctorWith([definition], { freshMinIntervalMs: 10 });

    await doctor.run();
    await delay(20);
    await doctor.run({ fresh: true });

    expect(calls.count).toBe(2);
  });

  it("doesn't cancel the run when the first requester aborts", async () => {
    let { calls, definition } = counted(40);
    let doctor = doctorWith([definition]);
    let controller = new AbortController();

    let first = doctor.run({ signal: controller.signal });
    await delay(5);
    let second = doctor.run();
    controller.abort(new Error('client went away'));

    await expect(first).rejects.toThrow('client went away');
    let report = await second;

    expect(report.checks[0]!.status).toBe('pass');
    expect(calls.count).toBe(1);
    expect((await doctor.run()).cached).toBe(true);
  });
});

describe('handler', () => {
  it('serves reports with protocol headers', async () => {
    let doctor = doctorWith([
      check({ ...base, id: 'one', title: 'One', run: ctx => ctx.pass() })
    ]);
    let response = await doctor.handler(new Request('http://localhost/doctor'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-metorial-doctor')).toBe('1');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(parseReport(await response.json()).checks).toHaveLength(1);
  });

  it('honors fresh=1', async () => {
    let { calls, definition } = counted(1);
    let doctor = doctorWith([definition], { freshMinIntervalMs: 0 });

    await doctor.handler(new Request('http://localhost/doctor'));
    await doctor.handler(new Request('http://localhost/doctor?fresh=1'));

    expect(calls.count).toBe(2);
  });

  it('rejects other methods', async () => {
    let response = await doctorWith([]).handler(
      new Request('http://localhost/doctor', { method: 'POST' })
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});
