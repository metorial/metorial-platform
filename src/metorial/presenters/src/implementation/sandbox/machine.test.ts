import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-sandbox', () => ({
  sandboxFailureCodes: ['internal_error'],
  sandboxBuildFailureCodes: ['internal_error'],
  mapSandboxFailure: vi.fn(),
  resolveSandboxImageRef: vi.fn(),
  resolveSandboxSpecId: vi.fn()
}));

import { getSandboxUpcomingEvents } from './machine';

describe('getSandboxUpcomingEvents', () => {
  let now = new Date('2026-01-01T12:00:00Z');
  let at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  it('lists events within the next hour, soonest first', () => {
    let events = getSandboxUpcomingEvents(
      {
        pauseAt: at(30),
        hibernateAt: at(90),
        restartAt: at(10),
        instanceExpiresAt: at(45)
      },
      now
    );

    expect(events).toEqual([
      { type: 'restart', occurs_at: at(10) },
      { type: 'pause', occurs_at: at(30) },
      { type: 'reprovision', occurs_at: at(45) }
    ]);
  });

  it('omits unscheduled events', () => {
    expect(
      getSandboxUpcomingEvents(
        { pauseAt: null, hibernateAt: null, restartAt: null, instanceExpiresAt: null },
        now
      )
    ).toEqual([]);
  });

  it('keeps overdue events that have not fired yet', () => {
    expect(
      getSandboxUpcomingEvents(
        { pauseAt: at(-5), hibernateAt: null, restartAt: null, instanceExpiresAt: null },
        now
      )
    ).toEqual([{ type: 'pause', occurs_at: at(-5) }]);
  });
});
