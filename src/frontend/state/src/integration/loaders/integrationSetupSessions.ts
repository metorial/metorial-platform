import { useMutation } from '@metorial/data-hooks';
import { useMemo } from 'react';
import { withAuth } from '../../user';

export type IntegrationSetupSessionCreateInput = {
  instanceId: string;
  integrationId: string;
  name: string;
  description?: string;
  toolFiltersEnabled?: boolean;
};

export type IntegrationSetupSessionCreateOutput = {
  id: string;
  url: string;
  status: string;
};

export let createIntegrationSetupSession = async (input: IntegrationSetupSessionCreateInput) =>
  withAuth(sdk =>
    sdk.integration.setupSessions.create(input.instanceId, {
      integrationId: input.integrationId,
      name: input.name,
      description: input.description,
      configuration: {
        toolFilters: {
          enabled: !!input.toolFiltersEnabled
        }
      }
    })
  );

export let useCreateIntegrationSetupSession = () =>
  useMutation(
    useMemo(
      () => (input: IntegrationSetupSessionCreateInput) =>
        createIntegrationSetupSession(input),
      []
    ),
    { disableToast: true }
  );
