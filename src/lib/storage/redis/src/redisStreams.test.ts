import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedisStreams } from './redisStreams';

let createRedis = vi.hoisted(() => vi.fn());

vi.mock('ioredis', () => ({
  default: function () {
    return createRedis();
  }
}));

afterEach(() => {
  createRedis.mockReset();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('RedisStreams connection lifecycle', () => {
  it('shares one publisher and one trim timer across concurrent sends', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let redis = {
      xadd: vi.fn().mockResolvedValue('1-0'),
      xtrim: vi.fn().mockRejectedValueOnce(new Error('trim failed')).mockResolvedValue(0)
    };
    createRedis.mockReturnValue(redis);
    let stream = new RedisStreams<number>('events', 'redis://unused');

    await Promise.all(Array.from({ length: 8 }, (_, value) => stream.send(value)));
    expect(createRedis).toHaveBeenCalledTimes(1);
    expect(redis.xadd).toHaveBeenCalledTimes(8);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(redis.xtrim).toHaveBeenCalledTimes(1);

    await stream.send(9);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(redis.xtrim).toHaveBeenCalledTimes(2);
    expect(createRedis).toHaveBeenCalledTimes(1);
  });

  it('reuses the blocking reader and releases both connections on a read failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let error = new Error('read failed');
    let redis = {
      xgroup: vi.fn().mockResolvedValue('OK'),
      xautoclaim: vi.fn().mockResolvedValue(null),
      disconnect: vi.fn()
    };
    let reader = {
      xreadgroup: vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(error),
      disconnect: vi.fn()
    };
    createRedis.mockReturnValueOnce(redis).mockReturnValueOnce(reader);
    let stream = new RedisStreams('events', 'redis://unused');

    let receiver = await stream.createReceiver({ groupId: 'group' }, async () => {});

    await vi.waitFor(() => expect(redis.disconnect).toHaveBeenCalledTimes(1));
    expect(reader.disconnect).toHaveBeenCalledTimes(1);
    expect(reader.xreadgroup).toHaveBeenCalledTimes(2);
    expect(createRedis).toHaveBeenCalledTimes(2);
    await expect(receiver.close()).rejects.toBe(error);
    expect(reader.disconnect).toHaveBeenCalledTimes(1);
  });
});
