import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveReleaseChannel, type ReleaseChannel } from '../channel';
import type { Edition } from '../edition';
import { makeEsmCyclesSafe } from './esmCycles';
import { editionsEsbuildPlugin } from './esbuild';
import { postgresSamlPlugin } from './postgresSaml';

let defaultExternals = ['bun', 'bun:*'];

let requireBanner =
  "import { createRequire as __metorialCreateRequire } from 'node:module'; let require = __metorialCreateRequire(import.meta.url);";

export type BuildEditionOptions = {
  entry: string;
  edition: Edition;
  channel?: ReleaseChannel;
  outdir?: string;
  outfile?: string;
  external?: string[];
  minify?: boolean;
  splitting?: boolean;
  sourcemap?: 'external' | 'none';
};

export let buildEdition = async (options: BuildEditionOptions) => {
  let channel = resolveReleaseChannel(options.channel ?? process.env.METORIAL_RELEASE_CHANNEL);

  let result = await build({
    entryPoints: [resolve(options.entry)],
    outdir: options.outdir ? resolve(options.outdir) : undefined,
    outfile: options.outfile ? resolve(options.outfile) : undefined,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    splitting: options.splitting ?? false,
    platform: 'node',
    format: 'esm',
    target: 'esnext',
    minify: options.minify ?? false,
    minifySyntax: true,
    sourcemap: options.sourcemap == 'none' ? false : 'external',
    sourcesContent: false,
    external: [...defaultExternals, ...(options.external ?? [])],
    define: {
      __METORIAL_EDITION__: JSON.stringify(options.edition),
      __METORIAL_BUILT__: 'true',
      __METORIAL_RELEASE_CHANNEL__: JSON.stringify(channel)
    },
    plugins: [
      editionsEsbuildPlugin(options.edition, channel),
      ...(options.edition === 'on-prem' ? [postgresSamlPlugin()] : [])
    ],
    banner: { js: requireBanner },
    metafile: true,
    logLevel: 'error'
  });

  let outputs = Object.keys(result.metafile.outputs)
    .filter(output => /\.[cm]?js$/.test(output))
    .map(output => resolve(output));

  for (let output of outputs) {
    let code = await readFile(output, 'utf8');
    let patched = makeEsmCyclesSafe(code, output);
    if (patched != code) await writeFile(output, patched);
  }

  return Object.keys(result.metafile.outputs).map(output => resolve(output));
};
