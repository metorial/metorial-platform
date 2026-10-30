import { readFile } from 'node:fs/promises';
import type { Plugin } from 'esbuild';
import type { Edition } from '../edition';
import { transformEditionSource } from './transform';

let sourceFilter = /\.[cm]?[jt]sx?$/;

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
      let contents = transformEditionSource(code, { edition, fileName: args.path });

      if (contents == null) return undefined;

      return { contents, loader: loaderFor(args.path) };
    });
  }
});
