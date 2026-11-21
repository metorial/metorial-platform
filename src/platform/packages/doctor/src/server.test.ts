import { check } from '@lowerdeck/doctor';
import { afterEach, describe, expect, it } from 'vitest';
import {
  registerDoctorChecks,
  registerDoctorFingerprint,
  resetDoctorRegistry
} from './registry';
import { resolveHealthPorts, startBootFailureServer, startHealthServer } from './server';

let request = (path: string, init?: RequestInit) => new Request(`http://health${path}`, init);

afterEach(() => resetDoctorRegistry());

describe('startHealthServer', () => {
  it('keeps the liveness answer on every path except /doctor', async () => {
    let server = startHealthServer({
      component: 'test',
      env: {},
      liveness: () => new Response('OK')
    });

    for (let path of ['/', '/health', '/anything']) {
      let response = await server.fetch(request(path));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('OK');
    }

    let failing = startHealthServer({
      component: 'test',
      env: {},
      liveness: () => new Response('Service Unavailable', { status: 503 })
    });
    let response = await failing.fetch(request('/'));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('Service Unavailable');
  });

  it('serves a doctor report with registered checks and fingerprints', async () => {
    registerDoctorFingerprint('installation-secret', 'abc123abc123');
    registerDoctorChecks(
      check({
        id: 'early',
        title: 'Early',
        category: 'runtime',
        severity: 'info',
        run: ctx => ctx.pass()
      })
    );

    let server = startHealthServer({
      component: 'test',
      env: { METORIAL_PUBLIC_URL: 'https://metorial.example.com' },
      liveness: () => new Response('OK'),
      checks: [
        check({
          id: 'own',
          title: 'Own',
          category: 'runtime',
          severity: 'critical',
          run: ctx => ctx.fail('broken')
        })
      ]
    });

    registerDoctorChecks(
      check({
        id: 'late',
        title: 'Late',
        category: 'runtime',
        severity: 'info',
        run: ctx => ctx.pass()
      })
    );

    let response = await server.fetch(request('/doctor'));
    let report = (await response.json()) as any;

    expect(response.headers.get('x-metorial-doctor')).toBe('1');
    expect(report.component).toBe('test');
    expect(report.publicUrl).toBe('https://metorial.example.com');
    expect(report.fingerprints).toEqual({ 'installation-secret': 'abc123abc123' });
    expect(report.checks.map((item: any) => item.id).sort()).toEqual(['early', 'late', 'own']);
  });

  it('rejects other methods on /doctor', async () => {
    let server = startHealthServer({
      component: 'test',
      env: {},
      liveness: () => new Response('OK')
    });
    let response = await server.fetch(request('/doctor', { method: 'POST' }));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});

describe('resolveHealthPorts', () => {
  it('listens on HEALTH_PORT, or the production ports, or nothing', () => {
    expect(resolveHealthPorts({ HEALTH_PORT: '13000' })).toEqual([13000]);
    expect(resolveHealthPorts({ NODE_ENV: 'production' })).toEqual([12121]);
    expect(resolveHealthPorts({ NODE_ENV: 'production' }, [10101, 12121])).toEqual([
      10101, 12121
    ]);
    expect(resolveHealthPorts({})).toEqual([]);
  });
});

describe('startBootFailureServer', () => {
  it('reports the boot failure as a critical check and keeps liveness failing', async () => {
    let server = startBootFailureServer('secret-store', new Error('KMS key not found'), {
      env: {}
    });

    let live = await server.fetch(request('/'));
    expect(live.status).toBe(503);

    let report = (await (await server.fetch(request('/doctor'))).json()) as {
      checks?: { id: string; status: string; message?: string }[];
    };
    let boot = (report.checks ?? []).find(item => item.id == 'runtime.boot');
    expect(boot?.status).toBe('fail');
    expect(boot?.message).toContain('KMS key not found');
  });
});
