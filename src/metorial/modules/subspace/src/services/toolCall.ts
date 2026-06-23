import { Fabric } from '@metorial/fabric';
import { enrichSessionParticipantsWithConsumer } from '../lib/enrichSessionParticipants';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceToolCallService = createSubspaceService(
  subspace.toolCall,
  ['get', 'list', 'create'],
  inner => ({
    get: async (...params: Parameters<typeof inner.get>) => {
      let toolCall = await inner.get(...params);
      let participants = await enrichSessionParticipantsWithConsumer({
        instanceOid: params[0].instance.oid,
        participants: [toolCall.senderParticipant, toolCall.responderParticipant].filter(
          (participant): participant is NonNullable<typeof participant> => !!participant
        )
      });
      let participantMap = new Map(participants.map(participant => [participant.id, participant]));

      return {
        ...toolCall,
        senderParticipant: participantMap.get(toolCall.senderParticipant.id) ?? toolCall.senderParticipant,
        responderParticipant: toolCall.responderParticipant
          ? participantMap.get(toolCall.responderParticipant.id) ?? toolCall.responderParticipant
          : null
      };
    },
    list: async (...params: Parameters<typeof inner.list>) => {
      let paginator = await inner.list(...params);

      return paginator.map(async items => {
        let participants = await enrichSessionParticipantsWithConsumer({
          instanceOid: params[0].instance.oid,
          participants: items.flatMap(item =>
            [item.senderParticipant, item.responderParticipant].filter(
              (participant): participant is NonNullable<typeof participant> => !!participant
            )
          )
        });
        let participantMap = new Map(participants.map(participant => [participant.id, participant]));

        return items.map(item => ({
          ...item,
          senderParticipant:
            participantMap.get(item.senderParticipant.id) ?? item.senderParticipant,
          responderParticipant: item.responderParticipant
            ? participantMap.get(item.responderParticipant.id) ?? item.responderParticipant
            : null
        }));
      });
    },
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.tool_call.created:before', eventBase);

      let toolCall = await inner.create(...params);

      await Fabric.fire('provider.tool_call.created:after', { ...eventBase, toolCall });

      return toolCall;
    }
  })
);

export type SubspaceToolCall = Awaited<ReturnType<typeof subspace.toolCall.get>>;
