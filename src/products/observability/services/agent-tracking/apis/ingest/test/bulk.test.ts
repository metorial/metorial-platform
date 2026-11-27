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

let hookToken = { binding: { deviceId: undefined, deviceMode: 'ephemeral' as const } };

let unbound = [
  hookToken,
  {
    credential: { kind: 'source' as const },
    binding: { userId: undefined, deviceId: undefined, deviceMode: 'vendor' as const }
  }
];

let historyOn = { organization: { settings: { desktop: { historyImport: true } } } };

let bulkItem = (d: {
  client: string;
  clientVersion?: string;
  channel: string;
  dialect: string;
  session: string;
  seq: number;
  observedAt?: string;
  payload: Record<string, unknown>;
}) => ({
  client: d.client,
  ...(d.clientVersion ? { client_version: d.clientVersion } : {}),
  channel: d.channel,
  dialect: d.dialect,
  source: { kind: 'desktop', ref: `session:${d.session}`, seq: d.seq },
  observed_at: d.observedAt ?? '2026-06-14T09:00:00Z',
  payload: { session_id: d.session, ...d.payload }
});

let hookPipeline = (overrides: Parameters<typeof createPipeline>[0] = {}) =>
  createPipeline({ ...hookToken, ...overrides });

let cursorItem = () =>
  bulkItem({
    client: 'cursor',
    channel: 'hook',
    dialect: 'cursor.hooks.v1',
    session: 'cursor-1',
    seq: 1,
    payload: {
      kind: 'request',
      generation_id: 'generation-1',
      model: 'composer-2.5',
      input_tokens: 1000,
      output_tokens: 100
    }
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
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();

      let response = await send(pipeline, body);

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_batch_header');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('does not process items after an invalid header', async () => {
      let pipeline = hookPipeline();

      let response = await send(pipeline, ndjson(header({ mode: 'nope' }), item()));

      expect(response.status).toBe(400);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('accepts a header with extra fields', async () => {
      let pipeline = hookPipeline();

      let result = await sendOk(pipeline, header({ extra: 'ignored' }), item());

      expect(result.accepted).toBe(1);
    });

    it('accepts windows line endings', async () => {
      let pipeline = hookPipeline();

      let body = [JSON.stringify(header()), JSON.stringify(item())].join('\r\n') + '\r\n';
      let response = await send(pipeline, body);

      expect(response.status).toBe(200);
      expect(((await response.json()) as BulkResponse).accepted).toBe(1);
    });
  });

  describe('accepting items', () => {
    it('maps a payload item into a record', async () => {
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();

      let { payload, ...rest } = item();
      let result = await sendOk(pipeline, header(), {
        ...rest,
        payload_line: JSON.stringify(payload)
      });

      expect(result.accepted).toBe(1);
      expect(pipeline.records()[0]!.type).toBe('prompt.submitted');
    });

    it('produces the same record from payload and payload_line', async () => {
      let first = hookPipeline();
      let second = hookPipeline();

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
      let pipeline = hookPipeline();

      await sendOk(pipeline, header(), item());

      expect(JSON.stringify(pipeline.records())).not.toContain(sentinel);
    });

    it('keeps content only in content entries in full mode', async () => {
      let pipeline = hookPipeline({ contentPolicy: { defaultMode: 'full' } });

      await sendOk(pipeline, header(), item());

      let [record] = pipeline.records();

      expect(record!.content.some(entry => entry.text?.includes(sentinel))).toBe(true);
      expect(JSON.stringify({ ...record, content: [] })).not.toContain(sentinel);
    });

    it('handles several items and clients in one batch', async () => {
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();

      let result = await sendOk(pipeline, header(), item({ client: 'Claude_Code' }));

      expect(result.accepted).toBe(1);
      expect(pipeline.records()[0]!.client.family).toBe('claude-code');
    });

    it('skips blank lines without shifting indexes', async () => {
      let pipeline = hookPipeline();
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
      let gzipped = hookPipeline();
      let zstded = hookPipeline();
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
      let pipeline = hookPipeline({ contentPolicy: { defaultMode: 'full' } });

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
      let pipeline = hookPipeline();

      await sendOk(pipeline, header(), item());

      expect(pipeline.sink.list()[0]!.lane).toBe('live');
      expect(pipeline.records()[0]!.ingest.backfill).toBe(false);
    });

    it('writes backfill batches to the backfill lane', async () => {
      let pipeline = hookPipeline();

      await sendOk(pipeline, header({ mode: 'backfill' }), item({ observed_at: isoMinus(2) }));

      expect(pipeline.sink.list()[0]!.lane).toBe('backfill');
      expect(pipeline.records()[0]!.ingest.backfill).toBe(true);
    });

    it('uses observed_at as the event time', async () => {
      let pipeline = hookPipeline();
      let observed = isoMinus(3);

      await sendOk(pipeline, header({ mode: 'backfill' }), item({ observed_at: observed }));

      let [record] = pipeline.records();

      expect(record!.occurred_at).toBe(observed);
      expect(record!.quality.time_source).toBe('agent_observed');
      expect(record!.quality.warnings).not.toContain('clock_skew');
    });

    it('warns about clock skew for live items far from arrival', async () => {
      let pipeline = hookPipeline();

      await sendOk(pipeline, header(), item({ observed_at: isoMinus(0, -3_600_000) }));

      expect(pipeline.records()[0]!.quality.warnings).toContain('clock_skew');
    });

    it('marks live items without a time as time_unknown', async () => {
      let pipeline = hookPipeline();

      await sendOk(pipeline, header(), item());

      expect(pipeline.records()[0]!.quality.warnings).toContain('time_unknown');
    });

    it('requires observed_at in backfill batches', async () => {
      let pipeline = hookPipeline();

      let result = await sendOk(pipeline, header({ mode: 'backfill' }), item());

      expect(result.accepted).toBe(0);
      expect(result.rejections).toEqual([
        { i: 0, code: 'parse_error', detail: 'observed_at is required in backfill mode.' }
      ]);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects an invalid observed_at in any mode', async () => {
      let pipeline = hookPipeline();

      let result = await sendOk(pipeline, header(), item({ observed_at: 'whenever' }));

      expect(result.rejections[0]).toMatchObject({ code: 'parse_error' });
    });

    it('rejects backfill items from the future', async () => {
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline({
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
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline({ allowedClients: ['codex'] });

      let result = await sendOk(pipeline, header(), item());

      expect(result.rejections).toEqual([{ i: 0, code: 'not_allowed' }]);
    });

    it('rejects channels the token may not use', async () => {
      let pipeline = hookPipeline({ allowedChannels: ['otlp.logs'] });

      let result = await sendOk(pipeline, header(), item());

      expect(result.rejections).toEqual([{ i: 0, code: 'not_allowed' }]);
    });

    it('rejects oversized items without affecting others', async () => {
      let pipeline = hookPipeline();

      let big = item({ payload: { prompt: 'a'.repeat(1024 * 1024 + 1) } });
      let result = await sendOk(pipeline, header(), big, item());

      expect(result.accepted).toBe(1);
      expect(result.rejections).toEqual([{ i: 0, code: 'too_large' }]);
    });

    it('keeps accepting after a rejection and reports the right index', async () => {
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();
      let lines = Array.from({ length: 1500 }, () => 'garbage');

      let response = await send(pipeline, ndjson(header(), ...lines));
      let result = (await response.json()) as BulkResponse;

      expect(result.rejected).toBe(1500);
      expect(result.rejections).toHaveLength(1000);
      expect(result.rejections[999]!.i).toBe(999);
    });

    it('limits the detail length', async () => {
      let pipeline = hookPipeline();

      let result = await sendOk(pipeline, header(), item({ ['k'.repeat(500)]: 1, client: 1 }));

      for (let rejection of result.rejections) {
        expect((rejection.detail ?? '').length).toBeLessThanOrEqual(160);
      }
    });

    it('survives hostile payloads', async () => {
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();

      await sendOk(pipeline, header(), item());
      let first = pipeline.records()[0]!.id;

      await sendOk(pipeline, header({ batch_id: 'batch-2' }), item());

      expect(pipeline.records().map(record => record.id)).toEqual([first, first]);
    });

    it('derives different ids for different sequence numbers', async () => {
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();

      let result = await sendOk(pipeline, header(), item(), item());

      expect(result.accepted).toBe(2);
      expect(pipeline.records()).toHaveLength(1);
    });

    it('keeps organizations apart', async () => {
      let first = hookPipeline({ organization: { id: 'ator_a' } });
      await sendOk(first, header(), item());
      let firstId = first.records()[0]!.id;

      let second = hookPipeline({ organization: { id: 'ator_b' } });
      await sendOk(second, header(), item());

      expect(second.records()[0]!.id).not.toBe(firstId);
    });

    it('ties the identity to the source, not the payload', async () => {
      let pipeline = hookPipeline();

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
      let pipeline = hookPipeline();
      let lines = Array.from({ length: 20_000 }, (_, seq) => tiny(seq));

      let response = await send(pipeline, ndjson(header(), ...lines));

      expect(response.status).toBe(200);
      expect(((await response.json()) as BulkResponse).accepted).toBe(20_000);
      expect(pipeline.seen()).toHaveLength(20_000);
    });

    it('rejects more items than the limit without writing anything', async () => {
      let pipeline = hookPipeline();
      let lines = Array.from({ length: 20_001 }, (_, seq) => tiny(seq));

      let response = await send(pipeline, ndjson(header(), ...lines));

      expect(response.status).toBe(413);
      expect((await errorBody(response)).code).toBe('too_many_items');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('does not count blank lines as items', async () => {
      let pipeline = hookPipeline();
      let lines = [JSON.stringify(header()), ...Array.from({ length: 30_000 }, () => '')];

      let response = await send(pipeline, lines.join('\n'));

      expect(response.status).toBe(200);
    });

    it('rejects invalid utf-8 without writing anything', async () => {
      let pipeline = hookPipeline();
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
      let pipeline = hookPipeline();

      let response = await send(pipeline, new Uint8Array([9, 9, 9, 9, 9]), {
        headers: { 'content-encoding': 'zstd' }
      });

      expect(response.status).toBe(400);
    });

    it('rejects a body over the size cap', async () => {
      let pipeline = hookPipeline();
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
      let pipeline = hookPipeline();

      let response = await pipeline.send(path, {
        contentType: 'application/json',
        body: '{}'
      });

      expect(response.status).toBe(415);
    });

    it('treats an unterminated long first line as an invalid header', async () => {
      let pipeline = hookPipeline();

      let response = await send(pipeline, 'x'.repeat(3 * 1024 * 1024));

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_batch_header');
    });

    it('rejects an unterminated line over the body cap', async () => {
      let pipeline = hookPipeline();

      let response = await send(pipeline, 'x'.repeat(5 * 1024 * 1024));

      expect(response.status).toBe(413);
      expect(pipeline.records()).toHaveLength(0);
    });
  });

  describe('sink failures', () => {
    it('answers 503 and stores nothing when the sink is busy', async () => {
      let pipeline = hookPipeline();
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
      let pipeline = hookPipeline();
      pipeline.sink.setBusy(true);

      await send(pipeline, ndjson(header(), item()));
      pipeline.sink.setBusy(false);
      let retry = await send(pipeline, ndjson(header(), item()));

      expect(retry.status).toBe(200);
      expect(pipeline.records()).toHaveLength(1);
    });

    it('answers 500 without leaking the failure', async () => {
      let pipeline = hookPipeline();
      pipeline.sink.failNext(new Error(`boom ${sentinel}`));

      let response = await send(pipeline, ndjson(header(), item()));

      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain(sentinel);
    });
  });

  describe('Desktop context', () => {
    let sha = '06de4d4304e317c123c4bbb07394249ed0cde401';

    let desktopItem = (payload: Record<string, unknown>, seq = 1) =>
      bulkItem({
        client: 'codex',
        clientVersion: '0.63.0',
        channel: 'envelope',
        dialect: 'metorial.desktop.context.v1',
        session: 'conv-1',
        seq,
        observedAt: '2026-06-15T11:59:00Z',
        payload
      });

    let desktopBatch = () => [
      desktopItem({
        kind: 'session_context',
        remote_url: 'git@github.com:acme/api.git',
        branch: 'ivan/mt-365-title',
        workspace_key: 'ab'.repeat(16),
        title: `Title ${sentinel}`
      }),
      desktopItem({ kind: 'commit', sha, ticket_refs: ['mt-365'] }, 2),
      desktopItem(
        {
          kind: 'pull_request',
          relation: 'opened',
          provider: 'github',
          repository: 'acme/api',
          number: 7
        },
        3
      ),
      desktopItem({ kind: 'session_stats', lines_added: 10, lines_removed: 2 }, 4)
    ];

    let sessionContextOff = {
      organization: { settings: { desktop: { sessionContext: false } } }
    };

    it('accepts a Desktop batch on a device-bound token', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), ...desktopBatch());
      let records = pipeline.records();

      expect(result).toEqual({
        batch_id: 'batch-1',
        accepted: 4,
        rejected: 0,
        rejections: []
      });
      expect(records.map(record => record.type)).toEqual([
        'session.context',
        'vcs.commit',
        'vcs.pull_request',
        'code.change'
      ]);
      expect(new Set(records.map(record => record.ctx.session_key)).size).toBe(1);
      expect(records[0]!).toMatchObject({
        client: { family: 'codex', version: '0.63.0' },
        source: { channel: 'envelope', dialect: 'metorial.desktop.context.v1' },
        data: { branch: 'ivan/mt-365-title', ticket_refs: ['MT-365'] }
      });
      expect(JSON.stringify(records)).not.toContain(sentinel);
    });

    it('keeps the title while session titles are on', async () => {
      let pipeline = createPipeline({
        organization: { settings: { desktop: { sessionTitles: true } } }
      });

      await sendOk(pipeline, header(), desktopBatch()[0]);

      expect(pipeline.records()[0]!.data.title).toBe(`Title ${sentinel}`);
    });

    it('rejects each Desktop item while session context is off', async () => {
      let pipeline = createPipeline(sessionContextOff);

      let result = await sendOk(pipeline, header(), ...desktopBatch(), cursorItem());

      expect(result.accepted).toBe(1);
      expect(result.rejections).toEqual([0, 1, 2, 3].map(i => ({ i, code: 'not_allowed' })));
      expect(pipeline.records().map(record => record.type)).toEqual(['turn.completed']);
    });

    it('rejects Desktop items from tokens that are not bound to a device', async () => {
      for (let overrides of unbound) {
        let pipeline = createPipeline(overrides);

        let result = await sendOk(pipeline, header(), ...desktopBatch());

        expect(result.accepted).toBe(0);
        expect(result.rejections.every(rejection => rejection.code == 'not_allowed')).toBe(
          true
        );
        expect(pipeline.records()).toHaveLength(0);
      }
    });

    it('names the first invalid field without echoing its value', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(
        pipeline,
        header(),
        desktopItem({ kind: 'session_context', head: sentinel }),
        desktopItem({ kind: 'nope' })
      );

      expect(result.rejections).toEqual([
        { i: 0, code: 'parse_error', detail: 'payload.head: invalid_regex' },
        { i: 1, code: 'parse_error', detail: 'payload.kind: invalid_enum' }
      ]);
      expect(JSON.stringify(result)).not.toContain(sentinel);
    });

    it('accepts history only while History Import is on', async () => {
      let backfill = header({ mode: 'backfill' });

      let off = createPipeline();
      let offResult = await sendOk(off, backfill, ...desktopBatch());

      expect(offResult.accepted).toBe(0);
      expect(offResult.rejections).toEqual(
        [0, 1, 2, 3].map(i => ({ i, code: 'not_allowed' }))
      );
      expect(off.records()).toHaveLength(0);

      let on = createPipeline({
        organization: { settings: { desktop: { historyImport: true } } }
      });
      let onResult = await sendOk(on, backfill, ...desktopBatch());

      expect(onResult).toMatchObject({ accepted: 4, rejected: 0 });
      expect(on.records().every(record => record.ingest.backfill)).toBe(true);

      let contextOff = createPipeline({
        organization: { settings: { desktop: { historyImport: true, sessionContext: false } } }
      });

      expect((await sendOk(contextOff, backfill, ...desktopBatch())).accepted).toBe(0);
    });

    it('rejects a client outside the Desktop list', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), {
        ...desktopBatch()[0],
        client: 'aider'
      });

      expect(result.rejections).toEqual([{ i: 0, code: 'unknown_client' }]);
    });

    it('rejects a client version over 64 characters', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), {
        ...desktopBatch()[0],
        client_version: 'v'.repeat(65)
      });

      expect(result.rejections).toEqual([{ i: 0, code: 'unsupported_version' }]);
    });

    it('stores a resent batch under the same ids', async () => {
      let pipeline = createPipeline();

      await sendOk(pipeline, header(), ...desktopBatch());
      let first = pipeline.records().map(record => record.id);

      await sendOk(
        pipeline,
        header({ batch_id: 'batch-2' }),
        ...desktopBatch().map((entry, index) => ({
          ...entry,
          source: { ...entry.source, seq: index + 10 }
        }))
      );

      expect(new Set(pipeline.records().map(record => record.id))).toEqual(new Set(first));
    });
  });

  describe('history import transcripts', () => {
    let backfill = header({ mode: 'backfill' });

    let claudeItem = (overrides: Record<string, unknown> = {}, seq = 1) =>
      bulkItem({
        client: 'claude-code',
        clientVersion: '2.1.300',
        channel: 'transcript',
        dialect: 'claude-code.transcript.v1',
        session: 'sess-1',
        seq,
        payload: {
          kind: 'request',
          message_id: `msg_${seq}`,
          request_id: `req_${seq}`,
          model: 'claude-opus-5-5',
          input_tokens: 2,
          output_tokens: 790,
          cache_read_input_tokens: 14623,
          cache_creation_input_tokens: 20634,
          ...overrides
        }
      });

    let codexItem = (seq = 1) =>
      bulkItem({
        client: 'codex',
        channel: 'transcript',
        dialect: 'codex.transcript.v1',
        session: 'thread-1',
        seq,
        payload: {
          kind: 'request',
          cumulative_total_tokens: 1000 * seq,
          model: 'gpt-6-luna',
          input_tokens: 900,
          cached_input_tokens: 600,
          output_tokens: 100,
          reasoning_output_tokens: 40,
          total_tokens: 1000
        }
      });

    it('accepts transcript usage in a backfill batch while History Import is on', async () => {
      let pipeline = createPipeline(historyOn);

      let result = await sendOk(
        pipeline,
        backfill,
        claudeItem(),
        claudeItem({}, 2),
        codexItem()
      );
      let records = pipeline.records();

      expect(result).toMatchObject({ accepted: 3, rejected: 0 });
      expect(records.map(record => [record.type, record.source.dialect])).toEqual([
        ['model.request', 'claude-code.transcript.v1'],
        ['model.request', 'claude-code.transcript.v1'],
        ['model.request', 'codex.transcript.v1']
      ]);
      expect(records.every(record => record.source.channel == 'transcript')).toBe(true);
      expect(records.every(record => record.ingest.backfill)).toBe(true);
      expect(records[0]).toMatchObject({
        occurred_at: '2026-06-14T09:00:00.000Z',
        client: { family: 'claude-code', version: '2.1.300' },
        data: { model: { id: 'claude-opus-5-5' }, usage: { output: 790 } }
      });
    });

    it('marks imported subagent requests as subagent work', async () => {
      let pipeline = createPipeline(historyOn);

      let result = await sendOk(
        pipeline,
        backfill,
        claudeItem(),
        claudeItem({ purpose: 'subagent' }, 2),
        claudeItem({ purpose: 'review' }, 3)
      );

      expect(result.rejections).toEqual([
        { i: 2, code: 'parse_error', detail: 'payload.purpose: invalid_enum' }
      ]);
      expect(pipeline.records().map(record => record.data.purpose)).toEqual([
        'main',
        'subagent'
      ]);
    });

    it.each([
      ['the organization window', 180, 400, 180],
      ['the record retention when it is shorter than the window', 365, 200, 200]
    ])(
      'accepts imported lines up to %s',
      async (_name, historyImportDays, recordRetentionDays, days) => {
        let pipeline = createPipeline({
          organization: {
            settings: { desktop: { historyImport: true, historyImportDays } }
          },
          instance: { backfillMaxAgeDays: null, recordRetentionDays }
        });

        let result = await sendOk(
          pipeline,
          backfill,
          { ...claudeItem(), observed_at: isoMinus(days, 1000) },
          { ...claudeItem({}, 2), observed_at: isoMinus(days, -1000) }
        );

        expect(result.accepted).toBe(1);
        expect(result.rejections).toEqual([{ i: 1, code: 'too_old' }]);
      }
    );

    it('rejects transcript items in live batches even while History Import is on', async () => {
      let pipeline = createPipeline(historyOn);

      let result = await sendOk(pipeline, header(), claudeItem(), codexItem());

      expect(result.rejections).toEqual([
        { i: 0, code: 'not_allowed' },
        { i: 1, code: 'not_allowed' }
      ]);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects transcript items while History Import is off', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, backfill, claudeItem(), codexItem());

      expect(result.rejections).toEqual([
        { i: 0, code: 'not_allowed' },
        { i: 1, code: 'not_allowed' }
      ]);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects transcript items from tokens that are not bound to a device', async () => {
      let pipeline = createPipeline({ ...historyOn, ...hookToken });

      let result = await sendOk(pipeline, backfill, claudeItem(), codexItem());

      expect(result.accepted).toBe(0);
      expect(result.rejections.map(rejection => rejection.code)).toEqual([
        'not_allowed',
        'not_allowed'
      ]);
    });

    it('applies the backfill time rules and names invalid fields', async () => {
      let pipeline = createPipeline(historyOn);

      let result = await sendOk(
        pipeline,
        backfill,
        { ...claudeItem(), observed_at: undefined },
        { ...claudeItem(), observed_at: isoMinus(10_000) },
        claudeItem({ model: '<synthetic>' }),
        claudeItem({ output_tokens: -1 }),
        { ...codexItem(), dialect: 'claude-code.transcript.v1' }
      );

      expect(result.rejections).toEqual([
        { i: 0, code: 'parse_error', detail: 'observed_at is required in backfill mode.' },
        { i: 1, code: 'too_old' },
        { i: 2, code: 'parse_error', detail: 'payload.model: invalid_regex' },
        { i: 3, code: 'parse_error', detail: 'payload.output_tokens: invalid_min' },
        { i: 4, code: 'unknown_dialect' }
      ]);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('keeps the response before a compaction whichever line arrives first', async () => {
      let compaction = {
        ...codexItem(2),
        payload: {
          ...codexItem(2).payload,
          cumulative_total_tokens: 1000,
          input_tokens: 0,
          cached_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
          total_tokens: 245_000
        }
      };

      for (let order of [
        [compaction, codexItem()],
        [codexItem(), compaction]
      ]) {
        let pipeline = createPipeline(historyOn);

        let result = await sendOk(pipeline, backfill, ...order);
        let records = pipeline.records();

        expect(result).toMatchObject({ accepted: 2, rejected: 0 });
        expect(records).toHaveLength(1);
        expect(records[0]!.data.usage).toMatchObject({ input_uncached: 300, output: 60 });
      }
    });

    it('stores a re-import under the same ids', async () => {
      let pipeline = createPipeline(historyOn);

      await sendOk(pipeline, backfill, claudeItem(), codexItem());
      let first = pipeline.records().map(record => record.id);

      await sendOk(
        pipeline,
        header({ mode: 'backfill', batch_id: 'batch-2' }),
        claudeItem({}, 1),
        { ...codexItem(), source: { kind: 'desktop', ref: 'session:thread-1', seq: 50 } }
      );

      expect(new Set(pipeline.records().map(record => record.id))).toEqual(new Set(first));
    });
  });

  describe('client usage', () => {
    let usageItems = (seq = 1) => [
      bulkItem({
        client: 'cursor',
        clientVersion: '2026.11.22-abc1234',
        channel: 'hook',
        dialect: 'cursor.hooks.v1',
        session: 'conv-1',
        seq,
        payload: {
          kind: 'request',
          generation_id: 'gen-1',
          model: 'composer-2.5',
          input_tokens: 40000,
          output_tokens: 200,
          cache_read_tokens: 30000,
          cache_write_tokens: 0,
          user_email: `dev@${sentinel}.test`
        }
      }),
      bulkItem({
        client: 'antigravity',
        channel: 'transcript',
        dialect: 'antigravity.transcript.v1',
        session: 'conv-2',
        seq,
        observedAt: '2026-06-14T09:00:01Z',
        payload: {
          kind: 'request',
          step_index: 4,
          model: 'gemini-4-hydrogen',
          input_tokens: 2500,
          cache_read_tokens: 11000,
          output_tokens: 90,
          content: `answer ${sentinel}`
        }
      }),
      bulkItem({
        client: 'opencode',
        clientVersion: '1.17.18',
        channel: 'sse',
        dialect: 'opencode.plugin.v1',
        session: 'ses_1',
        seq,
        observedAt: '2026-06-14T09:00:02Z',
        payload: {
          kind: 'request',
          message_id: 'msg_1',
          provider: 'anthropic',
          model: 'claude-haiku-5-5',
          input_tokens: 4,
          output_tokens: 99,
          reasoning_tokens: 95,
          cache_write_tokens: 10685,
          cost_usd: 0.0014,
          directory: `/home/${sentinel}`
        }
      })
    ];

    it('accepts usage from each client on a device-bound token in a live batch', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(pipeline, header(), ...usageItems());
      let records = pipeline.records();

      expect(result).toEqual({
        batch_id: 'batch-1',
        accepted: 3,
        rejected: 0,
        rejections: []
      });
      expect(records.map(record => [record.client.family, record.source.channel])).toEqual([
        ['cursor', 'hook'],
        ['antigravity', 'transcript'],
        ['opencode', 'sse']
      ]);
      expect(records.map(record => record.type)).toEqual([
        'turn.completed',
        'model.request',
        'model.request'
      ]);
      expect(records.some(record => record.ingest.backfill)).toBe(false);
      expect(records[0]).toMatchObject({
        occurred_at: '2026-06-14T09:00:00.000Z',
        data: {
          usage: {
            provenance: 'aggregate',
            input_uncached: 10000,
            cache_read: 30000,
            output: 200
          }
        }
      });
      expect(records[2]!.data).toMatchObject({
        model: { id: 'claude-haiku-5-5', provider: 'anthropic' },
        usage: { input_uncached: 4, cache_write: 10685, output: 99, reasoning: 95 },
        cost: { amount: '0.0014', unit: 'usd', basis: 'client_estimate' }
      });
      expect(JSON.stringify(records)).not.toContain(sentinel);
    });

    it('accepts usage in backfill batches under the backfill time rules', async () => {
      let pipeline = createPipeline(historyOn);
      let backfill = header({ mode: 'backfill' });

      let result = await sendOk(pipeline, backfill, ...usageItems(), {
        ...usageItems()[0],
        observed_at: isoMinus(10_000)
      });

      expect(result).toMatchObject({
        accepted: 3,
        rejected: 1,
        rejections: [{ i: 3, code: 'too_old' }]
      });
      expect(pipeline.records().every(record => record.ingest.backfill)).toBe(true);
    });

    it('accepts live usage whatever the Desktop settings', async () => {
      for (let desktop of [
        { historyImport: false, sessionContext: false },
        { historyImport: true, sessionContext: true }
      ]) {
        let pipeline = createPipeline({ organization: { settings: { desktop } } });

        let result = await sendOk(pipeline, header(), ...usageItems());

        expect(result).toMatchObject({ accepted: 3, rejected: 0 });
      }
    });

    it('accepts backfilled usage only while History Import is on', async () => {
      let backfill = header({ mode: 'backfill' });

      let off = createPipeline({
        organization: { settings: { desktop: { historyImport: false } } }
      });
      let offResult = await sendOk(off, backfill, ...usageItems());

      expect(offResult.accepted).toBe(0);
      expect(offResult.rejections).toEqual([0, 1, 2].map(i => ({ i, code: 'not_allowed' })));
      expect(off.records()).toHaveLength(0);

      let on = createPipeline({
        organization: { settings: { desktop: { historyImport: true, sessionContext: false } } }
      });

      expect(await sendOk(on, backfill, ...usageItems())).toMatchObject({
        accepted: 3,
        rejected: 0
      });
    });

    it('rejects usage from tokens that are not bound to a device', async () => {
      for (let overrides of unbound) {
        for (let mode of ['live', 'backfill']) {
          let pipeline = createPipeline({ ...historyOn, ...overrides });

          let result = await sendOk(pipeline, header({ mode }), ...usageItems());

          expect(result.accepted).toBe(0);
          expect(result.rejections).toEqual([0, 1, 2].map(i => ({ i, code: 'not_allowed' })));
          expect(pipeline.records()).toHaveLength(0);
        }
      }
    });

    it('names invalid fields and rejects a dialect on the wrong client or channel', async () => {
      let [cursor, antigravity, opencode] = usageItems();
      let pipeline = createPipeline();

      let result = await sendOk(
        pipeline,
        header(),
        { ...cursor, payload: { ...cursor!.payload, input_tokens: '40000' } },
        { ...antigravity, payload: { ...antigravity!.payload, step_index: -1 } },
        { ...opencode, payload: { ...opencode!.payload, cost_usd: -1 } },
        { ...opencode, channel: 'envelope' },
        { ...cursor, client: 'antigravity' }
      );

      expect(result.rejections).toEqual([
        { i: 0, code: 'parse_error', detail: 'payload.input_tokens: invalid_type' },
        { i: 1, code: 'parse_error', detail: 'payload.step_index: invalid_min' },
        { i: 2, code: 'parse_error', detail: 'payload.cost_usd: invalid_min' },
        { i: 3, code: 'unknown_dialect' },
        { i: 4, code: 'unknown_dialect' }
      ]);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('stores a resent batch under the same ids', async () => {
      let pipeline = createPipeline();

      await sendOk(pipeline, header(), ...usageItems());
      let first = pipeline.records().map(record => record.id);

      await sendOk(pipeline, header({ batch_id: 'batch-2' }), ...usageItems(9));

      expect(new Set(pipeline.records().map(record => record.id))).toEqual(new Set(first));
    });
  });

  describe('hook dialects and device-bound tokens', () => {
    it('refuses the Claude Code and Codex hook dialects but accepts Cursor usage', async () => {
      let pipeline = createPipeline();

      let result = await sendOk(
        pipeline,
        header(),
        item(),
        item({ client: 'codex', dialect: 'codex.hooks.v1' }),
        cursorItem()
      );

      expect(result.accepted).toBe(1);
      expect(result.rejections).toEqual([
        { i: 0, code: 'not_allowed' },
        { i: 1, code: 'not_allowed' }
      ]);
      expect(pipeline.records().map(record => record.type)).toEqual(['turn.completed']);
    });

    it('accepts the hook dialects from tokens that are not bound to a device', async () => {
      let pipeline = hookPipeline();

      let result = await sendOk(
        pipeline,
        header(),
        item(),
        item({ client: 'codex', dialect: 'codex.hooks.v1' })
      );

      expect(result).toMatchObject({ accepted: 2, rejected: 0 });
    });

    let reporting = (settings: { toolDetails: boolean; sessionContext: boolean }) => ({
      contentPolicy: { defaultMode: 'full' as const },
      organization: { settings: { desktop: settings } }
    });

    let mcpItem = (client: string, dialect: string) =>
      item({
        client,
        dialect,
        payload: {
          session_id: 'session-1',
          hook_event_name: 'PostToolUse',
          tool_name: 'mcp__github__create_pr',
          tool_use_id: 'toolu_1',
          mcp_server: { name: 'github' },
          tool_input: { title: sentinel },
          tool_response: { url: sentinel }
        }
      });

    let contextItem = item({
      source: { kind: 'transcript', ref: 'file-1', seq: 2 },
      payload: {
        session_id: 'session-1',
        hook_event_name: 'SessionStart',
        cwd: '/Users/someone/code/secret-project',
        metorial: { git: { branch: 'feature/MT-7-notes', head: 'a'.repeat(40) } }
      }
    });

    it('strips MCP names and tool inputs from hook items while detailed tool reporting is off', async () => {
      for (let token of unbound) {
        let pipeline = createPipeline({
          ...token,
          ...reporting({ toolDetails: false, sessionContext: true })
        });

        await sendOk(
          pipeline,
          header(),
          mcpItem('claude-code', 'claude-code.hooks.v1'),
          mcpItem('codex', 'codex.hooks.v1')
        );

        let tools = pipeline.records().filter(record => record.type == 'tool.call');

        expect(tools.map(record => record.data.tool)).toEqual([
          { name: 'mcp_tool', kind: 'mcp', class: 'mcp' },
          { name: 'mcp_tool', kind: 'mcp', class: 'mcp' }
        ]);
        expect(JSON.stringify(pipeline.records())).not.toMatch(/SENTINEL|github|create_pr/);
      }
    });

    it('keeps MCP names and tool inputs from hook items while detailed tool reporting is on', async () => {
      let pipeline = createPipeline({
        ...hookToken,
        ...reporting({ toolDetails: true, sessionContext: true })
      });

      await sendOk(pipeline, header(), mcpItem('claude-code', 'claude-code.hooks.v1'));

      let [tool] = pipeline.records().filter(record => record.type == 'tool.call');

      expect(tool!.data.tool).toMatchObject({ mcp: { server: 'github', tool: 'create_pr' } });
      expect(tool!.content.some(entry => entry.text?.includes(sentinel))).toBe(true);
    });

    it('stores no session context from hook items while session context is off', async () => {
      let off = createPipeline({
        ...hookToken,
        ...reporting({ toolDetails: true, sessionContext: false })
      });
      let on = createPipeline({
        ...hookToken,
        ...reporting({ toolDetails: true, sessionContext: true })
      });

      await sendOk(off, header(), contextItem);
      await sendOk(on, header(), contextItem);

      expect(off.seen().map(record => record.type)).toEqual(['session.start']);
      expect(JSON.stringify(off.seen())).not.toMatch(/secret-project|MT-7/);
      expect(on.records().map(record => record.type)).toContain('session.context');
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
        { client: 'codex', channel: 'hook', dialect: 'codex.hooks.v1' },
        ...['claude-code', 'codex', 'cursor', 'antigravity', 'opencode'].map(client => ({
          client,
          channel: 'envelope',
          dialect: 'metorial.desktop.context.v1'
        })),
        { client: 'claude-code', channel: 'transcript', dialect: 'claude-code.transcript.v1' },
        { client: 'codex', channel: 'transcript', dialect: 'codex.transcript.v1' },
        { client: 'cursor', channel: 'hook', dialect: 'cursor.hooks.v1' },
        { client: 'antigravity', channel: 'transcript', dialect: 'antigravity.transcript.v1' },
        { client: 'opencode', channel: 'sse', dialect: 'opencode.plugin.v1' }
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
