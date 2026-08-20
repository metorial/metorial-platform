import { managedProviderAuthCredentialsService } from '@metorial-subspace/module-auth';
import { managedProviderAuthCredentialsPresenter } from '@metorial-subspace/presenters';

type ResolveInput = Parameters<
  typeof managedProviderAuthCredentialsService.getManagedProviderAuthCredentialsById
>[0];

export let resolveManagedProviderAuthCredentialsControllerRecord = async (d: ResolveInput) =>
  await managedProviderAuthCredentialsService.getManagedProviderAuthCredentialsById(d);

export let presentManagedProviderAuthCredentialsControllerResponse = (
  record: Awaited<ReturnType<typeof resolveManagedProviderAuthCredentialsControllerRecord>>
) => managedProviderAuthCredentialsPresenter(record);

export let getManagedProviderAuthCredentialsControllerResponse = async (d: ResolveInput) =>
  presentManagedProviderAuthCredentialsControllerResponse(
    await resolveManagedProviderAuthCredentialsControllerRecord(d)
  );
