import type { ReaderToken, Tenant } from '../../prisma/generated/client';
import { apiKeys } from '../keys';

export let readerTokenPresenter = (token: ReaderToken & { tenant: Tenant | null }) => ({
  object: 'reader_token',

  id: token.id,
  status: token.status,

  name: token.name,
  secretRedacted: apiKeys.redact(token.secret),

  tenantId: token.tenant?.id ?? null,

  createdAt: token.createdAt,
  updatedAt: token.updatedAt,
  expiresAt: token.expiresAt
});
