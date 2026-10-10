import { beforeEach, describe, expect, it, vi } from 'vitest';

let lookup = vi.fn();
vi.mock('node:dns/promises', () => ({ lookup }));

let { assertPublicWebSocketUrl, WebSocketUrlNotAllowedError } =
  await import('./assertPublicWebSocketUrl');

let expectRejected = async (url: string) => {
  let error = await assertPublicWebSocketUrl(url).catch(err => err);
  expect(error).toBeInstanceOf(WebSocketUrlNotAllowedError);
  expect(error.code).toBe('gateway_url_not_allowed');
};

describe('assertPublicWebSocketUrl', () => {
  beforeEach(() => {
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: '162.159.135.232', family: 4 }]);
  });

  it('allows wss URLs whose host resolves only to public addresses', async () => {
    lookup.mockResolvedValue([
      { address: '162.159.135.232', family: 4 },
      { address: '2606:4700::6810:84e5', family: 6 }
    ]);

    let url = await assertPublicWebSocketUrl('wss://gateway.discord.gg/?v=10');

    expect(url.hostname).toBe('gateway.discord.gg');
    expect(lookup).toHaveBeenCalledWith('gateway.discord.gg', { all: true, verbatim: true });
  });

  it('allows public literal IPs without a DNS lookup', async () => {
    await expect(assertPublicWebSocketUrl('wss://8.8.8.8/socket')).resolves.toBeInstanceOf(
      URL
    );
    await expect(assertPublicWebSocketUrl('wss://[2606:4700::1]/')).resolves.toBeInstanceOf(
      URL
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects non-wss schemes, credentials and invalid URLs', async () => {
    for (let url of [
      'ws://gateway.example/',
      'https://gateway.example/',
      'http://gateway.example/',
      'file:///etc/passwd',
      'wss://user:pass@gateway.example/',
      'not a url'
    ]) {
      await expectRejected(url);
    }
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects literal IPs in private, loopback, link-local and other internal ranges', async () => {
    for (let host of [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '0x7f.1',
      '[::1]',
      '[::]',
      '[fc00::1]',
      '[fd12:3456::1]',
      '[fe80::1]',
      '[ff02::1]',
      '[::ffff:127.0.0.1]',
      '[::ffff:10.0.0.1]',
      '[::ffff:169.254.169.254]'
    ]) {
      await expectRejected(`wss://${host}/gateway`);
    }
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects hosts when any resolved address is internal', async () => {
    lookup.mockResolvedValue([
      { address: '162.159.135.232', family: 4 },
      { address: '10.1.2.3', family: 4 }
    ]);
    await expectRejected('wss://rebind.example/');

    lookup.mockResolvedValue([{ address: 'fd00::5', family: 6 }]);
    await expectRejected('wss://ula.example/');

    lookup.mockResolvedValue([{ address: '::ffff:192.168.0.10', family: 6 }]);
    await expectRejected('wss://mapped.example/');

    lookup.mockResolvedValue([]);
    await expectRejected('wss://empty.example/');
  });
});
