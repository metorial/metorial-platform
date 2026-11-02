import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]
  );

export let buildId = () => {
  let total = 0;

  for (let file of walk(join(import.meta.dir, '..'))) {
    let stat = statSync(file);
    total = (total * 31 + stat.size + Math.floor(stat.mtimeMs)) % 2 ** 52;
  }

  return total.toString(36);
};
