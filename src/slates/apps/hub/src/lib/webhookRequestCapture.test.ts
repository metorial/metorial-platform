import { describe, expect, it } from 'vitest';
import {
  attestWebhookCaptureConformanceReport,
  captureWebhookWireRequest,
  DEFAULT_WEBHOOK_BODY_LIMIT_BYTES,
  extractExplicitPathSecret,
  GLOBAL_WEBHOOK_BODY_LIMIT_BYTES,
  redactWebhookHeaders,
  redactWebhookUrl,
  validateWebhookCaptureConformanceReport,
  WebhookCaptureError
} from './webhookRequestCapture';

let request = (body?: BodyInit | null, headers?: HeadersInit) =>
  new Request('https://hooks.test/inbound/token?secret=one&secret=two', {
    method: 'POST',
    headers,
    ...(body === undefined ? {} : { body })
  });

describe('bounded webhook request capture', () => {
  it.each(['false', '-1', '1.5', '01', '1e2'])(
    'rejects malformed Content-Length %s',
    async value => {
      await expect(
        captureWebhookWireRequest({
          request: request('x'),
          trustedRawHeaders: [['Content-Length', value]]
        })
      ).rejects.toMatchObject({ code: 'wire_input_malformed' });
    }
  );

  it('accepts absent Content-Length and rejects duplicate or dishonest values', async () => {
    await expect(
      captureWebhookWireRequest({ request: request('abc') })
    ).resolves.toMatchObject({
      body: { present: true, base64: 'YWJj' }
    });
    await expect(
      captureWebhookWireRequest({
        request: request('abc'),
        trustedRawHeaders: [
          ['Content-Length', '3'],
          ['content-length', '3']
        ]
      })
    ).rejects.toMatchObject({ code: 'wire_input_malformed' });
    await expect(
      captureWebhookWireRequest({
        request: request('abc'),
        trustedRawHeaders: [['Content-Length', '2']]
      })
    ).rejects.toMatchObject({ code: 'wire_input_malformed' });
  });

  it('enforces exact default, rule, and global boundaries', async () => {
    await expect(
      captureWebhookWireRequest({
        request: request(new Uint8Array(4)),
        maxBodyBytes: 4
      })
    ).resolves.toBeTruthy();
    await expect(
      captureWebhookWireRequest({
        request: request(new Uint8Array(5)),
        maxBodyBytes: 4
      })
    ).rejects.toMatchObject({ code: 'wire_input_oversized' });
    await expect(
      captureWebhookWireRequest({
        request: request(new Uint8Array(DEFAULT_WEBHOOK_BODY_LIMIT_BYTES + 1))
      })
    ).rejects.toMatchObject({ code: 'wire_input_oversized' });
    await expect(
      captureWebhookWireRequest({
        request: request(null),
        maxBodyBytes: GLOBAL_WEBHOOK_BODY_LIMIT_BYTES + 1
      })
    ).rejects.toMatchObject({ code: 'wire_input_malformed' });
  });

  it('preserves absent, present-empty, and binary bodies exactly', async () => {
    let absent = await captureWebhookWireRequest({ request: request(undefined) });
    let empty = await captureWebhookWireRequest({ request: request(new Uint8Array()) });
    let binary = await captureWebhookWireRequest({
      request: request(Uint8Array.from([0, 255, 1, 128]))
    });
    expect(absent.body).toEqual({ present: false });
    expect(empty.body).toEqual({ present: true, base64: '' });
    expect(binary.body).toEqual({ present: true, base64: 'AP8BgA==' });
  });

  it('rejects ambiguous security duplicates but preserves ordinary ordered duplicates', async () => {
    await expect(
      captureWebhookWireRequest({
        request: request(''),
        trustedRawHeaders: [
          ['X-Signature', 'one'],
          ['x-signature', 'two']
        ]
      })
    ).rejects.toMatchObject({ code: 'security_header_ambiguous' });
    await expect(
      captureWebhookWireRequest({
        request: request(''),
        trustedRawHeaders: [
          ['X-Slack-Signature', 'one'],
          ['x-slack-signature', 'two']
        ]
      })
    ).rejects.toMatchObject({ code: 'security_header_ambiguous' });
    let captured = await captureWebhookWireRequest({
      request: request(''),
      trustedRawHeaders: [
        ['X-Ordinary', 'one'],
        ['x-ordinary', 'two,three']
      ]
    });
    expect(captured.headers).toEqual([
      ['X-Ordinary', 'one'],
      ['x-ordinary', 'two,three']
    ]);
  });

  it('redacts repeated query values, path secrets, and security headers', () => {
    let url = redactWebhookUrl(
      'https://hooks.test/slates-hub/triggers/webhook/id/path-secret?token=one&token=two',
      'path-secret'
    );
    expect(url).not.toContain('path-secret');
    expect(url).not.toContain('one');
    expect(url).not.toContain('two');
    expect(new URL(url).searchParams.getAll('token')).toEqual(['[REDACTED]', '[REDACTED]']);
    expect(
      redactWebhookHeaders([
        ['Authorization', 'bearer-secret'],
        ['Content-Type', 'application/json']
      ])
    ).toEqual([
      ['Authorization', '[REDACTED]'],
      ['Content-Type', '[REDACTED]']
    ]);
    expect(
      extractExplicitPathSecret({
        requestUrl: 'https://hooks.test/slates-hub/triggers/webhook/id/a%2Bb',
        routePrefix: '/slates-hub/triggers/webhook/id'
      })
    ).toBe('a+b');
  });

  it('requires deployed-path evidence for every conformance case', () => {
    let now = new Date('2026-08-14T12:00:00.000Z');
    let unsigned = {
      version: 1 as const,
      reportId: 'report-1234567890',
      deploymentId: 'deploy-1',
      runtime: 'bun-edge-1',
      buildId: 'build-1',
      route: 'slates_hub_public_native_v1',
      configDigest: 'sha256:config',
      rawHeaderSource: 'native' as const,
      executedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
      cases: Object.fromEntries(
        [
          'unique_mixed_case_headers',
          'case_variant_duplicate_name',
          'ordered_duplicate_headers',
          'comma_containing_single_value',
          'repeated_query_parameters',
          'binary_body',
          'absent_body',
          'present_empty_body'
        ].map(name => [name, 'passed'])
      ) as any
    };
    let report = attestWebhookCaptureConformanceReport(unsigned, 'service-auth-secret');
    let options = {
      buildId: 'build-1',
      route: 'slates_hub_public_native_v1',
      configDigest: 'sha256:config',
      serviceAuthSecret: 'service-auth-secret',
      now
    };
    expect(validateWebhookCaptureConformanceReport(undefined, 'deploy-1', options)).toBe(
      false
    );
    expect(
      validateWebhookCaptureConformanceReport(JSON.stringify(report), 'deploy-1', options)
    ).toBe(true);
    expect(
      validateWebhookCaptureConformanceReport(
        JSON.stringify({ ...report, buildId: 'tampered' }),
        'deploy-1',
        options
      )
    ).toBe(false);
    expect(
      validateWebhookCaptureConformanceReport(JSON.stringify(report), 'deploy-1', {
        ...options,
        serviceAuthSecret: 'spoofed-secret'
      })
    ).toBe(false);
    expect(
      validateWebhookCaptureConformanceReport(JSON.stringify(report), 'deploy-1', {
        ...options,
        now: new Date(now.getTime() + 60_001)
      })
    ).toBe(false);
    let usedReportIds = new Set<string>();
    expect(
      validateWebhookCaptureConformanceReport(JSON.stringify(report), 'deploy-1', {
        ...options,
        usedReportIds
      })
    ).toBe(true);
    expect(
      validateWebhookCaptureConformanceReport(JSON.stringify(report), 'deploy-1', {
        ...options,
        usedReportIds
      })
    ).toBe(false);
  });

  it('fails closed when trusted raw tuples are unavailable', async () => {
    await expect(
      captureWebhookWireRequest({
        request: request(''),
        requireTrustedRawHeaders: true
      })
    ).rejects.toEqual(
      expect.objectContaining<WebhookCaptureError>({ code: 'raw_header_capture_unavailable' })
    );
  });
});
