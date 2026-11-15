import { runOffline } from '@lowerdeck/offline';
import path from 'node:path';
import * as prettier from 'prettier';

let defaultOutput = path.resolve(
  import.meta.dir,
  '../../../../metorial-frontend/packages/state/src/config/generated/organizationConfigs.ts'
);

let output = path.resolve(
  process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length) ?? defaultOutput
);

await runOffline(
  async () => {
    let { getOrganizationConfigDeclarations, renderOrganizationConfigRegistry } =
      await import('@metorial/module-organization');

    let source = renderOrganizationConfigRegistry(getOrganizationConfigDeclarations());
    let formatted = await prettier.format(source, {
      ...(await prettier.resolveConfig(output)),
      filepath: output
    });

    await Bun.write(output, formatted);
    console.log(`Wrote organization config types to ${output}`);
  },
  {
    knownBackgroundHosts: ['models.dev'],
    onError: error =>
      String(error).includes('generated')
        ? 'Make sure the Prisma clients are generated (no database needed).'
        : undefined
  }
);
