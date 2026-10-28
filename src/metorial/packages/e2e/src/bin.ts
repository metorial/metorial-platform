#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isE2EEnvironment } from './env';
import { resolvePackageShardArgs } from './shard';

let resolveBin = (pkg: string, bin: string) =>
  path.join(path.dirname(Bun.resolveSync(`${pkg}/package.json`, import.meta.dir)), bin);

let isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// A typecheck follows imports through the whole workspace and takes several GB, so concurrent
// ones (e.g. parallel agents) share a machine-wide set of slots, held as pid lock files.
let acquireTypecheckSlot = async () => {
  let slots = Number(process.env.METORIAL_E2E_TYPECHECK_SLOTS) || 2;
  let directory = path.join(tmpdir(), 'metorial-e2e-typecheck');
  mkdirSync(directory, { recursive: true });

  let waiting = false;
  while (true) {
    for (let slot = 0; slot < slots; slot++) {
      let file = path.join(directory, `${slot}.lock`);
      try {
        writeFileSync(file, String(process.pid), { flag: 'wx' });
        let release = () => rmSync(file, { force: true });
        process.on('exit', release);
        return release;
      } catch {
        let owner = Number(existsSync(file) ? readFileSync(file, 'utf8') : 0);
        if (owner && !isAlive(owner)) rmSync(file, { force: true });
      }
    }

    if (!waiting) {
      console.log(`metorial-e2e typecheck: waiting for one of ${slots} typecheck slots...`);
      waiting = true;
    }
    await Bun.sleep(2000);
  }
};

// Package tsconfigs only include `src/`, so `e2e/` suites are checked through a generated config
// that extends the package's own. It lives in node_modules so it is never committed, and so that
// `@types/*` resolution walks up from the package like it does for the package config.
let typecheck = async () => {
  let cwd = process.cwd();
  let packageConfig = path.join(cwd, 'tsconfig.json');
  let hasPackageConfig = existsSync(packageConfig);
  if (!hasPackageConfig) {
    packageConfig = Bun.resolveSync('@metorial/tsconfig/base.json', import.meta.dir);
  }

  let directory = path.join(cwd, 'node_modules', '.metorial-e2e');
  let config = path.join(directory, 'tsconfig.json');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    config,
    JSON.stringify(
      {
        extends: packageConfig,
        include: [path.join(cwd, 'src/**/*.ts'), path.join(cwd, 'e2e/**/*.ts')],
        exclude: [path.join(cwd, '**/*.test.ts'), path.join(cwd, '**/node_modules')],
        compilerOptions: {
          noEmit: true,
          declaration: false,
          declarationMap: false,
          ...(hasPackageConfig ? {} : { jsx: 'react', moduleResolution: 'bundler' })
        }
      },
      null,
      2
    )
  );

  let release = await acquireTypecheckSlot();
  let output: string;
  try {
    let child = Bun.spawn(
      [
        process.execPath,
        resolveBin('typescript', 'bin/tsc'),
        '-p',
        config,
        '--pretty',
        'false'
      ],
      { cwd, stdout: 'pipe', stderr: 'inherit' }
    );
    output = await new Response(child.stdout).text();
    await child.exited;
  } finally {
    release();
  }

  // tsc also reports errors in the source of workspace dependencies it follows imports into;
  // those belong to other packages, so only diagnostics for files of this package count.
  let diagnostics = output.split(/\n(?=\S)/).filter(entry => entry.trim());
  let own = diagnostics.filter(entry => !entry.startsWith('..') && !entry.startsWith('/'));
  let ignored = diagnostics.length - own.length;

  if (own.length > 0) console.log(own.join('\n'));
  console.log(
    `metorial-e2e typecheck: ${own.length} error(s) in this package` +
      (ignored > 0 ? `, ${ignored} in dependencies ignored` : '')
  );
  return own.length > 0 ? 1 : 0;
};

let runSuites = async () => {
  if (!isE2EEnvironment()) {
    console.error(
      'metorial-e2e only runs inside `bun run control test:e2e` (CONTROL_E2E=1 is not set).'
    );
    return 1;
  }

  let packageConfig = path.join(process.cwd(), 'vitest.e2e.config.ts');
  let config = existsSync(packageConfig)
    ? packageConfig
    : path.join(import.meta.dir, '..', 'vitest.e2e.config.ts');

  let packageName = JSON.parse(
    readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
  ).name;
  let args = resolvePackageShardArgs(process.argv.slice(2), packageName);

  // Modules use Bun APIs at runtime, so Vitest (and its forked workers) run on Bun, not Node.
  let child = Bun.spawn(
    [
      process.execPath,
      resolveBin('vitest', 'vitest.mjs'),
      'run',
      '--config',
      config,
      '--root',
      process.cwd(),
      ...args
    ],
    { stdio: ['inherit', 'inherit', 'inherit'], env: process.env }
  );
  return await child.exited;
};

process.exit(process.argv[2] === 'typecheck' ? await typecheck() : await runSuites());
