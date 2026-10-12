import { DetailsOverviewLayout } from '@metorial/details-layout';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProvider, useProviderDeployment } from '@metorial/state';
import { Attributes, Badge, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ConfigurationsDeploymentOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);

  return renderWithLoader({ deployment, provider })(({ deployment, provider }) => (
    <DetailsOverviewLayout>
      <>
        <Attributes
          itemWidth="300px"
          attributes={[
            {
              label: 'Name',
              content: deployment.data.name ?? '—'
            },
            {
              label: 'Provider',
              content: provider.data?.name ?? deployment.data.providerId
            },
            {
              label: 'Pinned Version',
              content: deployment.data.lockedVersion ? (
                <Badge color="blue">
                  {deployment.data.lockedVersion.name} ({deployment.data.lockedVersion.version}
                  )
                </Badge>
              ) : (
                <Badge color="gray">Latest</Badge>
              )
            },
            {
              label: 'Updated At',
              content: <RenderDate date={deployment.data.updatedAt!} />
            }
          ]}
        />

        <Spacer height={20} />

        <Box title="Recent Sessions" description="Latest sessions using this deployment.">
          <ProviderSessionsTable providerDeploymentId={deployment.data.id} />
        </Box>
      </>
    </DetailsOverviewLayout>
  ));
};
