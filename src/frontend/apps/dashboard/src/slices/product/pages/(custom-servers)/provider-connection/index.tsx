import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useProviderConnection,
  useProviderConnectionEvents
} from '@metorial/state';
import { Attributes, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { UsageScene } from '../../../scenes/usage/usage';

export let ProviderConnectionPage = () => {
  let instance = useCurrentInstance();

  let { providerConnectionId } = useParams();
  let providerConnection = useProviderConnection(instance.data?.id, providerConnectionId);

  let events = useProviderConnectionEvents(
    instance.data?.id,
    providerConnection.data?.id ?? providerConnectionId
  );

  return renderWithLoader({ providerConnection, events })(({ providerConnection, events }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: providerConnection.data.name
          },
          {
            label: 'Provider',
            content: providerConnection.data.provider.name
          },
          {
            label: 'ID',
            content: <ID id={providerConnection.data.id} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={providerConnection.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how often this connection is used to authenticate users."
        entities={[{ type: 'provider_oauth_connection', id: providerConnection.data.id }]}
        entityNames={{ [providerConnection.data.id]: providerConnection.data.name! }}
      />

      <Spacer height={15} />

      <Box title="Connection Events" description="Important events about this connection.">
        <Table
          headers={['Event', 'Message', 'Created']}
          data={events.data.items.map(events => ({
            data: [
              <Text size="2" weight="strong">
                {
                  {
                    errors: 'Error',
                    config_auto_updated: 'Config Auto Updated'
                  }[events.type]
                }
              </Text>,
              <Text size="2" weight="strong">
                {events.type == 'config_auto_updated' &&
                  'Metorial synchronized the provider configuration automatically.'}
                {events.type == 'errors' &&
                  `This connection has encountered a high number of errors recently.`}
              </Text>,
              <RenderDate date={events.createdAt} />
            ],
            href: Paths.instance.providerConnection(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              events.id
            )
          }))}
        />

        {events.data.items.length == 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No recent events for this connection.
          </Text>
        )}
      </Box>
    </>
  ));
};
