import type { BillingDeclarationWithRelations } from '../billing';

export let billingDeclarationPresenter = (declaration: BillingDeclarationWithRelations) => ({
  object: 'groundstation#billing_declaration',

  id: declaration.id,
  name: declaration.name,
  reason: declaration.reason,

  projectId: declaration.project?.id ?? null,
  userId: declaration.user?.id ?? null,
  agentId: declaration.agentId,

  mode: declaration.mode,
  plan: declaration.plan,

  validFrom: declaration.validFrom,
  validTo: declaration.validTo,

  createdBy: declaration.createdBy,
  archivedAt: declaration.archivedAt,
  createdAt: declaration.createdAt,
  updatedAt: declaration.updatedAt
});
