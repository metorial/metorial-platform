import { describe, expect, it } from 'vitest';
import { buildCodexConfig, tomlBasicString } from './codexConfig';
import { ingestionKeyPlaceholder } from './settingsFile';

let ingestUrl = 'https://agent-tracking-ingest.example.com';
let secret = 'metorial_atis_0mhNnEqM7XQb3vXq8gD2abcd';

describe('buildCodexConfig', () => {
  it('writes the logs exporter over OTLP/HTTP JSON in the shape Metorial Desktop writes', () => {
    let config = buildCodexConfig({ ingestUrl, secret });

    expect(config.toml).toBe(
      [
        '[otel]',
        `exporter = { otlp-http = { endpoint = "https://agent-tracking-ingest.example.com/v1/logs", protocol = "json", headers = { Authorization = "Bearer ${secret}" } } }`,
        ''
      ].join('\n')
    );
    expect(config.usesPlaceholder).toBe(false);
  });

  it('keeps the exporter line on its own for merging into an existing otel table', () => {
    let config = buildCodexConfig({ ingestUrl, secret });

    expect(config.toml).toBe(`[otel]\n${config.exporterLine}\n`);
    expect(config.exporterLine.startsWith('exporter = { otlp-http = {')).toBe(true);
  });

  it('points the endpoint at the full logs path, which Codex uses as given', () => {
    let config = buildCodexConfig({ ingestUrl, secret });

    expect(config.endpoint).toBe(`${ingestUrl}/v1/logs`);
    expect(config.exporterLine).toContain(`endpoint = "${ingestUrl}/v1/logs"`);
  });

  it('joins the logs path onto an ingest URL with trailing slashes', () => {
    let config = buildCodexConfig({ ingestUrl: ' https://ingest.example.com// ', secret });

    expect(config.endpoint).toBe('https://ingest.example.com/v1/logs');
    expect(config.exporterLine).toContain('endpoint = "https://ingest.example.com/v1/logs"');
  });

  it('puts the key in the Authorization header and nowhere else', () => {
    let config = buildCodexConfig({ ingestUrl, secret });

    expect(config.exporterLine).toContain(`headers = { Authorization = "Bearer ${secret}" }`);
    expect(config.exporterLine.split(secret)).toHaveLength(2);
    expect(config.endpoint).not.toContain(secret);
  });

  it('writes a marked placeholder when the key is no longer available', () => {
    for (let missing of [null, undefined, '']) {
      let config = buildCodexConfig({ ingestUrl, secret: missing });

      expect(config.usesPlaceholder).toBe(true);
      expect(config.exporterLine).toContain(
        `Authorization = "Bearer ${ingestionKeyPlaceholder}"`
      );
    }
  });

  it('escapes characters that would end or break the TOML strings', () => {
    let config = buildCodexConfig({
      ingestUrl: 'https://ingest.example.com/a"b\\c',
      secret: 'key"with\\odd\nchars'
    });

    expect(config.exporterLine).toContain(
      'endpoint = "https://ingest.example.com/a\\"b\\\\c/v1/logs"'
    );
    expect(config.exporterLine).toContain(
      'Authorization = "Bearer key\\"with\\\\odd\\nchars"'
    );
  });
});

describe('tomlBasicString', () => {
  it('quotes plain text unchanged', () => {
    expect(tomlBasicString('Bearer abc-123_XYZ')).toBe('"Bearer abc-123_XYZ"');
  });

  it.each([
    ['"', '"\\""'],
    ['\\', '"\\\\"'],
    ['\b', '"\\b"'],
    ['\t', '"\\t"'],
    ['\n', '"\\n"'],
    ['\f', '"\\f"'],
    ['\r', '"\\r"'],
    ['\u0000', '"\\u0000"'],
    ['\u001b', '"\\u001B"'],
    ['\u007f', '"\\u007F"']
  ])('escapes %j', (value, quoted) => {
    expect(tomlBasicString(value)).toBe(quoted);
  });

  it('leaves non-ASCII text as it is, which TOML allows in basic strings', () => {
    expect(tomlBasicString('clé ✓')).toBe('"clé ✓"');
  });
});
