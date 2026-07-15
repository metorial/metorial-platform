import { describe, expect, it } from 'vitest';
import { __documentCollaborationTestUtils } from './documentCollaboration';

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
});
