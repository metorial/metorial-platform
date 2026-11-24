import type { Organization, Prisma } from '@mtsrc/ai-gateway-db';
import type { SecretOwner } from './nebula';

export let connectionInclude = {
  provider: true,
  organization: true,
  instance: { include: { project: true } }
} as const;

export type ConnectionWithRelations = Prisma.ProviderConnectionGetPayload<{
  include: typeof connectionInclude;
}>;

export let secretOwnerOf = (connection: { organization: Organization }): SecretOwner => ({
  organization: connection.organization
});
