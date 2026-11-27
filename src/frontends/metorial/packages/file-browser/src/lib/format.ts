import type { FileEntryType } from '../types';

let timeFormatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

let dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

let fullFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium'
});

let isSameDay = (a: Date, b: Date) =>
  a.getFullYear() == b.getFullYear() &&
  a.getMonth() == b.getMonth() &&
  a.getDate() == b.getDate();

export let formatModified = (date: Date | undefined, now: Date = new Date()) => {
  if (!date || Number.isNaN(date.getTime())) return '—';
  if (isSameDay(date, now)) return timeFormatter.format(date);

  return dateFormatter.format(date);
};

export let formatTimestamp = (date: Date | undefined) => {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return fullFormatter.format(date);
};

let typeChars: Record<FileEntryType, string> = {
  file: '-',
  directory: 'd',
  symlink: 'l',
  other: '?'
};

export let formatMode = (mode: number | undefined, type: FileEntryType) => {
  if (mode == undefined) return undefined;

  let flags = 'rwxrwxrwx';
  let permissions = '';

  for (let i = 0; i < 9; i++) {
    permissions += mode & (1 << (8 - i)) ? flags[i] : '-';
  }

  return `${typeChars[type]}${permissions}`;
};
