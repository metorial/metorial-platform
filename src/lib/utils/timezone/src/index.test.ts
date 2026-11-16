import { describe, expect, it } from 'vitest';
import { defaultTimezone, getTimezone, getTimezones } from './index';

describe('getTimezone', () => {
  it.each([
    ['Asia/Calcutta', 'asia/kolkata', 330],
    ['aSiA/cAlCuTtA', 'asia/kolkata', 330],
    ['Asia/Katmandu', 'asia/kathmandu', 345],
    ['Asia/Rangoon', 'asia/yangon', 390],
    ['Asia/Saigon', 'asia/ho_chi_minh', 420],
    ['Europe/Kiev', 'europe/kyiv', 120],
    ['US/Eastern', 'america/new_york', -300],
    ['US/Pacific', 'america/los_angeles', -480],
    ['Canada/Eastern', 'america/toronto', -300],
    ['Australia/ACT', 'australia/sydney', 600],
    ['Brazil/East', 'america/sao_paulo', -180],
    ['Pacific/Truk', 'pacific/port_moresby', 600]
  ])('resolves %s to %s', (alias, canonical, offset) => {
    let timezone = getTimezone(alias);

    expect(timezone).toBeDefined();
    expect(timezone).toBe(getTimezone(canonical));
    expect(timezone?.tzCode).toBe(canonical);
    expect(timezone?.utcOffsetInMinutes).toBe(offset);
  });

  it.each([
    'UTC',
    'Etc/UTC',
    'Etc/GMT',
    'GMT',
    'GMT0',
    'GMT+0',
    'GMT-0',
    'Etc/GMT0',
    'Etc/GMT+0',
    'Etc/GMT-0',
    'Etc/Greenwich',
    'Greenwich',
    'Etc/UCT',
    'UCT',
    'Etc/Universal',
    'Universal',
    'Etc/Zulu',
    'Zulu'
  ])('resolves %s to UTC', alias => {
    expect(getTimezone(alias)).toBe(defaultTimezone);
  });

  it('preserves existing timezone entries and numeric IDs', () => {
    let timezones = getTimezones();

    for (let timezone of timezones) {
      expect(getTimezone(timezone.tzCode)).toBe(timezone);
      expect(getTimezone(timezone.tzCode.toUpperCase())).toBe(timezone);
      expect(getTimezone(timezone.id)).toBe(timezone);
    }

    expect(getTimezones()).toBe(timezones);
    expect(defaultTimezone).toBe(timezones[0]);
  });

  it.each(['', 'Asia/Unknown', 'US/Unknown', 'toString', '__proto__', -1, 10000])(
    'returns undefined for an unknown timezone %s',
    input => {
      expect(getTimezone(input)).toBeUndefined();
    }
  );
});
