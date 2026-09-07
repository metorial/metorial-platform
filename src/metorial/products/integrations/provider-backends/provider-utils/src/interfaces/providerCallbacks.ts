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

  abstract deleteWebhookRegistration(
    data: WebhookRegistrationDeleteParam
  ): Promise<WebhookRegistrationDeleteRes>;

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

export interface WebhookRegistrationDeleteParam {
  tenant: Tenant;
  webhookRegistration: WebhookRegistration;
}

export interface WebhookRegistrationDeleteRes {}

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

  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: { encoding: 'base64'; content: string } | null;
  };

  receivedAt: Date;
}
