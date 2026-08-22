import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  IProviderCallbackConfig,
  type CallbackConfigCreateNextParam,
  type CallbackConfigCreateParam,
  type CallbackConfigCreateRes,
  type CallbackConfigDeleteParam,
  type CallbackConfigDeleteRes,
  type CallbackConfigSchemaGetParam,
  type CallbackConfigSchemaGetRes
} from '@metorial-subspace/provider-utils';

let unsupportedCallbackConfigError = () =>
  new ServiceError(
    badRequestError({
      code: 'callback_config_not_supported',
      message: 'This integration does not support callback configuration.'
    })
  );

export class ProviderCallbackConfig extends IProviderCallbackConfig {
  override async getCallbackConfigSchema(
    _data: CallbackConfigSchemaGetParam
  ): Promise<CallbackConfigSchemaGetRes> {
    return { schema: null };
  }

  override async createCallbackConfig(
    _data: CallbackConfigCreateParam
  ): Promise<CallbackConfigCreateRes> {
    throw unsupportedCallbackConfigError();
  }

  override async createNextCallbackConfig(
    _data: CallbackConfigCreateNextParam
  ): Promise<CallbackConfigCreateRes> {
    throw unsupportedCallbackConfigError();
  }

  override async deleteCallbackConfig(
    _data: CallbackConfigDeleteParam
  ): Promise<CallbackConfigDeleteRes> {
    return {};
  }
}
