import { offeringOverrideId, type OfferingOverride } from '../overrides';
import type { Catalog, Offering } from '../types';
import type { ValidationResult } from './validate';

export type IssueKind = 'stale-override' | 'price-outlier' | 'unresolved-offering';

// Every issue is fixed by one offering decision in overrides/offerings/<vendorId>.json, keyed by
// the vendor's own model id.
export interface CatalogIssue {
  key: string;
  kind: IssueKind;
  vendorId: string;
  vendorModelId: string;
  offeringId: string | null;
  firstParty: boolean;
  detail: string;
}

let kindOrder: IssueKind[] = ['stale-override', 'price-outlier', 'unresolved-offering'];

// Sorting by the bare model name puts the same model sold by several vendors in one batch, so it
// gets one consistent decision.
let nameTail = (vendorModelId: string) =>
  vendorModelId
    .toLowerCase()
    .replace(/:[a-z0-9-]+$/, '')
    .split('/')
    .pop()!;

export let collectIssues = (input: {
  catalog: Catalog;
  validation: ValidationResult;
  staleOverrides: OfferingOverride[];
}): CatalogIssue[] => {
  let firstParty = new Set(
    input.catalog.vendors
      .filter(vendor => vendor.kind === 'first-party')
      .map(vendor => vendor.id)
  );
  let offeringsById = new Map(
    input.catalog.offerings.map(offering => [offering.id, offering])
  );
  let issues = new Map<string, CatalogIssue>();

  let add = (
    kind: IssueKind,
    vendorId: string,
    vendorModelId: string,
    offering: Offering | null,
    detail: string
  ) => {
    let key = offeringOverrideId(vendorId, vendorModelId);
    if (issues.has(key)) return;

    issues.set(key, {
      key,
      kind,
      vendorId,
      vendorModelId,
      offeringId: offering?.id ?? null,
      firstParty: firstParty.has(vendorId),
      detail
    });
  };

  let liveOffering = (vendorId: string, vendorModelId: string) =>
    input.catalog.offerings.find(
      offering =>
        offering.vendorId === vendorId &&
        offering.vendorModelId === vendorModelId &&
        offering.status !== 'retired'
    ) ?? null;

  for (let override of input.staleOverrides) {
    let offering = liveOffering(override.vendorId, override.vendorModelId);
    if (!offering || override.target.kind !== 'model') continue;

    add(
      'stale-override',
      override.vendorId,
      override.vendorModelId,
      offering,
      `the decision links to ${override.target.modelId}, which no longer exists`
    );
  }

  for (let outlier of input.validation.priceOutliers) {
    let offering = offeringsById.get(outlier.offeringId);
    if (!offering) continue;

    add(
      'price-outlier',
      offering.vendorId,
      offering.vendorModelId,
      offering,
      `linked to ${outlier.modelId}, but its input price ${outlier.input} is far from that model's median ${outlier.median}`
    );
  }

  for (let offering of input.catalog.offerings) {
    if (offering.status === 'retired' || offering.resolution.method !== 'unresolved') continue;
    add(
      'unresolved-offering',
      offering.vendorId,
      offering.vendorModelId,
      offering,
      'not linked to any model'
    );
  }

  return [...issues.values()].sort(
    (a, b) =>
      Number(b.firstParty) - Number(a.firstParty) ||
      kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) ||
      nameTail(a.vendorModelId).localeCompare(nameTail(b.vendorModelId)) ||
      a.key.localeCompare(b.key)
  );
};
