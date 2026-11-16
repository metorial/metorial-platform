import path from 'node:path';
import { parseArgs } from 'node:util';
import { restorePreviousCatalog } from './previous';

let { values } = parseArgs({
  options: {
    previous: { type: 'string' },
    'live-url': { type: 'string' }
  }
});

if (!values.previous || !values['live-url']) {
  console.error('usage: restore-previous --previous <dir> --live-url <url>');
  process.exit(1);
}

let restored = await restorePreviousCatalog({
  siteUrl: values['live-url'],
  dir: path.resolve(values.previous)
});

if (restored.status === 'present') console.log(`previous catalog already at ${restored.file}`);
else if (restored.status === 'restored')
  console.log(
    `restored previous catalog from ${values['live-url']} (generated ${restored.generatedAt}, ${restored.offerings} offerings) to ${restored.file}`
  );
else {
  let message = `could not restore the previous catalog from ${values['live-url']}: ${restored.reason}`;
  console.log(process.env.GITHUB_ACTIONS === 'true' ? `::warning::${message}` : message);
}
