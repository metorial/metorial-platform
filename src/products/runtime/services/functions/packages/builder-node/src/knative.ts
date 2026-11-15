import type { FunctionBayRuntimeConfig } from '@function-bay/types';
import { createZipFromDirectory, hashFile, waitForStream } from '@function-bay/utils';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { runCommand } from './lib/runCommand';
import { stripSourcemapRegisterImports } from './lib/sanitizeLambdaBundle';
import { bundleTsConfig } from './tsconfig';

let outputCandidates = ['index.js', 'index.mjs', 'index.cjs'];

export let compileKnativeEntrypoint = async (d: {
  entrypoint: string;
  outDir: string;
  cwd?: string;
  ncc?: string;
  env?: Record<string, string | undefined>;
}) => {
  let cwd = d.cwd ?? process.cwd();
  await fs.writeFile(path.join(cwd, bundleTsConfig.filename), bundleTsConfig.content, 'utf-8');

  await runCommand(
    d.ncc ?? 'ncc',
    [
      'build',
      d.entrypoint,
      '-o',
      d.outDir,
      '--minify',
      '--source-map',
      '--no-source-map-register',
      '--target',
      'es2020',
      '--transpile-only'
    ],
    { cwd, env: d.env }
  );
};

export let prepareKnativeBundle = async (directory: string) => {
  await fs.rm(path.join(directory, 'sourcemap-register.cjs'), { force: true });

  for (let entry of await fs.readdir(directory)) {
    if (!/\.[cm]?js$/.test(entry)) continue;

    let filePath = path.join(directory, entry);
    let content = await fs.readFile(filePath, 'utf-8');
    let sanitized = stripSourcemapRegisterImports(content);
    if (sanitized !== content) await fs.writeFile(filePath, sanitized, 'utf-8');
  }

  let output = outputCandidates.find(candidate =>
    fsSync.existsSync(path.join(directory, candidate))
  );
  if (!output) throw new Error('ncc did not produce an index file');

  return { handler: `${output.replace(/\.js$/, '')}.handler` };
};

export let writeFunctionPackage = async (d: {
  runtime: FunctionBayRuntimeConfig;
  directory: string;
  outputPath?: string;
  manifestPath?: string;
}) => {
  let outputPath = d.outputPath ?? process.env.METORIAL_FUNCTION_BAY_OUTPUT_DESTINATION;
  let manifestPath = d.manifestPath ?? process.env.METORIAL_FUNCTION_BAY_MANIFEST_DESTINATION;
  if (!outputPath || !manifestPath) {
    throw new Error('Function Bay output and manifest destinations must be set');
  }

  let zip = await createZipFromDirectory(d.directory);
  let output = fsSync.createWriteStream(outputPath);
  zip.pipe(output);
  await waitForStream(output);

  await fs.writeFile(
    manifestPath,
    JSON.stringify({ runtime: d.runtime, hash: await hashFile(outputPath, 'sha256') }),
    'utf-8'
  );
};
