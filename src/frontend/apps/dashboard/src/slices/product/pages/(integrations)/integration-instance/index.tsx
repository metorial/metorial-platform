import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useIntegration,
  useIntegrationInstance
} from '@metorial/state';
import { Attributes, Badge, Callout, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { IntegrationInstanceProvidersManager } from '../../../scenes/integrations/providersManager';

let getIntegrationInstanceStatusColor = (status: string) => {
  if (status === 'active') return 'green';
  if (status === 'draft') return 'orange';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export let IntegrationInstanceOverviewPage = () => {
  let instance = useCurrentInstance();
  let { integrationInstanceId } = useParams();
  let integrationInstance = useIntegrationInstance(instance.data?.id, integrationInstanceId);
  let integration = useIntegration(instance.data?.id, integrationInstance.data?.integrationId);

  return renderWithLoader({ integrationInstance, integration })(
    ({ integrationInstance, integration }) => {
      let onComplete = () => integrationInstance.refetch();

      return (
        <>
          <Attributes
            itemWidth="360px"
            attributes={[
              { label: 'ID', content: <ID id={integrationInstance.data.id} /> },
              {
                label: 'Status',
                content: (
                  <Badge
                    color={getIntegrationInstanceStatusColor(integrationInstance.data.status)}
                  >
                    {capitalize(integrationInstance.data.status)}
                  </Badge>
                )
              },
              {
                label: 'Identity',
                content: integrationInstance.data.identityId ? (
                  <ID id={integrationInstance.data.identityId} />
                ) : (
                  '-'
                )
              }
            ]}
          />

          {integrationInstance.data.status === 'draft' ? (
            <>
              <Spacer height={20} />
              <Callout color="orange">
                This integration instance is still a draft and cannot be used yet. It first
                needs to be configured.
              </Callout>
            </>
          ) : null}

          <Spacer height={20} />

          <Box
            title="Providers"
            description="Review the providers attached to this integration and configure per-instance overrides where needed."
          >
            <IntegrationInstanceProvidersManager
              instanceId={instance.data!.id}
              integration={integration.data}
              integrationInstance={integrationInstance.data}
              onComplete={onComplete}
            />
          </Box>
        </>
      );
    }
  );
};
