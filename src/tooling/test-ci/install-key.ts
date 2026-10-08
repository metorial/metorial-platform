import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export let installKey = (d: {
  workspace: string;
  files: string[];
  lifecycleDirectories: string[];
  runtime: { bun: string; node: string; os: string; arch: string };
}) => {
  let inputs = d.files
    .filter(
      path =>
        /(^|\/)(package\.json|bun\.lock|bunfig\.toml|\.npmrc)$/.test(path) ||
        d.lifecycleDirectories.some(directory => path.startsWith(directory + '/'))
    )
    .sort();
  let hash = createHash('sha256');
  hash.update(JSON.stringify({ version: 1, ...d.runtime, linker: 'hoisted' }));

  for (let path of inputs) {
    hash.update(path);
    hash.update(readFileSync(join(d.workspace, path)));
  }

  return `test-install-v1-${hash.digest('hex')}`;
};
