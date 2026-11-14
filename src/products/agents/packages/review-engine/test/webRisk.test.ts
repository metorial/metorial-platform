import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebRiskCheck } from '../src/webRisk';

let mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('@lowerdeck/ssrf', () => ({ safeFetch: mocks.fetch }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  mocks.fetch.mockImplementation(async () => Response.json({}));
});

afterEach(() => vi.useRealTimers());

describe('Web Risk reputation caching', () => {
  it('refreshes a clean verdict after five minutes', async () => {
    let check = createWebRiskCheck('synthetic');
    await check('https://docs.vendor.com/a');
    await check('https://docs.vendor.com/a');
    expect(mocks.fetch).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date('2026-10-28T12:06:00Z'));
    await check('https://docs.vendor.com/a');
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it('honors the unsafe verdict expiry supplied by Google', async () => {
    mocks.fetch.mockImplementation(async () =>
      Response.json({
        threat: {
          threatTypes: ['MALWARE'],
          expireTime: '2026-10-28T12:01:00Z'
        }
      })
    );
    let check = createWebRiskCheck('synthetic');
    expect((await check('https://docs.vendor.com/a')).verdict).toBe('unsafe');
    await check('https://docs.vendor.com/a');
    expect(mocks.fetch).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date('2026-10-28T12:02:00Z'));
    await check('https://docs.vendor.com/a');
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not reuse an expired clear verdict when Google is unavailable', async () => {
    let check = createWebRiskCheck('synthetic');
    await check('https://docs.vendor.com/a');
    vi.setSystemTime(new Date('2026-10-28T12:06:00Z'));
    mocks.fetch.mockRejectedValue(new Error('network failed'));

    await expect(check('https://docs.vendor.com/a')).rejects.toThrow('reputation_unavailable');
  });
});
