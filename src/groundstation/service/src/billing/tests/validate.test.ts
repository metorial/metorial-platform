import { ServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import {
  assertValidBillingDeclaration,
  normalizePlan,
  type BillingDeclarationDefinition
} from '../validate';

let definition = (
  input: Partial<BillingDeclarationDefinition> = {}
): BillingDeclarationDefinition => ({
  mode: 'included',
  plan: null,
  agentId: null,
  validFrom: new Date('2026-01-01T00:00:00Z'),
  validTo: null,
  ...input
});

let rejection = (input: Partial<BillingDeclarationDefinition>) => {
  try {
    assertValidBillingDeclaration(definition(input));
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError);
    return (error as ServiceError<any>).data;
  }

  throw new Error('expected the declaration to be rejected');
};

describe('assertValidBillingDeclaration', () => {
  it('accepts each declarable mode', () => {
    for (let mode of ['included', 'overage', 'api'] as const) {
      expect(() =>
        assertValidBillingDeclaration(definition({ mode, plan: 'max', agentId: 'codex' }))
      ).not.toThrow();
    }
  });

  it('rejects unknown and modes that do not exist', () => {
    expect(rejection({ mode: 'unknown' })).toMatchObject({
      code: 'bad_request',
      message: expect.stringContaining('included, overage or api')
    });
    expect(rejection({ mode: 'seat' as never }).message).toContain(
      'seat is not a billing mode'
    );
  });

  it('limits the plan to 100 characters', () => {
    expect(() =>
      assertValidBillingDeclaration(definition({ plan: 'x'.repeat(100) }))
    ).not.toThrow();
    expect(rejection({ plan: 'x'.repeat(101) }).message).toContain('at most 100 characters');
  });

  it('rejects an empty agentId', () => {
    expect(rejection({ agentId: '' }).message).toContain('agentId must not be empty');
  });

  it('requires validTo after validFrom', () => {
    expect(rejection({ validTo: new Date('2026-01-01T00:00:00Z') }).message).toContain(
      'validTo must be after validFrom'
    );
    expect(rejection({ validTo: new Date('2025-12-31T00:00:00Z') }).message).toContain(
      'validTo must be after validFrom'
    );
    expect(() =>
      assertValidBillingDeclaration(definition({ validTo: new Date('2026-01-01T00:00:01Z') }))
    ).not.toThrow();
  });
});

describe('normalizePlan', () => {
  it('trims the plan and turns an empty one into null', () => {
    expect(normalizePlan(' max ')).toBe('max');
    expect(normalizePlan('   ')).toBeNull();
    expect(normalizePlan('')).toBeNull();
    expect(normalizePlan(null)).toBeNull();
    expect(normalizePlan(undefined)).toBeNull();
  });
});
