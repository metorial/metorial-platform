import { createSubspacePublicService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceAdminProviderTelemetryService = createSubspacePublicService(
  subspace.adminProviderTelemetry,
  [
    'listProviders',
    'getProvider',
    'updateProvider',
    'getTelemetry',
    'listErrorGroups',
    'getErrorGroup',
    'listRuns',
    'listToolCalls',
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
);

export type SubspaceAdminProviderTelemetryProvider = Awaited<
  ReturnType<typeof subspace.adminProviderTelemetry.getProvider>
>;
