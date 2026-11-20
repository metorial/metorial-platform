import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { createAgentTrackingClient } from '@mtsrc/agent-tracking-client-internal';
import { maxQueriesPerMinute } from '@mtsrc/agent-tracking-module-query';
import { explainShapes, timeSessionIndexBuilds } from './bench/explain';
import { selectQueries } from './bench/queries';
import { defaultPerMinute, runBenchmark } from './bench/runner';
import { cleanupStore, seedStore } from './bench/seed';
import { resolveSeedShape, smokeSeedShape } from './bench/shape';
import { openBenchStore, withCheckedStore } from './bench/store';
import { realClock } from './lib/clock';
import {
  assertNotProduction,
  readSecretFromEnv,
  redact,
  redactUrl,
  UsageError
} from './lib/safety';
import { runDryRun } from './load/dryRun';
import { defaultKneeThresholds, findKnee } from './load/knee';
import type { Compression, PayloadFormat } from './load/payload';
import { runProbe } from './load/probe';
import { resolveTrafficProfile } from './load/profile';
import { parseRates } from './load/rate';
import { fetchSend, runLoad } from './load/run';
import { createBatchStream } from './load/synth';
import { liveText } from './reconcile/report';
import { reconcileClientOnly, reconcileLive } from './reconcile/run';
import {
  formatBenchmark,
  formatDryRun,
  formatExplain,
  formatLoad,
  formatProbe
} from './report';
import { sampleStoreSizes } from './sizing/storeSample';
import { formatSizing, parseSizingInput, runSizing } from './sizing/model';
import defaultSizingInput from './sizing/estimates.json';

let usage = `Agent Tracking capacity and reconciliation tooling. Text goes to stderr, the JSON result
to stdout or --out.

  bun src/main.ts load --dry-run [--batches 200] [--backfill-requests 2]
      Generates a batch and runs it through the service's own ingest handler, parser, dialects
      and record builder in-process. No network, no database.

  bun src/main.ts load --url <ingest base url> --key-env <VAR> (--rates 250,500,1000 | --ramp 250:4000:x2)
      [--mode live|backfill|both] [--backfill-rate 200] [--step-seconds 60] [--warmup-seconds 10]
      [--concurrency 64] [--max-outstanding 2000] [--max-retries 5] [--max-retry-wait-seconds 30]
      [--timeout-seconds 30] [--format protobuf|json] [--compression none|gzip]
      [--developers 200] [--sessions 200] [--seed 1] [--profile profile.json] [--ingest-tasks 1]
      [--max-p95-ms 1000] [--max-p99-ms 2500] [--max-busy-rate 0.01] [--min-achieved-ratio 0.95]
      [--max-client-wait-ms 100]
      Rates are records per second. With --mode backfill the rates drive the bulk route's
      backfill lane; with both, --backfill-rate runs alongside every live step. Latency counts
      from the scheduled send time; a step whose generator queue exceeds --max-client-wait-ms is
      marked client-limited, not a service limit.

  bun src/main.ts probe --url <ingest> --key-env <VAR> --rpc-url <api base url>
      --organization-id <ator_…> --instance-id <atin_…> [--samples 5] [--timeout-seconds 120] [--poll-ms 500]
      Arrival-to-queryable delay on a dedicated probe instance.

  bun src/main.ts seed --mongo-url-env <VAR> --rpc-url <api base url> [--smoke] [--shape shape.json]
      [--organizations 1] [--seed 1]
  bun src/main.ts cleanup --mongo-url-env <VAR> --rpc-url <api base url> [--keep-organizations]
  bun src/main.ts bench --mongo-url-env <VAR> --rpc-url <api base url> [--repeats 30]
      [--per-minute ${defaultPerMinute}] [--queries a,b]
  bun src/main.ts explain --mongo-url-env <VAR> [--rebuild-indexes]
      The bench needs an empty, bench-only MongoDB database and an API task that reads it:
      run the service image with AGENT_TRACKING_ROLES=api only and AGENT_TRACKING_MONGO_URL set
      to that database. A worker role on the bench store may re-settle or re-attribute the
      seeded documents. Every command reads the bench marker and refuses a database holding
      data the bench did not create before it writes, builds or drops anything. Seed first
      writes a canary and checks that the service behind --rpc-url returns it.
      The bench organizations, projects, instances and users are created through --rpc-url in
      that service's Postgres; cleanup deletes the bench documents and erases those
      organizations (--keep-organizations leaves them).

  bun src/main.ts size [--input sizing.json]
  bun src/main.ts size --from-store --mongo-url-env <VAR> [--sample 2000]
      Storage, instance class and cost from a JSON input (default: the design docs' estimates).
      --from-store instead samples stored documents read-only and prints the measured sizes per
      record by type, records and slices per session, and slice and session sizes, to put into
      an input file.

  bun src/main.ts reconcile client-only (--claude-projects <dirs> | --codex-sessions <dir>) --out <dir>
  bun src/main.ts reconcile live (--claude-projects <dirs> | --codex-sessions <dir>) --out <dir>
      --rpc-url <api base url> --organization <id> [--instance a,b] [--since <date>]
      [--hash-secret-env AGENT_TRACKING_HASH_SECRET] [--settle-timeout 120] [--fail-unmatched]
      Compares what agent tracking calculates with what Claude Code and Codex recorded
      themselves. Transcripts are read in place; the report holds ids, model names, token
      counts and amounts only, and --out is a directory outside any git checkout. client-only
      reports what the client recorded, and how Claude Code's cost-state compares with the sum
      over its messages. live finds, for every session the service has, the transcript or
      rollout with the same session id and compares tokens and cost, and lists the selected
      local sessions the service lacks; it exits 1 on a failure, and when it compared no Claude
      Code session at all. --fail-unmatched fails on any Claude Code session found on one side
      only, for a stack that holds only the sessions of the selected directories.

Common: --out <file> writes the JSON there. Targets must be localhost or a host named with
--allow-host a,b (exact, or *.suffix, for example a staging domain); every host of a MongoDB
connection string is checked. --allow-production lifts the check. Keys and connection strings are read from the
env vars you name and never printed.`;

type Options = NonNullable<ParseArgsConfig['options']>;

type Values = Record<string, string | boolean | (string | boolean)[] | undefined>;

type Command = {
  options: Options;
  positionals?: boolean;
  run: (values: Values, positionals: string[]) => Promise<number>;
};

let text = { type: 'string' } as const;

let flag = { type: 'boolean' } as const;

let commonOptions: Options = {
  out: text,
  'allow-production': flag,
  'allow-host': text,
  help: flag
};

let secretEnvOptions = ['key-env', 'mongo-url-env', 'hash-secret-env'];

let defaultHashSecretEnv = 'AGENT_TRACKING_HASH_SECRET';

let defaultSettleSeconds = 120;

let log = (message: string) => process.stderr.write(`${message}\n`);

// Secrets come from the environment the operator started the tool with, never from the
// placeholders main.ts sets for the service's packages.
let operatorEnv: NodeJS.ProcessEnv = process.env;

let secretOf = (variable: string | undefined, label: string) =>
  readSecretFromEnv(variable, label, operatorEnv);

let textOf = (values: Values, name: string) => {
  let value = values[name];
  return typeof value == 'string' ? value : undefined;
};

let requiredOf = (values: Values, name: string) => {
  let value = textOf(values, name);
  if (!value) throw new UsageError(`--${name} is required.`);

  return value;
};

let numberOf = (values: Values, name: string, fallback: number) => {
  let value = textOf(values, name);
  if (value === undefined) return fallback;

  let parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new UsageError(`--${name} must be a number.`);

  return parsed;
};

let listOf = (values: Values, name: string) =>
  textOf(values, name)
    ?.split(',')
    .map(item => item.trim())
    .filter(Boolean);

let oneOf = <T extends string>(
  values: Values,
  name: string,
  allowed: readonly T[],
  fallback: T
): T => {
  let value = textOf(values, name) ?? fallback;
  if (!allowed.includes(value as T))
    throw new UsageError(`--${name} takes ${allowed.join(' or ')}.`);

  return value as T;
};

let emit = (values: Values, value: unknown) => {
  let json = JSON.stringify(value, null, 2);
  let out = textOf(values, 'out');

  if (out) writeFileSync(out, json + '\n');
  else process.stdout.write(json + '\n');
};

let readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

let profileOf = (values: Values) => {
  let path = textOf(values, 'profile');
  let developers = textOf(values, 'developers');

  return resolveTrafficProfile({
    ...(path ? readJson(path) : {}),
    ...(developers ? { developers: Number(developers) } : {})
  });
};

let shapeOf = (values: Values) => {
  let path = textOf(values, 'shape');
  let organizations = textOf(values, 'organizations');

  return resolveSeedShape({
    ...(values.smoke ? smokeSeedShape : {}),
    ...(path ? readJson(path) : {}),
    ...(organizations ? { organizations: Number(organizations) } : {})
  });
};

let assertTarget = (values: Values, target: string, label: string) =>
  assertNotProduction(
    target,
    !!values['allow-production'],
    label,
    listOf(values, 'allow-host') ?? []
  );

let mongoUrlOf = (values: Values) => {
  let url = secretOf(textOf(values, 'mongo-url-env'), 'mongo-url');
  assertTarget(values, url, 'MongoDB');

  return url;
};

let rpcUrlOf = (values: Values) => {
  let url = requiredOf(values, 'rpc-url').replace(/\/+$/, '');
  assertTarget(values, url, 'RPC');

  return url;
};

// The client is an RPC proxy that answers every property, `then` included, so it is a
// thenable: it is created and used synchronously and never returned from an async function.
let clientFor = (rpcUrl: string) =>
  createAgentTrackingClient({ endpoint: `${rpcUrl}/metorial-agent-tracking` });

let loadCommand: Command = {
  options: {
    'dry-run': flag,
    batches: text,
    'backfill-requests': text,
    url: text,
    'key-env': text,
    rates: text,
    ramp: text,
    mode: text,
    'backfill-rate': text,
    'step-seconds': text,
    'warmup-seconds': text,
    concurrency: text,
    'max-outstanding': text,
    'max-retries': text,
    'max-retry-wait-seconds': text,
    'timeout-seconds': text,
    format: text,
    compression: text,
    developers: text,
    sessions: text,
    seed: text,
    profile: text,
    'ingest-tasks': text,
    'max-p95-ms': text,
    'max-p99-ms': text,
    'max-busy-rate': text,
    'min-achieved-ratio': text,
    'max-client-wait-ms': text
  },

  run: async values => {
    let profile = profileOf(values);
    let seed = numberOf(values, 'seed', 1);
    let format = oneOf<PayloadFormat>(values, 'format', ['protobuf', 'json'], 'protobuf');
    let compression = oneOf<Compression>(values, 'compression', ['none', 'gzip'], 'none');

    if (values['dry-run']) {
      let report = await runDryRun({
        profile,
        seed,
        batches: numberOf(values, 'batches', 200),
        backfillRequests: numberOf(values, 'backfill-requests', 2),
        format,
        compression
      });

      log(formatDryRun(report));
      emit(values, { kind: 'agent-tracking.load.dry-run', profile: profile.name, ...report });

      return report.ok ? 0 : 1;
    }

    let url = requiredOf(values, 'url');
    assertTarget(values, url, 'ingest');
    let key = secretOf(textOf(values, 'key-env'), 'key');

    let mode = oneOf(values, 'mode', ['live', 'backfill', 'both'] as const, 'live');
    let rates = parseRates({ rates: listOf(values, 'rates'), ramp: textOf(values, 'ramp') });
    let backfillRate = numberOf(values, 'backfill-rate', 0);
    let concurrency = numberOf(values, 'concurrency', 64);

    if (mode == 'both' && backfillRate <= 0)
      throw new UsageError('--mode both needs --backfill-rate.');

    let thresholds = {
      maxP95Ms: numberOf(values, 'max-p95-ms', defaultKneeThresholds.maxP95Ms),
      maxP99Ms: numberOf(values, 'max-p99-ms', defaultKneeThresholds.maxP99Ms),
      maxClientWaitP95Ms: numberOf(
        values,
        'max-client-wait-ms',
        defaultKneeThresholds.maxClientWaitP95Ms
      ),
      maxBusyRate: numberOf(values, 'max-busy-rate', defaultKneeThresholds.maxBusyRate),
      maxErrorRate: defaultKneeThresholds.maxErrorRate,
      minAchievedRatio: numberOf(
        values,
        'min-achieved-ratio',
        defaultKneeThresholds.minAchievedRatio
      )
    };

    let config = {
      url,
      key,
      rates,
      backfillRates:
        mode == 'backfill' ? rates : mode == 'both' ? rates.map(() => backfillRate) : null,
      liveEnabled: mode != 'backfill',
      stepMs: numberOf(values, 'step-seconds', 60) * 1000,
      warmupMs: numberOf(values, 'warmup-seconds', 10) * 1000,
      concurrency,
      maxOutstanding: numberOf(values, 'max-outstanding', concurrency * 30),
      maxRetries: numberOf(values, 'max-retries', 5),
      maxRetryWaitMs: numberOf(values, 'max-retry-wait-seconds', 30) * 1000,
      requestTimeoutMs: numberOf(values, 'timeout-seconds', 30) * 1000,
      drainTimeoutMs: 120_000,
      format,
      compression,
      profile,
      seed
    };

    let stream = createBatchStream({
      profile,
      seed,
      developers: profile.developers,
      sessions: numberOf(values, 'sessions', profile.developers),
      clock: realClock.now
    });

    log(
      `load: ${mode}, steps ${rates.join(', ')} records/s, ${config.stepMs / 1000} s each, against ${redactUrl(url)}`
    );

    let result = await runLoad({
      config,
      stream,
      clock: realClock,
      onStep: step =>
        log(
          `step ${step.step + 1}: ${step.live ? `live achieved ${step.live.achievedRecordsPerSecond}/s p95 ${Math.round(step.live.latencyFromScheduleMs.p95 ?? 0)} ms busy ${(step.live.busyRate * 100).toFixed(2)}%` : ''}${step.backfill ? ` backfill achieved ${step.backfill.achievedRecordsPerSecond}/s` : ''}`
        )
    });

    let lanes = [
      ...(config.liveEnabled ? (['live'] as const) : []),
      ...(config.backfillRates ? (['backfill'] as const) : [])
    ];
    let knees = lanes.map(lane => findKnee(result.steps, lane, thresholds));
    let ingestTasks = numberOf(values, 'ingest-tasks', 1);

    log(
      formatLoad({ steps: result.steps, knees, ingestTasks, undelivered: result.undelivered })
    );
    emit(values, {
      kind: 'agent-tracking.load',
      target: redactUrl(url),
      mode,
      ingestTasks,
      profile,
      config: { ...config, key: undefined, url: undefined, profile: undefined },
      steps: result.steps,
      knees,
      undelivered: result.undelivered
    });

    return 0;
  }
};

let probeCommand: Command = {
  options: {
    url: text,
    'key-env': text,
    'rpc-url': text,
    'organization-id': text,
    'instance-id': text,
    samples: text,
    'timeout-seconds': text,
    'poll-ms': text,
    seed: text,
    profile: text
  },

  run: async values => {
    let url = requiredOf(values, 'url');
    assertTarget(values, url, 'ingest');
    let key = secretOf(textOf(values, 'key-env'), 'key');
    let client = clientFor(rpcUrlOf(values));

    let report = await runProbe({
      ingestUrl: url,
      key,
      client,
      organizationId: requiredOf(values, 'organization-id'),
      instanceId: requiredOf(values, 'instance-id'),
      samples: numberOf(values, 'samples', 5),
      timeoutMs: numberOf(values, 'timeout-seconds', 120) * 1000,
      pollMs: numberOf(values, 'poll-ms', 500),
      profile: profileOf(values),
      seed: numberOf(values, 'seed', 1),
      clock: realClock,
      send: fetchSend
    });

    log(formatProbe(report));
    emit(values, { kind: 'agent-tracking.probe', ...report });

    return report.pass ? 0 : 1;
  }
};

let seedCommand: Command = {
  options: {
    'mongo-url-env': text,
    'rpc-url': text,
    smoke: flag,
    shape: text,
    organizations: text,
    seed: text,
    profile: text
  },

  run: async values => {
    let shape = shapeOf(values);
    let client = clientFor(rpcUrlOf(values));

    let marker = await withCheckedStore(
      mongoUrlOf(values),
      { requireMarker: false },
      (store, found) =>
        seedStore({
          store,
          marker: found,
          client,
          shape,
          profile: profileOf(values),
          seed: numberOf(values, 'seed', 1),
          log
        })
    );

    emit(values, { kind: 'agent-tracking.seed', marker });

    return 0;
  }
};

let cleanupCommand: Command = {
  options: { 'mongo-url-env': text, 'rpc-url': text, 'keep-organizations': flag },

  run: async values => {
    let client = clientFor(rpcUrlOf(values));

    await withCheckedStore(mongoUrlOf(values), { requireMarker: true }, (store, marker) =>
      cleanupStore({
        store,
        marker: marker!,
        client,
        eraseOrganizations: !values['keep-organizations'],
        log
      })
    );

    return 0;
  }
};

let benchCommand: Command = {
  options: {
    'mongo-url-env': text,
    'rpc-url': text,
    repeats: text,
    'per-minute': text,
    queries: text
  },

  run: async values => {
    let perMinute = numberOf(values, 'per-minute', defaultPerMinute);
    if (perMinute > maxQueriesPerMinute) {
      throw new UsageError(
        `--per-minute must stay at or below the service limit of ${maxQueriesPerMinute}.`
      );
    }

    let client = clientFor(rpcUrlOf(values));
    let marker = await withCheckedStore(
      mongoUrlOf(values),
      { requireMarker: true, requireComplete: true },
      async (_, found) => found!
    );

    let report = await runBenchmark({
      client,
      marker,
      queries: selectQueries(listOf(values, 'queries')),
      repeats: numberOf(values, 'repeats', 30),
      perMinute,
      clock: realClock,
      log
    });

    log(formatBenchmark(report));
    emit(values, {
      kind: 'agent-tracking.bench',
      written: marker.written,
      shape: marker.shape,
      ...report
    });

    return report.pass ? 0 : 1;
  }
};

let explainCommand: Command = {
  options: { 'mongo-url-env': text, 'rebuild-indexes': flag },

  run: async values => {
    await withCheckedStore(
      mongoUrlOf(values),
      { requireMarker: true },
      async (store, marker) => {
        let results = await explainShapes({ store, marker: marker! });
        log(formatExplain(results));

        let builds = values['rebuild-indexes']
          ? await timeSessionIndexBuilds({ store, clock: realClock })
          : null;

        if (builds) {
          log(
            `index builds on ${builds.documents} sessions: ${builds.builds.map(build => `${build.index} ${build.ms} ms`).join(', ')}`
          );
        }

        emit(values, { kind: 'agent-tracking.explain', results, builds });
      }
    );

    return 0;
  }
};

let sizeCommand: Command = {
  options: { input: text, 'from-store': flag, 'mongo-url-env': text, sample: text },

  run: async values => {
    if (values['from-store']) {
      let store = await openBenchStore(mongoUrlOf(values));
      let sizes;

      try {
        sizes = await sampleStoreSizes({ store, sample: numberOf(values, 'sample', 2000) });
      } finally {
        await store.close();
      }

      log(
        `store sample: ${sizes.sample.events} events, ${sizes.sample.measurements} measurements, ${sizes.sample.slices} slices, ${sizes.sample.sessions} sessions, ${sizes.sample.perSession} settled sessions counted`
      );
      log(
        `measured: ${sizes.bytesPerRecord?.toFixed(0)} B/record, ${sizes.recordsPerSession?.toFixed(1)} records/session, ${sizes.slicesPerSession?.toFixed(2)} slices/session, ${sizes.bytesPerSlice?.toFixed(0)} B/slice, ${sizes.bytesPerSession?.toFixed(0)} B/session`
      );
      emit(values, { kind: 'agent-tracking.size.store', ...sizes });

      return 0;
    }

    let path = textOf(values, 'input');
    let input = parseSizingInput(path ? readJson(path) : defaultSizingInput);
    let result = runSizing(input);

    log(formatSizing(result));
    emit(values, { kind: 'agent-tracking.size', input, result });

    return 0;
  }
};

let reconcileCommand: Command = {
  positionals: true,

  options: {
    'claude-projects': text,
    'codex-sessions': text,
    'rpc-url': text,
    organization: text,
    instance: text,
    since: text,
    'hash-secret-env': text,
    'settle-timeout': text,
    'fail-unmatched': flag
  },

  run: async (values, positionals) => {
    let [mode, ...extra] = positionals;
    if (extra.length || (mode != 'client-only' && mode != 'live')) {
      throw new UsageError('reconcile takes one mode: client-only or live.');
    }

    let selection = {
      claudeProjects: listOf(values, 'claude-projects') ?? [],
      codexSessions: textOf(values, 'codex-sessions')
    };
    let out = requiredOf(values, 'out');

    if (mode == 'client-only') {
      let summary = reconcileClientOnly({ selection, out });
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

      return 0;
    }

    let since = textOf(values, 'since');
    let from = since ? new Date(since) : undefined;
    if (from && isNaN(from.getTime())) throw new UsageError('--since is not a date.');

    let hashSecret = secretOf(
      textOf(values, 'hash-secret-env') ?? defaultHashSecretEnv,
      'hash-secret'
    );

    let summary = await reconcileLive({
      selection,
      out,
      client: clientFor(rpcUrlOf(values)),
      organizationId: requiredOf(values, 'organization'),
      instanceIds: listOf(values, 'instance'),
      from,
      hashSecret,
      settleTimeoutMs: numberOf(values, 'settle-timeout', defaultSettleSeconds) * 1000,
      failUnmatched: !!values['fail-unmatched']
    });

    log(liveText({ rows: [], localOnly: [], summary }));

    return summary.passed ? 0 : 1;
  }
};

let commands: Record<string, Command> = {
  load: loadCommand,
  probe: probeCommand,
  seed: seedCommand,
  cleanup: cleanupCommand,
  bench: benchCommand,
  explain: explainCommand,
  size: sizeCommand,
  reconcile: reconcileCommand
};

let isParseError = (error: unknown) =>
  String((error as { code?: unknown })?.code ?? '').startsWith('ERR_PARSE_ARGS');

export let main = async (argv: string[], env: NodeJS.ProcessEnv = process.env) => {
  operatorEnv = env;

  let [name, ...rest] = argv;
  let command = name ? commands[name] : undefined;

  if (!command || rest.includes('--help')) {
    log(usage);
    return command || !name || name == 'help' || name == '--help' ? 0 : 2;
  }

  let secrets: string[] = [];

  try {
    let { values, positionals } = parseArgs({
      args: rest,
      options: { ...commonOptions, ...command.options },
      allowPositionals: !!command.positionals,
      strict: true
    });

    secrets = [...secretEnvOptions.map(option => textOf(values, option)), defaultHashSecretEnv]
      .map(variable => (variable ? (env[variable] ?? '') : ''))
      .filter(Boolean);

    return await command.run(values, positionals);
  } catch (error) {
    let usageError = error instanceof UsageError || isParseError(error);
    let message = error instanceof Error ? error.message : String(error);
    log(`${usageError ? 'usage' : 'error'}: ${redact(message, secrets)}`);

    return usageError ? 2 : 1;
  }
};
