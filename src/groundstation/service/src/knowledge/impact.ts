import type { PriceOverrideTarget } from '../../prisma/generated/client';
import { queueKnowledgeImpact } from '../queues/knowledgeImpact';

export type PriceOverrideImpactScope = {
  target: PriceOverrideTarget;
  targetId: string | null;
  vendorId: string | null;
  validFrom: Date;
  validTo: Date | null;
};

// Call after the override change commits; `before` and `after` are the override's matching
// scope before and after the change (`null` when it was created or archived).
export let queuePriceOverrideImpact = async (d: {
  organizationOid: bigint;
  projectOid: bigint | null;
  before: PriceOverrideImpactScope | null;
  after: PriceOverrideImpactScope | null;
}) => {
  let scopes = [d.before, d.after].flatMap(scope =>
    scope
      ? [
          {
            target: scope.target,
            targetId: scope.targetId,
            vendorId: scope.vendorId,
            validFrom: scope.validFrom.toISOString(),
            validTo: scope.validTo?.toISOString() ?? null
          }
        ]
      : []
  );
  if (!scopes.length) return;

  await queueKnowledgeImpact({
    type: 'override',
    organizationOid: d.organizationOid.toString(),
    projectOid: d.projectOid?.toString() ?? null,
    scopes
  });
};
