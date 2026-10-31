# @metorial/editions

Cloud and on-prem are product editions, separate from dev/staging/prod. The edition is
fixed per build; code for the other edition is removed from the bundle.

```ts
import { checkEdition, perEdition } from '@metorial/editions';

let domains = perEdition({ cloud: ['metorial.com'], 'on-prem': [] });

if (checkEdition('cloud')) {
  let { paymentQueueProcessor } = await import('@metorial-enterprise/federation-payment');
  processors.push(paymentQueueProcessor);
}
```

- `checkEdition(...editions)`, `assertEdition(...editions)`, `perEdition({ ... })`, `getEdition()`.
- Arguments must be string literals. The build transform replaces the calls with literals and the bundler removes the dead branches (and their imports).
- Without a build (dev, tests) the edition comes from `METORIAL_EDITION` and defaults to `cloud`.
- Packages that exist in one edition only declare it in `package.json`: `"metorial": { "editions": ["cloud"] }`.
- Statically imported modules used only in guarded branches need `"sideEffects": false`; otherwise use a guarded dynamic `import()`.

## Tooling (run with Bun)

```sh
metorial-editions build <entry> --edition on-prem --outdir dist
metorial-editions verify --edition on-prem --entry <package> --sourcemaps dist --deny-package stripe
```

- `build` bundles with esbuild, the edition plugin, `minifySyntax` (needed to drop dead branches) and external sourcemaps.
- `verify --entry` fails if a package excluded from the edition is reachable in the workspace dependency graph.
- `verify --sourcemaps` fails if a bundle contains an excluded workspace package or a denied npm package.
- `verify --egress <dir> --policy <file>` scans bundles and frontend output for denied hostnames (bundle hits are mapped to their source through the sourcemap). The policy file can also list `denyPackages` and `denyWorkspacePackages`, which fail a build regardless of package manifests.
- `"metorial": { "editionDependencies": { "cloud": ["pkg"] } }` marks dependencies that are only used in the listed edition (loaded behind `checkEdition`), so the package graph check does not follow them for other editions.
- Vite: `editionsVitePlugin()` from `@metorial/editions/vite` (the edition comes from `METORIAL_EDITION`; frontends with edition-only entries swap them in `transformIndexHtml` with `order: 'pre'`); esbuild: `editionsEsbuildPlugin(edition)`.
- Frontend packages that are only used behind a guard need `"sideEffects": false`; for third-party packages without it, use Rollup's `treeshake.moduleSideEffects` in the app's Vite config.
- `METORIAL_EDITION` is part of turbo's `globalEnv`, so cache keys differ per edition.
