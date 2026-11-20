import { afterEach, describe, expect, it } from 'vitest';
import {
  assertNotProduction,
  looksLikeProduction,
  readSecretFromEnv,
  redact,
  redactUrl,
  targetHosts,
  UsageError
} from '../../src/lib/safety';

describe('host allowlist', () => {
  it('allows loopback, and other hosts only when named for the run', () => {
    expect(looksLikeProduction('http://localhost:52181')).toBe(false);
    expect(looksLikeProduction('http://127.0.0.1:52180')).toBe(false);
    expect(looksLikeProduction('http://[::1]:52180')).toBe(false);
    expect(looksLikeProduction('http://at.localhost')).toBe(false);
    expect(looksLikeProduction('https://ingest.staging.example')).toBe(true);
    expect(looksLikeProduction('https://ingest.staging.example', ['*.staging.example'])).toBe(
      false
    );
    expect(looksLikeProduction('mongodb://u:p@localhost:27017,127.0.0.1:27018/x')).toBe(false);
  });

  it('refuses everything else, including addresses, other domains and AWS endpoints', () => {
    expect(looksLikeProduction('https://agent-tracking-ingest-us1.metorial.com')).toBe(true);
    expect(looksLikeProduction('http://10.0.12.7:52180')).toBe(true);
    expect(
      looksLikeProduction('http://agent-tracking.us1-stag-c1.metorial.internal:52180')
    ).toBe(true);
    expect(
      looksLikeProduction('https://staging.example.evil.example', ['*.staging.example'])
    ).toBe(true);
    expect(
      looksLikeProduction(
        'mongodb://u:p@at-records.cluster-c3.us-east-1.docdb.amazonaws.com:27017/x?tls=true'
      )
    ).toBe(true);
    expect(looksLikeProduction('mongodb+srv://u:p@cluster0.mongodb.net/x')).toBe(true);
    expect(looksLikeProduction('not a url')).toBe(true);
  });

  it('checks every host of a MongoDB seed list', () => {
    let url = 'mongodb://u:p@localhost:27017,db-2.docdb.amazonaws.com:27017/x';

    expect(targetHosts(url)).toEqual(['localhost', 'db-2.docdb.amazonaws.com']);
    expect(looksLikeProduction(url)).toBe(true);
    expect(looksLikeProduction(url, ['db-2.docdb.amazonaws.com'])).toBe(false);
  });

  it('allows hosts named for the run, exactly or by suffix', () => {
    let host = 'http://agent-tracking.us1-stag-c1.metorial.internal:52180';

    expect(looksLikeProduction(host, ['agent-tracking.us1-stag-c1.metorial.internal'])).toBe(
      false
    );
    expect(looksLikeProduction(host, ['*.us1-stag-c1.metorial.internal'])).toBe(false);
    expect(looksLikeProduction(host, ['metorial.internal'])).toBe(true);
  });

  it('needs an explicit override otherwise, and names the refused host', () => {
    let url = 'mongodb://user:secret@db.docdb.amazonaws.com:27017/x';

    expect(() => assertNotProduction(url, false, 'MongoDB')).toThrow(UsageError);
    expect(() => assertNotProduction(url, false, 'MongoDB')).toThrow(
      /db\.docdb\.amazonaws\.com/
    );
    expect(() => assertNotProduction(url, false, 'MongoDB')).not.toThrow(/secret/);
    expect(() =>
      assertNotProduction(url, false, 'MongoDB', ['db.docdb.amazonaws.com'])
    ).not.toThrow();
    expect(() => assertNotProduction(url, true, 'MongoDB')).not.toThrow();
    expect(() => assertNotProduction('http://localhost:1', false, 'endpoint')).not.toThrow();
  });
});

describe('secrets', () => {
  afterEach(() => {
    delete process.env.AT_BENCH_TEST_KEY;
  });

  it('reads keys only from a named env var', () => {
    expect(() => readSecretFromEnv(undefined, 'key')).toThrow(/--key-env is required/);
    expect(() => readSecretFromEnv('AT_BENCH_TEST_KEY', 'key')).toThrow(/is empty/);

    process.env.AT_BENCH_TEST_KEY = 'metorial_agis_secret';
    expect(readSecretFromEnv('AT_BENCH_TEST_KEY', 'key')).toBe('metorial_agis_secret');
  });

  it('redacts secrets from messages and credentials from urls', () => {
    expect(
      redact('failed with metorial_agis_secret twice: metorial_agis_secret', [
        'metorial_agis_secret'
      ])
    ).toBe('failed with [redacted] twice: [redacted]');
    expect(redactUrl('mongodb://user:pass@host:27017/db')).not.toContain('pass');
    expect(redactUrl('https://host/x')).toBe('https://host/x');
  });
});
