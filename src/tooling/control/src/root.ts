import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ancestors, canonical, packageName } from './files';
import type { ProjectRoot } from './types';

export let detect = (start: string): ProjectRoot => {
  let path = canonical(start);
  if (existsSync(path) && statSync(path).isFile()) path = dirname(path);

  let directories = [...ancestors(path)];

  for (let directory of directories) {
    if (
      existsSync(join(directory, '.git')) &&
      packageName(directory) === '@metorial/enterprise' &&
      packageName(join(directory, 'oss')) === '@metorial/oss'
    ) {
      return { kind: 'enterprise', root: directory, oss: join(directory, 'oss') };
    }
  }

  for (let directory of directories) {
    if (
      existsSync(join(directory, '.git')) &&
      packageName(directory) === '@metorial/oss' &&
      existsSync(join(directory, 'src'))
    ) {
      return { kind: 'oss', root: directory, oss: directory };
    }
  }
  throw new Error(`could not find a Metorial enterprise or standalone root above ${start}`);
};
