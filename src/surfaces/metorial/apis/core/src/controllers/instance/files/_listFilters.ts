import { v } from '@lowerdeck/validation';

export let stringArrayFilterSchema = (description: string) =>
  v.optional(v.union([v.string(), v.array(v.string())]), { description });
