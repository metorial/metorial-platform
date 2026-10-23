import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider,
  useProviderConfig,
  useSessions
} from '@metorial/state';
import { Attributes, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { ResourceOwnerEntity } from '../../../components/resourceOwnerEntity';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';

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
    <DetailsOverviewLayout>
      <>
        {config.data.ownerActor && (
          <>
            <ResourceOwnerEntity resource={config.data} />
            <Spacer height={15} />
          </>
        )}

        <Attributes
          itemWidth="300px"
          attributes={[
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
            }
          ]}
        />

        <Spacer height={15} />

        <Box
          title="Recent Sessions"
          description="Latest sessions currently using this configuration."
        >
          <ProviderSessionsTable providerConfigId={config.data.id} />
        </Box>
      </>
    </DetailsOverviewLayout>
  ));
};
