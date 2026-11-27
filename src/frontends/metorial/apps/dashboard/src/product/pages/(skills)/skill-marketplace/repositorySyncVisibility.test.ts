import type { SkillSync } from '@metorial/state';
import { describe, expect, it } from 'vitest';
import { shouldShowRepositorySyncLogs } from './repositorySyncVisibility';

let now = new Date('2026-07-31T10:00:00.000Z').getTime();

let makeSync = (p: Partial<SkillSync> = {}) =>
  ({
    status: 'processing',
    createdAt: new Date('2026-07-31T09:59:00.000Z'),
    startedAt: new Date('2026-07-31T09:59:00.000Z'),
    ...p
  }) as SkillSync;

describe('shouldShowRepositorySyncLogs', () => {
  it('hides logs while a processing sync is five minutes old or newer', () => {
    expect(
      shouldShowRepositorySyncLogs(
        makeSync({ startedAt: new Date('2026-07-31T09:55:00.000Z') }),
        now
      )
    ).toBe(false);
  });

  it('shows logs after a processing sync has run for more than five minutes', () => {
    expect(
      shouldShowRepositorySyncLogs(
        makeSync({ startedAt: new Date('2026-07-31T09:54:59.999Z') }),
        now
      )
    ).toBe(true);
  });

  it('uses the creation time when a processing sync has not recorded a start time', () => {
    expect(
      shouldShowRepositorySyncLogs(
        makeSync({
          createdAt: new Date('2026-07-31T09:54:00.000Z'),
          startedAt: null
        }),
        now
      )
    ).toBe(true);
  });

  it('always shows failed sync logs', () => {
    expect(
      shouldShowRepositorySyncLogs(
        makeSync({
          status: 'failed',
          startedAt: new Date('2026-07-31T09:59:59.000Z')
        }),
        now
      )
    ).toBe(true);
  });

  it.each(['pending', 'completed', 'waiting_for_review', 'canceled'] as const)(
    'hides logs for %s syncs',
    status => {
      expect(
        shouldShowRepositorySyncLogs(
          makeSync({ status, startedAt: new Date('2026-07-31T09:00:00.000Z') }),
          now
        )
      ).toBe(false);
    }
  );
});
