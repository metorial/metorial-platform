import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { type ChatAdapterInstance } from '@metorial-subspace/adapter-chat';

export type ChatCapability = Parameters<ChatAdapterInstance['isCapabilityAvailable']>[0];

export let hasChatCapability = (client: ChatAdapterInstance, capability: ChatCapability) =>
  client.isCapabilityAvailable(capability);

export interface AssertChatCapabilityOptions {
  code?: string;
  message?: string;
}

export let assertChatCapability = (
  client: ChatAdapterInstance,
  capability: ChatCapability,
  options: AssertChatCapabilityOptions = {}
) => {
  if (hasChatCapability(client, capability)) return;

  throw new ServiceError(
    badRequestError({
      code: options.code ?? `chat_${capability}_not_supported`,
      message: options.message ?? `This chat provider does not support "${capability}".`
    })
  );
};

export interface ChatCapabilityFallback<T> {
  provider: () => T;
  fallback: () => T;
}

export let withChatCapabilityFallback = <T>(
  client: ChatAdapterInstance,
  capability: ChatCapability,
  handlers: ChatCapabilityFallback<T>
): T => (hasChatCapability(client, capability) ? handlers.provider() : handlers.fallback());

export let requireLocalChatEntity = <T>(
  entity: string,
  entityId: string,
  local: T | null
): T => {
  if (local == null) throw new ServiceError(notFoundError(entity, entityId));
  return local;
};
