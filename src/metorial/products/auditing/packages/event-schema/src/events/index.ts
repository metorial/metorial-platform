import { combineEventSets } from '../_lib/event';
import { coreEvents } from './core';

export let webhookEvents = combineEventSets(coreEvents);
export type WebhookEvents = typeof webhookEvents;
export type WebhookEventName = keyof WebhookEvents;
