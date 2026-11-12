import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { defaultOverridesDir, readOverrideFiles, writeOverrideFiles } from '../overrides';
import { buildCatalog, type BuildResult } from '../pipeline/build';
import { emitCatalog } from '../pipeline/emit';
import { ensureModelsDevRepo } from '../sources/modelsDev';
import { runAgent, type AgentCredentials } from './agent';
import { addStats, describeStats, emptyStats } from './agentEvents';
import { openOverrideBranch } from './branch';
import { reviewDecisions, type DecisionReview } from './decisions';
import { buildEvidence, modelIndex } from './evidence';
import { createLogger, formatDuration, shorten } from './log';
import { decisionLabel, renderSummary, type IterationLog } from './summary';
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
let defaultDeadlineMinutes = 40;
let minFixMs = 3 * 60_000;
let defaultSearchProvider: SearchProvider = 'linkup';
let defaultMaxSearches = 400;
let maxFixRounds = 2;
let agentTimeoutMs = 12 * 60_000;
let topCount = 8;
let reasonLimit = 200;

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
    'deadline-minutes': { type: 'string', default: String(defaultDeadlineMinutes) },
    branch: { type: 'string' },
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
let deadlineAt = startedAt + Number(values['deadline-minutes']) * 60_000;
let systemPromptFile = path.join(import.meta.dirname, 'prompt.md');
let log = createLogger(startedAt);

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
        maxSearches: Number(values['max-searches']),
        log
      })
    : null;

let secrets = [
  process.env.CLOUDFLARE_AI_API_TOKEN,
  process.env.CLOUDFLARE_ACCOUNT_ID,
  process.env.GH_TOKEN,
  process.env.GITHUB_TOKEN
].filter((secret): secret is string => !!secret && secret.length >= 8);

let countBy = <T>(items: T[], key: (item: T) => string) => {
  let counts = new Map<string, number>();
  for (let item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);

  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topCount)
    .map(([name, count]) => `${name} ${count}`)
    .join(', ');
};

let describeSources = (result: BuildResult) =>
  result.catalog.sources
    .map(
      source =>
        `${source.kind} ${source.status}${source.error ? ` (${shorten(source.error, 100)})` : ''}`
    )
    .join(', ');

let describeCatalog = (result: BuildResult) => {
  let live = result.catalog.offerings.filter(offering => offering.status !== 'retired').length;
  return `${result.catalog.models.length} models, ${live} live offerings, ${result.resolutionCounts.unresolved} unresolved; ${result.validation.errors.length} validation errors, ${result.validation.warnings.length} warnings; ${result.issues.length} open issues`;
};

log(
  `reconcile: model ${values.model}, thinking ${values.thinking}, batches of ${batchSize} (at most ${maxIterations}), ${values['budget-minutes']} minute budget, hard deadline after ${values['deadline-minutes']} minutes`
);
log(
  `reconcile: credentials ${credentials ? 'present' : 'MISSING'}, web search ${
    webSearch
      ? `${values['search-provider']} (at most ${values['max-searches']} searches)`
      : 'off'
  }, hugging face ${values['no-hugging-face'] ? 'off' : 'on'}, ripgrep ${Bun.which('rg') ? 'found' : 'MISSING'}`
);

await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });

let root = await repoRoot(packageDir);
let overridesPrefix = `${path.relative(root, defaultOverridesDir)}/`;
let relative = (file: string) => path.relative(packageDir, file);

let initialFiles = await readOverrideFiles();
let overrideBranch = values.branch
  ? await openOverrideBranch({
      root,
      name: values.branch,
      overridesDir: defaultOverridesDir,
      log,
      redact: text => secrets.reduce((value, secret) => value.split(secret).join('***'), text)
    })
  : null;

let modelsDevPath = await ensureModelsDevRepo({
  repoPath: values['models-dev'] ? path.resolve(values['models-dev']) : undefined,
  cacheDir: path.resolve(values['cache-dir']!)
});
let previousDir = values.previous ? path.resolve(values.previous) : null;

let staleSources = (result: BuildResult) =>
  result.catalog.sources.filter(source => source.status !== 'fresh').length;

log('catalog: fetching every source');
let result = await buildCatalog({ modelsDevPath, previousDir, offline: false, now });
log(`catalog: sources: ${describeSources(result)}`);

// Most source failures are transient; one retry is the deterministic fix before anything else.
if (staleSources(result)) {
  log(`catalog: ${staleSources(result)} source(s) not fresh, fetching once more`);
  let retry = await buildCatalog({ modelsDevPath, previousDir, offline: false, now });
  if (staleSources(retry) < staleSources(result)) {
    result = retry;
    log(`catalog: retry helped, sources: ${describeSources(result)}`);
  } else log('catalog: retry did not help, keeping the first fetch');
}

// Every later build in this run reads these snapshots instead of fetching, so the only thing
// that changes between iterations is the override files.
await emitCatalog(pinnedDir, result);

let rebuild = () =>
  buildCatalog({ modelsDevPath, previousDir, sourcesDir: pinnedDir, offline: true, now });

let initialIssues = result.issues.length;
let attempted = new Set<string>();
let iterations: IterationLog[] = [];
let stopReason: string | null = null;

log(`catalog: ${describeCatalog(result)}`);
log(`catalog: open issues by kind: ${countBy(result.issues, issue => issue.kind) || 'none'}`);
log(
  `catalog: open issues by vendor: ${countBy(result.issues, issue => issue.vendorId) || 'none'}`
);

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
  if (deadlineAt - Date.now() < minFixMs) {
    stopReason = 'deadline reached';
    break;
  }

  let batch = open.slice(0, batchSize);
  for (let issue of batch) attempted.add(issue.key);

  let batchStartedAt = Date.now();
  let agentStats = emptyStats();
  let timing = () => ({
    seconds: Math.round((Date.now() - batchStartedAt) / 1000),
    agent: agentStats
  });
  let prefix = `batch ${iteration}`;

  log(
    `${prefix}/${maxIterations}: ${batch.length} issues, ${open.length - batch.length} more open after this one, ${formatDuration(Math.max(0, budgetMs - (Date.now() - startedAt)))} of budget left`
  );
  log(
    `${prefix}: by kind: ${countBy(batch, issue => issue.kind)}; by vendor: ${countBy(batch, issue => issue.vendorId)}`
  );

  let before = await readOverrideFiles();
  let batchFile = path.join(workDir, `batch-${iteration}.json`);
  let indexFile = path.join(workDir, 'models.tsv');
  let logFile = path.join(workDir, `agent-${iteration}.log`);

  let searchedBefore = webSearch?.stats.searches ?? 0;
  let failedBefore = webSearch?.stats.failures ?? 0;
  let evidenceStartedAt = Date.now();
  log(`${prefix}: gathering evidence (web search and hugging face)`);

  let evidence = await buildEvidence({
    result,
    batch,
    overrides: before,
    fetchHuggingFace: !values['no-hugging-face'],
    webSearch
  });

  log(
    `${prefix}: evidence ready in ${formatDuration(Date.now() - evidenceStartedAt)}: web search results for ${evidence.filter(entry => entry.webSearch).length}/${batch.length} issues (${(webSearch?.stats.searches ?? 0) - searchedBefore} new searches, ${(webSearch?.stats.failures ?? 0) - failedBefore} failed), hugging face metadata for ${evidence.filter(entry => entry.huggingFace).length}/${batch.length}`
  );

  await writeFile(batchFile, `${JSON.stringify(evidence, null, 2)}\n`);
  await writeFile(indexFile, modelIndex(result));

  let dirtyBefore = await dirtyPaths(root);
  let agent = async (message: string, continueSession: boolean, label: string) => {
    let run = await runAgent({
      piBin: values.pi!,
      model: values.model!,
      thinking: values.thinking!,
      cwd: packageDir,
      workDir: path.join(workDir, `agent-${iteration}`),
      systemPromptFile,
      message,
      continueSession,
      credentials: credentials!,
      timeoutMs: Math.min(agentTimeoutMs, Math.max(deadlineAt - Date.now(), 0)),
      logFile,
      log,
      label
    });

    agentStats = addStats(agentStats, run.stats);
    return run.exitCode;
  };

  let exitCode = await agent(
    [
      `Today is ${today}.`,
      `Issue batch (${batch.length} issues): ${relative(batchFile)}`,
      `Model index: ${relative(indexFile)}`,
      'Record a decision for every issue in the batch.'
    ].join('\n'),
    false,
    `agent ${iteration}`
  );

  let review: DecisionReview | null = null;
  let restored: string[] = [];
  let fixRounds = 0;
  let lastFeedback: string[] = [];

  while (true) {
    let reverted = await restoreOutside({
      root,
      before: dirtyBefore,
      allowed: [overridesPrefix]
    });
    restored.push(...reverted);
    if (reverted.length)
      log(
        `${prefix}: reverted ${reverted.length} edit(s) outside overrides/: ${reverted.join(', ')}`
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

      log(
        `${prefix}: review after ${fixRounds === 0 ? 'the first pass' : `fix round ${fixRounds}`}: ${review.accepted.length} accepted, ${feedback.length} not accepted${review.reverted.length ? `, ${review.reverted.length} edits outside the batch reverted` : ''}`
      );
    } catch (err) {
      review = null;
      feedback = [`- ${(err as Error).message}`];
      log(`${prefix}: review failed: ${shorten((err as Error).message, reasonLimit)}`);
    }

    lastFeedback = feedback;
    for (let line of feedback) log(`${prefix}:   ✗ ${shorten(line.slice(2), reasonLimit)}`);

    if (feedback.length && deadlineAt - Date.now() < minFixMs) {
      log(
        `${prefix}: not asking for fixes, ${formatDuration(Math.max(deadlineAt - Date.now(), 0))} left before the deadline`
      );
      break;
    }

    if (!feedback.length || fixRounds >= maxFixRounds || exitCode !== 0) {
      if (feedback.length && exitCode !== 0)
        log(`${prefix}: not asking for fixes, pi exited with ${exitCode}`);
      break;
    }

    fixRounds++;
    log(
      `${prefix}: asking the agent to fix ${feedback.length} entries (round ${fixRounds}/${maxFixRounds})`
    );
    exitCode = await agent(
      `These entries were not accepted. Fix them in place, then stop:\n${feedback.join('\n')}`,
      true,
      `agent ${iteration} fix ${fixRounds}`
    );
  }

  if (!review) {
    await writeOverrideFiles(before);
    log(
      `${prefix}: invalid override files, rolled back (${shorten(lastFeedback.join('; '), reasonLimit)})`
    );
    iterations.push({
      iteration,
      batch: batch.length,
      exitCode,
      outcome: 'invalid override files',
      ...timing()
    });
    continue;
  }

  for (let entry of review.accepted)
    log(`${prefix}:   ✓ ${entry.key}  ${decisionLabel(entry.decision)}`);

  await writeOverrideFiles(review.files);
  let rebuildStartedAt = Date.now();
  let candidate = await rebuild();
  log(
    `${prefix}: rebuilt the catalog in ${formatDuration(Date.now() - rebuildStartedAt)}: ${candidate.validation.errors.length} validation errors, ${candidate.issues.length} open issues`
  );

  if (candidate.validation.errors.length) {
    await writeOverrideFiles(before);
    log(
      `${prefix}: rolled back, rebuild failed: ${candidate.validation.errors.slice(0, 3).join('; ')}`
    );
    iterations.push({
      iteration,
      batch: batch.length,
      exitCode,
      outcome: `rebuild failed: ${candidate.validation.errors.slice(0, 3).join('; ')}`,
      ...timing()
    });
    continue;
  }

  let stillOpen = new Set(candidate.issues.map(issue => issue.key));
  let solved = batch.filter(issue => !stillOpen.has(issue.key)).length;
  iterations.push({
    iteration,
    batch: batch.length,
    exitCode,
    outcome: exitCode === 0 ? 'applied' : `pi exited with ${exitCode}`,
    solved,
    review,
    restored,
    ...timing()
  });

  log(
    `${prefix} done in ${formatDuration(Date.now() - batchStartedAt)}: ${review.accepted.length} accepted, ${review.rejected.length} rejected, ${solved}/${batch.length} issues solved, open issues ${result.issues.length} → ${candidate.issues.length}`
  );
  log(`${prefix}: agent usage: ${describeStats(agentStats)}`);
  result = candidate;
  await overrideBranch?.save(
    `Model catalog: reconcile overrides (batch ${iteration}, ${review.accepted.length} decisions)`
  );

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

log(`stopped: ${stopReason}`);
log(
  `totals: ${iterations.length} batches, open issues ${initialIssues} → ${result.issues.length}, overrides ${changed ? 'changed' : 'unchanged'}, agent ${describeStats(iterations.reduce((total, entry) => addStats(total, entry.agent ?? emptyStats()), emptyStats()))}${webSearch ? `, web search ${webSearch.stats.searches} searches / ${webSearch.stats.failures} failed${webSearch.stats.stoppedBecause ? ` (stopped: ${webSearch.stats.stoppedBecause})` : ''}` : ''}`
);
console.log(`\n${summary}`);
