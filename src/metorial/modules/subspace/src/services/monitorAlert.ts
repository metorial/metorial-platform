import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceMonitorAlertService = createSubspaceService(
  subspace.monitorAlert,
  ['get', 'list', 'viewed', 'resolve', 'unresolve'],
  () => ({})
);

export type SubspaceMonitorAlert = Awaited<ReturnType<typeof subspace.monitorAlert.get>>;
