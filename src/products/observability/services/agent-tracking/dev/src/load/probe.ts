import type { AgentTrackingClient } from '@mtsrc/agent-tracking-api-internal';
import type { Clock } from '../lib/clock';
import { retryAfterMsOf } from '../lib/pace';
import { createSampler, seedOf, stableHex, uuidOf } from '../lib/random';
import { summarize, type Summary } from '../lib/stats';
import { encodeLiveRequest } from './payload';
import type { TrafficProfile } from './profile';
import type { HttpSend } from './run';
import { developerOf, logGroupOf } from './synth';

// 07 §8.6: a session is listed within about a second of its first record, and its summary and
// aggregate queries follow the first throttled settle, about 30 s later. The settle job is delayed
// by exactly 30 s, so those budgets leave 5 s for the settle itself and the polls.
let freshnessBudgets = { listedMs: 1_000, summarizedMs: 35_000, queryableMs: 35_000 };

type ProbeSample = {
  sample: number;
  sentStatus: number;
  listedMs: number | null;
  summarizedMs: number | null;
  queryableMs: number | null;
};

export type ProbeReport = {
  samples: ProbeSample[];
  listedMs: Summary;
  summarizedMs: Summary;
  queryableMs: Summary;
  budgets: typeof freshnessBudgets;
  pass: boolean;
  note: string;
};

// Usage slices are 15-minute buckets selected by their start, so the range has to reach back past
// the start of the probe record's bucket.
let windowMs = 20 * 60_000;

// query.run counts toward the organization's 60 a minute; polling it every 2 s keeps the probe at
// half of that, whatever --poll-ms says for session.list.
let probeQueryIntervalMs = 2_000;

let usageInputTokens = async (d: {
  client: AgentTrackingClient;
  organizationId: string;
  instanceId: string;
  around: number;
}) => {
  let result;

  try {
    result = await d.client.query.run({
      organizationId: d.organizationId,
      scope: { instanceIds: [d.instanceId] },
      query: {
        atq: '0',
        dataset: 'usage',
        range: {
          from: new Date(d.around - windowMs).toISOString(),
          to: new Date(d.around + windowMs).toISOString()
        },
        measures: ['tokens.input'],
        totals: true,
        labels: false
      }
    });
  } catch (error) {
    if (retryAfterMsOf(error) !== null) return null;
    throw error;
  }

  return Number((result.totals as Record<string, unknown> | null)?.['tokens.input'] ?? 0);
};

// Each sample opens a new session on a dedicated probe instance, so any session that starts in
// that instance after the send belongs to the probe.
export let runProbe = async (d: {
  ingestUrl: string;
  key: string;
  client: AgentTrackingClient;
  organizationId: string;
  instanceId: string;
  samples: number;
  timeoutMs: number;
  pollMs: number;
  profile: TrafficProfile;
  seed: number;
  clock: Clock;
  send: HttpSend;
}): Promise<ProbeReport> => {
  let sampler = createSampler(seedOf(d.seed, 'probe'));
  let samples: ProbeSample[] = [];
  let developer = developerOf(d.profile, d.seed, 0);
  let model = d.profile.models[0]!;

  for (let index = 0; index < d.samples; index++) {
    let marker = 900_000_000 + sampler.int(90_000_000);
    let sessionId = uuidOf(d.seed, 'probe-session', index, Date.now());
    let now = Date.now();
    let baseline = await usageInputTokens({ ...d, around: now });

    while (baseline === null) {
      await d.clock.sleep(probeQueryIntervalMs);
      baseline = await usageInputTokens({ ...d, around: now });
    }

    let nextQueryAt = d.clock.now() + probeQueryIntervalMs;

    let request = encodeLiveRequest(
      logGroupOf(developer, [
        {
          timeNs: BigInt(now) * 1_000_000n,
          body: 'claude_code.api_request',
          attributes: {
            'event.name': 'api_request',
            'session.id': sessionId,
            'prompt.id': uuidOf(sessionId, 'prompt'),
            request_id: `req_${stableHex(24, sessionId)}`,
            model: model.id,
            input_tokens: marker,
            output_tokens: 1,
            duration_ms: 1_000
          }
        }
      ]),
      1,
      { format: 'protobuf', compression: 'none' }
    );

    let sentAt = d.clock.now();
    let response = await d.send({
      url: `${d.ingestUrl.replace(/\/+$/, '')}${request.path}`,
      headers: { ...request.headers, authorization: `Bearer ${d.key}` },
      body: request.body,
      timeoutMs: 10_000
    });

    let sample: ProbeSample = {
      sample: index,
      sentStatus: response.status,
      listedMs: null,
      summarizedMs: null,
      queryableMs: null
    };

    while (response.status == 200 && d.clock.now() - sentAt < d.timeoutMs) {
      let elapsed = () => Math.round(d.clock.now() - sentAt);

      if (sample.listedMs === null || sample.summarizedMs === null) {
        let page = await d.client.session.list({
          organizationId: d.organizationId,
          instanceIds: [d.instanceId],
          from: new Date(now - 1_000),
          limit: 10
        });
        let session = page.items[0];

        if (session && sample.listedMs === null) sample.listedMs = elapsed();
        if (
          session?.summary &&
          !session.summaryStale &&
          session.summary.tokens.inputUncached >= marker
        ) {
          sample.summarizedMs ??= elapsed();
        }
      }

      if (sample.queryableMs === null && d.clock.now() >= nextQueryAt) {
        nextQueryAt = d.clock.now() + probeQueryIntervalMs;

        let total = await usageInputTokens({ ...d, around: now });
        if (total !== null && total - baseline >= marker) sample.queryableMs = elapsed();
      }

      if (
        sample.listedMs !== null &&
        sample.summarizedMs !== null &&
        sample.queryableMs !== null
      ) {
        break;
      }

      await d.clock.sleep(d.pollMs);
    }

    samples.push(sample);
  }

  let values = (key: 'listedMs' | 'summarizedMs' | 'queryableMs') =>
    samples.flatMap(sample => (sample[key] === null ? [] : [sample[key]!]));

  let listed = summarize(values('listedMs'));
  let summarized = summarize(values('summarizedMs'));
  let queryable = summarize(values('queryableMs'));
  let complete = samples.every(
    sample =>
      sample.listedMs !== null && sample.summarizedMs !== null && sample.queryableMs !== null
  );

  return {
    samples,
    listedMs: listed,
    summarizedMs: summarized,
    queryableMs: queryable,
    budgets: freshnessBudgets,
    pass:
      complete &&
      (listed.max ?? Infinity) <= freshnessBudgets.listedMs &&
      (summarized.max ?? Infinity) <= freshnessBudgets.summarizedMs &&
      (queryable.max ?? Infinity) <= freshnessBudgets.queryableMs,
    note: `Delays are measured from the send to the first poll that saw the record, so they are accurate to the poll interval (${d.pollMs} ms for the list, ${probeQueryIntervalMs} ms for usage; a 429 counts as not yet). Budgets from 07 §8.6.`
  };
};
