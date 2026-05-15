import { v } from '@lowerdeck/validation';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';

export let stringArrayFilterSchema = (description: string) =>
  v.optional(v.union([v.string(), v.array(v.string())]), { description });

export let dateFilterSchema = (description: string) =>
  v.optional(
    v.object({
      gt: v.optional(v.date()),
      lt: v.optional(v.date())
    }),
    { description }
  );

export let mapCargoListQuery = (
  query: Record<string, any>,
  d: {
    arrays?: Record<string, string>;
    dates?: Record<string, string>;
  }
) => {
  let input = { ...query };

  for (let [from, to] of Object.entries(d.arrays ?? {})) {
    let value = input[from];
    delete input[from];

    let normalized = normalizeArrayParam(value);
    if (normalized) input[to] = normalized;
  }

  for (let [from, to] of Object.entries(d.dates ?? {})) {
    let value = input[from];
    delete input[from];

    if (value) input[to] = value;
  }

  return input;
};
