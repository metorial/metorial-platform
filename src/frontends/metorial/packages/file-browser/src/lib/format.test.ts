import { describe, expect, it } from 'vitest';
import { formatMode, formatModified, formatTimestamp } from './format';

describe('formatMode', () => {
  it('renders permission strings', () => {
    expect(formatMode(0o644, 'file')).toBe('-rw-r--r--');
    expect(formatMode(0o755, 'directory')).toBe('drwxr-xr-x');
    expect(formatMode(0o777, 'symlink')).toBe('lrwxrwxrwx');
  });

  it('ignores file type bits above the permissions', () => {
    expect(formatMode(0o100644, 'file')).toBe('-rw-r--r--');
  });

  it('returns undefined when the mode is unknown', () => {
    expect(formatMode(undefined, 'file')).toBeUndefined();
  });
});

describe('formatModified', () => {
  let now = new Date(2026, 5, 15, 14, 0, 0);

  it('shows a dash for missing or invalid dates', () => {
    expect(formatModified(undefined, now)).toBe('—');
    expect(formatModified(new Date('nope'), now)).toBe('—');
  });

  it('shows the time for today and the date otherwise', () => {
    let today = formatModified(new Date(2026, 5, 15, 9, 5), now);
    let earlier = formatModified(new Date(2026, 4, 2, 9, 5), now);

    expect(today).toMatch(/9|09/);
    expect(today).not.toMatch(/2026/);
    expect(earlier).toMatch(/2026/);
  });
});

describe('formatTimestamp', () => {
  it('returns undefined for missing dates', () => {
    expect(formatTimestamp(undefined)).toBeUndefined();
  });

  it('returns a readable string for valid dates', () => {
    expect(formatTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toMatch(/2026/);
  });
});
