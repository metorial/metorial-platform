import { describe, expect, it } from 'vitest';
import { describeSessionCost, firstName, sessionCostKind } from './sessionCost';

type Input = Parameters<typeof describeSessionCost>[0];

let session = (d: Partial<Omit<Input, 'cost'>> & { cost?: Partial<Input['cost']> } = {}) => ({
  billingModes: [],
  requests: 3,
  memberName: null,
  ...d,
  cost: { total: '18.42', billed: '0', estimated: '18.42', isEstimate: true, ...d.cost }
});

let unknownCost = { total: null, billed: null, estimated: null };

describe('describeSessionCost', () => {
  it('names the member whose subscription covers an estimated session', () => {
    expect(
      describeSessionCost(
        session({ billingModes: ['included'], requests: 214, memberName: 'Maya Okafor' })
      )
    ).toBe(
      "The tilde means this is an estimate. Maya's Claude subscription or seat covers this usage, so nobody was charged $18.42; it is what the same tokens cost at your contract prices where set, else the cost Claude Code reports, else list prices."
    );
  });

  it('splits a session that is partly billed', () => {
    expect(
      describeSessionCost(
        session({
          cost: { total: '10', billed: '4', estimated: '6' },
          billingModes: ['api', 'included'],
          requests: 12
        })
      )
    ).toMatch(/^\$4\.00 of it was billed by the provider\. The other ~\$6\.00 is an estimate/);
  });

  it('says a billed session matches the bill', () => {
    expect(
      describeSessionCost(
        session({
          cost: { billed: '18.42', estimated: '0', isEstimate: false },
          billingModes: ['api']
        })
      )
    ).toBe("Billed by the provider, so it matches your provider's bill and has no tilde.");
  });

  it('keeps an estimate without a subscription generic', () => {
    expect(
      describeSessionCost(session({ billingModes: ['unknown'], memberName: 'Maya Okafor' }))
    ).toMatch(/^The tilde means this is an estimate, not a bill/);
  });

  it('does not point at a tilde when the amount below a cent has none', () => {
    expect(
      describeSessionCost(
        session({
          cost: { total: '0.004672', estimated: '0.004672' },
          billingModes: ['included']
        })
      )
    ).toMatch(
      /^This is an estimate\. A Claude subscription or seat covers this usage, so nobody was charged <\$0\.01;/
    );
  });

  it('separates an unknown cost from zero', () => {
    expect(describeSessionCost(session({ cost: unknownCost }))).toMatch(
      /no total\. That is not the same as zero\.$/
    );
    expect(describeSessionCost(session({ cost: unknownCost, requests: 0 }))).toBeNull();
  });
});

describe('sessionCostKind', () => {
  it('tells the cost bases apart', () => {
    expect(sessionCostKind(session({ cost: unknownCost }))).toBe('unknown');
    expect(sessionCostKind(session({ cost: { isEstimate: false } }))).toBe('billed');
    expect(sessionCostKind(session({ cost: { billed: '4', estimated: '6' } }))).toBe(
      'partlyBilled'
    );
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
