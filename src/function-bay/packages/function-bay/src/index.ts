import { tempDir } from '@function-bay/utils';
import { $ } from 'bun';
import fs from 'fs/promises';
import path from 'path';

let main = async () => {
  console.log('Starting Function Bay build process...');

  let outputDir = await tempDir();

  let manifestPath =
    process.env.METORIAL_FUNCTION_BAY_MANIFEST_DESTINATION ??
    path.join(outputDir, 'manifest.json');
  let zipPath =
    process.env.METORIAL_FUNCTION_BAY_OUTPUT_DESTINATION ??
    path.join(outputDir, 'function.zip');

  process.env.METORIAL_FUNCTION_BAY_MANIFEST_DESTINATION = manifestPath;
  process.env.METORIAL_FUNCTION_BAY_OUTPUT_DESTINATION = zipPath;

  let builderName = '@function-bay/nodejs';

  console.log(`Using builder "${builderName}"`);
  console.log(`Installing builder...`);

  let installDir = await tempDir();
  await fs.mkdir(path.join(installDir, 'node_modules'), { recursive: true });
  await fs.writeFile(
    path.join(installDir, 'package.json'),
    JSON.stringify({ name: 'fbay-temp-install', version: '1.0.0' }),
    'utf-8'
  );

  await $`bun i --production ${builderName}`.cwd(installDir);

  let packageJsonPath = path.join(installDir, 'node_modules', builderName, 'package.json');
  let packageJson = await Bun.file(packageJsonPath).json();
  let entryPoint = packageJson.main ?? packageJson.exports?.['.'] ?? 'index.js';
  if (typeof entryPoint === 'object') {
    entryPoint = entryPoint.default ?? entryPoint.import ?? entryPoint.require;
  }

  console.log(`Starting builder "${builderName}"...`);

  let builderPath = path.join(installDir, 'node_modules', builderName, entryPoint);
  let builder = await import(builderPath);

  await builder.build();
};

main().catch(err => {
  console.error('Error during build:');
  console.error(err);
  process.exit(1);
});
