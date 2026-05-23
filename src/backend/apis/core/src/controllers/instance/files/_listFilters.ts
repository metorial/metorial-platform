import { v } from '@mtsrc/validation';

export let stringArrayFilterSchema = (description: string) =>
  v.optional(v.union([v.string(), v.array(v.string())]), { description });
