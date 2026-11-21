import { v } from '@lowerdeck/validation';
import { maxFilterValueLength, rangePresets } from '@metorial/module-agent-tracking-query';

let idValue = () => v.string({ modifiers: [v.maxLength(maxFilterValueLength)] });

export let idFilter = (name: string, description: string, examples: string[]) =>
  v.optional(
    v.union([idValue(), v.array(idValue(), { modifiers: [v.maxLength(100)] })], {
      name,
      description,
      examples
    })
  );

export let rangeFields = (descriptions: {
  range: string;
  from: string;
  to: string;
  timeZone: string;
}) => ({
  range: v.optional(
    v.enumOf(rangePresets, { name: 'range', description: descriptions.range })
  ),
  from: v.optional(v.date({ name: 'from', description: descriptions.from })),
  to: v.optional(v.date({ name: 'to', description: descriptions.to })),
  time_zone: v.optional(
    v.string({
      name: 'time_zone',
      description: descriptions.timeZone,
      examples: ['Europe/Berlin'],
      modifiers: [v.maxLength(100)]
    })
  )
});

export let rangeOf = (query: {
  range?: (typeof rangePresets)[number];
  from?: Date;
  to?: Date;
  time_zone?: string;
}) => ({ preset: query.range, from: query.from, to: query.to, timeZone: query.time_zone });
