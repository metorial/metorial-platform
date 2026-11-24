import type { Metafile } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

// The files a bundle was built from and the imports it leaves for runtime resolution. Container
// builds read it to ship only the packages a bundle loads at runtime, plus the manifests of the
// packages compiled into it so image scanners still see them (oss/src/tooling/docker-build/runtime-modules.ts).
export type BundleManifest = {
  version: 1;
  inputs: string[];
  externals: string[];
};

let sorted = (values: Iterable<string>) => [...new Set(values)].sort();

export let writeBundleManifest = async (
  path: string,
  bundle: { inputs: Iterable<string>; externals: Iterable<string> }
) => {
  let file = resolve(path);
  let directory = dirname(file);
  let manifest: BundleManifest = {
    version: 1,
    inputs: sorted([...bundle.inputs].map(input => relative(directory, resolve(input)))),
    externals: sorted(bundle.externals)
  };

  await mkdir(directory, { recursive: true });
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
};

// esbuild reports paths relative to its working directory, which is the process's.
export let esbuildBundleContents = (metafile: Metafile) => {
  let outputs = Object.values(metafile.outputs);

  return {
    inputs: outputs.flatMap(output =>
      Object.entries(output.inputs)
        .filter(([, input]) => input.bytesInOutput > 0)
        .map(([path]) => resolve(path))
    ),
    externals: outputs.flatMap(output =>
      output.imports.filter(item => item.external).map(item => item.path)
    )
  };
};

let moduleFile = (id: string) => {
  let path = id.replace(/^\0/, '').split('?')[0]!;
  return path.startsWith('/') ? path : undefined;
};

export let rollupBundleContents = (
  bundle: Record<
    string,
    { type: string; modules?: Record<string, { renderedLength: number }> }
  >
) => ({
  inputs: Object.values(bundle).flatMap(item =>
    item.type == 'chunk'
      ? Object.entries(item.modules ?? {}).flatMap(([id, module]) => {
          let file = module.renderedLength > 0 ? moduleFile(id) : undefined;
          return file ? [file] : [];
        })
      : []
  ),
  externals: []
});
