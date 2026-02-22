import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConfig, useProviderDeployment } from '@metorial/state';
import { Attributes, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderConfigOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId, providerConfigId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let config = useProviderConfig(instance.data?.id, providerDeploymentId, providerConfigId);

  return renderWithLoader({ config })(({ config }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: config.data.name ?? '—'
          },
          {
            label: 'Description',
            content: config.data.description ?? '—'
          },
          {
            label: 'ID',
            content: <ID id={config.data.id} />
          },
          {
            label: 'Provider',
            content: deployment.data?.providerId ?? '—'
          },
          {
            label: 'Deployment',
            content: deployment.data?.name ?? '—'
          },
          {
            label: 'Created',
            content: config.data.createdAt ? <RenderDate date={config.data.createdAt} /> : '—'
          },
          {
            label: 'Updated',
            content: config.data.updatedAt ? <RenderDate date={config.data.updatedAt} /> : '—'
          }
        ]}
      />
    </>
  ));
};
