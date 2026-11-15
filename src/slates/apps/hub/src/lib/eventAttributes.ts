import { type SlatesEventAttributes, slatesEventAttributes } from '@slates/proto';

export let normalizeEventAttributes = (input: unknown): SlatesEventAttributes | null => {
  let parsed = slatesEventAttributes.safeParse(input);
  if (!parsed.success || !Object.keys(parsed.data).length) return null;

  return parsed.data;
};
