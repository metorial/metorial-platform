import type {
  Provider,
  ProviderDeployment,
  ProviderDeploymentVersion,
  ProviderVariant,
  ProviderVersion,
  SlateCallbackConfig,
  Tenant
} from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderCallbackConfig extends IProviderFunctionality {
  abstract getCallbackConfigSchema(
    data: CallbackConfigSchemaGetParam
  ): Promise<CallbackConfigSchemaGetRes>;
  abstract createCallbackConfig(
    data: CallbackConfigCreateParam
  ): Promise<CallbackConfigCreateRes>;
  abstract createNextCallbackConfig(
    data: CallbackConfigCreateNextParam
  ): Promise<CallbackConfigCreateRes>;
  abstract deleteCallbackConfig(
    data: CallbackConfigDeleteParam
  ): Promise<CallbackConfigDeleteRes>;
}

export type CallbackConfigDeployment = ProviderDeployment & {
  currentVersion:
    | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
    | null;
};

export interface CallbackConfigBaseParam {
  tenant: Tenant;
  provider: Provider;
  providerVariant: ProviderVariant;
  deployment: CallbackConfigDeployment;
  triggerIds: string[];
}

export interface CallbackConfigSchemaGetParam extends CallbackConfigBaseParam {}

export interface CallbackConfigSchemaGetRes {
  schema: Record<string, any> | null;
}

export interface CallbackConfigCreateParam extends CallbackConfigBaseParam {
  values: Record<string, string>;
}

export interface CallbackConfigBacking {
  slateCallbackConfigOid?: bigint | null;
}

export interface CallbackConfigCreateNextParam extends CallbackConfigBaseParam {
  previousBacking: CallbackConfigBacking;
  valuesPatch: Record<string, string>;
}

export interface CallbackConfigCreateRes {
  slateCallbackConfig?: SlateCallbackConfig | null;
  configuredKeys: string[];
}

export interface CallbackConfigDeleteParam {
  tenant: Tenant;
  backing: CallbackConfigBacking;
}

export interface CallbackConfigDeleteRes {}
