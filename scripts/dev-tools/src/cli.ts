#!/usr/bin/env bun

import { initMinio } from './commands/initMinio';
import { setEnv } from './commands/setEnv';
import { watchBun } from './commands/watchBun';

let args = process.argv.slice(2);

let command = args[0];
args = args.slice(1);

switch (command) {
  case 'set-env':
    setEnv();
    break;

  case 'init-minio':
    initMinio();
    break;

  case 'watch-bun':
    await watchBun(args);
    break;

  default:
    console.error(`Unknown command: ${command ?? ''}`);
    console.error('Use `./dev-tools start` to start the development server.');
    process.exit(1);
    break;
}
