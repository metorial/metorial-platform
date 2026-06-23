import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionEventService = createSubspaceService(
  subspace.sessionEvent,
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

export type SubspaceSessionEvent = Awaited<ReturnType<typeof subspace.sessionEvent.get>>;
export type SubspaceSessionWarning = NonNullable<SubspaceSessionEvent['warning']>;
