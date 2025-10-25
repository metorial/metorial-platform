import { Callback, CallbackEventType, db, ID } from '@metorial/db';
import { Service } from '@metorial/service';
import { processEventQueue } from '../queue/processEvent';

class callbackHandlerServiceImpl {
  async handleCallback(d: { callback: Callback; payload: any; type: CallbackEventType }) {
    let event = await db.callbackEvent.create({
      data: {
        id: await ID.generateId('callbackEvent'),
        type: d.type,
        status: 'pending',
        payloadIncoming: JSON.stringify(d.payload),
        callbackOid: d.callback.oid
      }
    });

    await processEventQueue.add({ eventId: event.id });

    return event;
  }

  async handleWebhookCallback(d: {
    key: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    method: string;
  }) {
    let callbackHook = await db.callbackHook.findFirst({
      where: { key: d.key },
      include: { callback: true }
    });
    if (!callbackHook) throw new Error('Invalid callback key');

    return await this.handleCallback({
      callback: callbackHook.callback,
      type: 'webhook_received',
      payload: {
        url: d.url,
        headers: d.headers,
        body: d.body,
        method: d.method.toUpperCase()
      }
    });
  }
}

export let callbackHandlerService = Service.create(
  'callbackHandlerService',
  () => new callbackHandlerServiceImpl()
).build();
