import { check, type CheckDefinition } from '@lowerdeck/doctor';
import {
  baselineChecks,
  bunRedis,
  dependencyCheck,
  objectStorageChecks,
  postgresChecks,
  prismaQuery,
  queueChecks,
  redisChecks
} from '@metorial/doctor';
import type { RedisClient } from 'bun';
import { db } from './db';
import { delegateSecretsToNebula, env } from './env';
import { storage } from './storage';

let editorUrlCheck = (): CheckDefinition =>
  check({
    id: 'scm.code-bucket.editor-url',
    title: 'The code editor URL is a valid public URL',
    category: 'configuration',
    severity: 'warning',
    run: ctx => {
      let editorUrl = env.codeBucket.CODE_BUCKET_EDITOR_URL;

      try {
        let url = new URL(editorUrl);
        if (url.protocol != 'https:' && url.protocol != 'http:') throw new Error();
      } catch {
        return ctx.warn({
          message: `CODE_BUCKET_EDITOR_URL (${editorUrl}) is not an http(s) URL.`,
          resolution: {
            summary: 'Point it at the public URL the gateway serves the editor on.'
          }
        });
      }

      return ctx.pass(`The editor is served at ${editorUrl}.`, { editorUrl });
    }
  });

export let scmDoctorChecks = (redis: RedisClient): CheckDefinition[] => [
  ...baselineChecks(),
  ...postgresChecks({
    name: 'origin',
    query: prismaQuery(db),
    schemaProbe: () => db.tenant.count()
  }),
  ...redisChecks({ client: bunRedis(redis) }),
  ...objectStorageChecks({
    client: storage,
    buckets: [env.storage.CODE_BUCKET_OBJECT_STORAGE_BUCKET]
  }),
  ...queueChecks(),
  dependencyCheck({ name: 'code-bucket', tcp: env.codeBucket.CODE_BUCKET_SERVICE_URL }),
  ...(delegateSecretsToNebula
    ? [dependencyCheck({ name: 'secret-store', tcp: env.nebula.NEBULA_API_URL })]
    : []),
  editorUrlCheck()
];
