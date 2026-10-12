import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { useCurrentInstance, useProvider, useProviderDeployment } from '@metorial/state';
import { Attributes, Badge, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';

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
