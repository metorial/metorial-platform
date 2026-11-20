import { addTokens, emptyTokens, type Tokens } from '@mtsrc/agent-tracking-cost';

export let tokenComponents = [
  'inputUncached',
  'output',
  'cacheRead',
  'cacheWrite',
  'reasoning'
] as const satisfies readonly (keyof Tokens)[];

export type TokenComponent = keyof Tokens;

export let sumTokens = (items: Tokens[]) => {
  let total = emptyTokens();
  for (let item of items) addTokens(total, item);

  return total;
};

export let tokenTotal = (tokens: Tokens) =>
  tokenComponents.reduce((total, component) => total + tokens[component], 0);

export let count = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) ? value : 0;

export let isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value == 'object' && !Array.isArray(value);

export let timestampOf = (value: unknown) => {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value != 'string' && typeof value != 'number') return null;

  let date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

export type TimeSpan = { firstAt: Date | null; lastAt: Date | null };

export let widenSpan = (span: TimeSpan, at: Date | null) => {
  if (!at) return span;
  if (!span.firstAt || at < span.firstAt) span.firstAt = at;
  if (!span.lastAt || at > span.lastAt) span.lastAt = at;

  return span;
};
