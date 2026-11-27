import { describe, expect, it } from 'vitest';
import {
  activityLabel,
  formatDateTime,
  formatDayLabel,
  formatSpan,
  formatTimeSpan,
  sessionActivity,
  sessionTitle
} from './activity';

let minute = 60 * 1000;

let now = new Date(2026, 10, 19, 15, 42);

let ago = (ms: number) => new Date(now.getTime() - ms);

describe('sessionActivity', () => {
  it('reads as active now within five minutes of the last activity', () => {
    let activity = sessionActivity({ state: 'active', lastActivityAt: ago(4 * minute) }, now);

    expect(activity).toEqual({ kind: 'active' });
    expect(activityLabel(activity)).toBe('Active Now');
  });

  it('reads as idle with the quiet time once five minutes have passed', () => {
    expect(
      activityLabel(
        sessionActivity({ state: 'active', lastActivityAt: ago(20 * minute) }, now)
      )
    ).toBe('Idle · 20 min');

    expect(
      activityLabel(sessionActivity({ state: 'idle', lastActivityAt: ago(5 * minute) }, now))
    ).toBe('Idle · 5 min');

    expect(
      activityLabel(sessionActivity({ state: 'idle', lastActivityAt: ago(72 * minute) }, now))
    ).toBe('Idle · 1h 12m');
  });

  it('reads as ended whenever the session has ended, however recent', () => {
    expect(
      activityLabel(sessionActivity({ state: 'ended', lastActivityAt: ago(minute) }, now))
    ).toBe('Ended');
  });

  it('treats a last activity slightly in the future as active now', () => {
    expect(
      sessionActivity(
        { state: 'active', lastActivityAt: new Date(now.getTime() + minute) },
        now
      )
    ).toEqual({ kind: 'active' });
  });
});

describe('formatSpan', () => {
  it('uses minutes below an hour', () => {
    expect(formatSpan(30 * 1000)).toBe('<1 min');
    expect(formatSpan(39 * minute + 59 * 1000)).toBe('39 min');
  });

  it('uses hours and padded minutes below a day', () => {
    expect(formatSpan(64 * minute)).toBe('1h 04m');
    expect(formatSpan(6 * 60 * minute + 40 * minute)).toBe('6h 40m');
  });

  it('uses days and hours from a day on', () => {
    expect(formatSpan(26 * 60 * minute)).toBe('1d 2h');
    expect(formatSpan(48 * 60 * minute + 10 * minute)).toBe('2d');
  });
});

describe('dates', () => {
  it('names today and yesterday, and dates the rest', () => {
    expect(formatDayLabel(new Date(2026, 10, 19, 0, 5), now)).toBe('Today');
    expect(formatDayLabel(new Date(2026, 10, 18, 23, 55), now)).toBe('Yesterday');
    expect(formatDayLabel(new Date(2026, 10, 12, 13, 5), now)).toBe('Nov 12');
    expect(formatDayLabel(new Date(2025, 11, 30, 9, 0), now)).toBe('Dec 30, 2025');
  });

  it('formats a start and end on the same day with one day label', () => {
    expect(formatDateTime(new Date(2026, 10, 17, 9, 12), now)).toBe('Nov 17, 9:12 AM');
    expect(
      formatTimeSpan(new Date(2026, 10, 19, 12, 49), new Date(2026, 10, 19, 14, 31), now)
    ).toBe('Today, 12:49 PM to 2:31 PM');
    expect(
      formatTimeSpan(new Date(2026, 10, 18, 22, 0), new Date(2026, 10, 19, 1, 30), now)
    ).toBe('Yesterday, 10:00 PM to Today, 1:30 AM');
  });
});

describe('sessionTitle', () => {
  let startedAt = new Date(2026, 10, 19, 9, 0);

  it('names the member and the day the session started, never relatively', () => {
    expect(
      sessionTitle(
        { member: { name: 'Maya Okafor', email: 'maya@example.com' }, startedAt },
        now
      )
    ).toBe('Maya Okafor on Nov 19');
    expect(
      sessionTitle(
        {
          member: { name: null, email: 'maya@example.com' },
          startedAt: new Date(2025, 11, 30)
        },
        now
      )
    ).toBe('maya@example.com on Dec 30, 2025');
  });

  it('falls back to the session without a known member', () => {
    expect(sessionTitle({ member: null, startedAt }, now)).toBe('Session on Nov 19');
    expect(sessionTitle({ member: { name: null, email: null }, startedAt }, now)).toBe(
      'Session on Nov 19'
    );
  });
});
