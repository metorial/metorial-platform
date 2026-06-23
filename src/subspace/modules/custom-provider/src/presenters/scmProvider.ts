import type { ScmProvider } from '../origin';

export let scmProviderPresenter = (scmProvider: ScmProvider) => ({
  object: 'scm.provider',

  id: scmProvider.id,

  type: scmProvider.type,
  name: scmProvider.name,
  description: scmProvider.description,
  apiUrl: scmProvider.apiUrl,
  webUrl: scmProvider.webUrl,

  isDefault: scmProvider.isDefault,

  createdAt: scmProvider.createdAt,
  updatedAt: scmProvider.updatedAt
});
