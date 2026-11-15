import { checkEdition } from '@metorial/editions';
import { env } from '../env';
import type { ScmBackend } from '../../prisma/generated/client';
import { hasBackendSecret } from '../lib/scmCredentials';

export let scmBackendPresenter = (backend: ScmBackend) => ({
  object: 'origin#scmBackend' as const,
  id: backend.id,
  type: backend.type,
  name: backend.name,
  description: backend.description,
  apiUrl: backend.apiUrl,
  webUrl: backend.webUrl,
  appSlug: backend.appSlug,
  isDefault: backend.isDefault,
  // Don't expose sensitive credentials
  hasCredentials:
    checkEdition('on-prem') && !['github', 'github_enterprise'].includes(backend.type)
      ? !!(backend.clientId && hasBackendSecret(backend, 'clientSecret'))
      : !!(backend.appId && hasBackendSecret(backend, 'appPrivateKey')),
  ...(checkEdition('on-prem') && ['github', 'github_enterprise'].includes(backend.type)
    ? {
        appWebhookUrl: `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/webhook-ingest/github-app/${backend.id}`
      }
    : {}),
  createdAt: backend.createdAt,
  updatedAt: backend.updatedAt
});
