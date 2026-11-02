import { readFile } from 'node:fs/promises';
import type { Plugin } from 'esbuild';
import type { Edition } from '../edition';
import { transformEditionSource } from './transform';

let sourceFilter = /\.[cm]?[jt]sx?$/;

let esmImport = /^\s*import[\s{*'"]/m;
let esmExport = /^\s*export[\s{*]/m;

// A package with "type": "commonjs" makes esbuild wrap an export-less module as CommonJS,
// where its imports can't be awaited.
let ensureEsmMarker = (path: string, code: string) =>
  !path.includes('/node_modules/') && esmImport.test(code) && !esmExport.test(code)
    ? `${code}\nexport {};\n`
    : code;

let loaderFor = (path: string) => {
  if (/\.tsx$/.test(path)) return 'tsx' as const;
  if (/\.jsx$/.test(path)) return 'jsx' as const;
  if (/\.[cm]?js$/.test(path)) return 'js' as const;
  return 'ts' as const;
};

export let editionsEsbuildPlugin = (edition: Edition): Plugin => ({
  name: 'metorial-editions',

  setup(build) {
    build.onLoad({ filter: sourceFilter }, async args => {
      let code = await readFile(args.path, 'utf8');
      let transformed = transformEditionSource(code, { edition, fileName: args.path });
      let contents = ensureEsmMarker(args.path, transformed ?? code);

      if (transformed == null && contents == code) return undefined;

      return { contents, loader: loaderFor(args.path) };
    });
  }
});
