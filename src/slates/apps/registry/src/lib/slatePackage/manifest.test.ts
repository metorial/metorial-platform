import { describe, expect, it } from 'bun:test';
import { normalizeSlatePackage } from './manifest';

let createEntries = (slateJson: Record<string, unknown>) => [
  {
    path: 'slate.json',
    buffer: Buffer.from(JSON.stringify(slateJson))
  },
  {
    path: 'package.json',
    buffer: Buffer.from(
      JSON.stringify({
        name: '@npm/weather-package',
        version: '1.2.3',
        description: 'Weather slate'
      })
    )
  }
];

let normalizeWithTimeout = (timeout?: unknown) =>
  normalizeSlatePackage({
    entries: createEntries({
      name: '@demo/weather',
      ...(timeout !== undefined ? { timeout } : {})
    }),
    identifier: {
      scopeIdentifier: 'demo',
      slateIdentifier: 'weather'
    }
  });

describe('slate.json timeout validation', () => {
  it('accepts a manifest without a timeout', () => {
    expect(normalizeWithTimeout().manifest.timeout).toBeUndefined();
  });

  it('accepts timeouts within the Lambda limit', () => {
    expect(normalizeWithTimeout(1).manifest.timeout).toBe(1);
    expect(normalizeWithTimeout(120).manifest.timeout).toBe(120);
    expect(normalizeWithTimeout(900).manifest.timeout).toBe(900);
  });

  it('rejects timeouts above the 900 second Lambda maximum', () => {
    expect(() => normalizeWithTimeout(901)).toThrow();
    expect(() => normalizeWithTimeout(1500)).toThrow();
  });

  it('rejects zero and negative timeouts', () => {
    expect(() => normalizeWithTimeout(0)).toThrow();
    expect(() => normalizeWithTimeout(-15)).toThrow();
  });

  it('rejects non-integer timeouts', () => {
    expect(() => normalizeWithTimeout(12.5)).toThrow();
  });
});
