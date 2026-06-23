import { createSubspacePublicService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceTenantService = createSubspacePublicService(
  subspace.tenant,
  ['get', 'upsert'],
  () => ({})
);

export type SubspaceTenant = Awaited<ReturnType<typeof subspace.tenant.get>>;
