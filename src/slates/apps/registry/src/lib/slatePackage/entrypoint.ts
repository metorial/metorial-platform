import type { SlatePackageEntry } from './archive';

// Keep in sync with the hub's entrypoint rules in queues/deployment/packageFiles.ts.
let entrypointExtensions = ['.ts', '.js', '.cjs', '.mjs'];
let fallbackEntrypoints = [
  'src/index.ts',
  'src/index.js',
  'index.ts',
  'index.js',
  'dist/index.js',
  'dist/index.cjs'
];
let sourceEntrypoints = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js'];

let getEntrypointCandidates = (main: string) => {
  let normalized = main.replace(/^\.\/+/, '').replace(/^\/+/, '');
  if (entrypointExtensions.some(ext => normalized.endsWith(ext))) return [normalized];

  return [
    normalized,
    ...entrypointExtensions.map(ext => `${normalized}${ext}`),
    ...entrypointExtensions.map(ext => `${normalized}/index${ext}`)
  ];
};

export let getPrebuiltEntrypointProblem = (entries: SlatePackageEntry[]) => {
  let paths = new Set(entries.map(entry => entry.path));

  let source = sourceEntrypoints.find(path => paths.has(path));
  if (source) return `Prebuilt slate packages must not include ${source}.`;

  let main: unknown;
  try {
    main = JSON.parse(
      entries.find(entry => entry.path === 'package.json')?.buffer.toString('utf-8') ?? '{}'
    ).main;
  } catch {}

  let candidates = [
    ...(typeof main === 'string' ? getEntrypointCandidates(main) : []),
    ...fallbackEntrypoints
  ];
  let entrypoint = candidates.find(path => paths.has(path));

  if (!entrypoint?.startsWith('dist/')) {
    return 'Prebuilt slate packages need package.json main to point at a file in dist/.';
  }

  return null;
};
