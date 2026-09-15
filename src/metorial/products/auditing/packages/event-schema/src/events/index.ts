import { combineEventSets } from '../_lib/event';
import { chatEvents } from './chat';
import { coreEvents } from './core';

export { type ChatEventName, chatEventNames } from './chat';

export let webhookEvents = combineEventSets(coreEvents, chatEvents);
export type WebhookEvents = typeof webhookEvents;
export type WebhookEventName = keyof WebhookEvents;
