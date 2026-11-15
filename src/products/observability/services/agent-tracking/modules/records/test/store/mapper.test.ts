import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import { defaultStoragePolicy, type StoragePolicy } from '@mtsrc/agent-tracking-store';
import {
  buildDraft,
  buildNow,
  unitPrincipal
} from '@mtsrc/agent-tracking-dialects/test/build';
import { contentAad, createContentCipher } from '@mtsrc/agent-tracking-crypto';
import {
  storedKey,
  toContentTextDocuments,
  toDocuments,
  toRecordDocument,
  toStoredValue
} from '../../src/lib/mapper';

let sentinel = 'SENTINEL-7f3a';
let millisPerDay = 86_400_000;

let fullPrincipal = unitPrincipal({ contentPolicy: { defaultMode: 'full' } });

let draft = (overrides: Partial<RecordDraft> = {}): RecordDraft => ({
  kind: 'event',
  type: 'prompt.submitted',
  identity: 'id-1',
  signalName: 'UserPromptSubmit',
  client: { family: 'claude-code', version: '1.2.3' },
  ctx: { sessionId: 'session-1', turnId: 'turn-1', trace: { traceId: 'a'.repeat(32) } },
  data: { input_tokens: 12, cache_write_5m: 3, cost: { amount: '0.0123', unit: 'usd' } },
  extras: { plan: 'max' },
  ...overrides
});

let event = (overrides: Partial<RecordDraft> = {}, full = false) =>
  buildDraft(draft(overrides), full ? { principal: fullPrincipal } : {});

let withText = () =>
  event(
    {
      content: [
        { role: 'prompt', value: `please fix ${sentinel}` },
        { role: 'tool_output', clientLength: 10 }
      ]
    },
    true
  );

let measurement = () =>
  buildDraft(
    {
      kind: 'measurement',
      type: 'tokens',
      identity: 'm-1',
      client: { family: 'claude-code' },
      data: {
        name: 'tokens',
        value: 120,
        unit: '{token}',
        aggregation: 'delta',
        window: { start: '2026-06-15T11:59:00.000Z', end: '2026-06-15T11:59:30.000Z' },
        dims: { model: 'm', token_type: 'input' }
      }
    },
    {},
    { adapter: 'a', dialect: 'd', channel: 'otlp.metrics' }
  );

let map = (
  record: NormalizedRecord,
  storage: StoragePolicy = defaultStoragePolicy,
  now = buildNow
) => toRecordDocument(record, { storage, now });

let daysAfter = (date: Date, days: number) => new Date(date.getTime() + days * millisPerDay);

let keysOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (typeof value != 'object' || value === null || value instanceof Date) return [];
  if (value instanceof mongoose.Types.Decimal128) return [];

  return Object.entries(value).flatMap(([key, nested]) => [key, ...keysOf(nested)]);
};

describe('storedKey', () => {
  it.each([
    ['input_tokens', 'inputTokens'],
    ['cache_write_5m', 'cacheWrite5m'],
    ['token-type', 'tokenType'],
    ['x.claude-code.plan', 'x_claudeCode_plan'],
    ['$where', '_where'],
    ['alreadyCamel', 'alreadyCamel']
  ])('maps %s to %s', (key, expected) => {
    expect(storedKey(key)).toBe(expected);
  });
});

describe('toStoredValue', () => {
  it('camelCases nested keys, keeps arrays and skips undefined values', () => {
    expect(
      toStoredValue({ outer_key: { inner_key: [{ deep_key: 1 }], gone: undefined }, n: null })
    ).toEqual({ outerKey: { innerKey: [{ deepKey: 1 }] }, n: null });
  });

  it('stores well-formed cost amounts as Decimal128', () => {
    let stored = toStoredValue({ amount: '-12.000345', unit: 'usd', basis: 'reported' }) as {
      amount: mongoose.Types.Decimal128;
    };

    expect(stored.amount).toBeInstanceOf(mongoose.Types.Decimal128);
    expect(stored.amount.toString()).toBe('-12.000345');
    expect(stored).toMatchObject({ unit: 'usd', basis: 'reported' });
  });

  it.each([{ amount: '1e5', unit: 'usd' }, { amount: '12' }, { amount: 12, unit: 'usd' }])(
    'leaves %j untouched',
    value => {
      expect(toStoredValue(value)).toEqual(value);
    }
  );
});

describe('toRecordDocument', () => {
  it('maps an event to the camelCase document shape', () => {
    let record = event();
    let { document, texts } = map(record)!;

    expect(texts).toEqual([]);
    expect(document).toMatchObject({
      _id: record.id,
      organizationId: 'ator_unit',
      projectId: 'atpr_unit',
      instanceId: 'atin_unit',
      spec: record.spec,
      type: 'prompt.submitted',
      occurredAt: new Date(record.occurred_at),
      observedAt: new Date(record.observed_at),
      expiresAt: daysAfter(new Date(record.occurred_at), 90),
      ingest: {
        credentialKind: 'token',
        credentialId: 'atit_unit',
        route: 'hook',
        requestId: 'req_unit'
      },
      source: {
        adapter: 'test',
        dialect: 'test.v1',
        channel: 'hook',
        signalName: 'UserPromptSubmit'
      },
      client: { family: 'claude-code', version: '1.2.3' },
      ctx: {
        sessionId: 'session-1',
        sessionKey: record.ctx.session_key,
        turnId: 'turn-1',
        trace: { traceId: 'a'.repeat(32) }
      },
      data: { inputTokens: 12, cacheWrite5m: 3, cost: { unit: 'usd' } },
      extras: [{ k: 'x.claude-code.plan', v: 'max' }],
      quality: { timeSource: record.quality.time_source }
    });
    expect((document.data.cost as { amount: unknown }).amount).toBeInstanceOf(
      mongoose.Types.Decimal128
    );
  });

  it('maps attribution and the session origin', () => {
    let record = event();
    record.attribution = {
      user_id: 'aten_user',
      device_id: 'aten_device',
      client_installation_id: 'aten_install'
    };
    record.ctx.session_origin = 'linked';

    let { document } = map(record)!;

    expect(document.attribution).toEqual({
      userId: 'aten_user',
      deviceId: 'aten_device',
      clientInstallationId: 'aten_install'
    });
    expect(JSON.parse(JSON.stringify(document.attribution))).toEqual(document.attribution);
    expect(document.ctx.sessionOrigin).toBe('linked');
  });

  it('omits attribution when the record has none', () => {
    expect(map(event())!.document.attribution).toBeUndefined();
  });

  it('omits empty extras and empty quality lists', () => {
    let record = event({ extras: {} });
    let { document } = map(record)!;

    expect(record.quality.dropped).toEqual([]);
    expect(document.extras).toBeUndefined();
    expect(document.quality).toEqual({
      timeSource: record.quality.time_source,
      warnings: record.quality.warnings
    });
    expect(Object.keys(JSON.parse(JSON.stringify(document.quality))).sort()).toEqual([
      'timeSource',
      'warnings'
    ]);
  });

  it('never produces keys with dots or a leading dollar sign', () => {
    let { document } = map(
      event({ data: { 'a.b': 1, $where: 2, nested: { 'c.d': { $gt: 1 } } } })
    )!;

    let keys = keysOf(document.data);

    expect(keys).toEqual(expect.arrayContaining(['a_b', '_where', 'c_d', '_gt']));
    expect(keys.filter(key => key.includes('.') || key.startsWith('$'))).toEqual([]);
  });

  it('converts measurement windows to dates', () => {
    let { document } = map(measurement())!;

    expect(document.data).toMatchObject({
      name: 'tokens',
      value: 120,
      window: {
        start: new Date('2026-06-15T11:59:00.000Z'),
        end: new Date('2026-06-15T11:59:30.000Z')
      },
      dims: { model: 'm', tokenType: 'input' }
    });
  });

  it('splits content text out of the record in full mode', () => {
    let record = withText();
    let { document, texts } = map(record)!;

    expect(document.content).toEqual([
      expect.objectContaining({ role: 'prompt', mode: 'full', hasText: true }),
      expect.not.objectContaining({ hasText: true })
    ]);
    expect(JSON.stringify(document)).not.toContain(sentinel);

    expect(texts).toEqual([
      {
        recordId: record.id,
        index: 0,
        role: 'prompt',
        text: `please fix ${sentinel}`,
        occurredAt: document.occurredAt,
        expiresAt: daysAfter(document.occurredAt, 30)
      }
    ]);
  });

  it('keeps no text in basic mode', () => {
    let { document, texts } = map(event({ content: [{ role: 'prompt', value: sentinel }] }))!;

    expect(texts).toEqual([]);
    expect(document.content?.[0]?.hasText).toBeUndefined();
    expect(JSON.stringify(document)).not.toContain(sentinel);
  });

  it('drops text past content retention but keeps the record', () => {
    let record = withText();
    let { document, texts } = map(record, defaultStoragePolicy, daysAfter(buildNow, 40))!;

    expect(texts).toEqual([]);
    expect(document.content?.[0]?.hasText).toBeUndefined();
    expect(document.expiresAt).toEqual(daysAfter(new Date(record.occurred_at), 90));
  });

  it('never keeps text longer than the record', () => {
    let record = withText();
    let { texts } = map(record, {
      ...defaultStoragePolicy,
      recordRetentionDays: 10,
      contentRetentionDays: 60
    })!;

    expect(texts[0]!.expiresAt).toEqual(daysAfter(new Date(record.occurred_at), 10));
  });

  it('returns null for records already past retention', () => {
    expect(map(event(), defaultStoragePolicy, daysAfter(buildNow, 91))).toBeNull();
  });
});

describe('toDocuments', () => {
  it('routes records by kind and counts expired ones', () => {
    let old = buildDraft(draft({ identity: 'old' }), {
      principal: unitPrincipal({ contentPolicy: { defaultMode: 'full' } })
    });

    let mapped = toDocuments([withText(), measurement(), old], {
      storage: { ...defaultStoragePolicy, recordRetentionDays: 1 },
      now: daysAfter(buildNow, 0.5)
    });

    expect(mapped.events).toHaveLength(2);
    expect(mapped.measurements).toHaveLength(1);
    expect(mapped.texts).toHaveLength(1);
    expect(mapped.expired).toBe(0);

    let later = toDocuments([withText(), measurement()], {
      storage: { ...defaultStoragePolicy, recordRetentionDays: 1 },
      now: daysAfter(buildNow, 2)
    });

    expect(later).toEqual({ events: [], measurements: [], texts: [], expired: 2 });
  });
});

describe('toContentTextDocuments', () => {
  let scope = { organizationId: 'ator_unit', projectId: 'atpr_unit', instanceId: 'atin_unit' };

  it('encrypts each text under the organization key bound to its position', () => {
    let cipher = createContentCipher('unit-content-secret');
    let record = withText();
    let { texts } = map(record)!;

    let [document] = toContentTextDocuments(texts, {
      ...scope,
      storage: { ...defaultStoragePolicy, contentKeyVersion: 3 },
      cipher
    });

    expect(document).toMatchObject({
      _id: `${record.id}:0`,
      ...scope,
      recordId: record.id,
      index: 0,
      role: 'prompt',
      keyVersion: 3,
      occurredAt: texts[0]!.occurredAt,
      expiresAt: texts[0]!.expiresAt
    });
    expect(Buffer.from(document!.ciphertext.buffer).toString('utf8')).not.toContain(sentinel);

    let key = cipher.forOrganization({ id: 'ator_unit', contentKeyVersion: 3 });
    let aad = contentAad({
      organizationId: 'ator_unit',
      recordId: record.id,
      index: 0,
      role: 'prompt'
    });

    expect(
      cipher.decrypt(
        key,
        {
          iv: Buffer.from(document!.iv.buffer),
          ciphertext: Buffer.from(document!.ciphertext.buffer)
        },
        aad
      )
    ).toBe(`please fix ${sentinel}`);
  });

  it('returns nothing for no texts', () => {
    expect(
      toContentTextDocuments([], {
        ...scope,
        storage: defaultStoragePolicy,
        cipher: createContentCipher('s')
      })
    ).toEqual([]);
  });
});
