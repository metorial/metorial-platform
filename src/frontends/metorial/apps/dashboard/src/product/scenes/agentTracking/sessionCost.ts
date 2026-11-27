import { formatAmount } from './costFormat';

type BillingMode = 'included' | 'overage' | 'api' | 'unknown';

export let firstName = (name: string | null | undefined) =>
  name?.trim().split(/\s+/)[0] || null;

type SessionCostInput = {
  cost: {
    totalMicros: number | null;
    billedMicros: number | null;
    estimatedMicros: number | null;
    isEstimate: boolean;
  };
  billingModes: BillingMode[];
};

export let sessionCostKind = (d: SessionCostInput) => {
  if (d.cost.totalMicros === null) return 'unknown';
  if (!d.cost.isEstimate) return 'billed';
  if ((d.cost.billedMicros ?? 0) > 0 && d.cost.estimatedMicros !== null) return 'partlyBilled';
  if (d.billingModes.length && d.billingModes.every(mode => mode == 'included')) {
    return 'subscription';
  }

  return 'estimated';
};

export let describeSessionCost = (
  d: SessionCostInput & { requests: number; memberName: string | null }
) => {
  let kind = sessionCostKind(d);

  if (kind == 'unknown') {
    return d.requests
      ? 'No request of this session has a known cost, so there is no total (not $0).'
      : null;
  }

  if (kind == 'partlyBilled') {
    return `${formatAmount(d.cost.billedMicros!, { estimate: false })} was billed by the provider. The other ${formatAmount(d.cost.estimatedMicros!, { estimate: true })} is an estimate.`;
  }

  if (kind == 'subscription') {
    let owner = firstName(d.memberName);

    return `${owner ? `${owner}'s` : 'A'} subscription covers this session, so nobody was charged.`;
  }

  return null;
};
