import type { Prisma } from '@metorial-subspace/db';

export let webhookRegistrationInclude = {
  provider: { include: { type: true } },
  providerVariant: true
} as const;

export type WebhookRegistrationWithRelations = Prisma.WebhookRegistrationGetPayload<{
  include: typeof webhookRegistrationInclude;
}>;
