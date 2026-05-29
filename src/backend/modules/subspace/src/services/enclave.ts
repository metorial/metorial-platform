import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceEnclaveService = createSubspaceService(
  subspace.enclave,
  ['get', 'list'],
  () => ({})
);

export type SubspaceEnclave = Awaited<ReturnType<typeof subspace.enclave.get>>;
