import { Service } from '@lowerdeck/service';
import { db } from '@metorial-subspace/db';
import { resolveChatEventPayload } from '../lib/resolveChatEventPayload';

class chatEventServiceImpl {
  async getManyChatEventPayloads(d: { chatEventIds: string[] }) {
    let payloads = new Map<string, Record<string, any> | null>();
    if (d.chatEventIds.length === 0) return payloads;

    let chatEvents = await db.chatEvent.findMany({
      where: { id: { in: d.chatEventIds } },
      select: { id: true, payload: true, payloadStorageKey: true }
    });

    for (let chatEvent of chatEvents) {
      payloads.set(chatEvent.id, await resolveChatEventPayload(chatEvent));
    }

    return payloads;
  }
}

export let chatEventService = Service.create(
  'chatEventService',
  () => new chatEventServiceImpl()
).build();
