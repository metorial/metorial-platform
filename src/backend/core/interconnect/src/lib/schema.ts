import { v, ValidationTypeValue } from '@metorial/validation';

export let requestSchema = v.object({
  metorialInterconnect: v.literal('1.0'),
  type: v.literal('request'),
  id: v.string(),
  method: v.string(),
  params: v.record(v.any())
});

export let notificationSchema = v.object({
  metorialInterconnect: v.literal('1.0'),
  type: v.literal('notification'),
  method: v.string(),
  params: v.record(v.any())
});

export let responseSuccessSchema = v.object({
  metorialInterconnect: v.literal('1.0'),
  type: v.literal('response'),
  id: v.string(),
  result: v.record(v.any())
});

export let responseErrorSchema = v.object({
  metorialInterconnect: v.literal('1.0'),
  type: v.literal('response/error'),
  id: v.string(),
  error: v.object({
    code: v.number(),
    message: v.string(),
    data: v.optional(v.record(v.any()))
  })
});

export let messageSchema = v.union([
  requestSchema,
  notificationSchema,
  responseSuccessSchema,
  responseErrorSchema
]);

export type MICMessage = ValidationTypeValue<typeof messageSchema>;
export type MICRequestMessage = ValidationTypeValue<typeof requestSchema>;
export type MICNotificationMessage = ValidationTypeValue<typeof notificationSchema>;
export type MICResponseMessage = ValidationTypeValue<
  typeof responseSuccessSchema | typeof responseErrorSchema
>;
export type MICResponseSuccessMessage = ValidationTypeValue<typeof responseSuccessSchema>;
export type MICResponseErrorMessage = ValidationTypeValue<typeof responseErrorSchema>;
