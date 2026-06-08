import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProtoGuardConfigService = createSubspaceService(
  subspace.protoGuardConfig,
  [
    'get',
    'setFilterEnabled',
    'setFilterAlertConfidenceThreshold',
    'setAlertFilterCountThreshold'
  ],
  () => ({})
);

export type SubspaceProtoGuardConfig = Awaited<
  ReturnType<typeof subspace.protoGuardConfig.get>
>;
