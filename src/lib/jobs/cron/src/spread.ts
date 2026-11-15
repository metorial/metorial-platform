import { murmur3_32 } from '@lowerdeck/murmur3';

let literalMinute = /^\d{1,2}$/;

export let spreadCronPattern = (name: string, pattern: string) => {
  let fields = pattern.trim().split(/\s+/);
  if (fields.length !== 5) return pattern;
  if (!literalMinute.test(fields[0]!)) return pattern;

  fields[0] = String(murmur3_32(name) % 60);

  return fields.join(' ');
};

export let spreadCronStartupJitterMs = (jitterMs: number) =>
  Math.floor(Math.random() * Math.max(0, jitterMs));
