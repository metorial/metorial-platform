import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList, defineStatus, withDefaults } from '@metorial/data-list';
import {
  useCurrentInstance,
  useCustomProvider,
  useCustomProviderDeployments
} from '@metorial/state';
import { useParams } from 'react-router-dom';
import { useInstanceContext } from '../../../lib/dataList';

let deploymentStatus = defineStatus({
  queued: { label: 'Queued', color: 'orange' },
  deploying: { label: 'Deploying', color: 'orange' },
  succeeded: { label: 'Succeeded', color: 'green' },
  deployed: { label: 'Succeeded', color: 'green' },
  completed: { label: 'Succeeded', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
  deployment_failed: { label: 'Failed', color: 'red' }
});

let CustomProviderDeploymentsList = createDataList<{ customProviderId: string }>(
  'custom-provider-deployments'
)
  .context(useInstanceContext)
  .paginated(({ props, ctx, limit }) =>
    useCustomProviderDeployments(
      ctx.instanceId,
      props.customProviderId,
      withDefaults({ order: 'desc' as const }, { limit })
    )
  )
  .columns([
    col.status(deploymentStatus),
    col.text({ id: 'message', header: 'Message', get: row => row.commit?.message }),
    col.text({ id: 'trigger', header: 'Trigger', get: row => row.trigger ?? 'manual' }),
    col.text({ id: 'actor', header: 'Actor', get: row => row.actor?.name ?? 'System' }),
    col.createdAt(),
    col.id({ isDefault: false })
  ])
  .build();

export let CustomProviderCommitsPage = () => {
  let instance = useCurrentInstance();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);

  return renderWithLoader({ customProvider })(({ customProvider }) => (
    <CustomProviderDeploymentsList
      customProviderId={customProvider.data.id}
      listVariant="embedded"
      emptyState="No commits found."
    />
  ));
};
