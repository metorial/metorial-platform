import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderRunService = createSubspaceService(
  subspace.providerRun,
  ['get', 'list', 'getLogs'],
  () => ({})
);

export type SubspaceProviderRun = Awaited<ReturnType<typeof subspace.providerRun.get>>;
