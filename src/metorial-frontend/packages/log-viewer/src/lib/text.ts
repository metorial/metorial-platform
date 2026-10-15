import type { LogLine } from '../types';

export let MAX_RENDERED_CHARS = 10_000;
export let TAB_SIZE = 4;

let ansiPattern =
  /[\u001b\u009b](?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;

let danglingEscapePattern = /\u001b(?:\[[0-?]*[ -/]*)?$/;

let displayLengthCache = new WeakMap<LogLine, number>();

export let hasControlSequences = (text: string) =>
  text.includes('\u001b') || text.includes('\u009b') || text.includes('\r');

export let stripAnsi = (text: string) =>
  text.includes('\u001b') || text.includes('\u009b') ? text.replace(ansiPattern, '') : text;

export let trimLineEnding = (text: string) =>
  text.endsWith('\r') ? text.replace(/\r+$/, '') : text;

export let applyCarriageReturns = (text: string) => {
  if (!text.includes('\r')) return text;

  let segments = text.split('\r');
  let result = segments[0];

  for (let position = 1; position < segments.length; position++) {
    result = segments[position] + result.slice(segments[position].length);
  }

  return result;
};

export let toPlainText = (text: string) =>
  applyCarriageReturns(stripAnsi(trimLineEnding(text)));

export let truncateForDisplay = (text: string) => {
  let trimmed = trimLineEnding(text);
  if (trimmed.length <= MAX_RENDERED_CHARS) return trimmed;

  let clipped = trimmed.slice(0, MAX_RENDERED_CHARS).replace(danglingEscapePattern, '');
  return `${clipped} …`;
};

export let getDisplayLength = (line: LogLine) => {
  let cached = displayLengthCache.get(line);
  if (cached !== undefined) return cached;

  let plain = toPlainText(line.text);
  let tabs = plain.split('\t').length - 1;
  let length = Math.min(MAX_RENDERED_CHARS + 2, plain.length + tabs * (TAB_SIZE - 1));

  displayLengthCache.set(line, length);
  return length;
};

export let parseTimestamp = (timestamp: LogLine['timestamp']) => {
  if (!timestamp) return null;

  let date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

let pad = (value: number, length = 2) => String(value).padStart(length, '0');

export let formatClockTime = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

export let formatLineCount = (count: number) =>
  `${count.toLocaleString()} ${count == 1 ? 'line' : 'lines'}`;

export let linesToPlainText = (lines: LogLine[]) =>
  lines.map(line => toPlainText(line.text)).join('\n');
