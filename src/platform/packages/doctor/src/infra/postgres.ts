import { check, probes, type CheckDefinition } from '@lowerdeck/doctor';
import { attempt } from '../resolutions';
import { idPart } from './ids';

let minimumServerVersion = 170000;
let maxConnectionsMinimum = 1000;
let connectionUsageWarnRatio = 0.8;
let connectionUsageCriticalRatio = 0.95;

export type SqlQuery = (sql: string) => Promise<Record<string, unknown>[]>;

export interface PostgresCheckOptions {
  name: string;
  query: SqlQuery;
  schemaProbe?: () => Promise<unknown>;
  expectTls?: boolean;
}

export let prismaQuery =
  (client: { $queryRawUnsafe: (sql: string) => Promise<unknown> }): SqlQuery =>
  async sql =>
    (await client.$queryRawUnsafe(sql)) as Record<string, unknown>[];

let firstValue = (rows: Record<string, unknown>[]) => {
  let row = rows[0];
  return row ? Object.values(row)[0] : undefined;
};

export let postgresChecks = (options: PostgresCheckOptions): CheckDefinition[] => {
  let prefix = `postgres.${idPart(options.name)}`;
  let target = `postgres/${options.name}`;
  let connectId = `${prefix}.connect`;
  let base = { category: 'database' as const, target, dependsOn: [connectId] };
  let connect = probes.sql({ query: () => options.query('SELECT 1') });

  let checks: CheckDefinition[] = [
    check({
      id: connectId,
      title: `PostgreSQL database ${options.name} is reachable`,
      category: 'database',
      severity: 'critical',
      target,
      run: ctx => attempt(ctx, 'postgres', () => connect(ctx), { database: options.name })
    }),

    check({
      ...base,
      id: `${prefix}.version`,
      title: `PostgreSQL ${options.name} runs version 17 or newer`,
      severity: 'critical',
      run: ctx =>
        attempt(ctx, 'postgres', async () => {
          let version = Number(firstValue(await options.query('SHOW server_version_num')));
          let details = { serverVersionNum: version };

          if (!Number.isFinite(version) || version < minimumServerVersion) {
            return ctx.fail({
              message: `PostgreSQL ${Math.floor(version / 10000)} is too old; Metorial needs 17 or newer.`,
              resolution: { summary: 'Upgrade the PostgreSQL server to version 17 or newer.' },
              details
            });
          }

          return ctx.pass(`PostgreSQL ${Math.floor(version / 10000)}.`, details);
        })
    }),

    check({
      ...base,
      id: `${prefix}.tls`,
      title: `Connection to PostgreSQL ${options.name} uses TLS`,
      severity: options.expectTls ? 'warning' : 'info',
      run: ctx =>
        attempt(ctx, 'postgres', async () => {
          let ssl = firstValue(
            await options.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()')
          );

          if (ssl === true) return ctx.pass('The connection is encrypted.');
          if (!options.expectTls) return ctx.pass('The connection is not encrypted.');

          return ctx.warn({
            message: 'The connection to PostgreSQL is not encrypted.',
            resolution: { summary: 'Add sslmode=require to the database URL.' }
          });
        })
    })
  ];

  if (options.schemaProbe) {
    let schemaProbe = options.schemaProbe;

    checks.push(
      check({
        ...base,
        id: `${prefix}.schema`,
        title: `PostgreSQL ${options.name} has the Metorial schema`,
        severity: 'critical',
        run: async ctx => {
          try {
            await schemaProbe();
            return ctx.pass('The schema is applied.');
          } catch (error) {
            return ctx.fail({
              message: `The schema of ${options.name} is missing or outdated: ${(error as Error).message}`,
              resolution: {
                summary: 'The bootstrap Job did not run for this release.',
                steps: [
                  'Check the logs of the bootstrap Job: kubectl logs job/<release>-bootstrap',
                  'Re-run it with helm upgrade, which recreates the Job.'
                ],
                docs: 'datacenter/operations/doctor#postgres'
              }
            });
          }
        }
      })
    );
  }

  return checks;
};

export let postgresServerChecks = (options: {
  query: SqlQuery;
  databases: string[];
}): CheckDefinition[] => {
  let base = {
    category: 'database' as const,
    target: 'postgres/server',
    dependsOn: [] as string[]
  };

  return [
    check({
      ...base,
      id: 'postgres.server.databases',
      title: 'All Metorial databases exist',
      severity: 'critical',
      run: ctx =>
        attempt(ctx, 'postgres', async () => {
          let rows = await options.query('SELECT datname FROM pg_database');
          let existing = new Set(rows.map(row => String(row.datname)));
          let missing = options.databases.filter(name => !existing.has(name));
          if (!missing.length)
            return ctx.pass(`All ${options.databases.length} databases exist.`);

          let canCreate = firstValue(
            await options.query(
              'SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user'
            )
          );
          if (canCreate === true) {
            return ctx.pass(
              `${missing.length} databases will be created by the bootstrap Job.`,
              {
                missing
              }
            );
          }

          return ctx.fail({
            message: `${missing.length} databases are missing and the user cannot create them: ${missing.join(', ')}.`,
            resolution: {
              summary: 'Create the missing databases, or grant the user CREATEDB.',
              steps: missing.map(name => `CREATE DATABASE ${name} OWNER <metorial user>;`),
              docs: 'datacenter/operations/doctor#postgres'
            },
            details: { missing }
          });
        })
    }),

    check({
      ...base,
      id: 'postgres.server.max-connections',
      title: 'PostgreSQL allows enough connections',
      severity: 'warning',
      run: ctx =>
        attempt(ctx, 'postgres', async () => {
          let max = Number(firstValue(await options.query('SHOW max_connections')));
          let used = Number(
            firstValue(await options.query('SELECT count(*)::int FROM pg_stat_activity'))
          );
          let ratio = max ? used / max : 0;
          let details = { maxConnections: max, used, ratio: Number(ratio.toFixed(3)) };
          let resolution = {
            summary: `Raise max_connections to at least ${maxConnectionsMinimum}.`,
            docs: 'datacenter/operations/doctor#postgres'
          };

          if (ratio > connectionUsageCriticalRatio) {
            return ctx.fail({
              message: `${used} of ${max} connections are in use.`,
              resolution,
              details
            });
          }

          if (max < maxConnectionsMinimum || ratio > connectionUsageWarnRatio) {
            return ctx.warn({
              message: `max_connections is ${max} with ${used} in use.`,
              resolution,
              details
            });
          }

          return ctx.pass(`${used} of ${max} connections are in use.`, details);
        })
    })
  ];
};
