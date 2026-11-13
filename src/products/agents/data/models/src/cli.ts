import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildCatalog } from './pipeline/build';
import { emitCatalog } from './pipeline/emit';
import { ensureModelsDevRepo } from './sources/modelsDev';

let defaultOut = 'out';
let defaultCacheDir = '.cache';

let { values } = parseArgs({
  options: {
    out: { type: 'string', default: defaultOut },
    'models-dev': { type: 'string' },
    previous: { type: 'string' },
    sources: { type: 'string' },
    'cache-dir': { type: 'string', default: defaultCacheDir },
    offline: { type: 'boolean', default: false }
  }
});

let outDir = path.resolve(values.out!);
let modelsDevPath = await ensureModelsDevRepo({
  repoPath: values['models-dev'] ? path.resolve(values['models-dev']) : undefined,
  cacheDir: path.resolve(values['cache-dir']!)
});

let result = await buildCatalog({
  modelsDevPath,
  previousDir: values.previous ? path.resolve(values.previous) : null,
  sourcesDir: values.sources ? path.resolve(values.sources) : null,
  offline: values.offline!
});

await emitCatalog(outDir, result);

let live = result.catalog.offerings.filter(offering => offering.status !== 'retired').length;
console.log(
  [
    `models.dev ${result.modelsDevSha}`,
    ...result.catalog.sources.map(
      source => `${source.kind}: ${source.status}${source.error ? ` (${source.error})` : ''}`
    ),
    `${result.catalog.models.length} models, ${result.catalog.families.length} families, ${live} live offerings, ${result.resolutionCounts.unresolved} unresolved`,
    `${result.validation.errors.length} errors, ${result.validation.warnings.length} warnings, ${result.issues.length} open issues`,
    `wrote ${outDir}`
  ].join('\n')
);

if (result.validation.errors.length) {
  console.error(result.validation.errors.slice(0, 50).join('\n'));
  process.exit(1);
}
