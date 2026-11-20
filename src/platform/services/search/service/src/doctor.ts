import { check, type CheckDefinition } from '@lowerdeck/doctor';
import {
  attempt,
  baselineChecks,
  bunRedis,
  dependencyCheck,
  postgresChecks,
  prismaQuery,
  queueChecks,
  redisChecks,
  type SqlQuery
} from '@metorial/doctor';
import type { RedisClient } from 'bun';
import { sql } from 'drizzle-orm';
import { defaultBackend } from './backends';
import { AlgoliaBackend } from './backends/algolia';
import { db as searchDb } from './backends/pg/schema';
import { db } from './db';
import { env } from './env';

let searchQuery: SqlQuery = async statement => {
  if (!searchDb) throw new Error('SEARCH_DATABASE_URL is not set');
  let result = await searchDb.execute(sql.raw(statement));
  return result.rows as Record<string, unknown>[];
};

let trigramCheck = (): CheckDefinition =>
  check({
    id: 'postgres.search.pg-trgm',
    title: 'The pg_trgm extension is installed in the search database',
    category: 'database',
    severity: 'critical',
    target: 'postgres/search',
    dependsOn: ['postgres.search.connect'],
    run: ctx =>
      attempt(ctx, 'postgres', async () => {
        let rows = await searchQuery(
          "SELECT extversion FROM pg_extension WHERE extname = 'pg_trgm'"
        );
        let version = rows[0]?.extversion;

        if (!version) {
          return ctx.fail({
            message: 'The pg_trgm extension is not installed in the search database.',
            resolution: {
              summary: 'Allow the extension, or install it as a superuser.',
              steps: [
                'Run CREATE EXTENSION pg_trgm; in the search database.',
                'On managed PostgreSQL, add pg_trgm to the allowed extensions first.'
              ]
            }
          });
        }

        return ctx.pass(`pg_trgm ${version} is installed.`, { version });
      })
  });

let backendChecks = (): CheckDefinition[] => {
  if (defaultBackend instanceof AlgoliaBackend) {
    return [
      dependencyCheck({
        name: 'algolia',
        severity: 'critical',
        url: `https://${env.service.ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes?page=0&hitsPerPage=1`,
        headers: {
          'x-algolia-application-id': env.service.ALGOLIA_APP_ID!,
          'x-algolia-api-key': env.service.ALGOLIA_API_KEY!
        }
      })
    ];
  }

  return [...postgresChecks({ name: 'search', query: searchQuery }), trigramCheck()];
};

export let searchDoctorChecks = (redis: RedisClient): CheckDefinition[] => [
  ...baselineChecks(),
  ...postgresChecks({
    name: 'voyager',
    query: prismaQuery(db),
    schemaProbe: () => db.backend.count()
  }),
  ...redisChecks({ client: bunRedis(redis) }),
  ...queueChecks(),
  ...backendChecks()
];
