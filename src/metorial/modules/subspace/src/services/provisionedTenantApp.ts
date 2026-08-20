import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProvisionedTenantAppService = createSubspaceService(
  subspace.provisionedTenantApp,
  ['beginGithubManifest'],
  () => ({})
);
