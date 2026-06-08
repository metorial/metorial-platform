import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProtoGuardAlertService = createSubspaceService(
  subspace.protoGuardAlert,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProtoGuardAlert = Awaited<ReturnType<typeof subspace.protoGuardAlert.get>>;
