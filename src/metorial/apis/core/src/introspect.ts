import { runOffline } from '@lowerdeck/offline';
import path from 'node:path';

let defaultOutput = path.resolve(
  import.meta.dir,
  '../../../../../clients/.introspection/snapshot.json'
);

let output = path.resolve(
  process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length) ?? defaultOutput
);

await runOffline(
  async () => {
    let { introspectVersions } = await import('@metorial/rest');
    let { apiVersions } = await import('./versions');

    await Bun.write(output, JSON.stringify(introspectVersions(apiVersions), null, 2));
    console.log(`Wrote introspection snapshot to ${output}`);
  },
  {
    // product-assistant warms its model pricing catalog at import.
    knownBackgroundHosts: ['models.dev'],
    onError: error =>
      String(error).includes('generated')
        ? 'Make sure the Prisma clients are generated (no database needed).'
        : undefined
  }
);
