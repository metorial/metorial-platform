import { createHash } from 'node:crypto';
import { Client } from 'pg';
import type { DatabaseConfig } from './config';
import { throwIfInterrupted } from './signals';

let lockPollMs = 500;
let maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);

export let lockKey = (db: DatabaseConfig) => {
  if (db.lock !== undefined) return db.lock;

  let digest = createHash('sha256').update(`metorial:migrate:${db.name}`).digest();

  return Number(digest.readBigUInt64BE(0) % maxSafeInteger);
};

export let schemaOf = (url: string) => new URL(url).searchParams.get('schema') ?? 'public';

export let connect = async (url: string) => {
  let connectionUrl = new URL(url);
  let mode = connectionUrl.searchParams.get('sslmode');

  for (let param of ['sslmode', 'schema', 'connection_limit']) {
    connectionUrl.searchParams.delete(param);
  }

  let client = new Client({
    connectionString: connectionUrl.toString(),
    ssl: mode === 'require' || mode === 'no-verify' ? { rejectUnauthorized: false } : undefined
  });
  await client.connect();

  return client;
};

let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export let withLock = async <T>(
  db: DatabaseConfig,
  url: string,
  run: (client: Client) => Promise<T>
) => {
  let client = await connect(url);

  try {
    let key = lockKey(db);
    let announced = false;

    while (true) {
      throwIfInterrupted();

      let result = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [
        key
      ]);
      if (result.rows[0].locked) break;

      if (!announced) {
        console.log(`Waiting for the ${db.name} migration lock held by another process`);
        announced = true;
      }

      await sleep(lockPollMs);
    }

    return await run(client);
  } finally {
    await client.end();
  }
};
