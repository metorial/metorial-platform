import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionParticipantService = createSubspaceService(
  subspace.sessionParticipant,
  ['get', 'list'],
  inner => ({
    list: async (
      input: Parameters<typeof inner.list>[0] & { accessTagSessionIds?: string[] }
    ) => {
      let sessionIds = narrowSessionIdFilter({
        allowedSessionIds: input.accessTagSessionIds,
        requestedSessionIds: input.sessionIds
      });

      return await inner.list({
        ...input,
        sessionIds
      });
    }
  })
);

export type SubspaceSessionParticipant = Awaited<
  ReturnType<typeof subspace.sessionParticipant.get>
>;
