import type { BulkResponse } from '@mtsrc/agent-tracking-spec';
import { zstdCompressSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { setRuntime } from '@mtsrc/agent-tracking-module-ingest';
import { setRecordSink } from '@mtsrc/agent-tracking-module-records';
import { createPipeline, errorBody, fixedNow, ndjson } from './pipeline';

let sentinel = 'SENTINEL-bulk-7f3a';

let path = '/v1/bulk';

let header = (overrides: Record<string, unknown> = {}) => ({
  batch_id: 'batch-1',
  mode: 'live',
  sent_at: '2026-06-15T12:00:00Z',
  agent: { name: 'metorial-agent', version: '1.2.3', install_id: 'install-1' },
  ...overrides
});

let item = (overrides: Record<string, unknown> = {}) => ({
  client: 'claude-code',
  channel: 'hook',
  dialect: 'claude-code.hooks.v1',
  source: { kind: 'transcript', ref: 'file-1', seq: 1 },
  payload: {
    session_id: 'session-1',
    hook_event_name: 'UserPromptSubmit',
    prompt: `fix ${sentinel}`
  },
  ...overrides
});

let isoMinus = (days: number, extraMs = 0) =>
  new Date(fixedNow.getTime() - days * 86_400_000 + extraMs).toISOString();

let send = async (
  pipeline: ReturnType<typeof createPipeline>,
  body: string | Uint8Array,
  options: { gzip?: boolean; headers?: Record<string, string> } = {}
) =>
  pipeline.send(path, {
    contentType: 'application/x-ndjson',
    body,
    ...options
  });

let sendOk = async (pipeline: ReturnType<typeof createPipeline>, ...lines: unknown[]) => {
  let response = await send(pipeline, ndjson(...lines));

  expect(response.status).toBe(200);

  return (await response.json()) as BulkResponse;
};

afterEach(() => {
  setRuntime(undefined);
  setRecordSink(undefined);
});

describe('bulk handler', () => {
  describe('batch header', () => {
    it('accepts a batch with only a header', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header());

      expect(result).toEqual({
        batch_id: 'batch-1',
        accepted: 0,
        rejected: 0,
        rejections: []
      });
      expect(pipeline.records()).toHaveLength(0);
    });

    it.each([
      ['an empty body', ''],
      ['a blank first line', '\n'],
      ['a non-json header', 'nope\n'],
      ['an array header', '[]\n'],
      [
        'a header without batch_id',
        JSON.stringify({ ...header(), batch_id: undefined }) + '\n'
      ],
      ['an unknown mode', JSON.stringify(header({ mode: 'replay' })) + '\n'],
      ['a missing agent', JSON.stringify({ ...header(), agent: undefined }) + '\n'],
      ['a numeric batch_id', JSON.stringify(header({ batch_id: 7 })) + '\n'],
      ['an empty batch_id', JSON.stringify(header({ batch_id: '' })) + '\n'],
      ['a blank batch_id', JSON.stringify(header({ batch_id: '   ' })) + '\n'],
      ['a long batch_id', JSON.stringify(header({ batch_id: 'b'.repeat(129) })) + '\n'],
      ['a control character', JSON.stringify(header({ batch_id: 'a\u0007b' })) + '\n'],
      ['a non-ascii batch_id', JSON.stringify(header({ batch_id: 'bätch' })) + '\n'],
      ['an invalid sent_at', JSON.stringify(header({ sent_at: 'today' })) + '\n'],
      [
        'a sent_at without a zone',
        JSON.stringify(header({ sent_at: '2026-06-15T12:00:00' })) + '\n'
      ],
      [
        'a long agent name',
        JSON.stringify(
          header({ agent: { name: 'n'.repeat(129), version: '1', install_id: 'i' } })
        ) + '\n'
      ],
      ['an oversized header', JSON.stringify(header({ extra: 'x'.repeat(5000) })) + '\n']
    ])('rejects %s', async (_name, body) => {
      let pipeline = createPipeline();

      let response = await send(pipeline, body);

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_batch_header');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('does not process items after an invalid header', async () => {
      let pipeline = createPipeline();

      let response = await send(pipeline, ndjson(header({ mode: 'nope' }), item()));

      expect(response.status).toBe(400);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('accepts a header with extra fields', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header({ extra: 'ignored' }), item());

      expect(result.accepted).toBe(1);
    });

    it('accepts windows line endings', async () => {
      let pipeline = createPipeline();

      let body = [JSON.stringify(header()), JSON.stringify(item())].join('\r\n') + '\r\n';
      let response = await send(pipeline, body);

      expect(response.status).toBe(200);
      expect(((await response.json()) as BulkResponse).accepted).toBe(1);
    });
  });

  describe('accepting items', () => {
    it('maps a payload item into a record', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), item());
      let [record] = pipeline.records();

      expect(result).toMatchObject({ accepted: 1, rejected: 0, rejections: [] });
      expect(pipeline.records()).toHaveLength(1);
      expect(record!.type).toBe('prompt.submitted');
      expect(record!.source).toMatchObject({
        channel: 'hook',
        dialect: 'claude-code.hooks.v1'
      });
      expect(record!.ingest).toMatchObject({
        route: 'bulk',
        organization_id: 'ator_test',
        instance_id: 'atin_test',
        batch_id: 'batch-1',
        agent: { name: 'metorial-agent', version: '1.2.3', install_id: 'install-1' }
      });
    });

    it('accepts payload_line as an encoded payload', async () => {
      let pipeline = createPipeline();

      let { payload, ...rest } = item();
      let result = await sendOk(pipeline, header(), {
        ...rest,
        payload_line: JSON.stringify(payload)
      });

      expect(result.accepted).toBe(1);
      expect(pipeline.records()[0]!.type).toBe('prompt.submitted');
    });

    it('produces the same record from payload and payload_line', async () => {
      let first = createPipeline();
      let second = createPipeline();

      let { payload, ...rest } = item();

      await sendOk(first, header(), item());
      await sendOk(second, header(), { ...rest, payload_line: JSON.stringify(payload) });

      let strip = (records: ReturnType<typeof first.records>) =>
        records.map(record => ({
          ...record,
          ingest: { ...record.ingest, request_id: undefined }
        }));

      expect(strip(second.records())).toEqual(strip(first.records()));
    });

    it('never stores content in basic mode', async () => {
      let pipeline = createPipeline();

      await sendOk(pipeline, header(), item());

      expect(JSON.stringify(pipeline.records())).not.toContain(sentinel);
    });

    it('keeps content only in content entries in full mode', async () => {
      let pipeline = createPipeline({ contentPolicy: { defaultMode: 'full' } });

      await sendOk(pipeline, header(), item());

      let [record] = pipeline.records();

      expect(record!.content.some(entry => entry.text?.includes(sentinel))).toBe(true);
      expect(JSON.stringify({ ...record, content: [] })).not.toContain(sentinel);
    });

    it('handles several items and clients in one batch', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(
        pipeline,
        header(),
        item({ source: { kind: 'transcript', ref: 'f', seq: 1 } }),
        item({ source: { kind: 'transcript', ref: 'f', seq: 2 } }),
        item({
          client: 'codex',
          dialect: 'codex.hooks.v1',
          source: { kind: 'rollout', ref: 'r', seq: 1 }
        })
      );

      expect(result.accepted).toBe(3);
      expect(pipeline.records()).toHaveLength(3);
      expect(new Set(pipeline.records().map(record => record.source.dialect)).size).toBe(2);
    });

    it('normalizes the client spelling', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), item({ client: 'Claude_Code' }));

      expect(result.accepted).toBe(1);
      expect(pipeline.records()[0]!.client.family).toBe('claude-code');
    });

    it('skips blank lines without shifting indexes', async () => {
      let pipeline = createPipeline();
      let body = [
        JSON.stringify(header()),
        '',
        JSON.stringify(item()),
        '   ',
        'broken',
        '',
        JSON.stringify(item({ source: { kind: 'transcript', ref: 'x', seq: 2 } }))
      ].join('\n');

      let response = await send(pipeline, body);
      let result = (await response.json()) as BulkResponse;

      expect(result.accepted).toBe(2);
      expect(result.rejections).toEqual([
        { i: 1, code: 'parse_error', detail: 'The line is not a JSON object.' }
      ]);
    });

    it('accepts gzip and zstd bodies', async () => {
      let gzipped = createPipeline();
      let zstded = createPipeline();
      let body = ndjson(header(), item());

      let first = await send(gzipped, body, { gzip: true });
      let second = await send(zstded, new Uint8Array(zstdCompressSync(Buffer.from(body))), {
        headers: { 'content-encoding': 'zstd' }
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(gzipped.records()).toHaveLength(1);
      expect(zstded.records()).toHaveLength(1);
    });

    it('handles multi-byte characters across lines', async () => {
      let pipeline = createPipeline({ contentPolicy: { defaultMode: 'full' } });

      let result = await sendOk(
        pipeline,
        header(),
        item({
          payload: {
            hook_event_name: 'UserPromptSubmit',
            session_id: 's',
            prompt: '日本語 🚀 émoji'
          }
        })
      );

      expect(result.accepted).toBe(1);
      expect(
        pipeline.records()[0]!.content.some(entry => entry.text == '日本語 🚀 émoji')
      ).toBe(true);
    });
  });

  describe('lanes and time', () => {
    it('writes live batches to the live lane', async () => {
      let pipeline = createPipeline();

      await sendOk(pipeline, header(), item());

      expect(pipeline.sink.list()[0]!.lane).toBe('live');
      expect(pipeline.records()[0]!.ingest.backfill).toBe(false);
    });

    it('writes backfill batches to the backfill lane', async () => {
      let pipeline = createPipeline();

      await sendOk(pipeline, header({ mode: 'backfill' }), item({ observed_at: isoMinus(2) }));

      expect(pipeline.sink.list()[0]!.lane).toBe('backfill');
      expect(pipeline.records()[0]!.ingest.backfill).toBe(true);
    });

    it('uses observed_at as the event time', async () => {
      let pipeline = createPipeline();
      let observed = isoMinus(3);

      await sendOk(pipeline, header({ mode: 'backfill' }), item({ observed_at: observed }));

      let [record] = pipeline.records();

      expect(record!.occurred_at).toBe(observed);
      expect(record!.quality.time_source).toBe('agent_observed');
      expect(record!.quality.warnings).not.toContain('clock_skew');
    });

    it('warns about clock skew for live items far from arrival', async () => {
      let pipeline = createPipeline();

      await sendOk(pipeline, header(), item({ observed_at: isoMinus(0, -3_600_000) }));

      expect(pipeline.records()[0]!.quality.warnings).toContain('clock_skew');
    });

    it('marks live items without a time as time_unknown', async () => {
      let pipeline = createPipeline();

      await sendOk(pipeline, header(), item());

      expect(pipeline.records()[0]!.quality.warnings).toContain('time_unknown');
    });

    it('requires observed_at in backfill batches', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header({ mode: 'backfill' }), item());

      expect(result.accepted).toBe(0);
      expect(result.rejections).toEqual([
        { i: 0, code: 'parse_error', detail: 'observed_at is required in backfill mode.' }
      ]);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects an invalid observed_at in any mode', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), item({ observed_at: 'whenever' }));

      expect(result.rejections[0]).toMatchObject({ code: 'parse_error' });
    });

    it('rejects backfill items from the future', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(
        pipeline,
        header({ mode: 'backfill' }),
        item({ observed_at: isoMinus(0, 301_000) }),
        item({
          observed_at: isoMinus(0, 299_000),
          source: { kind: 'transcript', ref: 'ok', seq: 1 }
        })
      );

      expect(result.accepted).toBe(1);
      expect(result.rejections).toEqual([
        { i: 0, code: 'parse_error', detail: 'observed_at is in the future.' }
      ]);
    });

    it('rejects backfill items older than the retention window', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(
        pipeline,
        header({ mode: 'backfill' }),
        item({ observed_at: isoMinus(30, -1000) }),
        item({
          observed_at: isoMinus(30, 1000),
          source: { kind: 'transcript', ref: 'ok', seq: 1 }
        })
      );

      expect(result.accepted).toBe(1);
      expect(result.rejections).toEqual([{ i: 0, code: 'too_old' }]);
    });

    it('falls back to the record retention when the instance sets no age limit', async () => {
      let pipeline = createPipeline({
        instance: { backfillMaxAgeDays: null, recordRetentionDays: 60 }
      });

      let result = await sendOk(
        pipeline,
        header({ mode: 'backfill' }),
        item({ observed_at: isoMinus(60, -1000) }),
        item({
          observed_at: isoMinus(60, 1000),
          source: { kind: 'transcript', ref: 'ok', seq: 1 }
        })
      );

      expect(result.accepted).toBe(1);
      expect(result.rejections).toEqual([{ i: 0, code: 'too_old' }]);
    });

    it('does not apply the age limit to live batches', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), item({ observed_at: isoMinus(400) }));

      expect(result.accepted).toBe(1);
    });
  });

  describe('rejections', () => {
    it.each([
      ['unknown_client', { client: 'mystery-agent' }],
      ['unknown_client', { client: 'bad client!' }],
      ['unknown_dialect', { dialect: 'claude-code.hooks.v9' }],
      ['unknown_dialect', { channel: 'otlp.logs' }],
      ['parse_error', { source: { kind: 'k' } }],
      ['parse_error', { source: { kind: 'k', ref: 'r', seq: -1 } }],
      ['parse_error', { source: { kind: 'k', ref: 'r', seq: 1.5 } }],
      ['parse_error', { source: { kind: 'k'.repeat(129), ref: 'r' } }],
      ['parse_error', { source: { kind: 'k', ref: 'r'.repeat(513) } }],
      ['parse_error', { payload: 'text' }],
      ['parse_error', { payload: [] }],
      ['parse_error', { payload_line: '{"a":1}' }],
      ['parse_error', { payload: undefined }],
      ['parse_error', { payload: undefined, payload_line: '[1]' }],
      ['parse_error', { payload: undefined, payload_line: 'not json' }],
      ['parse_error', { client: 5 }]
    ] as const)('rejects an item as %s (%j)', async (code, overrides) => {
      let pipeline = createPipeline();

      let result = await sendOk(
        pipeline,
        header(),
        item(overrides as Record<string, unknown>)
      );

      expect(result.accepted).toBe(0);
      expect(result.rejected).toBe(1);
      expect(result.rejections[0]).toMatchObject({ i: 0, code });
      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects clients the token may not use', async () => {
      let pipeline = createPipeline({ allowedClients: ['codex'] });

      let result = await sendOk(pipeline, header(), item());

      expect(result.rejections).toEqual([{ i: 0, code: 'not_allowed' }]);
    });

    it('rejects channels the token may not use', async () => {
      let pipeline = createPipeline({ allowedChannels: ['otlp.logs'] });

      let result = await sendOk(pipeline, header(), item());

      expect(result.rejections).toEqual([{ i: 0, code: 'not_allowed' }]);
    });

    it('rejects oversized items without affecting others', async () => {
      let pipeline = createPipeline();

      let big = item({ payload: { prompt: 'a'.repeat(1024 * 1024 + 1) } });
      let result = await sendOk(pipeline, header(), big, item());

      expect(result.accepted).toBe(1);
      expect(result.rejections).toEqual([{ i: 0, code: 'too_large' }]);
    });

    it('keeps accepting after a rejection and reports the right index', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(
        pipeline,
        header(),
        item({ source: { kind: 'k', ref: 'a', seq: 1 } }),
        'garbage',
        item({ source: { kind: 'k', ref: 'b', seq: 1 } }),
        item({ client: 'nope' })
      );

      expect(result.accepted).toBe(2);
      expect(result.rejected).toBe(2);
      expect(result.rejections.map(rejection => rejection.i)).toEqual([1, 3]);
    });

    it('never echoes item values in rejection details', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(
        pipeline,
        header(),
        item({ client: { secret: sentinel } }),
        item({ payload: sentinel }),
        item({ observed_at: sentinel }),
        `not json ${sentinel}`
      );

      expect(result.rejected).toBe(4);
      expect(JSON.stringify(result)).not.toContain(sentinel);
    });

    it('caps the listed rejections but counts them all', async () => {
      let pipeline = createPipeline();
      let lines = Array.from({ length: 1500 }, () => 'garbage');

      let response = await send(pipeline, ndjson(header(), ...lines));
      let result = (await response.json()) as BulkResponse;

      expect(result.rejected).toBe(1500);
      expect(result.rejections).toHaveLength(1000);
      expect(result.rejections[999]!.i).toBe(999);
    });

    it('limits the detail length', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), item({ ['k'.repeat(500)]: 1, client: 1 }));

      for (let rejection of result.rejections) {
        expect((rejection.detail ?? '').length).toBeLessThanOrEqual(160);
      }
    });

    it('survives hostile payloads', async () => {
      let pipeline = createPipeline();

      let hostile = '{"__proto__":{"polluted":true},"hook_event_name":"Stop"}';

      let result = await sendOk(
        pipeline,
        header(),
        item({ payload: undefined, payload_line: hostile })
      );

      expect(result.accepted).toBe(1);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe('idempotency', () => {
    it('derives the same ids when a batch is resent', async () => {
      let pipeline = createPipeline();

      await sendOk(pipeline, header(), item());
      let first = pipeline.records()[0]!.id;

      await sendOk(pipeline, header({ batch_id: 'batch-2' }), item());

      expect(pipeline.records().map(record => record.id)).toEqual([first, first]);
    });

    it('derives different ids for different sequence numbers', async () => {
      let pipeline = createPipeline();

      await sendOk(
        pipeline,
        header(),
        item({ source: { kind: 'k', ref: 'r', seq: 1 } }),
        item({ source: { kind: 'k', ref: 'r', seq: 2 } })
      );

      let [first, second] = pipeline.records();

      expect(first!.id).not.toBe(second!.id);
    });

    it('collapses duplicate items inside one request', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), item(), item());

      expect(result.accepted).toBe(2);
      expect(pipeline.records()).toHaveLength(1);
    });

    it('keeps organizations apart', async () => {
      let first = createPipeline({ organization: { id: 'ator_a' } });
      await sendOk(first, header(), item());
      let firstId = first.records()[0]!.id;

      let second = createPipeline({ organization: { id: 'ator_b' } });
      await sendOk(second, header(), item());

      expect(second.records()[0]!.id).not.toBe(firstId);
    });

    it('ties the identity to the source, not the payload', async () => {
      let pipeline = createPipeline();

      await sendOk(pipeline, header(), item());
      await sendOk(
        pipeline,
        header(),
        item({
          payload: {
            session_id: 'session-1',
            hook_event_name: 'UserPromptSubmit',
            prompt: 'edited'
          }
        })
      );

      let [first, second] = pipeline.records();

      expect(first!.id).toBe(second!.id);
    });
  });

  describe('limits and structure', () => {
    let tiny = (seq: number) => ({
      client: 'codex',
      channel: 'hook',
      dialect: 'codex.hooks.v1',
      source: { kind: 'k', ref: 'r', seq },
      payload: {}
    });

    it('accepts exactly the item limit', async () => {
      let pipeline = createPipeline();
      let lines = Array.from({ length: 20_000 }, (_, seq) => tiny(seq));

      let response = await send(pipeline, ndjson(header(), ...lines));

      expect(response.status).toBe(200);
      expect(((await response.json()) as BulkResponse).accepted).toBe(20_000);
      expect(pipeline.records()).toHaveLength(20_000);
    });

    it('rejects more items than the limit without writing anything', async () => {
      let pipeline = createPipeline();
      let lines = Array.from({ length: 20_001 }, (_, seq) => tiny(seq));

      let response = await send(pipeline, ndjson(header(), ...lines));

      expect(response.status).toBe(413);
      expect((await errorBody(response)).code).toBe('too_many_items');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('does not count blank lines as items', async () => {
      let pipeline = createPipeline();
      let lines = [JSON.stringify(header()), ...Array.from({ length: 30_000 }, () => '')];

      let response = await send(pipeline, lines.join('\n'));

      expect(response.status).toBe(200);
    });

    it('rejects invalid utf-8 without writing anything', async () => {
      let pipeline = createPipeline();
      let bytes = new Uint8Array([
        ...new TextEncoder().encode(ndjson(header(), item())),
        0xff,
        0xfe,
        0x0a
      ]);

      let response = await send(pipeline, bytes);

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('unreadable_body');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects a corrupt compressed body', async () => {
      let pipeline = createPipeline();

      let response = await send(pipeline, new Uint8Array([9, 9, 9, 9, 9]), {
        headers: { 'content-encoding': 'zstd' }
      });

      expect(response.status).toBe(400);
    });

    it('rejects a body over the size cap', async () => {
      let pipeline = createPipeline();
      let lines = Array.from({ length: 6 }, (_, seq) =>
        item({
          source: { kind: 'k', ref: 'r', seq },
          payload: { prompt: 'a'.repeat(900_000) }
        })
      );

      let response = await send(pipeline, ndjson(header(), ...lines));

      expect(response.status).toBe(413);
      expect((await errorBody(response)).code).toBe('payload_too_large');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects json content types', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(path, {
        contentType: 'application/json',
        body: '{}'
      });

      expect(response.status).toBe(415);
    });

    it('treats an unterminated long first line as an invalid header', async () => {
      let pipeline = createPipeline();

      let response = await send(pipeline, 'x'.repeat(3 * 1024 * 1024));

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_batch_header');
    });

    it('rejects an unterminated line over the body cap', async () => {
      let pipeline = createPipeline();

      let response = await send(pipeline, 'x'.repeat(5 * 1024 * 1024));

      expect(response.status).toBe(413);
      expect(pipeline.records()).toHaveLength(0);
    });
  });

  describe('sink failures', () => {
    it('answers 503 and stores nothing when the sink is busy', async () => {
      let pipeline = createPipeline();
      pipeline.sink.setBusy(true);

      let response = await send(
        pipeline,
        ndjson(header(), item(), item({ source: { kind: 'k', ref: 'r' } }))
      );

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('accepts the retry once the sink recovers', async () => {
      let pipeline = createPipeline();
      pipeline.sink.setBusy(true);

      await send(pipeline, ndjson(header(), item()));
      pipeline.sink.setBusy(false);
      let retry = await send(pipeline, ndjson(header(), item()));

      expect(retry.status).toBe(200);
      expect(pipeline.records()).toHaveLength(1);
    });

    it('answers 500 without leaking the failure', async () => {
      let pipeline = createPipeline();
      pipeline.sink.failNext(new Error(`boom ${sentinel}`));

      let response = await send(pipeline, ndjson(header(), item()));

      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain(sentinel);
    });
  });

  describe('dialect listing', () => {
    it('lists the registered bulk dialects', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send('/v1/bulk/dialects', { method: 'GET', body: null });
      let body = (await response.json()) as { object: string; items: unknown[] };

      expect(response.status).toBe(200);
      expect(body.object).toBe('agent_tracking#bulk_dialects');
      expect(body.items).toEqual([
        { client: 'claude-code', channel: 'hook', dialect: 'claude-code.hooks.v1' },
        { client: 'codex', channel: 'hook', dialect: 'codex.hooks.v1' }
      ]);
    });

    it('does not require credentials', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send('/v1/bulk/dialects', {
        method: 'GET',
        body: null,
        headers: { authorization: '' }
      });

      expect(response.status).toBe(200);
    });
  });
});
