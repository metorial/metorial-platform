import type { ScmBackend } from '../../prisma/generated/client';

export let scmBackendPresenter = (backend: ScmBackend) => ({
  object: 'origin#scmBackend',
  id: backend.id,
  type: backend.type,
  name: backend.name,
  description: backend.description,
  apiUrl: backend.apiUrl,
  webUrl: backend.webUrl,
  appSlug: backend.appSlug,
  isDefault: backend.isDefault,
  // Don't expose sensitive credentials
  hasCredentials: !!(backend.appId && backend.appPrivateKey),
  createdAt: backend.createdAt,
  updatedAt: backend.updatedAt
});
