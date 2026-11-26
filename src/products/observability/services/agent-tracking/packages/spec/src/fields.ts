import { v } from '@lowerdeck/validation';

let maxRequestTokens = 1_000_000_000;

let timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

export let unsafeTextPattern =
  /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;

export let commitShaPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

export let workspaceKeyPattern = /^[0-9a-f]{32,64}$/i;

export let parseTimestamp = (value: string): Date | null => {
  if (!timestampPattern.test(value)) return null;

  let date = new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
};

export let pattern = (regex: RegExp) => v.string({ modifiers: [v.regex(regex)] });

export let nativeId = pattern(/^[\x21-\x7e]{1,256}$/);

export let model = pattern(/^(?!<)[\x21-\x7e]{1,128}$/);

export let jsonNumber = (value: unknown) => (typeof value == 'number' ? value : NaN);

export let count = (max: number, min = 0) =>
  v.number({
    preprocessors: [jsonNumber],
    modifiers: [v.integer(), v.minValue(min), v.maxValue(max)]
  });

export let tokens = count(maxRequestTokens);
