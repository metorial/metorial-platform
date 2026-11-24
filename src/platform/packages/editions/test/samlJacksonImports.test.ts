import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildEdition } from '../src/tooling/build';

it('bundles the lazy SSO dependencies from the Jackson installation', async () => {
  let directory = await mkdtemp(join(tmpdir(), 'saml-jackson-imports-'));
  let modules = join(directory, 'node_modules');
  let jackson = join(modules, '@boxyhq/saml-jackson');
  let controller = join(jackson, 'dist/controller');
  let entry = join(directory, 'main.js');
  let outdir = join(directory, 'dist');

  try {
    await mkdir(controller, { recursive: true });
    await writeFile(
      join(controller, 'utils.js'),
      "exports.dynamicImport = (packageName) => { return new Function(`return import('${packageName}')`)(); };"
    );

    for (let name of ['jose', 'openid-client']) {
      let dependency = join(jackson, 'node_modules', name);
      await mkdir(dependency, { recursive: true });
      await writeFile(join(dependency, 'index.mjs'), `export default '${name}';`);
      await writeFile(join(dependency, 'package.json'), JSON.stringify({ main: 'index.mjs' }));
    }

    await writeFile(
      entry,
      `import utils from '@boxyhq/saml-jackson/dist/controller/utils.js';
       for (let name of ['jose', 'openid-client']) {
         console.log((await utils.dynamicImport(name)).default);
       }`
    );
    await buildEdition({ entry, edition: 'on-prem', outdir });
    await rm(modules, { recursive: true });

    let output = execFileSync(process.execPath, [join(outdir, 'main.mjs')], {
      encoding: 'utf8'
    });
    expect(output.trim().split('\n')).toEqual(['jose', 'openid-client']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
