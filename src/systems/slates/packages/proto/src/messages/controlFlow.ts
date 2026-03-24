import z from 'zod';
import { slatesParticipant } from '../types';

export let slatesMessageHelloNotification = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('slates/hello'),
  params: z.object({
    protocol: z.literal('slates@2026-01-01')
  })
});

export type SlatesMessageHelloNotification = z.infer<typeof slatesMessageHelloNotification>;

export let slatesMessageSetParticipantsNotification = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('slates/participant.set'),
  params: z.object({
    participants: z.array(slatesParticipant)
  })
});

export type SlatesMessageSetParticipantsNotification = z.infer<
  typeof slatesMessageSetParticipantsNotification
>;

export let slatesMessageSessionStartNotification = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('slates/session.start'),
  params: z.object({
    sessionId: z.string(),
    state: z.record(z.string(), z.any())
  })
});

export type SlatesMessageSessionStartNotification = z.infer<
  typeof slatesMessageSessionStartNotification
>;

export type SlatesControlFlowNotifications =
  | SlatesMessageHelloNotification
  | SlatesMessageSetParticipantsNotification
  | SlatesMessageSessionStartNotification;

export let slatesControlFlowNotificationsByMethod = {
  'slates/hello': slatesMessageHelloNotification,
  'slates/participant.set': slatesMessageSetParticipantsNotification,
  'slates/session.start': slatesMessageSessionStartNotification
};
