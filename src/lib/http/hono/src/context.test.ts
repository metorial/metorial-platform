import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { useRequestContext } from './context';

let app = new Hono().get('/', c => c.json(useRequestContext(c)));

let contextFor = async (headers: Record<string, string>) =>
  (await app.request('/', { headers })).json();

describe('useRequestContext', () => {
  it('returns the visitor Cloudflare forwarded through the load balancer', async () => {
    expect(
      await contextFor({
        'x-forwarded-for': '198.51.100.7, 173.245.48.10',
        'cf-connecting-ip': '198.51.100.7',
        'user-agent': 'test-agent'
      })
    ).toEqual({ ip: '198.51.100.7', ua: 'test-agent' });
  });

  it('ignores addresses a client prepends to the forwarded chain', async () => {
    expect((await contextFor({ 'x-forwarded-for': '203.0.113.5, 198.51.100.7' })).ip).toBe(
      '198.51.100.7'
    );
  });

  it('ignores cf-connecting-ip and x-real-ip unless Cloudflare is the closest hop', async () => {
    expect(
      (
        await contextFor({
          'x-forwarded-for': '198.51.100.7',
          'cf-connecting-ip': '203.0.113.5'
        })
      ).ip
    ).toBe('198.51.100.7');
    expect((await contextFor({ 'cf-connecting-ip': '203.0.113.5' })).ip).toBe('0.0.0.0');
    expect((await contextFor({ 'x-real-ip': '203.0.113.5' })).ip).toBe('0.0.0.0');
  });
});
