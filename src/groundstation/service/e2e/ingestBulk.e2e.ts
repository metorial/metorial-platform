import { describe, expect, it } from 'vitest';
import {
  createScope,
  createToken,
  errorCode,
  ingest,
  instanceRecords,
  setSinkBusy
} from './support';

let header = (overrides: Record<string, unknown> = {}) => ({
  batch_id: 'batch-1',
  mode: 'live',
  sent_at: new Date().toISOString(),
  agent: { name: 'metorial-desktop', version: '1.0.0', install_id: 'install-1' },
  ...overrides
});

let item = (seq: number, overrides: Record<string, unknown> = {}) => ({
  client: 'claude-code',
  channel: 'hook',
  dialect: 'claude-code.hooks.v1',
  source: { kind: 'transcript', ref: 'file-1', seq },
  observed_at: new Date().toISOString(),
  payload: { hook_event_name: 'UserPromptSubmit', session_id: 'session-1', prompt: `p${seq}` },
  ...overrides
});

let ndjson = (...lines: unknown[]) =>
  lines.map(line => (typeof line == 'string' ? line : JSON.stringify(line))).join('\n') + '\n';

let bulk = (credential: string, body: string, headers: Record<string, string> = {}) =>
  ingest('/v1/bulk', {
    credential,
    body,
    headers: { 'content-type': 'application/x-ndjson', ...headers }
  });

let daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe('bulk ingest', () => {
  it('stores accepted items and reports counts', async () => {
    let { instance, secret } = await createToken();

    let response = await bulk(secret, ndjson(header(), item(1), item(2), item(3)));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      batch_id: 'batch-1',
      accepted: 3,
      rejected: 0,
      rejections: []
    });

    let items = await instanceRecords(instance, 'live');

    expect(items).toHaveLength(3);
    expect(items.every(entry => entry.record.ingest.route == 'bulk')).toBe(true);
    expect(items[0]!.record.ingest.agent).toMatchObject({ name: 'metorial-desktop' });
  });

  it('routes backfill batches to the backfill lane with event time from the item', async () => {
    let { instance, secret } = await createToken();
    let observedAt = daysAgo(2);

    let response = await bulk(
      secret,
      ndjson(header({ mode: 'backfill' }), item(1, { observed_at: observedAt }))
    );

    expect(response.status).toBe(200);
    expect(await instanceRecords(instance, 'live')).toHaveLength(0);

    let [stored] = await instanceRecords(instance, 'backfill');

    expect(stored!.record.ingest.backfill).toBe(true);
    expect(new Date(stored!.record.occurred_at).toISOString()).toBe(observedAt);
  });

  it('rejects backfill items without observed_at, from the future, or too old', async () => {
    let { instance, secret } = await createToken(
      {},
      await createScope({ instance: { backfillMaxAgeDays: 30, skewBoundSeconds: 300 } })
    );

    let { observed_at: _removed, ...withoutTime } = item(1);

    let response = await bulk(
      secret,
      ndjson(
        header({ mode: 'backfill' }),
        withoutTime,
        item(2, { observed_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }),
        item(3, { observed_at: daysAgo(60) }),
        item(4, { observed_at: daysAgo(1) })
      )
    );

    let body = (await response.json()) as {
      accepted: number;
      rejected: number;
      rejections: { i: number; code: string }[];
    };

    expect(body.accepted).toBe(1);
    expect(body.rejected).toBe(3);
    expect(body.rejections.map(r => [r.i, r.code])).toEqual([
      [0, 'parse_error'],
      [1, 'parse_error'],
      [2, 'too_old']
    ]);
    expect(await instanceRecords(instance, 'backfill')).toHaveLength(1);
  });

  it('reports item-level rejections with their line index', async () => {
    let { instance, secret } = await createToken({ allowedClients: ['claude-code'] });

    let response = await bulk(
      secret,
      ndjson(
        header(),
        item(1),
        'not json',
        item(2, { client: 'codex', dialect: 'codex.hooks.v1' }),
        item(3, { dialect: 'nope.v1' }),
        item(4, { client: 'Bad Client!' }),
        item(6)
      )
    );

    let body = (await response.json()) as {
      accepted: number;
      rejected: number;
      rejections: { i: number; code: string }[];
    };

    expect(body.accepted).toBe(2);

    let codes = Object.fromEntries(body.rejections.map(r => [r.i, r.code]));

    expect(codes[1]).toBe('parse_error');
    expect(codes[2]).toBe('not_allowed');
    expect(codes[3]).toBe('unknown_dialect');
    expect(codes[4]).toBe('unknown_client');
    expect(await instanceRecords(instance)).toHaveLength(2);
  });

  it('is idempotent when a batch is resent', async () => {
    let { instance, secret } = await createToken();
    let body = ndjson(header(), item(1), item(2));

    await bulk(secret, body);
    await bulk(secret, body);

    let items = await instanceRecords(instance);
    let ids = new Set(items.map(entry => entry.record.id));

    expect(ids.size).toBe(2);
  });

  it('rejects an invalid header and stores nothing', async () => {
    let { instance, secret } = await createToken();

    for (let body of [
      '',
      'not json\n',
      ndjson(header({ batch_id: '' }), item(1)),
      ndjson(header({ mode: 'weird' }), item(1)),
      ndjson(header({ sent_at: 'yesterday' }), item(1)),
      ndjson(item(1))
    ]) {
      let response = await bulk(secret, body);

      expect(response.status, body).toBe(400);
      expect(await errorCode(response), body).toBe('invalid_batch_header');
    }

    expect(await instanceRecords(instance)).toHaveLength(0);
  });

  it('answers 503 and stores nothing when the sink is busy', async () => {
    let { instance, secret } = await createToken();

    await setSinkBusy(true);

    try {
      let response = await bulk(secret, ndjson(header(), item(1), item(2)));

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
    } finally {
      await setSinkBusy(false);
    }

    expect(await instanceRecords(instance)).toHaveLength(0);

    let retry = await bulk(secret, ndjson(header(), item(1), item(2)));

    expect(retry.status).toBe(200);
    expect(await instanceRecords(instance)).toHaveLength(2);
  });

  it('rejects unauthenticated requests', async () => {
    let response = await bulk('metorial_agit_invalid', ndjson(header(), item(1)));

    expect(response.status).toBe(401);
  });

  it('lists supported dialects without authentication', async () => {
    let response = await ingest('/v1/bulk/dialects', { method: 'GET' });

    expect(response.status).toBe(200);

    let body = (await response.json()) as {
      object: string;
      items: { client: string; channel: string; dialect: string }[];
    };

    expect(body.object).toBe('groundstation#bulk_dialects');
    expect(body.items.map(entry => entry.dialect)).toEqual(
      expect.arrayContaining(['claude-code.hooks.v1', 'codex.hooks.v1'])
    );
  });

  it('keeps batches of different instances apart', async () => {
    let first = await createToken();
    let second = await createToken();

    await bulk(first.secret, ndjson(header(), item(1), item(2)));
    await bulk(second.secret, ndjson(header(), item(1)));

    expect(await instanceRecords(first.instance)).toHaveLength(2);
    expect(await instanceRecords(second.instance)).toHaveLength(1);
  });
});
