import { build } from 'esbuild';
import { resolve } from 'node:path';
import type { Edition } from '../edition';
import { editionsEsbuildPlugin } from './esbuild';

let defaultExternals = ['bun', 'bun:*'];

let requireBanner =
  "import { createRequire as __metorialCreateRequire } from 'node:module'; let require = __metorialCreateRequire(import.meta.url);";

export type BuildEditionOptions = {
  entry: string;
  edition: Edition;
  outdir: string;
  external?: string[];
  minify?: boolean;
  sourcemap?: 'external' | 'none';
};

export let buildEdition = async (options: BuildEditionOptions) => {
  let result = await build({
    entryPoints: [resolve(options.entry)],
    outdir: resolve(options.outdir),
    outExtension: { '.js': '.mjs' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'esnext',
    minify: options.minify ?? false,
    minifySyntax: true,
    sourcemap: options.sourcemap == 'none' ? false : 'external',
    sourcesContent: false,
    external: [...defaultExternals, ...(options.external ?? [])],
    define: { __METORIAL_EDITION__: JSON.stringify(options.edition) },
    plugins: [editionsEsbuildPlugin(options.edition)],
    banner: { js: requireBanner },
    metafile: true,
    logLevel: 'error'
  });

  return Object.keys(result.metafile.outputs).map(output => resolve(output));
};
