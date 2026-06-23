import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceMonitorService = createSubspaceService(
  subspace.monitor,
  ['get', 'list'],
  () => ({})
);

export type SubspaceMonitor = Awaited<ReturnType<typeof subspace.monitor.get>>;
