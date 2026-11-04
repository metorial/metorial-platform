import { describe, expect, test } from 'bun:test';
import {
  compile,
  dependency,
  dev,
  endpoint,
  fromEnv,
  inherit,
  mergeEnv,
  nats,
  postgres,
  project,
  t
} from './index';

describe('control dsl', () => {
  test('endpoints compile with health and listen env', () => {
    let raw = compile(
      project({
        name: 'api',
        endpoints: { http: endpoint(4310).health('/ping').listenEnv('API_PORT') }
      })
    );

    expect(raw.endpoints!.http!.port).toBe(4310);
    expect(JSON.stringify(raw.endpoints!.http)).toContain('API_PORT');
    expect(JSON.stringify(raw.endpoints!.http)).toContain('/ping');
  });

  test('template tokens', () => {
    expect(`${t.hostname}:${t.port}`).toBe('{{HOSTNAME}}:{{PORT}}');
  });

  test('mergeEnv rejects duplicate keys', () => {
    expect(() => mergeEnv({ A: '1' }, { A: '2' })).toThrow();
    expect(mergeEnv({ A: '1' }, { B: inherit() })).toBeDefined();
  });

  test('fromEnv and inherit compile into the legacy wire format', () => {
    let raw = compile(
      project({
        name: 'api',
        dev: dev({ run: ['dev:start'], env: { A: inherit(), B: fromEnv('OTHER') } })
      })
    );

    expect(raw.dev!.env!.A).toBe(true);
    expect(raw.dev!.env!.B).toMatchObject({ from: 'OTHER' });
  });

  test('resources and dependencies compile', () => {
    let raw = compile(
      project({
        name: 'api',
        dependencies: [dependency('@x/y').noStart().env('api', 'URL', 'http://{{HOSTNAME}}')],
        resources: [nats({ NATS_URL: 'nats://{{HOSTNAME}}:{{PORT}}' })],
        dev: dev({
          run: ['dev:start'],
          databases: { main: postgres({ package: 'api', name: 'db', env: 'DB' }) }
        })
      })
    );

    expect(raw.dependencies).toHaveLength(1);
    expect(raw.resources).toHaveLength(1);
    expect(raw.dev!.db!.main).toMatchObject({ engine: 'postgres', name: 'db' });
  });
});
