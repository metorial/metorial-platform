import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { buildEdition } from '../src/tooling/build';

let directories: string[] = [];

afterAll(async () => {
  await Promise.all(
    directories.map(directory => rm(directory, { recursive: true, force: true }))
  );
});

it('omits Jackson Mongo storage on-prem and keeps Postgres and cloud adapters', async () => {
  let directory = await mkdtemp(join(tmpdir(), 'postgres-saml-'));
  directories.push(directory);
  let db = join(directory, 'node_modules/@boxyhq/saml-jackson/dist/db');
  await mkdir(db, { recursive: true });
  await writeFile(
    join(db, 'mongo.js'),
    'module.exports = class Mongo { static new() { return "MONGO_DRIVER_MARKER"; } };'
  );
  await writeFile(join(db, 'sql.js'), 'module.exports = "POSTGRES_ADAPTER_MARKER";');
  let platform = join(directory, 'node_modules/typeorm/platform');
  await mkdir(platform, { recursive: true });
  await mkdir(join(directory, 'node_modules/mongodb'), { recursive: true });
  await writeFile(
    join(platform, 'PlatformTools.js'),
    'exports.load = function() { return require("mongodb"); };'
  );
  await writeFile(
    join(directory, 'node_modules/mongodb/index.js'),
    'module.exports = "TYPEORM_MONGO_MARKER";'
  );
  let entry = join(directory, 'main.js');
  await writeFile(
    entry,
    'const mongo = require("@boxyhq/saml-jackson/dist/db/mongo.js"); const sql = require("@boxyhq/saml-jackson/dist/db/sql.js"); const platform = require("typeorm/platform/PlatformTools.js"); console.log(sql); if (process.env.SSO_ENGINE === "mongo") console.log(mongo.new(), platform.load());'
  );

  for (let edition of ['cloud', 'on-prem'] as const) {
    let outdir = join(directory, edition);
    await buildEdition({ entry, edition, outdir });
    let bundle = await readFile(join(outdir, 'main.mjs'), 'utf8');
    expect(bundle).toContain('POSTGRES_ADAPTER_MARKER');
    if (edition === 'cloud') {
      expect(bundle).toContain('MONGO_DRIVER_MARKER');
      expect(bundle).toContain('TYPEORM_MONGO_MARKER');
    } else {
      expect(bundle).not.toContain('MONGO_DRIVER_MARKER');
      expect(bundle).not.toContain('TYPEORM_MONGO_MARKER');
      expect(bundle).toContain('On-prem SSO uses Postgres storage');
    }
  }
});
