import { v } from '@lowerdeck/validation';

let absentQueryField = () => ({
  ...v.optional(v.literal('false')),
  hidden: true
});
