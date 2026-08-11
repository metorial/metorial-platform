import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthImportService = createSubspaceService(
  subspace.providerAuthImport,
  ['get', 'list', 'create', 'getSchema']
);

export type SubspaceProviderAuthImport = Awaited<
  ReturnType<typeof subspace.providerAuthImport.get>
>;

export type SubspaceProviderAuthImportSchema = Awaited<
  ReturnType<typeof subspace.providerAuthImport.getSchema>
>;
