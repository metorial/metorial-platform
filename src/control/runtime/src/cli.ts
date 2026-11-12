import { readFileSync } from 'node:fs';
import type { RuntimeConfig } from './config';
import { defaultConfigPath, defaultRoot, migrate } from './migrate';
import { MigrationInterrupted } from './signals';

let [command, ...names] = process.argv.slice(2);
let root = defaultRoot();

try {
  if (command !== 'migrate') throw new Error('usage: control-runtime migrate [database...]');

  let path = process.env.CONTROL_RUNTIME_CONFIG ?? defaultConfigPath(root);
  let config = JSON.parse(readFileSync(path, 'utf8')) as RuntimeConfig;

  await migrate(config, names, process.env, root);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(error instanceof MigrationInterrupted ? error.exitCode : 1);
}
