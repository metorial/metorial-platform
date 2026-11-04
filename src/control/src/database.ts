import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { SQL } from 'bun';
import * as environment from './environment';
import { packageScripts, readJson, sortedEntries } from './files';
import { discoverPackages } from './packages';
import * as commands from './process';
import type { Database, Environment, LoadedManifest, ProjectRoot } from './types';

export type DatabaseTask = 'generate' | 'push' | 'migrate';

export let databasePackages = (manifests: LoadedManifest[]) =>
  [
    ...new Set(
      manifests.flatMap(({ manifest }) =>
        [...Object.values(manifest.postgres), ...Object.values(manifest.mongo)].map(
          db => db.package
        )
      )
    )
  ].sort();

export let databaseOwnerEnvironments = (manifests: LoadedManifest[], root: Environment) => {
  let values: Record<string, Environment> = {};
  let packages = databasePackages(manifests);

  for (let loaded of manifests) {
    let resolved = environment.allForManifest(loaded, root);
    let name = loaded.manifest.package?.name;
    if (name && packages.includes(name)) Object.assign((values[name] ??= {}), resolved);

    for (let [key, db] of [
      ...Object.entries(loaded.manifest.postgres),
      ...Object.entries(loaded.manifest.mongo)
    ])
      (values[db.package] ??= {})[key] = resolved[key]!;
  }

  return values;
};

export let pool = async <T>(items: T[], limit: number, work: (item: T) => Promise<void>) => {
  let queue = [...items];
  let errors: unknown[] = [];

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        try {
          await work(item);
        } catch (error) {
          errors.push(error);
        }
      }
    })
  );

  if (errors.length) {
    let interrupted = errors.find(error => error instanceof commands.Interrupted);
    if (interrupted) throw interrupted;

    throw new Error(
      errors.map(error => (error instanceof Error ? error.message : error)).join('\n\n')
    );
  }
};

let concurrency = () => {
  let configured = Number(process.env.CONTROL_DB_CONCURRENCY);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : Math.max(2, Math.min(6, availableParallelism() - 1));
};

let ignoredSchemaDirectories = new Set(['generated', 'node_modules', 'migrations']);

export let schemaFiles = (directory: string): string[] => {
  let result: string[] = [];
  let visit = (current: string) => {
    let entries;

    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (let entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.isDirectory()) {
        if (!ignoredSchemaDirectories.has(entry.name)) visit(join(current, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.prisma')) {
        result.push(join(current, entry.name));
      }
    }
  };

  visit(join(directory, 'prisma'));

  return result;
};

export let installedVersion = (directory: string, name: string) => {
  let current = resolve(directory);

  while (true) {
    let path = join(current, 'node_modules', name, 'package.json');

    if (existsSync(path)) {
      try {
        return String(readJson<{ version?: string }>(path).version ?? '');
      } catch {
        return '';
      }
    }

    let parent = dirname(current);
    if (parent === current) return '';
    current = parent;
  }
};

let readIfPresent = (path: string) => (existsSync(path) ? readFileSync(path) : '');

let fingerprint = (directory: string, files: string[], extra: string[]) => {
  let hash = createHash('sha256');
  let add = (label: string, value: string | Buffer) => {
    hash.update(`${label}\0${value.length}\0`);
    hash.update(value);
    hash.update('\0');
  };

  for (let file of files) add(relative(directory, file), readFileSync(file));
  for (let name of ['prisma.config.ts', 'prisma-generate.sh'])
    add(name, readIfPresent(join(directory, name)));
  add('../prisma.config.ts', readIfPresent(join(directory, '..', 'prisma.config.ts')));
  add('scripts', JSON.stringify(sortedEntries(packageScripts(directory))));

  for (let name of [
    'prisma',
    '@prisma/client',
    '@prisma/adapter-pg',
    'prisma-json-types-generator'
  ])
    add(`version:${name}`, installedVersion(directory, name));

  for (let value of extra) add('extra', value);

  return hash.digest('hex').slice(0, 32);
};

export let generatedOutputs = (files: string[]) => {
  let outputs: string[] = [];

  for (let file of files) {
    for (let block of readFileSync(file, 'utf8').matchAll(/generator\s+\w+\s*\{([^}]*)\}/g)) {
      let output = block[1]!.match(/^\s*output\s*=\s*"([^"]+)"/m)?.[1];
      if (output) outputs.push(resolve(dirname(file), output));
    }
  }

  return outputs;
};

interface Job {
  name: string;
  directory: string;
  script: string;
  env: Environment;
  postgres: Database[];
}

let jobsFor = (
  project: ProjectRoot,
  selected: LoadedManifest[],
  env: Environment,
  task: DatabaseTask
): Job[] => {
  let directories = new Map(
    discoverPackages(project.root).map(item => [item.name, item.directory])
  );
  let owners = databaseOwnerEnvironments(selected, env);
  let script = `control:db:${task}`;
  let jobs: Job[] = [];

  for (let name of databasePackages(selected)) {
    let directory = directories.get(name);
    if (!directory) throw new Error(`unknown database package ${JSON.stringify(name)}`);

    let command = packageScripts(directory)[script];
    if (command === undefined || command.trim() === 'true') continue;

    jobs.push({
      name,
      directory,
      script,
      env: { ...env, ...owners[name] },
      postgres: selected.flatMap(({ manifest }) =>
        Object.values(manifest.postgres).filter(db => db.package === name)
      )
    });
  }

  return jobs;
};

let force = () => !!process.env.CONTROL_FORCE_PREPARE;

let seconds = (started: number) => ((Date.now() - started) / 1000).toFixed(1);

let runJob = async (job: Job) => {
  let started = Date.now();

  await commands.runCaptured(
    `${job.script} [${job.name}]`,
    'bun',
    ['run', job.script],
    job.directory,
    job.env
  );
  commands.say(`${job.script} [${job.name}] done in ${seconds(started)}s`);
};

let generateStamp = (job: Job) => {
  let files = schemaFiles(job.directory);
  let outputs = generatedOutputs(files);
  if (!files.length || !outputs.length) return;

  return {
    hash: fingerprint(job.directory, files, [process.platform, process.arch]),
    outputs,
    path: join(outputs[0]!, '.control-stamp')
  };
};

let generateIsCurrent = (stamp: NonNullable<ReturnType<typeof generateStamp>>) => {
  try {
    return (
      stamp.outputs.every(output => existsSync(output)) &&
      readFileSync(stamp.path, 'utf8').trim() === stamp.hash
    );
  } catch {
    return false;
  }
};

let runGenerate = async (jobs: Job[], useStamps: boolean) => {
  await pool(jobs, concurrency(), async job => {
    let stamp = useStamps ? generateStamp(job) : undefined;

    if (stamp && generateIsCurrent(stamp)) {
      commands.say(`${job.script} [${job.name}] up to date`);

      return;
    }

    await runJob(job);

    let fresh = generateStamp(job);
    if (fresh && fresh.outputs.every(output => existsSync(output)))
      writeFileSync(fresh.path, fresh.hash + '\n');
  });
};

let stampPrefix = 'control-schema-v1:';

let serverUrl = (db: Database) => environment.postgresUrl({ ...db, database: 'postgres' });

let quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

export let readStamps = async (url: string, names: string[]) => {
  let sql = new SQL(url, { max: 1, connectionTimeout: 5 });

  try {
    let rows =
      (await sql`select datname, shobj_description(oid, 'pg_database') as comment from pg_database`) as {
        datname: string;
        comment: string | null;
      }[];
    let stamps: Record<string, Record<string, string>> = {};

    for (let row of rows) {
      if (!names.includes(row.datname)) continue;

      try {
        stamps[row.datname] = row.comment?.startsWith(stampPrefix)
          ? JSON.parse(row.comment.slice(stampPrefix.length))
          : {};
      } catch {
        stamps[row.datname] = {};
      }
    }

    return stamps;
  } finally {
    await sql.close();
  }
};

export let writeStamp = async (
  url: string,
  database: string,
  current: Record<string, string>,
  name: string,
  hash: string
) => {
  let sql = new SQL(url, { max: 1, connectionTimeout: 5 });

  try {
    let value = stampPrefix + JSON.stringify({ ...current, [name]: hash });
    await sql.unsafe(
      `comment on database ${quote(database)} is '${value.replaceAll("'", "''")}'`
    );
  } finally {
    await sql.close();
  }
};

// The stamp lives on the database itself so it disappears together with the data.
let pushPlan = async (jobs: Job[]) => {
  let owners = new Map<string, number>();

  for (let job of jobs)
    for (let key of new Set(job.postgres.map(db => `${db.host}:${db.port}/${db.database}`)))
      owners.set(key, (owners.get(key) ?? 0) + 1);

  let stamps = new Map<string, Record<string, Record<string, string>>>();
  let plans = new Map<
    Job,
    | { hash: string; databases: { db: Database; current: Record<string, string> }[] }
    | undefined
  >();

  for (let job of jobs) {
    let files = schemaFiles(job.directory);
    let exclusive = job.postgres.every(
      db => owners.get(`${db.host}:${db.port}/${db.database}`) === 1
    );

    if (!files.length || !job.postgres.length || !exclusive) {
      plans.set(job, undefined);
      continue;
    }

    let hash = fingerprint(job.directory, files, [
      readIfPresent(join(job.directory, '.env')).toString()
    ]);
    let databases: { db: Database; current: Record<string, string> }[] = [];

    try {
      for (let db of job.postgres) {
        let url = serverUrl(db);
        let known = stamps.get(url);

        if (!known) {
          known = await readStamps(
            url,
            jobs.flatMap(item => item.postgres.map(other => other.database))
          );
          stamps.set(url, known);
        }

        databases.push({ db, current: known[db.database] ?? {} });
      }
      plans.set(job, { hash, databases });
    } catch {
      plans.set(job, undefined);
    }
  }

  return plans;
};

let runPush = async (jobs: Job[], useStamps: boolean) => {
  let plans = useStamps ? await pushPlan(jobs) : new Map();

  await pool(jobs, concurrency(), async job => {
    let plan = plans.get(job) as Awaited<ReturnType<typeof pushPlan>> extends Map<
      Job,
      infer Plan
    >
      ? Plan
      : never;

    if (plan && plan.databases.every(({ current }) => current[job.name] === plan.hash)) {
      commands.say(`${job.script} [${job.name}] up to date`);

      return;
    }

    await runJob(job);

    if (!plan) return;

    try {
      for (let { db, current } of plan.databases)
        await writeStamp(serverUrl(db), db.database, current, job.name, plan.hash);
    } catch (error) {
      commands.warn(
        `could not record schema stamp for ${job.name}: ${error instanceof Error ? error.message : error}`
      );
    }
  });
};

export let runDatabaseScripts = async (
  project: ProjectRoot,
  selected: LoadedManifest[],
  env: Environment,
  task: DatabaseTask,
  options: { cached: boolean }
) => {
  let jobs = jobsFor(project, selected, env, task);
  if (!jobs.length) return;

  let useStamps = options.cached && !force();

  if (task === 'generate') await runGenerate(jobs, useStamps);
  else if (task === 'push') await runPush(jobs, useStamps);
  else await pool(jobs, 1, runJob);
};

export let scriptName = (task: DatabaseTask) => `control:db:${task}`;

export let packageLabel = (path: string) => basename(path);
