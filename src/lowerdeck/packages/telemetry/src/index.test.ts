import { SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { describe, expect, it } from 'vitest';
import { shouldDropSpan } from './index';

let makeSpan = (opts: {
  name: string;
  durationMs: number;
  statusCode?: SpanStatusCode;
}): ReadableSpan => {
  let seconds = Math.floor(opts.durationMs / 1000);
  let nanoseconds = (opts.durationMs - seconds * 1000) * 1_000_000;

  return {
    name: opts.name,
    duration: [seconds, nanoseconds],
    status: { code: opts.statusCode ?? SpanStatusCode.UNSET }
  } as ReadableSpan;
};

describe('shouldDropSpan', () => {
  it('drops fast, successful prisma spans', () => {
    let span = makeSpan({ name: 'prisma:client:operation', durationMs: 5 });

    expect(shouldDropSpan(span, 100)).toBe(true);
  });

  it('keeps slow prisma spans', () => {
    let span = makeSpan({ name: 'prisma:client:operation', durationMs: 250 });

    expect(shouldDropSpan(span, 100)).toBe(false);
  });

  it('keeps errored prisma spans regardless of duration', () => {
    let span = makeSpan({
      name: 'prisma:client:operation',
      durationMs: 5,
      statusCode: SpanStatusCode.ERROR
    });

    expect(shouldDropSpan(span, 100)).toBe(false);
  });

  it('keeps non-prisma spans regardless of duration', () => {
    let span = makeSpan({ name: 'organization.getOrganization', durationMs: 5 });

    expect(shouldDropSpan(span, 100)).toBe(false);
  });

  it('keeps every prisma span when the minimum duration is 0', () => {
    let span = makeSpan({ name: 'prisma:client:operation', durationMs: 0 });

    expect(shouldDropSpan(span, 0)).toBe(false);
  });
});
