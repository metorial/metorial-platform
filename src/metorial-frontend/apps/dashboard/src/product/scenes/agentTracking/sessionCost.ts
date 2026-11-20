import { formatAmount } from './costFormat';

let valuationBasis =
  'your contract prices where set, else the cost Claude Code reports, else list prices';

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
      ? 'None of the requests of this session has a known cost, so it has no total. That is not the same as zero.'
      : null;
  }

  if (kind == 'billed') {
    return "Billed by the provider, so it matches your provider's bill and has no tilde.";
  }

  if (kind == 'partlyBilled') {
    return `${formatAmount(d.cost.billedMicros!, { estimate: false })} of it was billed by the provider. The other ${formatAmount(d.cost.estimatedMicros!, { estimate: true })} is an estimate, not a bill, valued at ${valuationBasis}.`;
  }

  let estimateLead = formatAmount(d.cost.totalMicros!, { estimate: true }).startsWith('~')
    ? 'The tilde means this is an estimate'
    : 'This is an estimate';

  if (kind == 'subscription') {
    let owner = firstName(d.memberName);

    return `${estimateLead}. ${owner ? `${owner}'s` : 'A'} Claude subscription or seat covers this usage, so nobody was charged ${formatAmount(d.cost.totalMicros!, { estimate: false })}; it is what the same tokens cost at ${valuationBasis}.`;
  }

  return `${estimateLead}, not a bill, valued at ${valuationBasis}.`;
};
