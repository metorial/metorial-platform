import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { defaultOverridesDir, readOverrideFiles, writeOverrideFiles } from '../overrides';
import { buildCatalog, type BuildResult } from '../pipeline/build';
import { emitCatalog } from '../pipeline/emit';
import { ensureModelsDevRepo } from '../sources/modelsDev';
import { runAgent, type AgentCredentials } from './agent';
import { reviewDecisions, type DecisionReview } from './decisions';
import { buildEvidence, modelIndex } from './evidence';
import { renderSummary, type IterationLog } from './summary';
import {
  createWebSearch,
  searchProviders,
  type SearchProvider,
  type WebSearch
} from './webSearch';
import { dirtyPaths, repoRoot, restoreOutside, scrubSecrets } from './workspace';

let defaultWorkDir = '.reconcile';
let defaultCacheDir = '.cache';
let defaultModel = '@cf/zai-org/glm-5.3';
let defaultThinking = 'high';
let defaultBatchSize = 40;
let defaultMaxIterations = 8;
let defaultBudgetMinutes = 30;
let defaultSearchProvider: SearchProvider = 'linkup';
let defaultMaxSearches = 400;
let maxFixRounds = 2;
let agentTimeoutMs = 12 * 60_000;

let { values } = parseArgs({
  options: {
    work: { type: 'string', default: defaultWorkDir },
    'cache-dir': { type: 'string', default: defaultCacheDir },
    'models-dev': { type: 'string' },
    previous: { type: 'string' },
    model: { type: 'string', default: defaultModel },
    thinking: { type: 'string', default: defaultThinking },
    'batch-size': { type: 'string', default: String(defaultBatchSize) },
    'max-iterations': { type: 'string', default: String(defaultMaxIterations) },
    'budget-minutes': { type: 'string', default: String(defaultBudgetMinutes) },
    pi: { type: 'string', default: process.env.PI_BIN ?? 'pi' },
    'no-hugging-face': { type: 'boolean', default: false },
    'no-web-search': { type: 'boolean', default: false },
    'search-provider': { type: 'string', default: defaultSearchProvider },
    'max-searches': { type: 'string', default: String(defaultMaxSearches) }
  }
});

if (!searchProviders.includes(values['search-provider'] as SearchProvider))
  throw new Error(`--search-provider must be one of ${searchProviders.join(', ')}`);

let packageDir = path.resolve(import.meta.dirname, '..', '..');
let workDir = path.resolve(values.work!);
let pinnedDir = path.join(workDir, 'pinned');
let startedAt = Date.now();
let now = new Date(startedAt).toISOString();
let today = now.slice(0, 10);
let batchSize = Number(values['batch-size']);
let maxIterations = Number(values['max-iterations']);
let budgetMs = Number(values['budget-minutes']) * 60_000;
let systemPromptFile = path.join(import.meta.dirname, 'prompt.md');

let credentials: AgentCredentials | null =
  process.env.CLOUDFLARE_AI_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID
    ? {
        apiToken: process.env.CLOUDFLARE_AI_API_TOKEN,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID
      }
    : null;

let webSearch: WebSearch | null =
  credentials && !values['no-web-search']
    ? createWebSearch({
        ...credentials,
        provider: values['search-provider'] as SearchProvider,
        maxSearches: Number(values['max-searches'])
      })
    : null;

let secrets = [
  process.env.CLOUDFLARE_AI_API_TOKEN,
  process.env.CLOUDFLARE_ACCOUNT_ID,
  process.env.GH_TOKEN,
  process.env.GITHUB_TOKEN
].filter((secret): secret is string => !!secret && secret.length >= 8);

await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });

let root = await repoRoot(packageDir);
let overridesPrefix = `${path.relative(root, defaultOverridesDir)}/`;
let relative = (file: string) => path.relative(packageDir, file);

let modelsDevPath = await ensureModelsDevRepo({
  repoPath: values['models-dev'] ? path.resolve(values['models-dev']) : undefined,
  cacheDir: path.resolve(values['cache-dir']!)
});
let previousDir = values.previous ? path.resolve(values.previous) : null;

let staleSources = (result: BuildResult) =>
  result.catalog.sources.filter(source => source.status !== 'fresh').length;

let result = await buildCatalog({ modelsDevPath, previousDir, offline: false, now });

// Most source failures are transient; one retry is the deterministic fix before anything else.
if (staleSources(result)) {
  let retry = await buildCatalog({ modelsDevPath, previousDir, offline: false, now });
  if (staleSources(retry) < staleSources(result)) result = retry;
}

// Every later build in this run reads these snapshots instead of fetching, so the only thing
// that changes between iterations is the override files.
await emitCatalog(pinnedDir, result);

let rebuild = () =>
  buildCatalog({ modelsDevPath, previousDir, sourcesDir: pinnedDir, offline: true, now });

let initialFiles = await readOverrideFiles();
let initialIssues = result.issues.length;
let attempted = new Set<string>();
let iterations: IterationLog[] = [];
let stopReason: string | null = null;

for (let iteration = 1; iteration <= maxIterations; iteration++) {
  let open = result.issues.filter(issue => !attempted.has(issue.key));
  if (!open.length) {
    stopReason = attempted.size ? 'every open issue was attempted' : 'no open issues';
    break;
  }
  if (!credentials) {
    stopReason = 'no Workers AI credentials';
    break;
  }
  if (!Bun.which('rg')) {
    stopReason = "ripgrep isn't installed; pi's grep tool needs it";
    break;
  }
  if (Date.now() - startedAt > budgetMs) {
    stopReason = 'time budget used up';
    break;
  }

  let batch = open.slice(0, batchSize);
  for (let issue of batch) attempted.add(issue.key);

  let before = await readOverrideFiles();
  let batchFile = path.join(workDir, `batch-${iteration}.json`);
  let indexFile = path.join(workDir, 'models.tsv');
  let logFile = path.join(workDir, `agent-${iteration}.log`);

  await writeFile(
    batchFile,
    `${JSON.stringify(
      await buildEvidence({
        result,
        batch,
        overrides: before,
        fetchHuggingFace: !values['no-hugging-face'],
        webSearch
      }),
      null,
      2
    )}\n`
  );
  await writeFile(indexFile, modelIndex(result));

  let dirtyBefore = await dirtyPaths(root);
  let agent = (message: string, continueSession: boolean) =>
    runAgent({
      piBin: values.pi!,
      model: values.model!,
      thinking: values.thinking!,
      cwd: packageDir,
      workDir: path.join(workDir, `agent-${iteration}`),
      systemPromptFile,
      message,
      continueSession,
      credentials: credentials!,
      timeoutMs: agentTimeoutMs,
      logFile
    });

  let exitCode = await agent(
    [
      `Today is ${today}.`,
      `Issue batch (${batch.length} issues): ${relative(batchFile)}`,
      `Model index: ${relative(indexFile)}`,
      'Record a decision for every issue in the batch.'
    ].join('\n'),
    false
  );

  let review: DecisionReview | null = null;
  let restored: string[] = [];
  let fixRounds = 0;

  while (true) {
    restored.push(
      ...(await restoreOutside({ root, before: dirtyBefore, allowed: [overridesPrefix] }))
    );

    let feedback: string[] = [];
    try {
      review = reviewDecisions({
        before,
        after: await readOverrideFiles(),
        batch,
        modelIds: new Set(result.catalog.models.map(model => model.id)),
        today,
        secrets
      });

      let decided = new Set([
        ...review.accepted.map(entry => entry.key),
        ...review.rejected.map(entry => entry.key)
      ]);
      feedback = [
        ...review.rejected.map(entry => `- ${entry.key}: ${entry.reason}`),
        ...batch
          .filter(issue => !decided.has(issue.key))
          .map(issue => `- ${issue.key}: no decision recorded`)
      ];
    } catch (err) {
      review = null;
      feedback = [`- ${(err as Error).message}`];
    }

    if (!feedback.length || fixRounds >= maxFixRounds || exitCode !== 0) break;

    fixRounds++;
    exitCode = await agent(
      `These entries were not accepted. Fix them in place, then stop:\n${feedback.join('\n')}`,
      true
    );
  }

  if (!review) {
    await writeOverrideFiles(before);
    iterations.push({
      iteration,
      batch: batch.length,
      exitCode,
      outcome: 'invalid override files'
    });
    continue;
  }

  await writeOverrideFiles(review.files);
  let candidate = await rebuild();

  if (candidate.validation.errors.length) {
    await writeOverrideFiles(before);
    iterations.push({
      iteration,
      batch: batch.length,
      exitCode,
      outcome: `rebuild failed: ${candidate.validation.errors.slice(0, 3).join('; ')}`
    });
    continue;
  }

  let stillOpen = new Set(candidate.issues.map(issue => issue.key));
  iterations.push({
    iteration,
    batch: batch.length,
    exitCode,
    outcome: exitCode === 0 ? 'applied' : `pi exited with ${exitCode}`,
    solved: batch.filter(issue => !stillOpen.has(issue.key)).length,
    review,
    restored
  });
  result = candidate;

  // A failing agent with nothing to show is an outage or a config problem, not a hard batch;
  // stop instead of spending the rest of the run on it.
  if (exitCode !== 0 && !review.accepted.length) {
    stopReason = `pi exited with ${exitCode}; see ${relative(logFile)}`;
    break;
  }
}

stopReason ??= 'iteration limit reached';

let changed = JSON.stringify(initialFiles) !== JSON.stringify(await readOverrideFiles());
let summary = renderSummary({
  model: values.model!,
  iterations,
  initialIssues,
  remainingIssues: result.issues.length,
  stopReason,
  changed,
  search: webSearch ? { provider: values['search-provider']!, ...webSearch.stats } : null
});

await writeFile(path.join(workDir, 'summary.md'), summary);
await scrubSecrets(workDir, secrets);

if (process.env.GITHUB_OUTPUT)
  await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);

console.log(summary);
