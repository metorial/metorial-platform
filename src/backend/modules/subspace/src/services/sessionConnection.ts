import { enrichSessionParticipantsWithConsumer } from '../lib/enrichSessionParticipants';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionConnectionService = createSubspaceService(
  subspace.sessionConnection,
  ['get', 'list'],
  inner => ({
    get: async (...params: Parameters<typeof inner.get>) => {
      let sessionConnection = await inner.get(...params);

      if (!sessionConnection.participant) return sessionConnection;

      let [participant] = await enrichSessionParticipantsWithConsumer({
        instanceOid: params[0].instance.oid,
        participants: [sessionConnection.participant]
      });

      return {
        ...sessionConnection,
        participant
      };
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

      return paginator.map(async items => {
        let participants = await enrichSessionParticipantsWithConsumer({
          instanceOid: input.instance.oid,
          participants: items.map(item => item.participant).filter(Boolean)
        });

        let participantMap = new Map(participants.map(participant => [participant.id, participant]));

        return items.map(item => ({
          ...item,
          participant: item.participant ? participantMap.get(item.participant.id) ?? item.participant : null
        }));
      });
    }
  })
);

export type SubspaceSessionConnection = Awaited<
  ReturnType<typeof subspace.sessionConnection.get>
>;
