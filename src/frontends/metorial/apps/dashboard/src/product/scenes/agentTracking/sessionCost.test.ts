import { describe, expect, it } from 'vitest';
import { describeSessionCost, firstName, sessionCostKind } from './sessionCost';

type Input = Parameters<typeof describeSessionCost>[0];

let session = (d: Partial<Omit<Input, 'cost'>> & { cost?: Partial<Input['cost']> } = {}) => ({
  billingModes: [],
  requests: 3,
  memberName: null,
  ...d,
  cost: {
    totalMicros: 18420000,
    billedMicros: 0,
    estimatedMicros: 18420000,
    isEstimate: true,
    ...d.cost
  }
});

let unknownCost = { totalMicros: null, billedMicros: null, estimatedMicros: null };

describe('describeSessionCost', () => {
  it('names the member whose subscription covers an estimated session', () => {
    expect(
      describeSessionCost(
        session({ billingModes: ['included'], requests: 214, memberName: 'Maya Okafor' })
      )
    ).toBe("Maya's subscription covers this session, so nobody was charged.");
  });

  it('splits a session that is partly billed', () => {
    expect(
      describeSessionCost(
        session({
          cost: { totalMicros: 10000000, billedMicros: 4000000, estimatedMicros: 6000000 },
          billingModes: ['api', 'included'],
          requests: 12
        })
      )
    ).toBe('$4.00 was billed by the provider. The other ~$6.00 is an estimate.');
  });

  it('adds nothing to the cost label of a billed session', () => {
    expect(
      describeSessionCost(
        session({
          cost: { billedMicros: 18420000, estimatedMicros: 0, isEstimate: false },
          billingModes: ['api']
        })
      )
    ).toBeNull();
  });

  it('adds nothing to the cost label of a plain estimate', () => {
    expect(
      describeSessionCost(session({ billingModes: ['unknown'], memberName: 'Maya Okafor' }))
    ).toBeNull();
  });

  it('names no one when the member of a covered session is unknown', () => {
    expect(describeSessionCost(session({ billingModes: ['included'] }))).toBe(
      'A subscription covers this session, so nobody was charged.'
    );
  });

  it('separates an unknown cost from zero', () => {
    expect(describeSessionCost(session({ cost: unknownCost }))).toBe(
      'No request of this session has a known cost, so there is no total (not $0).'
    );
    expect(describeSessionCost(session({ cost: unknownCost, requests: 0 }))).toBeNull();
  });
});

describe('sessionCostKind', () => {
  it('tells the cost bases apart', () => {
    expect(sessionCostKind(session({ cost: unknownCost }))).toBe('unknown');
    expect(sessionCostKind(session({ cost: { isEstimate: false } }))).toBe('billed');
    expect(
      sessionCostKind(session({ cost: { billedMicros: 4000000, estimatedMicros: 6000000 } }))
    ).toBe('partlyBilled');
    expect(sessionCostKind(session({ billingModes: ['included'] }))).toBe('subscription');
    expect(sessionCostKind(session())).toBe('estimated');
  });
});

describe('firstName', () => {
  it('takes the first word of a name', () => {
    expect(firstName('Maya Okafor')).toBe('Maya');
    expect(firstName('  ')).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});
