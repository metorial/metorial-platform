import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Environment, Tenant } from '@metorial-subspace/db';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import { type MetorialFacing, resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';

export type CallProviderPublicToolParams = {
  providerId: string;
  providerVersionId?: string;

  toolKey: string;
  input: Record<string, any>;

  caller?: {
    id: string;
    name: string;
    description?: string;
  };
};

class providerPublicToolCallServiceImpl {
  async callPublicTool(d: MetorialFacing<CallProviderPublicToolParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.callPublicToolInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async callPublicToolInternal(
    d: { tenant: Tenant; environment: Environment } & CallProviderPublicToolParams
  ) {
    let provider = await providerService.getProviderByIdInternal({
      providerId: d.providerId,
      tenant: d.tenant,
      environment: d.environment
    });

    let providerVariant = provider.defaultVariant;
    if (!providerVariant) {
      throw new ServiceError(notFoundError('provider.variant'));
    }

    let providerVersion = d.providerVersionId
      ? await providerVersionService.getProviderVersionByIdInternal({
          providerVersionId: d.providerVersionId,
          tenant: d.tenant,
          environment: d.environment
        })
      : providerVariant.currentVersion;

    if (!providerVersion) {
      throw new ServiceError(
        badRequestError({ message: 'Provider does not have a current version set.' })
      );
    }
    if (providerVersion.providerOid !== provider.oid) {
      throw new ServiceError(notFoundError('provider.version', d.providerVersionId));
    }

    let backend = await getBackend({ entity: providerVersion });

    return backend.providerRun.callPublicTool({
      tenant: d.tenant,
      provider,
      providerVariant,
      providerVersion,
      toolKey: d.toolKey,
      input: d.input,
      caller: d.caller
    });
  }
}

export let providerPublicToolCallService = Service.create(
  'providerPublicToolCallService',
  () => new providerPublicToolCallServiceImpl()
).build();
