import { awaitConfig } from '@metorial/frontend-config';
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

let getDashboardApiUrl = async (path: string) => {
  let config = await awaitConfig();
  let url = new URL(config.apiUrl);
  let metorialInstance = url.searchParams.get('_metorial_instance') || 'external';
  let basePath = url.pathname.replace(/\/$/, '');

  url.pathname = `${basePath}/${path.replace(/^\//, '')}`;
  url.search = '';
  url.searchParams.set('_m', metorialInstance);

  return url;
};

export let createIntegrationSetupSession = async (input: IntegrationSetupSessionCreateInput) =>
  withAuth(async () => {
    let url = await getDashboardApiUrl(
      `dashboard/instances/${input.instanceId}/integration-setup-sessions`
    );

    let response = await fetch(url.toString(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Metorial-Version': '2025-01-01-dashboard'
      },
      body: JSON.stringify({
        integration_id: input.integrationId,
        name: input.name,
        description: input.description,
        configuration: {
          tool_filters: {
            enabled: !!input.toolFiltersEnabled
          }
        }
      })
    });

    if (!response.ok) {
      let body = await response.json().catch(() => null);
      throw new Error(body?.message ?? 'Failed to create integration setup session.');
    }

    return (await response.json()) as IntegrationSetupSessionCreateOutput;
  });

export let useCreateIntegrationSetupSession = () =>
  useMutation(
    useMemo(
      () => (input: IntegrationSetupSessionCreateInput) =>
        createIntegrationSetupSession(input),
      []
    ),
    { disableToast: true }
  );
