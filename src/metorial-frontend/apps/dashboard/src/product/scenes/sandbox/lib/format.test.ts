import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatCpus,
  formatDuration,
  formatDurationBetween,
  formatEnumLabel,
  formatGib,
  formatMib,
  formatPercent,
  formatRelativeTime,
  formatSpec
} from './format';

describe('formatBytes', () => {
  it('uses binary units', () => {
    expect(formatBytes(16 * 1024 ** 3)).toBe('16 GiB');
    expect(formatBytes(512 * 1024 ** 2)).toBe('512 MiB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GiB');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(2 * 1024 ** 4)).toBe('2 TiB');
  });

  it('rolls over to the next unit after rounding', () => {
    expect(formatBytes(1024 ** 3 - 1)).toBe('1 GiB');
  });

  it('handles missing values', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('specs', () => {
  it('formats cpus and memory', () => {
    expect(formatSpec({ cpus: 2, memory_gib: 4 })).toBe('2 vCPU · 4 GiB');
    expect(formatSpec({ cpus: 0.5, memory_gib: 0.5 })).toBe('0.5 vCPU · 512 MiB');
    expect(formatCpus(0.25)).toBe('0.25 vCPU');
    expect(formatGib(16)).toBe('16 GiB');
    expect(formatMib(16)).toBe('16 MiB');
    expect(formatSpec(null)).toBe('—');
  });

  it('formats percentages', () => {
    expect(formatPercent(0.425)).toBe('43%');
    expect(formatPercent(0.425, 1)).toBe('42.5%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('shows the two largest units', () => {
    expect(formatDuration(221_000)).toBe('3m 41s');
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(3_600_000 + 5 * 60_000 + 12_000)).toBe('1h 5m');
    expect(formatDuration(3_600_000 + 12_000)).toBe('1h');
    expect(formatDuration(2 * 86_400_000 + 3 * 3_600_000)).toBe('2d 3h');
  });

  it('handles tiny and missing values', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(400)).toBe('<1s');
    expect(formatDuration(null)).toBe('—');
  });

  it('measures between two dates', () => {
    expect(formatDurationBetween('2026-10-14T10:00:00Z', '2026-10-14T10:03:41Z')).toBe(
      '3m 41s'
    );
    expect(formatDurationBetween(null)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  let now = new Date('2026-10-14T12:00:00Z');

  it('formats the past', () => {
    expect(formatRelativeTime(new Date('2026-10-14T11:59:50Z'), now)).toBe('just now');
    expect(formatRelativeTime(new Date('2026-10-14T11:56:00Z'), now)).toBe('4 min ago');
    expect(formatRelativeTime(new Date('2026-10-14T09:00:00Z'), now)).toBe('3 hr ago');
    expect(formatRelativeTime(new Date('2026-10-13T12:00:00Z'), now)).toBe('1 day ago');
    expect(formatRelativeTime(new Date('2026-10-10T12:00:00Z'), now)).toBe('4 days ago');
  });

  it('formats the future', () => {
    expect(formatRelativeTime(new Date('2026-10-14T12:10:00Z'), now)).toBe('in 10 min');
  });

  it('falls back to a date for old timestamps', () => {
    expect(formatRelativeTime(new Date('2026-01-01T12:00:00Z'), now)).toMatch(/2026/);
  });

  it('handles missing values', () => {
    expect(formatRelativeTime(null, now)).toBe('—');
    expect(formatRelativeTime('not a date', now)).toBe('—');
  });
});

describe('formatEnumLabel', () => {
  it('converts enum values to Title Case', () => {
    expect(formatEnumLabel('timed_out')).toBe('Timed Out');
    expect(formatEnumLabel('running')).toBe('Running');
    expect(formatEnumLabel('idle_policy')).toBe('Idle Policy');
    expect(formatEnumLabel(null)).toBe('—');
  });
});
