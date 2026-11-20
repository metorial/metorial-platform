import { v, type ValidationType } from '@lowerdeck/validation';

export let spreadSchema = v.object({
  median: v.number(),
  p90: v.number(),
  min: v.optional(v.number()),
  max: v.optional(v.number())
});

export let parseWith = <T>(schema: ValidationType<T>, label: string, value: unknown): T => {
  let validated = schema.validate(value);

  if (!validated.success) {
    let first = validated.errors[0];
    throw new Error(`Invalid ${label} at ${first?.path?.join('.') ?? '?'}: ${first?.code}`);
  }

  return validated.value;
};
