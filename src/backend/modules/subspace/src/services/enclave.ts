import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceEnclaveService = createSubspaceService(
  subspace.enclave,
  ['get', 'list', 'listNetworkLogs', 'getLastUsedEnclaves'],
  () => ({})
);

export type SubspaceEnclave = Awaited<ReturnType<typeof subspace.enclave.get>>;
export type SubspaceEnclaveNetworkLogs = Awaited<
  ReturnType<typeof subspace.enclave.listNetworkLogs>
>;
