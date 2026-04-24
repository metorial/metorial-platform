import {
  type ProviderInvocationGetParam,
  IProviderInvocation,
  type ProviderInvocationListParam,
  type ProviderInvocationListRes
} from '@metorial-subspace/provider-utils';

export class ProviderInvocation extends IProviderInvocation {
  override async listProviderInvocations(
    _data: ProviderInvocationListParam
  ): Promise<ProviderInvocationListRes> {
    return {
      items: []
    };
  }

  override async getProviderInvocation(
    _data: ProviderInvocationGetParam
  ): Promise<null> {
    return null;
  }
}
