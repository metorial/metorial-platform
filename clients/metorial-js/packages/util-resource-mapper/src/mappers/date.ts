import { MetorialMapper } from '../types';

let toDate = (input: any): Date => {
  if (input instanceof Date) return input;

  if (typeof input === 'string' || typeof input === 'number') {
    let date = new Date(input);
    if (!isNaN(date.getTime())) return date;
  }

  return input;
};

export let dateMapper = (): MetorialMapper<Date> => ({
  transformFrom: (input: any): Date => toDate(input),
  transformTo: (input: any): Date => toDate(input)
});
