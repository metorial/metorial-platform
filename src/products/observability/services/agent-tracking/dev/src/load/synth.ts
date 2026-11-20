import type { Tokens } from '@mtsrc/agent-tracking-cost';
import type { Group, LogDesc } from '@mtsrc/agent-tracking-testing';
import { createSampler, seedOf, stableHex, uuidOf, type Sampler } from '../lib/random';
import type { ModelProfile, TrafficProfile } from './profile';

export type ExpectedRecord =
  | {
      type: 'model.request';
      outcome: 'ok';
      model: string;
      tokens: Tokens;
      costUsd: number;
    }
  | { type: 'model.request'; outcome: 'error'; model: string }
  | { type: 'tool.call' | 'tool.decision' | 'prompt.submitted' };

type SyntheticEvent = { log: LogDesc; expected: ExpectedRecord };

export type Developer = {
  index: number;
  email: string;
  accountUuid: string;
  installId: string;
  clientVersion: string;
};

type SyntheticBatch = {
  group: Group<LogDesc>;
  expected: ExpectedRecord[];
  developer: Developer;
  sessionId: string;
};

let scopeName = 'com.anthropic.claude_code.events';

let microsPerDollar = 1_000_000;

export let developerOf = (profile: TrafficProfile, seed: number, index: number): Developer => {
  let sampler = createSampler(seedOf(seed, 'developer', index));
  let label = String(index + 1).padStart(4, '0');

  return {
    index,
    email: `dev-${label}@${profile.identityDomain}`,
    accountUuid: uuidOf(seed, 'account', index),
    installId: stableHex(64, seed, 'install', index),
    clientVersion: sampler.pick(profile.clientVersions)
  };
};

export let costOf = (model: ModelProfile, tokens: Omit<Tokens, 'reasoning'>) => {
  let price = model.usdPerMillion;
  let micros =
    tokens.inputUncached * price.input +
    tokens.output * price.output +
    tokens.cacheRead * price.cacheRead +
    tokens.cacheWrite * price.cacheWrite;

  return Math.round(micros) / microsPerDollar;
};

let resourceOf = (developer: Developer) => ({
  attributes: {
    'service.name': 'claude-code',
    'service.version': developer.clientVersion,
    'user.id': developer.installId,
    'user.account_uuid': developer.accountUuid,
    'user.email': developer.email,
    'terminal.type': 'loadtest'
  }
});

export let logGroupOf = (developer: Developer, items: LogDesc[]): Group<LogDesc> => ({
  resource: resourceOf(developer),
  scope: { name: scopeName, version: developer.clientVersion },
  items
});

// Claude Code's event stream for one session, in order. Attributes are the ones the dialect reads
// (07, 08); nothing that would be content (prompt text, tool input, paths) is ever set.
function* sessionEvents(d: {
  profile: TrafficProfile;
  sampler: Sampler;
  sessionId: string;
  clock: () => number;
}): Generator<SyntheticEvent> {
  let { profile, sampler, sessionId } = d;
  let model = sampler.weighted(
    profile.models.map(item => ({ value: item, weight: item.weight }))
  );
  let turns = sampler.count(profile.turnsPerSession);
  let sequence = 0;

  let base = (eventName: string, promptId: string) => ({
    'event.name': eventName,
    'event.sequence': ++sequence,
    'session.id': sessionId,
    'prompt.id': promptId
  });

  let log = (eventName: string, attributes: Record<string, LogDesc['body']>): LogDesc => ({
    timeNs: BigInt(Math.floor(d.clock())) * 1_000_000n,
    body: `claude_code.${eventName}`,
    attributes: attributes as LogDesc['attributes']
  });

  for (let turn = 0; turn < turns; turn++) {
    let promptId = uuidOf(sessionId, 'prompt', turn);

    yield {
      log: log('user_prompt', {
        ...base('user_prompt', promptId),
        prompt_length: sampler.count({ median: 180, p90: 1_200, min: 1, max: 50_000 })
      }),
      expected: { type: 'prompt.submitted' }
    };

    let requests = sampler.count(profile.requestsPerTurn);

    for (let request = 0; request < requests; request++) {
      let requestId = `req_${stableHex(24, sessionId, turn, request)}`;
      let duration = sampler.count(profile.requestDurationMs);

      if (sampler.bool(profile.apiErrorRate)) {
        yield {
          log: log('api_error', {
            ...base('api_error', promptId),
            request_id: requestId,
            model: model.id,
            status_code: sampler.pick([429, 500, 529]),
            attempt: 1,
            duration_ms: duration
          }),
          expected: { type: 'model.request', outcome: 'error', model: model.id }
        };
        continue;
      }

      let tokens: Tokens = {
        inputUncached: sampler.count(profile.tokens.inputUncached),
        cacheRead: sampler.count(profile.tokens.cacheRead),
        cacheWrite: sampler.count(profile.tokens.cacheWrite),
        output: sampler.count(profile.tokens.output),
        reasoning: 0
      };
      let costUsd = costOf(model, tokens);

      yield {
        log: log('api_request', {
          ...base('api_request', promptId),
          request_id: requestId,
          model: model.id,
          input_tokens: tokens.inputUncached,
          cache_read_tokens: tokens.cacheRead,
          cache_creation_tokens: tokens.cacheWrite,
          output_tokens: tokens.output,
          cost_usd: { double: costUsd },
          duration_ms: duration,
          query_source: 'repl_main_thread'
        }),
        expected: { type: 'model.request', outcome: 'ok', model: model.id, tokens, costUsd }
      };

      if (!sampler.bool(profile.toolCallProbability)) continue;

      let calls = sampler.count(profile.toolCallsWhenUsed);

      for (let call = 0; call < calls; call++) {
        let toolUseId = `toolu_${stableHex(24, sessionId, turn, request, call)}`;
        let tool = sampler.weighted(profile.tools);

        if (sampler.bool(profile.toolDecisionShare)) {
          yield {
            log: log('tool_decision', {
              ...base('tool_decision', promptId),
              tool_use_id: toolUseId,
              tool_name: tool,
              decision: 'accept',
              source: sampler.pick(['config', 'user_temporary', 'user_permanent'])
            }),
            expected: { type: 'tool.decision' }
          };
        }

        yield {
          log: log('tool_result', {
            ...base('tool_result', promptId),
            tool_use_id: toolUseId,
            tool_name: tool,
            success: sampler.bool(0.97) ? 'true' : 'false',
            duration_ms: sampler.count(profile.toolDurationMs),
            tool_result_size_bytes: sampler.count({
              median: 2_000,
              p90: 40_000,
              max: 1_000_000
            })
          }),
          expected: { type: 'tool.call' }
        };
      }
    }
  }
}

type ActiveSession = {
  developer: Developer;
  sessionId: string;
  events: Generator<SyntheticEvent>;
};

export type BatchStream = { next: () => SyntheticBatch };

// A fleet of developers, each with one Claude Code session open at a time. Each export carries
// events from one session, the way one client process batches its own log records.
export let createBatchStream = (d: {
  profile: TrafficProfile;
  seed: number;
  developers?: number;
  sessions?: number;
  clock: () => number;
}): BatchStream => {
  let { profile, seed } = d;
  let developers = d.developers ?? profile.developers;
  let slots = Math.max(1, d.sessions ?? developers);
  let sampler = createSampler(seedOf(seed, 'stream'));
  let sessionCount = 0;

  let openSession = (developerIndex: number): ActiveSession => {
    let sessionNumber = sessionCount++;
    let sessionId = uuidOf(seed, 'session', sessionNumber);

    return {
      developer: developerOf(profile, seed, developerIndex),
      sessionId,
      events: sessionEvents({
        profile,
        sampler: createSampler(seedOf(seed, 'session', sessionNumber)),
        sessionId,
        clock: d.clock
      })
    };
  };

  let active: ActiveSession[] = Array.from({ length: slots }, (_, slot) =>
    openSession(slot % developers)
  );

  let next = (): SyntheticBatch => {
    let slot = sampler.int(active.length);
    let size = Math.max(1, sampler.count(profile.recordsPerExport));
    let events: SyntheticEvent[] = [];

    while (events.length < size) {
      let session = active[slot]!;
      let step = session.events.next();

      if (step.done) {
        if (events.length) break;
        active[slot] = openSession(sampler.int(developers));
        continue;
      }

      events.push(step.value);
    }

    let session = active[slot]!;

    return {
      group: logGroupOf(
        session.developer,
        events.map(event => event.log)
      ),
      expected: events.map(event => event.expected),
      developer: session.developer,
      sessionId: session.sessionId
    };
  };

  return { next };
};
