import type { ProviderInvocation } from '@metorial-subspace/provider-utils';

export let providerInvocationPresenter = (invocation: ProviderInvocation) => ({
  object: 'provider_invocation',

  id: invocation.id,
  source: invocation.source,
  type: invocation.type,
  status: invocation.status,

  providerRunIds: invocation.providerRunIds,
  sessionMessageIds: invocation.sessionMessageIds,
  authConfigEventIds: invocation.authConfigEventIds,
  providerOAuthSetupIds: invocation.providerOAuthSetupIds,

  toolCallId: invocation.toolCallId,
  action: invocation.action,

  requests: invocation.requests,
  responses: invocation.responses,
  requestTraces: invocation.requestTraces,
  logs: invocation.logs,
  attachments: invocation.attachments,

  error: invocation.error,
  provider: invocation.provider,
  metadata: invocation.metadata,

  createdAt: invocation.createdAt
});
