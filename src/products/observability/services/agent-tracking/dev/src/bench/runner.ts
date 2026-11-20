import type { AgentTrackingClient } from '@mtsrc/agent-tracking-api-internal';
import { maxConcurrentQueries, maxQueriesPerMinute } from '@mtsrc/agent-tracking-module-query';
import { dayMs, type Clock } from '../lib/clock';
import { createOrganizationPace, retryAfterMsOf, type Pace } from '../lib/pace';
import { round, summarize, type Summary } from '../lib/stats';
import {
  takesQuerySlot,
  type BenchCall,
  type BenchContext,
  type NamedQuery,
  type PrepareList
} from './queries';
import type { SeedMarker } from './seed';

export let defaultPerMinute = 50;

let callOptions = { timeoutMs: 60_000, retry: false, captureErrors: false };

type QueryResult = {
  name: string;
  source: string;
  budgetP95Ms: number | null;
  coldMs: Summary;
  warmMs: Summary;
  serverWarmMs: Summary;
  errors: { count: number; codes: Record<string, number> };
  rateLimited: number;
  pass: boolean | null;
};

export type BenchmarkReport = {
  organizations: number;
  repeats: number;
  pacing: string;
  anchor: string;
  ageDays: number;
  queries: QueryResult[];
  pass: boolean;
};

let errorCodeOf = (error: unknown) => {
  let data = (error as { data?: { code?: string; reason?: string } }).data;

  return data?.reason ?? data?.code ?? (error instanceof Error ? error.name : 'error');
};

let invoke = async (client: AgentTrackingClient, call: BenchCall) => {
  if (call.method == 'query.run') {
    let result = await client.query.run(call.input, callOptions);
    return (result.meta as { elapsedMs?: number } | undefined)?.elapsedMs ?? null;
  }

  if (call.method == 'query.values') await client.query.values(call.input, callOptions);
  else await client.session.list(call.input, callOptions);

  return null;
};

type Sample =
  | { kind: 'ok'; ms: number; serverMs: number | null }
  | { kind: 'rate_limited' }
  | { kind: 'error'; code: string };

// A 429 is an invalid sample: it is counted and reported, waited out, and never becomes a
// latency, and the sample is not retried.
let measureCall = async (d: {
  client: AgentTrackingClient;
  call: BenchCall;
  ctx: BenchContext;
  pace: Pace;
  clock: Clock;
}): Promise<Sample> => {
  if (takesQuerySlot(d.call)) await d.pace.wait(d.ctx.organizationId);

  let started = d.clock.now();

  try {
    let serverMs = await invoke(d.client, d.call);
    return { kind: 'ok', ms: d.clock.now() - started, serverMs };
  } catch (error) {
    let wait = retryAfterMsOf(error);

    if (wait !== null) {
      await d.clock.sleep(wait);
      return { kind: 'rate_limited' };
    }

    return { kind: 'error', code: errorCodeOf(error) };
  }
};

export let runBenchmark = async (d: {
  client: AgentTrackingClient;
  marker: SeedMarker;
  queries: NamedQuery[];
  repeats: number;
  perMinute: number;
  clock: Clock;
  log: (message: string) => void;
}): Promise<BenchmarkReport> => {
  let { client, clock } = d;
  let pace = createOrganizationPace(d.perMinute, clock);
  let anchor = new Date(d.marker.anchor);
  let modelIds = d.marker.shape.models.map(model => model.id);

  let organizations: BenchContext[] = d.marker.organizations.map(org => ({
    organizationId: org.organizationId,
    instanceId: org.instanceIds[0]!,
    userIds: org.userIds,
    modelIds,
    now: anchor
  }));

  if (!organizations.length) throw new Error('The marker lists no organizations; seed first.');

  let list: PrepareList = input => client.session.list(input, callOptions);

  let results: QueryResult[] = [];

  for (let query of d.queries) {
    let cold: number[] = [];
    let warm: number[] = [];
    let serverWarm: number[] = [];
    let codes: Record<string, number> = {};
    let errors = 0;
    let rateLimited = 0;

    let run = async (index: number, into: number[]) => {
      let ctx = organizations[index % organizations.length]!;
      let call = await query.build(ctx, list);
      let sample = await measureCall({ client, call, ctx, pace, clock });

      if (sample.kind == 'rate_limited') {
        rateLimited++;
        return;
      }

      if (sample.kind == 'error') {
        errors++;
        codes[sample.code] = (codes[sample.code] ?? 0) + 1;
        return;
      }

      into.push(sample.ms);
      if (into === warm && sample.serverMs !== null) serverWarm.push(sample.serverMs);
    };

    for (let index = 0; index < organizations.length; index++) await run(index, cold);
    for (let index = 0; index < d.repeats; index++) await run(index, warm);

    let warmSummary = summarize(warm);
    let budget = query.budgetP95Ms ?? null;

    results.push({
      name: query.name,
      source: query.source,
      budgetP95Ms: budget,
      coldMs: summarize(cold),
      warmMs: warmSummary,
      serverWarmMs: summarize(serverWarm),
      errors: { count: errors, codes },
      rateLimited,
      pass:
        budget === null
          ? null
          : errors == 0 && rateLimited == 0 && (warmSummary.p95 ?? Infinity) < budget
    });

    d.log(
      `${query.name}: warm p95 ${round(warmSummary.p95, 0)} ms over ${warm.length}${budget ? `, budget ${budget} ms` : ''}${errors ? `, ${errors} errors` : ''}${rateLimited ? `, ${rateLimited} rate-limited samples` : ''}`
    );
  }

  return {
    organizations: organizations.length,
    repeats: d.repeats,
    pacing: `one call at a time (service limit ${maxConcurrentQueries} concurrent); query.run and query.values at most ${d.perMinute} per minute per organization (service limit ${maxQueriesPerMinute}); a 429 is an invalid sample, never a latency; cold = first call of a query on each organization, warm = the repeats that follow; ranges end at the seed's anchor`,
    anchor: anchor.toISOString(),
    ageDays: round((Date.now() - anchor.getTime()) / dayMs, 1)!,
    queries: results,
    pass: results.every(
      result => result.pass !== false && result.errors.count == 0 && result.rateLimited == 0
    )
  };
};
