import { describe, expect, it } from 'vitest';
import {
  addStats,
  createEventReader,
  describeStats,
  emptyStats
} from '../src/reconcile/agentEvents';
import {
  createLogger,
  formatCost,
  formatDuration,
  formatTokens,
  shorten
} from '../src/reconcile/log';
import { createWebSearch } from '../src/reconcile/webSearch';

let toolStart = (id: string, toolName: string, args: Record<string, unknown>) =>
  JSON.stringify({ type: 'tool_execution_start', toolCallId: id, toolName, args });

let toolEnd = (id: string, toolName: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'tool_execution_end',
    toolCallId: id,
    toolName,
    durationMs: 12,
    isError: false,
    result: { content: [{ type: 'text', text: 'ok' }] },
    ...extra
  });

let assistantEnd = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'message_end',
    message: {
      role: 'assistant',
      stopReason: 'stop',
      durationMs: 65_000,
      usage: {
        input: 12_345,
        output: 800,
        cacheRead: 2_000,
        reasoning: 300,
        cost: { total: 0.0421 }
      },
      content: [{ type: 'text', text: 'first decision\n\nsecond decision' }],
      ...extra
    }
  });

let collect = () => {
  let lines: string[] = [];
  let transcript: string[] = [];
  let time = 0;
  let reader = createEventReader({
    log: line => lines.push(line),
    transcript: text => transcript.push(text),
    now: () => time
  });

  return { lines, transcript, reader, advance: (ms: number) => (time += ms) };
};

describe('log helpers', () => {
  it('formats durations, tokens and costs compactly', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59_400)).toBe('59s');
    expect(formatDuration(65_000)).toBe('1m05s');
    expect(formatDuration(3_725_000)).toBe('1h02m05s');
    expect(formatDuration(-5)).toBe('0s');

    expect(formatTokens(900)).toBe('900');
    expect(formatTokens(1_500)).toBe('1.5k');
    expect(formatTokens(45_000)).toBe('45k');

    expect(formatCost(0.0421)).toBe('$0.042');
    expect(formatCost(3.456)).toBe('$3.46');
  });

  it('shortens text onto one line', () => {
    expect(shorten('a\n  b\tc', 20)).toBe('a b c');
    expect(shorten('x'.repeat(30), 10)).toBe(`${'x'.repeat(9)}…`);
  });

  it('prefixes every line with the elapsed time and indents continuation lines', () => {
    let written: string[] = [];
    let log = createLogger(Date.now() - 65_000, line => written.push(line));

    log('first\nsecond');

    expect(written).toHaveLength(2);
    expect(written[0]).toMatch(/^\[  1m0[5-6]s\] first$/);
    expect(written[1]).toBe(`${' '.repeat(10)}second`);
  });
});

describe('agent event reader', () => {
  it('logs each tool call with its arguments and duration', () => {
    let { lines, reader } = collect();

    reader.push(
      toolStart('1', 'grep', { pattern: 'gpt-4o', path: 'overrides', ignored: 'x' })
    );
    reader.push(toolEnd('1', 'grep'));

    expect(lines).toEqual(['  ↳ grep gpt-4o path=overrides  12ms']);
    expect(reader.stats.toolCalls).toBe(1);
    expect(reader.stats.toolErrors).toBe(0);
  });

  it('keeps the end of long paths', () => {
    let { lines, reader } = collect();
    let long = `${'../'.repeat(20)}private/tmp/work/overrides/offerings/zhipu.json`;

    reader.push(toolStart('1', 'read', { path: long }));
    reader.push(toolEnd('1', 'read'));

    expect(lines[0]).toMatch(/^ {2}↳ read …\S+zhipu\.json {2}12ms$/);
    expect(lines[0]!.length).toBeLessThan(120);
  });

  it('shows the error text of failed tools and counts them', () => {
    let { lines, reader } = collect();

    reader.push(toolStart('1', 'read', { path: 'missing.json' }));
    reader.push(
      toolEnd('1', 'read', {
        isError: true,
        result: { content: [{ type: 'text', text: 'ENOENT: no such file' }] }
      })
    );

    expect(lines[0]).toContain('✗ read missing.json');
    expect(lines[0]).toContain('ENOENT: no such file');
    expect(reader.stats.toolErrors).toBe(1);
  });

  it('logs usage per turn and the closing message line by line', () => {
    let { lines, transcript, reader } = collect();

    reader.push(assistantEnd());

    expect(lines[0]).toBe(
      'turn 1  1m05s  in 12k (2.0k cached) out 800 (reasoning 300)  $0.042'
    );
    expect(lines.slice(1)).toEqual(['  says: first decision', '  says: second decision']);
    expect(transcript).toContain('assistant\nfirst decision\n\nsecond decision');
    expect(reader.stats).toMatchObject({
      turns: 1,
      inputTokens: 12_345,
      outputTokens: 800,
      cachedTokens: 2_000,
      reasoningTokens: 300
    });
    expect(reader.stats.cost).toBeCloseTo(0.0421);
  });

  it('does not echo intermediate assistant text that precedes tool calls', () => {
    let { lines, reader } = collect();

    reader.push(assistantEnd({ stopReason: 'toolUse' }));

    expect(lines).toHaveLength(1);
  });

  it('flags a failed turn', () => {
    let { lines, reader } = collect();

    reader.push(
      assistantEnd({ stopReason: 'error', errorMessage: 'upstream 503', content: [] })
    );

    expect(lines[0]).toContain('FAILED: upstream 503');
  });

  it('passes non-json output through and survives broken json', () => {
    let { lines, transcript, reader } = collect();

    reader.push('warning: something odd');
    reader.push('{"type": "tool_exec');
    reader.push('');

    expect(lines).toEqual(['  pi: warning: something odd', '  pi: {"type": "tool_exec']);
    expect(transcript[0]).toBe('output\nwarning: something odd');
  });

  it('reports what the agent is doing and how long it has been quiet', () => {
    let { reader, advance } = collect();

    advance(10_000);
    reader.push(toolStart('1', 'grep', { pattern: 'claude' }));
    advance(95_000);

    let heartbeat = reader.heartbeat();
    expect(heartbeat).toContain('working 1m45s');
    expect(heartbeat).toContain('last event 1m35s ago (grep claude)');
    expect(heartbeat).toContain('1 tool calls');
  });
});

describe('agent stats', () => {
  it('adds and describes usage', () => {
    let total = addStats(
      {
        ...emptyStats(),
        turns: 2,
        toolCalls: 5,
        toolErrors: 1,
        inputTokens: 20_000,
        cost: 0.5
      },
      { ...emptyStats(), turns: 1, toolCalls: 2, outputTokens: 1_200, cost: 0.25 }
    );

    expect(total).toMatchObject({
      turns: 3,
      toolCalls: 7,
      toolErrors: 1,
      outputTokens: 1_200
    });
    expect(describeStats(total)).toBe(
      '3 turns · 7 tool calls (1 failed) · 20k in (0 cached) / 1.2k out · $0.750'
    );
  });
});

describe('web search logging', () => {
  let options = { accountId: 'acct', apiToken: 'token', provider: 'linkup' as const };

  let withFetch = async (
    respond: () => Response | Promise<Response>,
    run: () => Promise<void>
  ) => {
    let original = globalThis.fetch;
    globalThis.fetch = (async () => respond()) as unknown as typeof fetch;

    try {
      await run();
    } finally {
      globalThis.fetch = original;
    }
  };

  it('logs failed attempts, then stops after the first few', async () => {
    let lines: string[] = [];

    await withFetch(
      () => new Response('boom', { status: 502 }),
      async () => {
        let search = createWebSearch({ ...options, log: line => lines.push(line) });

        for (let index = 0; index < 8; index++) await search(`query ${index}`);
      }
    );

    expect(lines[0]).toBe('web search: HTTP 502 (attempt 1/2) for "query 0"');
    expect(lines[1]).toBe('web search: HTTP 502 (attempt 2/2) for "query 0"');
    expect(lines.filter(line => line.includes('HTTP 502'))).toHaveLength(10);
    expect(lines.filter(line => line.includes('not logging'))).toHaveLength(1);
  });

  it('says why searching stopped', async () => {
    let lines: string[] = [];

    await withFetch(
      () => Response.json({ error: { code: 'web_search_payment_required' } }, { status: 402 }),
      async () => {
        let search = createWebSearch({ ...options, log: line => lines.push(line) });
        await search('a');
      }
    );

    expect(lines).toEqual([
      'web search: stopping for this run, HTTP 402 web_search_payment_required'
    ]);
  });

  it('logs network errors', async () => {
    let lines: string[] = [];

    await withFetch(
      () => {
        throw new Error('connection reset');
      },
      async () => {
        let search = createWebSearch({ ...options, log: line => lines.push(line) });
        await search('a');
      }
    );

    expect(lines[0]).toBe('web search: connection reset (attempt 1/2) for "a"');
  });
});
