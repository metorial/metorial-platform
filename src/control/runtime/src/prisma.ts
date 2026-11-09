import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let urlVariable = 'METORIAL_MIGRATE_DATABASE_URL';

export interface PrismaTarget {
  name: string;
  schema: string;
  migrations: string;
  url: string;
  root: string;
}

let prismaCommand = () =>
  process.env.PRISMA_BIN ? [process.env.PRISMA_BIN] : [process.execPath, 'run', 'prisma'];

let run = async (args: string[], target: PrismaTarget, label: string) => {
  let child = Bun.spawn([...prismaCommand(), ...args], {
    cwd: target.root,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'ignore',
    env: { ...process.env, [urlVariable]: target.url },
    detached: true
  });

  let code = await child.exited;
  if (code !== 0)
    throw new Error(`prisma ${label} failed for ${target.name} (exit code ${code})`);
};

export let push = (target: PrismaTarget) =>
  run(
    ['db', 'push', '--schema', target.schema, '--accept-data-loss', '--url', target.url],
    target,
    'db push'
  );

let withConfig = async (target: PrismaTarget, args: string[], label: string) => {
  let directory = await mkdtemp(join(tmpdir(), 'metorial-prisma-'));
  let config = join(directory, 'prisma.config.mjs');

  try {
    await writeFile(
      config,
      `export default {
  schema: ${JSON.stringify(target.schema)},
  migrations: { path: ${JSON.stringify(target.migrations)} },
  datasource: { url: process.env.${urlVariable} }
};
`
    );

    await run([...args, '--config', config], target, label);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

export let deploy = (target: PrismaTarget) =>
  withConfig(target, ['migrate', 'deploy'], 'migrate deploy');

export let markApplied = (target: PrismaTarget, migration: string) =>
  withConfig(
    target,
    ['migrate', 'resolve', '--applied', migration],
    `migrate resolve ${migration}`
  );
