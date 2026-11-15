import { describe, expect, it, vi } from 'vitest';
import {
  buildSubscriptionFilter,
  SubscriptionStream,
  toLegacySubscriptionMessage,
  type SubscriptionStreamOutcome
} from './subscriptions';

describe('buildSubscriptionFilter', () => {
  it('subscribes to list changes the server advertises and to resource URIs', () => {
    expect(
      buildSubscriptionFilter({
        serverCapabilities: {
          tools: { listChanged: true },
          prompts: {},
          resources: { listChanged: true, subscribe: true }
        },
        resourceUris: ['file:///a.json']
      })
    ).toEqual({
      toolsListChanged: true,
      resourcesListChanged: true,
      resourceSubscriptions: ['file:///a.json']
    });
  });

  it('returns null when there is nothing to listen for', () => {
    expect(
      buildSubscriptionFilter({ serverCapabilities: { tools: {} }, resourceUris: [] })
    ).toBe(null);
  });
});

describe('toLegacySubscriptionMessage', () => {
  it('drops acknowledgments and the graceful-close response', () => {
    expect(
      toLegacySubscriptionMessage({
        jsonrpc: '2.0',
        method: 'notifications/subscriptions/acknowledged',
        params: {}
      })
    ).toBe(null);

    expect(toLegacySubscriptionMessage({ jsonrpc: '2.0', id: 1, result: {} })).toBe(null);
  });

  it('strips the subscription id from notifications', () => {
    expect(
      toLegacySubscriptionMessage({
        jsonrpc: '2.0',
        method: 'notifications/resources/updated',
        params: {
          uri: 'file:///a.json',
          _meta: { 'io.modelcontextprotocol/subscriptionId': 1 }
        }
      })
    ).toEqual({
      jsonrpc: '2.0',
      method: 'notifications/resources/updated',
      params: { uri: 'file:///a.json' }
    });
  });
});

describe('SubscriptionStream', () => {
  it('reopens only when the filter changes and aborts the previous stream', () => {
    let signals: AbortSignal[] = [];
    let open = vi.fn((_filter, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<SubscriptionStreamOutcome>(() => {});
    });
    let stream = new SubscriptionStream(open);

    stream.update({ toolsListChanged: true });
    stream.update({ toolsListChanged: true });
    expect(open).toHaveBeenCalledTimes(1);

    stream.update({ toolsListChanged: true, resourceSubscriptions: ['x'] });
    expect(open).toHaveBeenCalledTimes(2);
    expect(signals[0]!.aborted).toBe(true);

    stream.update(null);
    expect(signals[1]!.aborted).toBe(true);
  });

  it('reconnects with backoff after the stream ends', async () => {
    vi.useFakeTimers();

    try {
      let open = vi.fn(async (): Promise<SubscriptionStreamOutcome> => 'reconnect');
      let stream = new SubscriptionStream(open);

      stream.update({ toolsListChanged: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(open).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(open).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1999);
      expect(open).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(open).toHaveBeenCalledTimes(3);

      stream.close();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(open).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops reconnecting when the stream reports a permanent failure', async () => {
    vi.useFakeTimers();

    try {
      let open = vi.fn(async (): Promise<SubscriptionStreamOutcome> => 'stop');
      let stream = new SubscriptionStream(open);

      stream.update({ toolsListChanged: true });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(open).toHaveBeenCalledTimes(1);

      stream.update({ toolsListChanged: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(open).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
