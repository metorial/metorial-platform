import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let fixturesDir = join(__dirname, '../../../spec/fixtures');

export let readFixture = <T = unknown>(name: string): T =>
  JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));

export let fixtureFiles = (dir: string) =>
  readdirSync(join(fixturesDir, dir))
    .filter(file => file.endsWith('.json'))
    .map(file => ({ name: file, value: readFixture(join(dir, file)) }));
