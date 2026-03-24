import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCallbackEventService = createSubspaceService(
  subspace.callbackEvent,
  ['get', 'list'],
  () => ({})
);

export type SubspaceCallbackEvent = Awaited<ReturnType<typeof subspace.callbackEvent.get>>;
