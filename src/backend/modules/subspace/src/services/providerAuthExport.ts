import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthExportService = createSubspaceService(
  subspace.providerAuthExport,
  ['get', 'list', 'create'],
  {}
);
