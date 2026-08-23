import { afterEach, describe, expect, it, vi } from 'vitest';
import { __documentCollaborationTestUtils } from './documentCollaboration';

afterEach(() => {
  vi.useRealTimers();
});

describe('document collaboration reset helpers', () => {
  it('seeds a reset collaboration state from the authoritative document snapshot', () => {
    let document = {
      id: 'doc_123',
      title: 'Skill',
      content: '# Skill\n\nMerged content.'
    } as any;

    expect(
      __documentCollaborationTestUtils.resolveInitialMarkdown({
        document,
        initialMarkdown: 'Stale editor content.',
        getInitialMarkdown: current => current.content.replace(/^# Skill\n\n/, '')
      })
    ).toBe('Merged content.');
  });

  it('does not let read-only viewers initialize collaboration state', () => {
    expect(
      __documentCollaborationTestUtils.shouldInitializeCollaboration({
        canWrite: false,
        bodyStateReceived: false,
        initialMarkdown: 'Managed content'
      })
    ).toBe(false);
    expect(
      __documentCollaborationTestUtils.shouldInitializeCollaboration({
        canWrite: true,
        bodyStateReceived: false,
        initialMarkdown: 'Writable content'
      })
    ).toBe(true);
  });

  it('uses capped exponential reconnect delays with jitter', () => {
    expect(__documentCollaborationTestUtils.getReconnectDelayMs(0, () => 0)).toBe(1_000);
    expect(__documentCollaborationTestUtils.getReconnectDelayMs(1, () => 1)).toBe(2_500);
    expect(__documentCollaborationTestUtils.getReconnectDelayMs(10, () => 1)).toBe(10_000);
  });

  it('stops reconnecting after the configured attempt budget', () => {
    let maxAttempts = __documentCollaborationTestUtils.reconnectMaxAttempts;

    expect(__documentCollaborationTestUtils.canRetryConnection(maxAttempts - 1)).toBe(true);
    expect(__documentCollaborationTestUtils.canRetryConnection(maxAttempts)).toBe(false);
  });

  it('refreshes document tokens one minute before expiry', () => {
    let now = new Date('2030-01-01T00:00:00Z').getTime();

    expect(
      __documentCollaborationTestUtils.getTokenRefreshDelayMs(new Date(now + 5 * 60_000), now)
    ).toBe(4 * 60_000);
    expect(
      __documentCollaborationTestUtils.getTokenRefreshDelayMs(new Date(now + 30_000), now)
    ).toBe(0);
  });
});

describe('document collaboration connection lifecycle', () => {
  it('cancels a deferred initial connection during a StrictMode cleanup', () => {
    vi.useFakeTimers();
    let connect = vi.fn();

    let cancel = __documentCollaborationTestUtils.deferInitialConnection(connect);
    cancel();
    vi.runAllTimers();

    expect(connect).not.toHaveBeenCalled();
  });

  it('starts a normal deferred initial connection', () => {
    vi.useFakeTimers();
    let connect = vi.fn();

    __documentCollaborationTestUtils.deferInitialConnection(connect);
    vi.runAllTimers();

    expect(connect).toHaveBeenCalledOnce();
  });
});
