import { createSubspacePublicService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceAdminProviderTelemetryService = createSubspacePublicService(
  subspace.adminProviderTelemetry as any,
  [
    'listProviders',
    'getProvider',
    'updateProvider',
    'getTelemetry',
    'listErrorGroups',
    'getErrorGroup',
    'listRuns',
    'getRunLogs',
    'listAuthLogs',
    'listProviderVersionDeployments',
    'getSession',
    'listSessionMessages',
    'listSessionRuns',
    'listSessionInvocations',
    'getProviderInvocation',
    'getSessionTrace',
    'compareVersions'
  ],
  () => ({})
) as any;

export type SubspaceAdminProviderTelemetryProvider = Awaited<
  ReturnType<typeof subspace.adminProviderTelemetry.getProvider>
>;
