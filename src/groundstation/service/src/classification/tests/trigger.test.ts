import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionClassifyQueue } from '../../queues/sessionClassify';
import type { SessionDocument } from '../../store/derivedModels';
import { maybeClassifySession } from '../trigger';
import { sessionDocument } from './fixtures';

let sessions = new Map<string, SessionDocument>();

vi.mock('../../queues/sessionClassify', () => ({
  sessionClassifyQueue: { add: vi.fn(async () => ({})) }
}));

vi.mock('../../store/connection', () => ({
  getStore: () => ({
    ready: async () => {},
    collections: () => ({
      sessions: {
        findOne: async (filter: { _id: string }) => sessions.get(filter._id) ?? null
      }
    })
  })
}));

describe('maybeClassifySession', () => {
  beforeEach(() => {
    sessions.clear();
    vi.mocked(sessionClassifyQueue.add).mockClear();
  });

  it('queues the first run with the session key as job id', async () => {
    sessions.set('s1', sessionDocument({ _id: 's1' }));

    expect(await maybeClassifySession({ sessionKey: 's1', reason: 'turn_completed' })).toBe(
      true
    );
    expect(sessionClassifyQueue.add).toHaveBeenCalledWith(
      { sessionKey: 's1', reason: 'turn_completed' },
      { id: 's1' }
    );
  });

  it('does not queue sessions that are missing or not due', async () => {
    sessions.set(
      's2',
      sessionDocument({
        _id: 's2',
        classification: { status: 'accepted', runs: 1, results: [], at: new Date() }
      })
    );

    expect(await maybeClassifySession({ sessionKey: 's2', reason: 'idle' })).toBe(false);
    expect(await maybeClassifySession({ sessionKey: 'missing', reason: 'idle' })).toBe(false);
    expect(sessionClassifyQueue.add).not.toHaveBeenCalled();
  });

  it('queues manual runs without checking the conditions', async () => {
    expect(await maybeClassifySession({ sessionKey: 's3', reason: 'manual' })).toBe(true);
    expect(sessionClassifyQueue.add).toHaveBeenCalledWith(
      { sessionKey: 's3', reason: 'manual' },
      { id: 'manual-s3' }
    );
  });
});
