#!/usr/bin/env node

import { existsSync, realpathSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let packageName = path => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')).name;
  } catch {
    return undefined;
  }
};

let isGitCheckout = path => existsSync(join(path, '.git'));

let startingDirectory = start => {
  let path = resolve(start);
  if (existsSync(path) && statSync(path).isFile()) path = dirname(path);
  return path;
};

let findAncestor = (start, predicate) => {
  let path = startingDirectory(start);
  while (true) {
    let manifest = predicate(path);
    if (manifest) return manifest;

    let parent = dirname(path);
    if (parent === path) return undefined;
    path = parent;
  }
};

let enterpriseControlManifestAt = path => {
  if (
    !isGitCheckout(path) ||
    packageName(join(path, 'package.json')) !== '@metorial/enterprise' ||
    packageName(join(path, 'oss/package.json')) !== '@metorial/oss'
  ) {
    return undefined;
  }

  let manifest = join(path, 'oss/src/control/Cargo.toml');
  return existsSync(manifest) ? manifest : undefined;
};

let standaloneControlManifestAt = path => {
  if (
    !isGitCheckout(path) ||
    packageName(join(path, 'package.json')) !== '@metorial/oss'
  ) {
    return undefined;
  }

  let manifest = join(path, 'src/control/Cargo.toml');
  return existsSync(manifest) ? manifest : undefined;
};

export let findControlManifest = start =>
  findAncestor(start, enterpriseControlManifestAt) ??
  findAncestor(start, standaloneControlManifestAt);

export let run = async ({ cwd = process.cwd(), args = process.argv.slice(2) } = {}) => {
  let manifest = findControlManifest(cwd);
  if (!manifest) {
    throw new Error(
      `Could not find a Control-enabled Metorial enterprise or OSS checkout above ${resolve(cwd)}.`
    );
  }

  let child = spawn(
    process.platform === 'win32' ? 'cargo.exe' : 'cargo',
    ['run', '--quiet', '--manifest-path', manifest, '--', ...args],
    { cwd, stdio: 'inherit' }
  );

  return await new Promise((resolveRun, rejectRun) => {
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      resolveRun(code ?? 1);
    });
  });
};

let entrypoint = process.argv[1] && realpathSync(process.argv[1]);
if (entrypoint === fileURLToPath(import.meta.url)) {
  run()
    .then(code => {
      process.exitCode = code;
    })
    .catch(error => {
      console.error(`control: ${error.message}`);
      process.exitCode = 1;
    });
}
