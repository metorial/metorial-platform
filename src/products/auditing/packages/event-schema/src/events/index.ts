import { coreEvents } from './core';

export { type ChatEventName, chatEventNames, chatEvents } from './chat';

export let webhookEvents = coreEvents;
export type WebhookEvents = typeof webhookEvents;
export type WebhookEventName = keyof WebhookEvents;
