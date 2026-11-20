import { hostname } from 'node:os';
import {
  check as defineCheck,
  checkIdPattern,
  createCheckContext,
  type CheckDefinition,
  type CheckOutcome,
  type ResolutionInput
} from './check';
import { describeError } from './errors';
import { redact, redactString } from './redact';
import {
  doctorProtocolVersion,
  isPassing,
  type CheckDetails,
  type CheckResult,
  type Report,
  type Resolution
} from './types';

export let doctorDefaults = {
  concurrency: 4,
  timeoutMs: 5_000,
  runBudgetMs: 12_000,
  cacheTtlMs: 30_000,
  freshMinIntervalMs: 10_000
};

export interface DoctorOptions {
  component: string;
  instance?: string;
  releaseVersion?: string | null;
  buildVersion?: string | null;
  channel?: string | null;
  publicUrl?: string | null;
  fingerprints?: Record<string, string>;
  checks?: CheckDefinition[];
  concurrency?: number;
  timeoutMs?: number;
  runBudgetMs?: number;
  cacheTtlMs?: number;
  freshMinIntervalMs?: number;
  now?: () => number;
}

export interface RunOptions {
  fresh?: boolean;
  signal?: AbortSignal;
}

interface StoredResult {
  result: CheckResult;
  producedAt: number;
}

class CheckTimeout {
  constructor(readonly timeoutMs: number) {}
}

let iso = (ms: number) => new Date(ms).toISOString();

let envValue = (name: string) => {
  let value = typeof process != 'undefined' ? process.env[name] : undefined;
  return value && value.trim() ? value.trim() : null;
};

let processStartedAt = () => {
  let origin = typeof performance != 'undefined' ? performance.timeOrigin : undefined;
  return Math.round(origin && Number.isFinite(origin) ? origin : Date.now());
};

let randomRunId = () => {
  let bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

let stripUndefined = <T extends object>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>;

let toResolution = (input: ResolutionInput | null | undefined): Resolution | null =>
  input
    ? { summary: input.summary, steps: input.steps ?? [], docs: input.docs ?? null }
    : null;

let toDetails = (details: Record<string, unknown> | null | undefined): CheckDetails | null =>
  details ? (redact(details) as CheckDetails) : null;

let createLimiter = (limit: number) => {
  let active = 0;
  let waiting: (() => void)[] = [];

  let acquire = () => {
    if (active < limit) {
      active++;
      return Promise.resolve();
    }

    return new Promise<void>(resolve => waiting.push(resolve));
  };

  // The slot passes straight to the next waiter, so nobody can slip in between.
  let release = () => {
    let next = waiting.shift();
    if (next) next();
    else active--;
  };

  return async <T>(fn: () => Promise<T>) => {
    await acquire();

    try {
      return await fn();
    } finally {
      release();
    }
  };
};

let waitFor = <T>(promise: Promise<T>, signal: AbortSignal | undefined) => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise<T>((resolve, reject) => {
    let onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
};

let findCycles = (checks: Map<string, CheckDefinition>) => {
  let cyclic = new Map<string, string[]>();
  let state = new Map<string, 'visiting' | 'done'>();
  let stack: string[] = [];

  let visit = (id: string) => {
    if (state.get(id) == 'done') return;

    if (state.get(id) == 'visiting') {
      let cycle = [...stack.slice(stack.indexOf(id)), id];
      for (let member of cycle) cyclic.set(member, cycle);
      return;
    }

    state.set(id, 'visiting');
    stack.push(id);

    for (let dependency of checks.get(id)?.dependsOn ?? []) {
      if (checks.has(dependency)) visit(dependency);
    }

    stack.pop();
    state.set(id, 'done');
  };

  for (let id of checks.keys()) visit(id);

  return cyclic;
};

export let createDoctor = (options: DoctorOptions) => {
  let settings = { ...doctorDefaults, ...stripUndefined(options) };
  let now = options.now ?? Date.now;
  let startedProcessAt = processStartedAt();

  let identity = {
    component: options.component,
    instance: options.instance ?? envValue('HOSTNAME') ?? hostname(),
    releaseVersion:
      options.releaseVersion !== undefined
        ? options.releaseVersion
        : envValue('METORIAL_RELEASE_VERSION'),
    buildVersion:
      options.buildVersion !== undefined ? options.buildVersion : envValue('METORIAL_VERSION'),
    channel:
      options.channel !== undefined ? options.channel : envValue('METORIAL_RELEASE_CHANNEL'),
    publicUrl: options.publicUrl ?? null
  };

  let checks = new Map<string, CheckDefinition>();
  let previous = new Map<string, StoredResult>();
  let inflight: Promise<Report> | null = null;
  let last: { report: Report; finishedAt: number } | null = null;

  let register = (...definitions: CheckDefinition[]) => {
    let pending = new Map<string, CheckDefinition>();

    for (let definition of definitions) {
      if (!checkIdPattern.test(definition.id)) {
        throw new Error(`Invalid doctor check id "${definition.id}"`);
      }

      if (checks.has(definition.id) || pending.has(definition.id)) {
        throw new Error(`Duplicate doctor check id "${definition.id}"`);
      }

      pending.set(definition.id, defineCheck(definition));
    }

    for (let [id, definition] of pending) {
      checks.set(id, definition);
    }
  };

  let result = (
    definition: CheckDefinition,
    outcome: CheckOutcome,
    durationMs: number
  ): CheckResult => ({
    id: definition.id,
    title: definition.title,
    category: definition.category,
    target: definition.target ? redactString(definition.target) : null,
    status: outcome.status,
    severity: definition.severity,
    durationMs: Math.max(0, Math.round(durationMs)),
    message: redactString(outcome.message),
    resolution: toResolution(
      outcome.resolution ??
        (outcome.status == 'pass' || outcome.status == 'skip' ? null : definition.resolution)
    ),
    details: toDetails(outcome.details),
    cachedAt: null
  });

  let errorOutcome = (error: unknown, resolution?: ResolutionInput): CheckOutcome => {
    let info = describeError(error);

    return {
      status: 'error',
      message: info.message,
      resolution: resolution ?? (info.hint ? { summary: info.hint } : null),
      details: { error: info }
    };
  };

  let timeoutOutcome = (definition: CheckDefinition, timeoutMs: number): CheckOutcome => ({
    status: 'timeout',
    message: `Timed out after ${timeoutMs}ms.`,
    resolution: definition.resolution ?? null,
    details: { timeoutMs }
  });

  let execute = async (
    definition: CheckDefinition,
    dependency: (id: string) => CheckResult | undefined,
    deadline: number
  ) => {
    let started = now();
    let timeoutMs = Math.min(definition.timeoutMs ?? settings.timeoutMs, deadline - started);
    if (timeoutMs <= 0) {
      return result(definition, timeoutOutcome(definition, 0), 0);
    }

    let controller = new AbortController();
    let { ctx, recorded } = createCheckContext(controller.signal, dependency);
    let timer: ReturnType<typeof setTimeout> | undefined;

    let timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        let reason = new CheckTimeout(timeoutMs);
        controller.abort(reason);
        reject(reason);
      }, timeoutMs);
    });

    // After a timeout the check keeps running until it notices the abort; its late rejection is
    // already reported as the timeout.
    let running = Promise.resolve().then(() => definition.run(ctx));
    running.catch(() => {});

    try {
      let returned = await Promise.race([running, timeout]);
      let outcome = returned ?? recorded() ?? { status: 'pass', message: 'OK' };

      return result(definition, outcome, now() - started);
    } catch (error) {
      let outcome =
        error instanceof CheckTimeout
          ? timeoutOutcome(definition, error.timeoutMs)
          : errorOutcome(error, definition.resolution);

      return result(definition, outcome, now() - started);
    } finally {
      clearTimeout(timer);
    }
  };

  let runChecks = async (deadline: number) => {
    let limit = createLimiter(settings.concurrency);
    let cyclic = findCycles(checks);
    let results = new Map<string, Promise<CheckResult>>();
    let settled = new Map<string, CheckResult>();

    let resultOf = (definition: CheckDefinition): Promise<CheckResult> => {
      let existing = results.get(definition.id);
      if (existing) return existing;

      let promise = evaluate(definition).then(value => {
        settled.set(definition.id, value);
        return value;
      });
      results.set(definition.id, promise);

      return promise;
    };

    let evaluate = async (definition: CheckDefinition): Promise<CheckResult> => {
      let cycle = cyclic.get(definition.id);
      if (cycle) {
        return result(
          definition,
          { status: 'error', message: `Dependency cycle: ${cycle.join(' → ')}.` },
          0
        );
      }

      let dependencyIds = definition.dependsOn ?? [];
      let unknown = dependencyIds.filter(id => !checks.has(id));
      if (unknown.length) {
        return result(
          definition,
          { status: 'error', message: `Unknown dependency: ${unknown.join(', ')}.` },
          0
        );
      }

      let dependencies = await Promise.all(dependencyIds.map(id => resultOf(checks.get(id)!)));
      let failed = dependencies.filter(dependency => !isPassing(dependency.status));
      if (failed.length) {
        return result(
          definition,
          {
            status: 'skip',
            message: `Skipped because ${failed.map(dependency => dependency.id).join(', ')} did not pass.`,
            details: { dependsOn: failed.map(dependency => dependency.id) }
          },
          0
        );
      }

      let stored = previous.get(definition.id);
      if (
        definition.minIntervalMs &&
        stored &&
        now() - stored.producedAt < definition.minIntervalMs
      ) {
        return { ...stored.result, cachedAt: iso(stored.producedAt) };
      }

      let fresh = await limit(() => execute(definition, id => settled.get(id), deadline));
      previous.set(definition.id, { result: fresh, producedAt: now() });

      return fresh;
    };

    return Promise.all([...checks.values()].map(resultOf));
  };

  let produce = async (): Promise<Report> => {
    let startedAt = now();
    let checkResults = await runChecks(startedAt + settings.runBudgetMs);
    let finishedAt = now();

    let report: Report = {
      doctor: doctorProtocolVersion,
      ...identity,
      fingerprints: { ...(options.fingerprints ?? {}) },
      processStartedAt: iso(startedProcessAt),
      startedAt: iso(startedAt),
      generatedAt: iso(finishedAt),
      durationMs: Math.max(0, finishedAt - startedAt),
      runId: randomRunId(),
      cached: false,
      ageMs: 0,
      checks: checkResults
    };

    last = { report, finishedAt };

    return report;
  };

  let served = (report: Report, finishedAt: number, cached: boolean): Report => ({
    ...report,
    cached,
    ageMs: Math.max(0, now() - finishedAt)
  });

  let run = async (runOptions: RunOptions = {}): Promise<Report> => {
    if (!inflight && last) {
      let age = now() - last.finishedAt;
      let maxAge = runOptions.fresh ? settings.freshMinIntervalMs : settings.cacheTtlMs;
      if (age < maxAge) return served(last.report, last.finishedAt, true);
    }

    // The run is shared and never tied to the caller's signal: aborting only stops this caller
    // from waiting, everyone else who joined still gets the report.
    inflight ??= produce().finally(() => {
      inflight = null;
    });

    let report = await waitFor(inflight, runOptions.signal);

    return served(report, Date.parse(report.generatedAt), false);
  };

  let handler = async (request: Request): Promise<Response> => {
    if (request.method != 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET' } });
    }

    let fresh = new URL(request.url).searchParams.get('fresh');

    try {
      let report = await run({
        fresh: fresh == '1' || fresh == 'true',
        signal: request.signal
      });

      return Response.json(report, {
        headers: { 'x-metorial-doctor': '1', 'cache-control': 'no-store' }
      });
    } catch (error) {
      return Response.json(
        { error: describeError(error).message },
        { status: 503, headers: { 'x-metorial-doctor': '1', 'cache-control': 'no-store' } }
      );
    }
  };

  register(...(options.checks ?? []));

  return { register, run, handler };
};

export type Doctor = ReturnType<typeof createDoctor>;
