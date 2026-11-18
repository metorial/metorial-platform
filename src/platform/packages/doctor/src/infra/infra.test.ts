import { createDoctor, type CheckDefinition } from '@lowerdeck/doctor';
import { describe, expect, it } from 'vitest';
import { dependencyCheck, tcpAddress } from './dependency';
import { natsChecks } from './nats';
import { objectStorageChecks } from './objectStorage';
import { postgresChecks, postgresServerChecks } from './postgres';
import { parseRedisInfo, redisChecks } from './redis';

let run = async (checks: CheckDefinition[]) => {
  let report = await createDoctor({ component: 'test', checks }).run();
  return Object.fromEntries(report.checks.map(item => [item.id, item]));
};

let coded = (code: string, message = code) => Object.assign(new Error(message), { code });

describe('postgresChecks', () => {
  let healthy = async (sql: string) => {
    if (sql == 'SHOW server_version_num') return [{ server_version_num: '170004' }];
    if (sql.includes('pg_stat_ssl')) return [{ ssl: true }];
    return [{ '?column?': 1 }];
  };

  it('passes against a healthy server', async () => {
    let checks = await run(
      postgresChecks({ name: 'core', query: healthy, schemaProbe: async () => 1 })
    );

    expect(checks['postgres.core.connect']!.status).toBe('pass');
    expect(checks['postgres.core.version']!.status).toBe('pass');
    expect(checks['postgres.core.schema']!.status).toBe('pass');
    expect(checks['postgres.core.tls']!.status).toBe('pass');
    expect(checks['postgres.core.connect']!.target).toBe('postgres/core');
  });

  it('explains a wrong password and skips dependent checks', async () => {
    let checks = await run(
      postgresChecks({
        name: 'core',
        query: async () => {
          throw coded('P1000', 'Authentication failed against database server');
        }
      })
    );

    expect(checks['postgres.core.connect']!.status).toBe('fail');
    expect(checks['postgres.core.connect']!.resolution!.summary).toContain('password');
    expect(checks['postgres.core.version']!.status).toBe('skip');
  });

  it('explains a missing database', async () => {
    let checks = await run(
      postgresChecks({
        name: 'core',
        query: async () => {
          throw coded('3D000', 'database "metorial" does not exist');
        }
      })
    );

    expect(checks['postgres.core.connect']!.resolution!.summary).toBe(
      'The database does not exist.'
    );
  });

  it('fails old servers and missing schemas', async () => {
    let checks = await run(
      postgresChecks({
        name: 'core',
        query: async sql =>
          sql == 'SHOW server_version_num' ? [{ v: '150002' }] : [{ v: 1 }],
        schemaProbe: async () => {
          throw new Error('relation "Tenant" does not exist');
        }
      })
    );

    expect(checks['postgres.core.version']!.status).toBe('fail');
    expect(checks['postgres.core.version']!.message).toContain('PostgreSQL 15');
    expect(checks['postgres.core.schema']!.status).toBe('fail');
    expect(checks['postgres.core.schema']!.resolution!.summary).toContain('bootstrap Job');
  });

  it('only warns about plaintext connections when TLS is expected', async () => {
    let plain = async (sql: string) =>
      sql.includes('pg_stat_ssl') ? [{ ssl: false }] : [{ v: '170000' }];

    expect(
      (await run(postgresChecks({ name: 'core', query: plain })))['postgres.core.tls']!.status
    ).toBe('pass');
    expect(
      (await run(postgresChecks({ name: 'core', query: plain, expectTls: true })))[
        'postgres.core.tls'
      ]!.status
    ).toBe('warn');
  });
});

describe('postgresServerChecks', () => {
  it('fails missing databases only when the user cannot create them', async () => {
    let query = (canCreate: boolean) => async (sql: string) => {
      if (sql.includes('pg_database')) return [{ datname: 'metorial' }];
      if (sql.includes('rolcreatedb')) return [{ rolcreatedb: canCreate }];
      if (sql == 'SHOW max_connections') return [{ max_connections: '1000' }];
      return [{ count: 10 }];
    };

    let blocked = await run(
      postgresServerChecks({ query: query(false), databases: ['metorial', 'nebula'] })
    );
    expect(blocked['postgres.server.databases']!.status).toBe('fail');
    expect(blocked['postgres.server.databases']!.details).toEqual({ missing: ['nebula'] });

    let creatable = await run(
      postgresServerChecks({ query: query(true), databases: ['metorial', 'nebula'] })
    );
    expect(creatable['postgres.server.databases']!.status).toBe('pass');
    expect(creatable['postgres.server.max-connections']!.status).toBe('pass');
  });

  it('warns about low max_connections and fails when nearly exhausted', async () => {
    let query = (max: number, used: number) => async (sql: string) =>
      sql == 'SHOW max_connections'
        ? [{ v: String(max) }]
        : sql.includes('pg_database')
          ? []
          : [{ v: used }];

    let low = await run(postgresServerChecks({ query: query(100, 10), databases: [] }));
    expect(low['postgres.server.max-connections']!.status).toBe('warn');

    let exhausted = await run(
      postgresServerChecks({ query: query(1000, 990), databases: [] })
    );
    expect(exhausted['postgres.server.max-connections']!.status).toBe('fail');
  });
});

describe('redisChecks', () => {
  let client = (sections: Record<string, string>) => ({
    ping: async () => 'PONG',
    info: async (section: string) => sections[section] ?? ''
  });

  let healthy = {
    server: '# Server\r\nredis_version:7.2.4\r\n',
    memory: 'used_memory:100\r\nmaxmemory:0\r\nmaxmemory_policy:noeviction\r\n',
    cluster: 'cluster_enabled:0\r\n',
    persistence: 'rdb_last_bgsave_status:ok\r\n'
  };

  it('parses INFO output', () => {
    expect(parseRedisInfo(healthy.server)).toEqual({ redis_version: '7.2.4' });
  });

  it('passes against a healthy server', async () => {
    let checks = await run(redisChecks({ client: client(healthy) }));
    for (let id of [
      'redis.connect',
      'redis.version',
      'redis.eviction-policy',
      'redis.cluster-mode',
      'redis.memory',
      'redis.persistence'
    ]) {
      expect([id, checks[id]!.status]).toEqual([id, 'pass']);
    }
  });

  it('fails an evicting, clustered or old server', async () => {
    let checks = await run(
      redisChecks({
        client: client({
          ...healthy,
          server: 'redis_version:6.2.0',
          memory: 'used_memory:95\r\nmaxmemory:100\r\nmaxmemory_policy:allkeys-lru',
          cluster: 'cluster_enabled:1'
        })
      })
    );

    expect(checks['redis.version']!.status).toBe('fail');
    expect(checks['redis.eviction-policy']!.status).toBe('fail');
    expect(checks['redis.eviction-policy']!.resolution!.summary).toContain('noeviction');
    expect(checks['redis.cluster-mode']!.status).toBe('fail');
    expect(checks['redis.memory']!.status).toBe('warn');
  });

  it('explains a wrong password', async () => {
    let checks = await run(
      redisChecks({
        client: {
          ping: async () => {
            throw new Error('WRONGPASS invalid username-password pair');
          },
          info: async () => ''
        }
      })
    );

    expect(checks['redis.connect']!.status).toBe('fail');
  });
});

describe('natsChecks', () => {
  it('checks max_payload', async () => {
    let small = await run(
      natsChecks({ connection: { flush: async () => {}, info: { max_payload: 1024 * 1024 } } })
    );
    expect(small['nats.connect']!.status).toBe('pass');
    expect(small['nats.max-payload']!.status).toBe('fail');

    let large = await run(
      natsChecks({
        connection: { flush: async () => {}, info: { max_payload: 64 * 1024 * 1024 } }
      })
    );
    expect(large['nats.max-payload']!.status).toBe('pass');
  });
});

describe('objectStorageChecks', () => {
  it('round-trips an object in every bucket', async () => {
    let stored = new Map<string, string>();
    let client = {
      ping: async () => {},
      putObject: async (bucket: string, key: string, data: string) =>
        void stored.set(`${bucket}/${key}`, data),
      getObject: async (bucket: string, key: string) => ({
        data: new TextEncoder().encode(stored.get(`${bucket}/${key}`))
      }),
      deleteObject: async (bucket: string, key: string) =>
        void stored.delete(`${bucket}/${key}`)
    };

    let checks = await run(
      objectStorageChecks({ client, buckets: ['files', 'event-payloads'], instance: 'pod-1' })
    );

    expect(checks['object-storage.files.round-trip']!.status).toBe('pass');
    expect(checks['object-storage.event-payloads.round-trip']!.status).toBe('pass');
    expect(stored.size).toBe(0);
  });

  it('reports a missing bucket', async () => {
    let client = {
      ping: async () => {},
      putObject: async () => {
        throw coded('NoSuchBucket', 'The specified bucket does not exist');
      },
      getObject: async () => ({ data: new Uint8Array() }),
      deleteObject: async () => {}
    };

    let checks = await run(objectStorageChecks({ client, buckets: ['files'] }));
    expect(checks['object-storage.files.round-trip']!.status).toBe('fail');
    expect(checks['object-storage.files.round-trip']!.details!.errorKind).toBe('not_found');
  });
});

describe('dependencyCheck', () => {
  it('reports a refused connection with a resolution', async () => {
    let checks = await run([
      dependencyCheck({
        name: 'email',
        run: async () => {
          throw coded('ECONNREFUSED', 'connect ECONNREFUSED 10.0.0.1:52140');
        }
      })
    ]);

    expect(checks['dependencies.email']!.status).toBe('fail');
    expect(checks['dependencies.email']!.target).toBe('email');
    expect(checks['dependencies.email']!.resolution!.summary).toBe(
      'The service is not reachable.'
    );
  });
});

describe('tcpAddress', () => {
  it('derives ports from URLs and host:port pairs', () => {
    expect(tcpAddress('http://code-bucket:4040/api')).toEqual({
      host: 'code-bucket',
      port: 4040
    });
    expect(tcpAddress('https://example.com')).toEqual({ host: 'example.com', port: 443 });
    expect(tcpAddress('nats:4222')).toEqual({ host: 'nats', port: 4222 });
    expect(() => tcpAddress('tcp://nats')).toThrow();
  });
});
