import { enrichSessionParticipantsWithConsumer } from '../lib/enrichSessionParticipants';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionParticipantService = createSubspaceService(
  subspace.sessionParticipant,
  ['get', 'list'],
  inner => ({
    get: async (...params: Parameters<typeof inner.get>) => {
      let participant = await inner.get(...params);
      let [enriched] = await enrichSessionParticipantsWithConsumer({
        instanceOid: params[0].instance.oid,
        participants: [participant]
      });
      return enriched!;
    },
    list: async (
      input: Parameters<typeof inner.list>[0] & { accessTagSessionIds?: string[] }
    ) => {
      let sessionIds = narrowSessionIdFilter({
        allowedSessionIds: input.accessTagSessionIds,
        requestedSessionIds: input.sessionIds
      });

      let paginator = await inner.list({
        ...input,
        sessionIds
      });

      return paginator.map(items =>
        enrichSessionParticipantsWithConsumer({
          instanceOid: input.instance.oid,
          participants: items
        })
      );
    }
  })
);

export type SubspaceSessionParticipant = Awaited<
  ReturnType<typeof subspace.sessionParticipant.get>
> & { consumerId?: string | null };
