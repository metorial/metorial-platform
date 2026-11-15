import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList } from '@metorial/data-list';
import { DetailsTableLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  IntegrationPreview,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  useIntegration
} from '@metorial/state';
import { Badge, Callout } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { useInstanceContext } from '../../../lib/dataList';
import { CallbackSyncBadge } from '../../../scenes/callbacks/shared';

type ProviderCallbackRow = NonNullable<IntegrationPreview['providers']>[number] & {
  id: string;
};

let ProviderCallbacksList = createDataList<{ providers: ProviderCallbackRow[] }>(
  'integration-callbacks',
  { customizable: false }
)
  .context(useInstanceContext)
  .items(({ props }) => ({ items: props.providers }))
  .columns([
    col.text({
      id: 'provider',
      header: 'Provider',
      weight: 'strong',
      get: row => row.callbacks.callback?.name ?? row.provider.name
    }),
    col.custom({
      id: 'sync',
      header: 'Delivery',
      render: row =>
        row.callbacks.callback ? (
          <CallbackSyncBadge sync={row.callbacks.callback.sync} />
        ) : (
          <Badge color="orange">Registering</Badge>
        )
    }),
    col.refId('callbackId', row => row.callbacks.callback?.id, { header: 'Callback ID' })
  ])
  .link((row, _props, ctx) =>
    row.callbacks.callback
      ? Paths.instance.callback(
          ctx.organization,
          ctx.project,
          ctx.instance,
          row.callbacks.callback.id
        )
      : undefined
  )
  .build();

export let IntegrationCallbacksPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);

  return renderWithLoader({ integration, instance, organization, project })(
    ({ integration, instance, organization, project }) => {
      let providers = (integration.data.providers ?? []).filter(
        provider => provider.callbacks.status === 'enabled'
      );

      return (
        <DetailsTableLayout
          title="Callbacks"
          description="When you enable callbacks for a provider, Metorial registers with the provider to receive events. You can view the configuration of each provider's callback below."
        >
          {providers.length === 0 ? (
            <Callout color="orange">
              <span>
                Callbacks are no longer enabled for any provider in this integration. Turn them
                back on from the integration's provider settings.
              </span>
            </Callout>
          ) : (
            <ProviderCallbacksList
              listVariant="embedded"
              providers={providers.map(provider => ({
                ...provider,
                id: provider.provider.id
              }))}
            />
          )}
        </DetailsTableLayout>
      );
    }
  );
};
