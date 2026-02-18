import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionParticipantService = createSubspaceService(
  subspace.sessionParticipant,
  ['get', 'list'],
  () => ({})
);

export type SubspaceSessionParticipant = Awaited<ReturnType<typeof subspace.sessionParticipant.get>>;
