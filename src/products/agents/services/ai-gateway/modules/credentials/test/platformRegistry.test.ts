import type { ConnectionCheckResult } from '@mtsrc/ai-gateway-spec';
import { describe, expect, it, vi } from 'vitest';
import { platformConnection } from '../src/lib/definitions/platformConnection';
import {
  createPlatformConnectionRegistry,
  type PlatformConnectionState
} from '../src/lib/platformRegistry';

let anthropic = platformConnection({
  slug: 'anthropic',
  provider: 'anthropic',
  name: 'Anthropic',
  credentials: { apiKey: 'sk-ant-abcdef123456' }
});

let openai = platformConnection({
  slug: 'openai',
  provider: 'openai',
  name: 'OpenAI',
  credentials: { apiKey: undefined }
});

let registry = (d: {
  results?: ConnectionCheckResult[];
  onStatusChange?: (state: PlatformConnectionState) => void;
  now?: () => Date;
}) => {
  let results = [...(d.results ?? [])];
  let check = vi.fn(async () => results.shift() ?? { outcome: 'valid' as const });

  return {
    check,
    registry: createPlatformConnectionRegistry({
      definitions: [anthropic, openai],
      check,
      onStatusChange: d.onStatusChange,
      now: d.now
    })
  };
};

describe('createPlatformConnectionRegistry', () => {
  it('starts configured connections as pending and leaves unconfigured ones out', () => {
    let { registry: r } = registry({});

    expect(r.status('anthropic')).toBe('pending');
    expect(r.status('openai')).toBeNull();
    expect(r.status('unknown')).toBeNull();
    expect(r.list().find(state => state.slug == 'openai')).toMatchObject({
      configured: false,
      status: 'disabled',
      statusMessage: expect.stringContaining('apiKey')
    });
  });

  it('only checks configured connections', async () => {
    let { registry: r, check } = registry({});

    await r.checkAll();

    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith({
      providerSlug: 'anthropic',
      credentials: { apiKey: 'sk-ant-abcdef123456' },
      config: {}
    });
    expect(r.status('anthropic')).toBe('valid');
  });

  it('marks a rejected key invalid and reports the change', async () => {
    let changes: PlatformConnectionState[] = [];
    let { registry: r } = registry({
      results: [{ outcome: 'valid' }, { outcome: 'invalid', message: 'bad key' }],
      onStatusChange: state => changes.push(state)
    });

    await r.check('anthropic');
    await r.check('anthropic');

    expect(r.status('anthropic')).toBe('invalid');
    expect(changes.map(state => [state.status, state.statusMessage])).toEqual([
      ['valid', null],
      ['invalid', 'bad key']
    ]);
  });

  it('keeps the last known status when the provider is unreachable', async () => {
    let { registry: r } = registry({
      results: [{ outcome: 'valid' }, { outcome: 'unreachable' }]
    });

    await r.check('anthropic');
    await r.check('anthropic');

    expect(r.status('anthropic')).toBe('valid');
  });

  it('throttles re-checks after auth failures', async () => {
    let time = 0;
    let { registry: r, check } = registry({ now: () => new Date(time) });

    time = 100_000;
    r.reportAuthFailure('anthropic');
    r.reportAuthFailure('anthropic');
    time = 200_000;
    r.reportAuthFailure('anthropic');
    await Promise.resolve();

    expect(check).toHaveBeenCalledTimes(2);
  });

  it('returns credentials only for configured connections', () => {
    let { registry: r } = registry({});

    expect(r.credentials('anthropic')).toEqual({ apiKey: 'sk-ant-abcdef123456' });
    expect(() => r.credentials('openai')).toThrow(/apiKey/);
    expect(() => r.credentials('unknown')).toThrow(/not defined/);
  });
});
