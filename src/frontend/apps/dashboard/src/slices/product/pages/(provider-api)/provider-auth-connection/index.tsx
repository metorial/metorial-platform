import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderAuthConfig,
  useProviderDeployment
} from '@metorial/state';
import { Attributes, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

let formatType = (type: string | null | undefined) => {
  if (type === 'oauth_automated') return 'OAuth (Automated)';
  if (type === 'oauth_manual') return 'OAuth (Manual)';
  if (type === 'manual') return 'Manual';
  return '—';
};

export let ProviderAuthConnectionOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId, providerAuthConfigId } = useParams();
  let deployment = useProviderDeployment(instance.data?.instanceId, providerDeploymentId);
  let authConfig = useProviderAuthConfig(
    instance.data?.instanceId,
    providerDeploymentId,
    providerAuthConfigId
  );

  return renderWithLoader({ authConfig })(({ authConfig }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: authConfig.data.name ?? '—'
          },
          {
            label: 'Description',
            content: authConfig.data.description ?? '—'
          },
          {
            label: 'ID',
            content: <ID id={authConfig.data.id} />
          },
          {
            label: 'Type',
            content: formatType(authConfig.data.type)
          },
          {
            label: 'Status',
            content: authConfig.data.status ?? '—'
          },
          {
            label: 'Provider',
            content: deployment.data?.provider?.name ?? deployment.data?.providerId ?? '—'
          },
          {
            label: 'Deployment',
            content: deployment.data?.name ?? '—'
          },
          {
            label: 'Ephemeral',
            content: authConfig.data.isEphemeral ? 'Yes' : 'No'
          },
          {
            label: 'Created',
            content: authConfig.data.createdAt ? (
              <RenderDate date={authConfig.data.createdAt} />
            ) : (
              '—'
            )
          },
          {
            label: 'Updated',
            content: authConfig.data.updatedAt ? (
              <RenderDate date={authConfig.data.updatedAt} />
            ) : (
              '—'
            )
          }
        ]}
      />
    </>
  ));
};
