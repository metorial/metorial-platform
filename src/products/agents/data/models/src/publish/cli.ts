import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildSite, liveFingerprint } from './site';

let defaultOut = 'out';
let defaultSite = 'site';
let defaultAssets = path.join(import.meta.dirname, '..', '..', 'site-assets');

let { values } = parseArgs({
  options: {
    out: { type: 'string', default: defaultOut },
    site: { type: 'string', default: defaultSite },
    'live-url': { type: 'string' }
  }
});

let built = await buildSite({
  outDir: path.resolve(values.out!),
  siteDir: path.resolve(values.site!),
  assetsDir: defaultAssets,
  now: new Date().toISOString()
});

let live = values['live-url'] ? await liveFingerprint(values['live-url']) : null;
let changed = live !== built.fingerprint;

console.log(
  [
    `${built.files} files, fingerprint ${built.fingerprint.slice(0, 12)}`,
    live ? `live fingerprint ${live.slice(0, 12)}` : 'no live fingerprint',
    changed ? 'changed: deploy' : 'unchanged: skip deploy'
  ].join('\n')
);

if (process.env.GITHUB_OUTPUT)
  await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
