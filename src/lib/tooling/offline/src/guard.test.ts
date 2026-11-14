import { describe, expect, test } from 'bun:test';
import net from 'node:net';
import { getBlockedConnections, installOfflineMode, isBlockedConnectionError } from './index';

installOfflineMode();

let lastBlocked = () => getBlockedConnections().at(-1);

describe('offline network guard', () => {
  test('refuses net sockets with a recorded target', async () => {
    let socket = net.createConnection({ host: '10.0.0.1', port: 5432 });
    let error = await new Promise(resolve => socket.on('error', resolve));

    expect(isBlockedConnectionError(error)).toBe(true);
    expect(lastBlocked()).toMatchObject({ kind: 'net', target: '10.0.0.1:5432' });
  });

  test('refuses fetch', async () => {
    let error = await fetch('https://example.com/x').catch(e => e);

    expect(isBlockedConnectionError(error)).toBe(true);
    expect(lastBlocked()).toMatchObject({ kind: 'fetch', target: 'https://example.com/x' });
  });

  test('replaces the Bun native redis client', async () => {
    let { RedisClient } = await import('bun');
    new RedisClient('redis://10.0.0.2:6379');

    expect(lastBlocked()).toMatchObject({ kind: 'redis', target: 'redis://10.0.0.2:6379' });
  });

  test('sets offline env', () => {
    expect(process.env.LOWERDECK_OFFLINE).toBe('1');
    expect(process.env.DATABASE_URL).toContain('127.0.0.1:1');
  });
});
