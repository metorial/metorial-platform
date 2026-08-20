import { randomUUID } from 'node:crypto';

export let CALLBACK_DASHBOARD_TEST_EVENT = {
  route: 'callbacks/:callbackId/instances/:callbackInstanceId/test-event',
  sdkPath: 'callbacks.instances.sendTestEvent',
  scope: 'instance.callback:write',
  confidential: true
} as const;

export let sendDashboardTestCallbackEvent = async <Instance, Output>(
  d: {
    instance: Instance;
    callbackId: string;
    callbackInstanceId: string;
    eventType: string;
    payload: Record<string, unknown>;
  },
  service: {
    sendDashboardTestEvent: (input: {
      instance: Instance;
      callbackId: string;
      callbackInstanceId: string;
      eventId: string;
      eventType: string;
      payloadJson: string;
    }) => Promise<Output>;
  },
  generateEventId: () => string = () => `dashboard_test:${randomUUID()}`
) => {
  // Generate once above the retrying RPC client. Every transport retry for this
  // dashboard action therefore carries the same server-owned event identity.
  let eventId = generateEventId();

  return await service.sendDashboardTestEvent({
    instance: d.instance,
    callbackId: d.callbackId,
    callbackInstanceId: d.callbackInstanceId,
    eventId,
    eventType: d.eventType,
    payloadJson: JSON.stringify(d.payload)
  });
};
