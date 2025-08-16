import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomServer, useCustomServerEvents } from '@metorial/state';
import { Attributes, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { UsageScene } from '../../../scenes/usage/usage';

export let CustomServerOverviewPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  let events = useCustomServerEvents(
    instance.data?.id,
    customServer.data?.id ?? customServerId
  );

  return renderWithLoader({ customServer, events })(({ customServer, events }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: customServer.data.name
          },
          {
            label: 'Type',
            content: {
              remote: 'Remote Server'
            }[customServer.data.type]
          },
          {
            label: 'ID',
            content: <ID id={customServer.data.id} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={customServer.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how often this custom server is used."
        entities={[{ type: 'server', id: customServer.data.server.id }]}
        entityNames={{ [customServer.data.server.id]: customServer.data.name! }}
      />

      <Spacer height={15} />

      <Box title="Connection Events" description="Important events about this custom server.">
        <Table
          headers={['Event', 'Message', 'Created']}
          data={events.data.items.map(event => ({
            data: [
              <Text size="2" weight="strong">
                {
                  {
                    remote_connection_issue: 'Remote Connection Issue'
                  }[event.type]
                }
              </Text>,
              <Text size="2" weight="strong">
                {event.message}
              </Text>,
              <RenderDate date={event.createdAt} />
            ],
            href: Paths.instance.customServer(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              event.id
            )
          }))}
        />

        {events.data.items.length == 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No recent events for this custom server.
          </Text>
        )}
      </Box>
    </>
  ));
};
