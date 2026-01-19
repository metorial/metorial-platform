import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthImportService = createSubspaceService(
  subspace.providerAuthImport,
  ['get', 'list', 'create', 'getSchema'],
  () => ({})
);
