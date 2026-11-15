import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildCatalog } from './pipeline/build';
import { emitCatalog } from './pipeline/emit';
import { evaluateDeployGate } from './pipeline/gate';
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
    offline: { type: 'boolean', default: false },
    'allow-unsafe': { type: 'boolean', default: false }
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
let gate = evaluateDeployGate(result, { allowUnsafe: values['allow-unsafe']! });

await emitCatalog(outDir, result, gate);

let live = result.catalog.offerings.filter(offering => offering.status !== 'retired').length;
console.log(
  [
    `models.dev ${result.modelsDevSha}`,
    ...result.catalog.sources.map(
      source => `${source.kind}: ${source.status}${source.error ? ` (${source.error})` : ''}`
    ),
    `${result.catalog.models.length} models, ${result.catalog.families.length} families, ${live} live offerings, ${result.resolutionCounts.unresolved} unresolved`,
    `${result.validation.errors.length} errors, ${result.validation.warnings.length} warnings, ${result.issues.length} open issues`,
    ...gate.checks.map(
      check =>
        `gate ${check.id}: ${check.passed ? 'pass' : check.overridden ? 'fail (allow-unsafe)' : 'fail'} (${check.detail})`
    ),
    `deploy gate: ${gate.passed ? 'passed' : gate.deploy ? 'failed, overridden by --allow-unsafe' : 'failed'}`,
    `wrote ${outDir}`
  ].join('\n')
);

if (process.env.GITHUB_ACTIONS === 'true')
  for (let check of gate.checks.filter(check => !check.passed))
    console.log(
      `::${check.overridden ? 'warning' : 'error'} title=Deploy gate::${check.label}: ${check.detail}`
    );

if (process.env.GITHUB_OUTPUT)
  await appendFile(process.env.GITHUB_OUTPUT, `deploy=${gate.deploy}\n`);

if (result.validation.errors.length) {
  console.error(result.validation.errors.slice(0, 50).join('\n'));
  process.exit(1);
}
