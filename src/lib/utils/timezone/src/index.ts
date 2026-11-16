import { data } from './data';
import { legacyTimezoneAliases } from './legacyAliases';

export interface Timezone {
  label: string;
  tzCode: string;
  name: string;
  utc: string;
  id: number;
  utcOffsetInMinutes: number;
}

export let getTimezones = (): Timezone[] => data;

let tzCodeMap = new Map<string, Timezone>(data.map(tz => [tz.tzCode, tz]));

export let getTimezone = (tzCode: string | number): Timezone | undefined => {
  if (typeof tzCode === 'number') return data[tzCode];

  let normalized = tzCode.toLowerCase();

  return (
    tzCodeMap.get(normalized) ?? tzCodeMap.get(legacyTimezoneAliases.get(normalized) ?? '')
  );
};

export let defaultTimezone = data[0];
