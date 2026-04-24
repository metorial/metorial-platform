import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceAuthConfigEventService = createSubspaceService(
  subspace.authConfigEvent,
  ['get', 'list'],
  () => ({})
);

export type SubspaceAuthConfigEvent = Awaited<ReturnType<typeof subspace.authConfigEvent.get>>;
