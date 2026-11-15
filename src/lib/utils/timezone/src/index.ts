import { data } from './data';

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

  return tzCodeMap.get(tzCode.toLowerCase());
};

export let defaultTimezone = data[0];
