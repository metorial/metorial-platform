export let billingModes = ['included', 'overage', 'api', 'unknown'] as const;

export type BillingMode = (typeof billingModes)[number];

export let billingSources = [
  'reported',
  'client',
  'vendor',
  'inferred',
  'declared',
  'default'
] as const;

export type BillingSource = (typeof billingSources)[number];

// `data.billing` on usage-bearing records, from what the client reported about its credential
// or plan. Dialects leave it out when the client says nothing.
export type RecordBilling = {
  mode: Exclude<BillingMode, 'unknown'>;
  plan?: string;
  seat?: string;
};
