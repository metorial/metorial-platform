import type {
  Callback,
  CallbackEvent,
  CallbackInstance,
  Provider,
  ProviderAuthConfigVersion,
  ProviderConfigVersion,
  ProviderVariant,
  Tenant,
  WebhookRegistration
} from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderCallbacks extends IProviderFunctionality {
  abstract createCallback(data: CallbackCreateParam): Promise<CallbackCreateRes>;

  abstract updateCallback(data: CallbackUpdateParam): Promise<CallbackUpdateRes>;

  abstract deleteCallback(data: CallbackDeleteParam): Promise<CallbackDeleteRes>;

  abstract createCallbackInstance(
    data: CallbackInstanceCreateParam
  ): Promise<CallbackInstanceCreateRes>;

  abstract deleteCallbackInstance(
    data: CallbackInstanceDeleteParam
  ): Promise<CallbackInstanceDeleteRes>;

  abstract createWebhookRegistration(
    data: WebhookRegistrationCreateParam
  ): Promise<WebhookRegistrationCreateRes>;

  abstract finishWebhookRegistrationSetup(
    data: WebhookRegistrationSetupFinishParam
  ): Promise<WebhookRegistrationSetupFinishRes>;

  abstract updateWebhookRegistration(
    data: WebhookRegistrationUpdateParam
  ): Promise<WebhookRegistrationUpdateRes>;

  abstract deleteWebhookRegistration(
    data: WebhookRegistrationDeleteParam
  ): Promise<WebhookRegistrationDeleteRes>;

  abstract listWebhookEvents(data: WebhookEventListParam): Promise<WebhookEventListRes>;

  abstract getWebhookEvent(data: WebhookEventGetParam): Promise<ProviderWebhookEvent>;

  abstract getManyEvents(data: CallbackEventGetManyParam): Promise<CallbackEventGetManyRes>;

  abstract getManyWebhookEvents(
    data: CallbackWebhookEventGetManyParam
  ): Promise<CallbackWebhookEventGetManyRes>;
}

export interface CallbackCreateParam {
  tenant: Tenant;
  provider: Provider;
  providerVariant: ProviderVariant;
  callback: Callback;
}

export interface CallbackCreateRes {}

export interface CallbackUpdateParam {
  tenant: Tenant;
  callback: Callback;
  input: {
    name?: string;
    description?: string | null;
  };
}

export interface CallbackUpdateRes {}

export interface CallbackDeleteParam {
  tenant: Tenant;
  callback: Callback;
}

export interface CallbackDeleteRes {}

export interface CallbackInstanceCreateParam {
  tenant: Tenant;
  callback: Callback;
  callbackInstance: CallbackInstance;
  configVersion: ProviderConfigVersion;
  authConfigVersion: ProviderAuthConfigVersion | null;
}

export interface CallbackInstanceCreateRes {}

export interface CallbackInstanceDeleteParam {
  tenant: Tenant;
  callback: Callback;
  callbackInstance: CallbackInstance;
}

export interface CallbackInstanceDeleteRes {}

export interface WebhookRegistrationCreateParam {
  tenant: Tenant;
  provider: Provider;
  providerVariant: ProviderVariant;
  webhookRegistration: WebhookRegistration;
}

export interface WebhookRegistrationCreateRes {
  receiveUrl: string;
  setup: PrismaJson.WebhookRegistrationSetup;
}

export interface WebhookRegistrationSetupFinishParam {
  tenant: Tenant;
  webhookRegistration: WebhookRegistration;
  userConfig: Record<string, any>;
}

export interface WebhookRegistrationSetupFinishRes {
  receiveUrl: string;
}

export interface WebhookRegistrationUpdateParam {
  tenant: Tenant;
  webhookRegistration: WebhookRegistration;
  input: {
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
  };
}

export interface WebhookRegistrationUpdateRes {}

export interface WebhookRegistrationDeleteParam {
  tenant: Tenant;
  webhookRegistration: WebhookRegistration;
}

export interface WebhookRegistrationDeleteRes {}

export interface WebhookEventListParam {
  tenant: Tenant;
  webhookRegistrations?: WebhookRegistration[];
  providers?: Provider[];
  statuses?: string[];
  input: {
    limit: number;
    after?: string;
    before?: string;
    order: 'asc' | 'desc';
  };
}

export interface WebhookEventListRes {
  items: ProviderWebhookEvent[];
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
}

export interface WebhookEventGetParam {
  tenant: Tenant;
  webhookEventId: string;
}

export interface ProviderWebhookEventRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: { encoding: 'base64'; content: string } | null;
}

export interface ProviderWebhookEvent {
  id: string;

  status: string;
  attemptCount: number;

  request: ProviderWebhookEventRequest | null;

  provider: Provider;

  webhookRegistrationOid: bigint | null;

  receivedAt: Date;
}

export interface CallbackEventGetManyParam {
  tenant: Tenant;
  callbackEvents: CallbackEvent[];
}

export interface CallbackEventGetManyRes {
  events: ProviderCallbackEvent[];
}

export interface ProviderCallbackEvent {
  callbackEventOid: bigint;

  status: string;
  payload: Record<string, any> | null;
  attemptCount: number;
  error: { code: string; message: string } | null;

  hasWebhookEvent: boolean;
}

export interface CallbackWebhookEventGetManyParam {
  tenant: Tenant;
  callbackEvents: CallbackEvent[];
}

export interface CallbackWebhookEventGetManyRes {
  webhookEvents: ProviderCallbackWebhookEvent[];
}

export interface ProviderCallbackWebhookEvent {
  callbackEventOid: bigint;

  status: string;
  attemptCount: number;

  /** Null once the backend has aged the raw request out of hot storage. */
  request: ProviderWebhookEventRequest | null;

  receivedAt: Date;
}

/**
 * Inbound port for a provider backend that receives callback events pushed from its own
 * infrastructure. Injected by the API layer rather than imported, so backends never depend on
 * the callback module that calls into them.
 */
export type CallbackEventRecorder = (d: {
  callbackInstance: CallbackInstance;
  source: 'webhook' | 'polling';
  providerTriggerKey: string;
  mappedType?: string;
  mappedId?: string;
  occurredAt: Date;
}) => Promise<{ oid: bigint }>;
