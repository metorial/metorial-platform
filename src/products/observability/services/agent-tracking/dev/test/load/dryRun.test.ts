import { describe, expect, it } from 'vitest';
import { runDryRun } from '../../src/load/dryRun';
import { rejectedOfOtlpResponse } from '../../src/load/payload';
import { defaultTrafficProfile } from '../../src/load/profile';
import { encodeExportResponse } from '@mtsrc/agent-tracking-otlp';

describe('dry run through the service ingest path', () => {
  it('accepts every generated record with the sent tokens and cost (protobuf)', async () => {
    let report = await runDryRun({
      profile: defaultTrafficProfile,
      seed: 1,
      batches: 120,
      backfillRequests: 1,
      format: 'protobuf',
      compression: 'none'
    });

    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.live.records).toBeGreaterThan(300);
    expect(report.live.stored).toBe(report.live.records);
    expect(Object.keys(report.live.byType).sort()).toEqual(
      ['model.request', 'prompt.submitted', 'tool.call', 'tool.decision'].sort()
    );
    expect(report.live.tokens.stored).toEqual(report.live.tokens.expected);
    expect(report.live.tokens.stored.cacheRead).toBeGreaterThan(0);
    expect(report.live.costUsd.stored).toBeCloseTo(report.live.costUsd.expected, 6);
    expect(report.live.failedRequests.stored).toBe(report.live.failedRequests.expected);
    expect(report.backfill.accepted).toBe(report.backfill.items);
    expect(report.backfill.stored).toBe(report.backfill.items);
    expect(report.documentBytes.all.mean).toBeGreaterThan(300);
  });

  it('accepts the JSON encoding with gzip', async () => {
    let report = await runDryRun({
      profile: defaultTrafficProfile,
      seed: 2,
      batches: 30,
      backfillRequests: 0,
      format: 'json',
      compression: 'gzip'
    });

    expect(report.problems).toEqual([]);
    expect(report.live.stored).toBe(report.live.records);
  });
});

describe('OTLP partial success', () => {
  it('reads rejected records from the service encoding', () => {
    expect(rejectedOfOtlpResponse(new Uint8Array(), 'application/x-protobuf')).toBe(0);
    expect(
      rejectedOfOtlpResponse(
        encodeExportResponse('logs', { rejected: 300, message: 'no' }),
        'application/x-protobuf'
      )
    ).toBe(300);
    expect(
      rejectedOfOtlpResponse(
        new TextEncoder().encode(
          JSON.stringify({ partialSuccess: { rejectedLogRecords: '4' } })
        ),
        'application/json'
      )
    ).toBe(4);
  });
});
