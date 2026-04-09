import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider,
  useProviderConfig,
  useSessions
} from '@metorial/state';
import { Attributes, Badge, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { Link, useLocation, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';
import { UsageScene } from '../../../scenes/usage/usage';
import { getFromDeployment, withFromDeployment } from '../fromDeployment';

let SummaryValue = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

export let ProviderConfigOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let location = useLocation();
  let fromDeployment = getFromDeployment(location.search);

  let { providerConfigId } = useParams();
  let config = useProviderConfig(instance.data?.id, providerConfigId);
  let provider = useProvider(instance.data?.id, config.data?.providerId ?? undefined);

  let sessions = useSessions(
    instance.data?.id && config.data?.id ? instance.data.id : null,
    config.data?.id
      ? {
          providerConfigId: config.data.id,
          order: 'desc'
        }
      : undefined
  );

  return renderWithLoader({ config })(({ config }) => (
    <>
      <Attributes
        itemWidth="300px"
        attributes={[
          {
            label: 'Type',
            content: config.data.isDefault ? (
              <Badge color="blue">Default</Badge>
            ) : (
              <Badge color="gray">Custom</Badge>
            )
          },
          {
            label: 'Source',
            content: config.data.fromVault ? (
              <SummaryValue>
                <Badge color="purple">Vault</Badge>
                <Link
                  to={withFromDeployment(
                    Paths.instance.providerConfigVault(
                      organization.data,
                      project.data,
                      instance.data,
                      config.data.fromVault.id
                    ),
                    fromDeployment
                  )}
                >
                  {config.data.fromVault.name ?? config.data.fromVault.id}
                </Link>
              </SummaryValue>
            ) : (
              'Direct'
            )
          },
          {
            label: 'Deployment',
            content: config.data.deployment ? (
              <Link
                to={Paths.instance.providerDeployment(
                  organization.data,
                  project.data,
                  instance.data,
                  config.data.deployment.id
                )}
              >
                {config.data.deployment.name ?? config.data.deployment.id}
              </Link>
            ) : (
              <Text size="2" color="gray600">
                Unlinked
              </Text>
            )
          },
          {
            label: 'Provider',
            content: provider.data?.name ?? '...'
          },
          {
            label: 'Config ID',
            content: <ID id={config.data.id} />
          },
          {
            label: 'Updated At',
            content: <RenderDate date={config.data.updatedAt} />
          }
        ]}
      />

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how this config is being used in your instance."
        entities={[{ type: 'provider_auth_config', id: config.data.id }]}
        entityNames={{
          [config.data.id]: config.data.name ?? config.data.id
        }}
      />

      <Spacer height={15} />

      <Box
        title="Recent Sessions"
        description="Latest sessions currently using this configuration."
      >
        <ProviderSessionsTable providerConfigId={config.data.id} />
      </Box>
    </>
  ));
};
