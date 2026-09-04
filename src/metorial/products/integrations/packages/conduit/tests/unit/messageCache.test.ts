import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { MessageCache } from '../../src/core/messageCache';
import type { ConduitResponse } from '../../src/types/response';

describe('MessageCache', () => {
  let cache: MessageCache;

  beforeEach(() => {
    cache = new MessageCache(100, 1000); // 100 items, 1 second TTL
  });

  afterEach(() => {
    cache.destroy();
  });

  test('should store and retrieve responses', () => {
    const response: ConduitResponse = {
      messageId: 'msg-1',
      success: true,
      result: { data: 'test' },
      processedAt: Date.now()
    };

    cache.set('msg-1', response);
    const retrieved = cache.get('msg-1');

    expect(retrieved).toEqual(response);
  });

  test('should return undefined for non-existent keys', () => {
    const retrieved = cache.get('non-existent');
    expect(retrieved).toBeUndefined();
  });

  test('should indicate has() correctly', () => {
    const response: ConduitResponse = {
      messageId: 'msg-1',
      success: true,
      result: null,
      processedAt: Date.now()
    };

    expect(cache.has('msg-1')).toBe(false);
    cache.set('msg-1', response);
    expect(cache.has('msg-1')).toBe(true);
  });

  test('should delete entries', () => {
    const response: ConduitResponse = {
      messageId: 'msg-1',
      success: true,
      result: null,
      processedAt: Date.now()
    };

    cache.set('msg-1', response);
    expect(cache.has('msg-1')).toBe(true);
    cache.delete('msg-1');
    expect(cache.has('msg-1')).toBe(false);
  });

  test('should clear all entries', () => {
    cache.set('msg-1', {
      messageId: 'msg-1',
      success: true,
      result: null,
      processedAt: Date.now()
    });
    cache.set('msg-2', {
      messageId: 'msg-2',
      success: true,
      result: null,
      processedAt: Date.now()
    });

    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  test('should expire entries after TTL', async () => {
    const response: ConduitResponse = {
      messageId: 'msg-1',
      success: true,
      result: null,
      processedAt: Date.now()
    };

    cache.set('msg-1', response);
    expect(cache.has('msg-1')).toBe(true);

    // Wait for expiry (1 second TTL + buffer)
    await new Promise(resolve => setTimeout(resolve, 1100));

    expect(cache.has('msg-1')).toBe(false);
  });

  test('should enforce max size with LRU eviction', () => {
    const smallCache = new MessageCache(3, 60000); // Max 3 items

    smallCache.set('msg-1', {
      messageId: 'msg-1',
      success: true,
      result: null,
      processedAt: Date.now()
    });
    smallCache.set('msg-2', {
      messageId: 'msg-2',
      success: true,
      result: null,
      processedAt: Date.now()
    });
    smallCache.set('msg-3', {
      messageId: 'msg-3',
      success: true,
      result: null,
      processedAt: Date.now()
    });

    expect(smallCache.size()).toBe(3);

    // Adding 4th item should evict first item
    smallCache.set('msg-4', {
      messageId: 'msg-4',
      success: true,
      result: null,
      processedAt: Date.now()
    });

    expect(smallCache.size()).toBe(3);
    expect(smallCache.has('msg-1')).toBe(false);
    expect(smallCache.has('msg-2')).toBe(true);
    expect(smallCache.has('msg-3')).toBe(true);
    expect(smallCache.has('msg-4')).toBe(true);

    smallCache.destroy();
  });

  test('should not evict when updating existing key', () => {
    const smallCache = new MessageCache(3, 60000);

    smallCache.set('msg-1', {
      messageId: 'msg-1',
      success: true,
      result: 'v1',
      processedAt: Date.now()
    });
    smallCache.set('msg-2', {
      messageId: 'msg-2',
      success: true,
      result: 'v2',
      processedAt: Date.now()
    });
    smallCache.set('msg-3', {
      messageId: 'msg-3',
      success: true,
      result: 'v3',
      processedAt: Date.now()
    });

    // Update existing key
    smallCache.set('msg-2', {
      messageId: 'msg-2',
      success: true,
      result: 'v2-updated',
      processedAt: Date.now()
    });

    expect(smallCache.size()).toBe(3);
    expect(smallCache.get('msg-2')?.result).toBe('v2-updated');

    smallCache.destroy();
  });
});
