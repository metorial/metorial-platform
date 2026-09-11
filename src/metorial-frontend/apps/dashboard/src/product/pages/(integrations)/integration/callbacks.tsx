import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { PageHeaderSection } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  useIntegration
} from '@metorial/state';
import { Badge, Button, Callout, Flex, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { CallbackSyncBadge } from '../../../scenes/callbacks/shared';

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
      let callbackIds = providers.flatMap(provider =>
        provider.callbacks.callback ? [provider.callbacks.callback.id] : []
      );

      let rows = providers.map(provider => {
        let callback = provider.callbacks.callback;

        return {
          href: callback
            ? Paths.instance.callback(
                organization.data,
                project.data,
                instance.data,
                callback.id
              )
            : undefined,
          data: [
            <Flex direction="column" gap={2} key="provider">
              <Text size="2" weight="strong">
                {callback?.name ?? provider.provider.name}
              </Text>
            </Flex>,
            callback ? (
              <CallbackSyncBadge key="sync" sync={callback.sync} />
            ) : (
              <Badge key="sync" color="orange">
                Registering
              </Badge>
            ),
            callback ? (
              <ID key="id" id={callback.id} />
            ) : (
              <Text size="2" color="gray600" key="id">
                -
              </Text>
            )
          ]
        };
      });

      return (
        <>
          {providers.length === 0 ? (
            <Callout color="orange">
              <span>
                Callbacks are no longer enabled for any provider in this integration. Turn them
                back on from the integration's provider settings.
              </span>
            </Callout>
          ) : (
            <PageHeaderSection
              title="Callbacks"
              description="When you enable callbacks for a provider, Metorial registers with the provider to receive events. You can view the configuration of each provider's callback below."
              actions={
                <Link
                  to={Paths.instance.callbacks(organization.data, project.data, instance.data)}
                >
                  <Button size="2" as="span" variant="outline">
                    All Callbacks
                  </Button>
                </Link>
              }
            >
              <Table headers={['Provider', 'Delivery', 'Callback ID']} data={rows} />
            </PageHeaderSection>
          )}

          {/* <Spacer height={50} />

          <PageHeaderSection
            title="Events"
            description="Provider events recorded for this integration's callbacks."
          >
            <PaginationSearchParamsProvider enabled={true}>
              <CallbackEventsTable
                instanceId={instance.data.id}
                filters={{ integrationId: integration.data.id }}
                emptyState="No events have been recorded for this integration yet."
              />
            </PaginationSearchParamsProvider>
          </PageHeaderSection> */}
        </>
      );
    }
  );
};
