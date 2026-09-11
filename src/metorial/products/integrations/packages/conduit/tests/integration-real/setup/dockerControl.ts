import { execFileSync } from 'node:child_process';
import { COMPOSE_FILE, COMPOSE_PROJECT, isNoDocker } from './connection';

type Stdio = 'inherit' | 'pipe' | 'ignore';

let compose = (args: string[], stdio: Stdio = 'pipe') => {
  execFileSync('docker', ['compose', '-p', COMPOSE_PROJECT, '-f', COMPOSE_FILE, ...args], {
    stdio
  });
};

export let composeUp = () => compose(['up', '-d'], 'inherit');
export let composeDown = () => compose(['down', '-v', '--remove-orphans'], 'inherit');

export let composeDownQuiet = () => {
  try {
    compose(['down', '-v', '--remove-orphans'], 'ignore');
  } catch {
    // ignore - nothing to clean or docker not ready yet
  }
};

export let composeRestart = (service: string) => {
  if (isNoDocker()) return;
  compose(['restart', service]);
};

export let composeStop = (service: string) => {
  if (isNoDocker()) return;
  compose(['stop', service]);
};

export let composeStart = (service: string) => {
  if (isNoDocker()) return;
  compose(['start', service]);
};
